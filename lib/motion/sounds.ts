// Every sound of a skill video, composed over the video by Web Audio. The MP4 carries a SILENT audio track only (iOS Safari lets Web Audio past the ringer switch while a video with sound plays).
// layers.json lists every cue (`sounds`: start, files, kind sfx | loop | voice, d3, event, end, mix, pool / option / roll) and the random choices behind them (`soundPools`). A cue's level is its `mix`:
// [frame, left, right] points that already hold the game's volume, the lowering while a voice sounds, the 3D distance and pan and the fade at a stop, so the player lowers nothing again. Per PLAY (the first
// start, each wrap of the loop and each restart after the tail) one option is picked in every pool, by the game's odds, and one of every cue's `files` at the same odds; a cue sounds when the option of its
// pool is the picked one (and its S1 / S2 chance `roll` picked option 0). Scheduling is against the video's media time: the frame sync (requestVideoFrameCallback: mediaTime + expectedDisplayTime) is turned
// into AudioContext time, and every cue due in the next LOOK seconds is started at its exact context time, its curve laid on a left and a right gain node. A seek, a pause or a wrap stops what sounds and
// schedules again from the new time (a cue that was already running starts in its middle, at the value of its curve there); a negative `start` skips that much of the file's front and plays from video time 0.
//
// The play-time rules the rendered files do not carry (sound_rules.json next to index.json):
//  - max instances of an event (the 8th Hit, the 4th tremor burst ...): the OLDEST instance is stolen (fades out over steal.fade); cues of one event in the same frame all play, inside that limit;
//  - the SFX bus limiter (a lookahead peak limiter in an AudioWorklet): sums above the ceiling are pulled down; the 3D events pass at ceiling3D;
//  - the output gain `output` (4): the library files are the game's output x 0.25, so the master multiplies back to the game's loudness.
// The effects and voice volume options sit on the buses (a cue's curve is the same for any option value). After the last picture frame the sound may run on (`tail` of layers.json): the scheduler goes on
// with the audio clock until the page plays the video again.
export interface SoundCue {
  start: number; files: string[]; seconds: number; kind?: "sfx" | "loop" | "voice"; d3?: boolean; event?: string; end?: number;
  /** [frame, left, right] points of the level, joined by straight lines; the first / last value holds outside them */
  mix: [number, number, number][];
  pool?: string; option?: number; roll?: string;
}
export interface SoundPoolMeta { id: string; kind: string; options: { weight: number; silence?: boolean }[]; }
export interface SoundMeta { fps: number; sounds?: SoundCue[]; soundPools?: SoundPoolMeta[]; }
export interface SoundRules {
  version: number;
  steal: { fade: number };
  limiter: { release: number; lookahead: number; ceiling: number; ceiling3D: number };
  events: Record<string, { max?: number; d3?: boolean }>;
  output?: number;
}

/** A cue's [left, right] level at a frame: the curve joins its points by straight lines, the first / last point's value holds outside them (1 for a cue with none). */
export function gainAt(mix: readonly (readonly [number, number, number])[], frame: number): [number, number] {
  if (!mix.length) return [1, 1];
  if (frame <= mix[0][0]) return [mix[0][1], mix[0][2]];
  for (let i = 1; i < mix.length; i++) {
    const a = mix[i - 1], b = mix[i];
    if (frame <= b[0]) { const k = (frame - a[0]) / (b[0] - a[0]); return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  }
  const z = mix[mix.length - 1];
  return [z[1], z[2]];
}

const LOOK = 0.3;      // seconds of cues scheduled ahead
const STEP_MS = 25;    // the scheduler's period (not rAF: the tail after the last picture frame has no frames)
// VIEWER (USER 2026-10-28 "기본 재생이 100%인데 ㅈㄴ 커서 귀 찢어지는줄"): the page's volume (setVolume) starts at half; 1 = the game's own output at its options' defaults
const DEFAULT_VOLUME = 0.5;
// VIEWER (USER 2026-10-28 "찢어지는듯한 소리가 들리는데 이거 리미터라던지 있어야할듯함"): a last peak limiter on the master at -0.2 dBFS. The game hands sums over 1.0 to the
// sound device unclipped (a skill can peak +1.6 dB at the defaults) — what the device does then is not the game's data
const MASTER_CEILING = 0.977, MASTER_RELEASE = 0.05;

interface Live { cue: SoundCue; src: AudioBufferSourceNode; gain: GainNode; when: number; end: number; cutAt: number; seq: number; }

// the SFX bus limiter: a lookahead peak limiter on the stereo bus, linked channels. The audio is delayed by the lookahead; the gain follows ceiling / (the peak of the
// window that will be output within the lookahead), falling fast (0.8 ms) and rising with the release time. The window's peak comes from a running maximum (a queue of the falling peaks)
// instead of a search of the whole window per sample (tests/lib/motion/sound-limiter.test.ts).
/** The limiter AudioWorklet (public/motion-sfx-limiter.js): a same-origin file, as the CSP allows no blob: scripts. */
export const LIMITER_URL = '/motion-sfx-limiter.js';

export class SoundPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private video!: HTMLVideoElement;
  private muted = true;
  private vol = DEFAULT_VOLUME;                          // the page's volume (setVolume)
  private base = "";
  private fps = 60;
  private cues: SoundCue[] = [];
  private pools = new Map<string, SoundPoolMeta>();
  private picks = new Map<string, number>();
  private chosen = new Map<SoundCue, string>();          // the file of each cue in this play
  private buffers = new Map<string, AudioBuffer | null>();
  private rules: SoundRules | null = null;
  private rulesRoot = "";
  private rulesLoad: Promise<void> = Promise.resolve();
  private loading = 0;                                   // bumped on each load(): a late decode of an earlier state is dropped
  private done = new Set<SoundCue>();                    // cues started in this play since the last resync
  private live = new Set<Live>();
  private seq = 0;
  private anchor = { media: 0, ctx: 0 };                 // media time `media` is heard at context time `ctx` (the sound of that frame)
  private fresh = false;                                 // the anchor came from a frame callback of this play
  private last = 0;                                      // the last media time seen (a jump back = the loop wrapped)
  private tailing = false;                               // the video ended and the sound runs on: the clock is the audio clock
  private over = false;                                  // the video ended: its next play is a new play
  private rvfc = 0;
  // the mixer: cue -> steal gain -> left, right (the curve) -> sfx2D / sfx3D (-> limiter) -> master; voices -> voiceBus -> master
  private bus2: GainNode | null = null;
  private bus3: GainNode | null = null;
  private lim: (AudioWorkletNode | null)[] = [null, null];
  private voiceBus: GainNode | null = null;
  // the game's two option sliders (vfx / voice, default 1), on the buses
  private sfxOpt = 1;
  private voiceOpt = 1;

  /** the effects volume 0..1 (the game's option, 1 at the start): every effect / loop cue, also those sounding now */
  setSfxVolume(v: number) { this.sfxOpt = Math.max(0, Math.min(1, v)); if (this.bus2) { this.bus2.gain.value = this.sfxOpt; this.bus3!.gain.value = this.sfxOpt; } }
  get sfxVolume() { return this.sfxOpt; }
  /** the voice volume 0..1 (the game's option, 1 at the start) */
  setVoiceVolume(v: number) { this.voiceOpt = Math.max(0, Math.min(1, v)); if (this.voiceBus) this.voiceBus.gain.value = this.voiceOpt; }
  get voiceVolume() { return this.voiceOpt; }

  /** test hook: every start() the scheduler made { file, when, offset, start, opt, kind, stolen } */
  log: { file: string; when: number; offset: number; start: number; opt?: number; kind?: string; stolen?: number }[] = [];

  attach(video: HTMLVideoElement) {
    this.video = video;
    video.addEventListener("play", () => this.onPlay());
    // the pause that comes with the end of the video does not cut the sound: its tail goes on
    video.addEventListener("pause", () => { if (!video.ended) this.resync(); });
    video.addEventListener("ended", () => { this.tailing = true; this.over = true; });
    video.addEventListener("seeking", () => this.resync());
    video.addEventListener("seeked", () => { this.fresh = false; this.resync(); });
    // a stall: the sound stops with the picture and starts again from where the video resumes
    video.addEventListener("waiting", () => this.resync());
    video.addEventListener("playing", () => { this.fresh = false; this.resync(); });
    this.timer = window.setInterval(() => this.pump(), STEP_MS);
  }

  // the page leaves: the scheduler stops and the context is closed (a page that comes back makes a new player)
  private timer = 0;
  dispose() {
    window.clearInterval(this.timer);
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  /** a gesture (the sound button, play): the context may only be created / resumed inside one on iOS Safari */
  unlock() {
    if (!this.ctx) this.make();
    if (this.ctx!.state !== "running") void this.ctx!.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (!m) this.unlock();
    if (this.master) this.master.gain.value = this.outGain();
  }

  /** the master's gain: 0 muted, else the rules' output gain (the game's loudness) times the page's volume */
  private outGain() { return this.muted ? 0 : (this.rules?.output ?? 1) * this.vol; }

  /** the page's volume 0..1 (DEFAULT_VOLUME at the start), on the master after the game's output gain */
  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.outGain();
  }
  get volume() { return this.vol; }

  private make() {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.outGain();
    this.master.connect(ctx.destination);
    this.voiceBus = ctx.createGain(); this.voiceBus.gain.value = this.voiceOpt; this.voiceBus.connect(this.master);
    this.bus2 = ctx.createGain(); this.bus2.gain.value = this.sfxOpt; this.bus2.connect(this.master);
    this.bus3 = ctx.createGain(); this.bus3.gain.value = this.sfxOpt; this.bus3.connect(this.master);
    // the limiters sit between the buses and the master; until the worklet is in (or when there is none) the buses pass straight through
    if (ctx.audioWorklet) {
      ctx.audioWorklet.addModule(LIMITER_URL).then(() => {
        if (this.ctx !== ctx) return;
        const limiter = () => new AudioWorkletNode(ctx, "sfx-limiter", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit" });
        [this.bus2!, this.bus3!].forEach((b, k) => {
          const n = limiter();
          b.disconnect(); b.connect(n); n.connect(this.master!);
          this.lim[k] = n;
        });
        const m = limiter(); // the master's last limiter (MASTER_CEILING)
        m.parameters.get("ceiling")!.value = MASTER_CEILING; m.parameters.get("release")!.value = MASTER_RELEASE;
        this.master!.disconnect(); this.master!.connect(m); m.connect(ctx.destination);
        this.setLimiter();
      }).catch(() => { /* no worklet: the effects are not limited */ });
    }
  }

  private setLimiter() {
    const r = this.rules?.limiter;
    this.lim.forEach((n, k) => {
      if (!n) return;
      // no rules: ceiling far above any sum = a plain delay line
      n.parameters.get("ceiling")!.value = r ? (k === 0 ? r.ceiling : r.ceiling3D) : 1e6;
      n.parameters.get("release")!.value = r ? r.release : 0.0052;
    });
  }

  /** the state's sounds: decodes every file of layers.json `sounds` (base = the data root URL; files are relative to it) and loads the rules of the data root once */
  async load(root: string, m: SoundMeta) {
    const token = ++this.loading;
    this.stop();
    this.fps = m.fps;
    this.cues = (m.sounds ?? []).slice().sort((a, b) => a.start - b.start);
    this.pools = new Map((m.soundPools ?? []).map((p) => [p.id, p]));
    this.base = root;
    this.log = [];
    this.over = false;
    if (this.buffers.size > 240) this.buffers.clear();        // (the library is shared by the states: kept while browsing, dropped when it grows)
    this.pickAll();
    if (!this.cues.length) return;
    if (!this.ctx) this.make();
    const ctx = this.ctx!;
    if (this.rulesRoot !== root) {
      this.rulesRoot = root;
      this.rules = null;
      // one fetch per data root, awaited by every load() of it (a load that started while the first one was still fetching would otherwise run without the rules)
      this.rulesLoad = (async () => { try { const r = await fetch(root + "sound_rules.json"); if (r.ok) this.rules = await r.json(); } catch { /* no rules: nothing is limited */ } })();
    }
    await this.rulesLoad;
    if (token !== this.loading) return;
    if (this.master) this.master.gain.value = this.outGain(); // (the rules set it)
    this.setLimiter();
    await Promise.all([...new Set(this.cues.flatMap((c) => c.files))].filter((f) => !this.buffers.has(f)).map(async (f) => {
      try {
        const response = await fetch(this.base + f);
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.arrayBuffer();
        // (the callback form: Safari before 14.1 has no promise)
        this.buffers.set(f, await new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(data, res, rej)));
      } catch { this.buffers.set(f, null); }
    }));
    if (token !== this.loading) return;
    this.resync();
  }

  /** one option per pool, by weight (the silence option picks nothing to play), and one of the `files` of every cue that sounds */
  pickAll() {
    this.picks.clear();
    for (const p of this.pools.values()) {
      let r = Math.random() * p.options.reduce((s, o) => s + o.weight, 0), i = 0;
      for (; i < p.options.length - 1; i++) { r -= p.options[i].weight; if (r < 0) break; }
      this.picks.set(p.id, i);
    }
    this.play = this.cues.filter((c) => (!c.pool || this.picks.get(c.pool) === c.option) && (!c.roll || this.picks.get(c.roll) === 0));
    this.chosen.clear();
    for (const c of this.play) this.chosen.set(c, c.files[Math.floor(Math.random() * c.files.length)]);
  }

  /** the cues that sound in this play (kept from pickAll, not filtered again on every scheduler step) */
  private play: SoundCue[] = [];
  wanted(): SoundCue[] { return this.play; }

  /** everything stops (a state change) */
  stop() {
    this.stopAll(0);
    this.done.clear();
    this.fresh = false;
    this.tailing = false;
  }

  private stopAll(fade: number) {
    const t = this.ctx ? this.ctx.currentTime : 0;
    for (const l of this.live) { try { l.gain.gain.cancelScheduledValues(t); l.gain.gain.setValueAtTime(l.gain.gain.value, t); l.gain.gain.linearRampToValueAtTime(0, t + fade); l.src.stop(t + fade); } catch { /* already stopped */ } }
    this.live.clear();
  }

  /** the media time changed under us (pause, seek, play, a stall): what sounds stops, the cues due are scheduled again from the new time */
  private resync() {
    this.stopAll(0.01);
    this.done.clear();
    this.tailing = false;
    this.anchor = this.here();
  }

  private onPlay() {
    this.resync();
    if (this.over) { this.pickAll(); this.last = 0; this.over = false; }   // the video starts again after its end: a new play
    this.video.cancelVideoFrameCallback(this.rvfc);
    const on = (_: number, md: VideoFrameCallbackMetadata) => {
      if (this.ctx) {
        const p = md.expectedDisplayTime - performance.now(); // the frame appears p ms from now: what is heard then
        this.anchor = { media: md.mediaTime, ctx: this.heardNow() + p / 1000 };
        this.fresh = true;
      }
      if (!this.video.paused) this.rvfc = this.video.requestVideoFrameCallback(on);
    };
    this.rvfc = this.video.requestVideoFrameCallback(on);
  }

  /** the context time of the sound that comes out of the speakers right now (getOutputTimestamp: output latency included; Safari has none: currentTime minus the reported latency) */
  private heardNow(): number {
    const c = this.ctx!, ts = c.getOutputTimestamp ? c.getOutputTimestamp() : null;
    if (ts && ts.performanceTime && ts.contextTime !== undefined) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    return c.currentTime - ((c as any).outputLatency || c.baseLatency || 0);
  }

  private here() { return { media: this.video.currentTime, ctx: this.ctx ? this.heardNow() : 0 }; }

  /** the media time of what the viewer sees and hears now */
  private mediaNow() { return this.anchor.media + (this.heardNow() - this.anchor.ctx); }

  private pump() {
    const ctx = this.ctx, v = this.video;
    if (!ctx || ctx.state !== "running" || !v || !this.cues.length) return;
    // the tail runs on the audio clock with the video ended; otherwise the video must be playing with a frame ready (a stall holds the clock)
    if (!this.tailing && (v.paused || v.ended || v.seeking || v.readyState < 3)) return;
    if (!this.fresh && !this.tailing && v.readyState >= 2) this.anchor = this.here(); // (no frame callback yet this play: currentTime)
    const T = this.mediaNow();
    if (T < this.last - 0.5) { this.pickAll(); this.stopAll(0.01); this.done.clear(); this.anchor = this.here(); this.fresh = false; } // the loop wrapped: a new play
    this.last = T;
    for (const c of this.wanted()) {
      if (this.done.has(c) || c.start > T + LOOK) continue;
      const buf = this.buffers.get(this.chosen.get(c)!);
      if (buf === undefined) continue;                      // still decoding: due again on the next step
      this.done.add(c);
      if (buf) this.start(c, buf, T);                       // (null: the file did not load - that cue stays silent)
    }
  }

  private start(c: SoundCue, buf: AudioBuffer, T: number) {
    const ctx = this.ctx!, a = this.anchor, voice = c.kind === "voice", file = this.chosen.get(c)!;
    // a negative start: the file's front is skipped and the cue plays from video time 0
    const at = Math.max(c.start, 0), skip = at - c.start;
    const looping = c.kind === "loop" && c.end !== undefined && buf.duration < c.end - c.start;
    const natural = looping ? Infinity : at + buf.duration - skip, stopAt = c.end !== undefined ? Math.min(natural, c.end) : natural;
    if (stopAt <= T) return;                                // over before this moment (a seek past it)
    let when = a.ctx + (at - a.media), offset = skip;
    if (when < ctx.currentTime) { offset += ctx.currentTime - when; when = ctx.currentTime; } // late (or a seek into the middle of it): starts now, from where it would be
    if (looping) offset %= buf.duration;
    const media = a.media + (when - a.ctx);                 // the media time at which the source starts
    const gain = ctx.createGain(), src = ctx.createBufferSource();
    src.buffer = buf;
    if (looping) { src.loop = true; src.loopStart = 0; src.loopEnd = buf.duration; }
    const rule = !voice && c.event ? this.rules?.events[c.event.toLowerCase()] : undefined;
    // src -> gain (the steal fade) -> left, right (the curve) -> merger -> bus; a mono file is spread to both channels first
    const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
    gain.channelCount = 2; gain.channelCountMode = "explicit"; gain.channelInterpretation = "speakers";
    src.connect(gain); gain.connect(split);
    const start = gainAt(c.mix, media * this.fps);
    start.forEach((v0, i) => {
      const side = ctx.createGain();
      side.gain.setValueAtTime(v0, when);
      for (const point of c.mix) { const t = point[0] / this.fps; if (t > media + 1e-6 && t <= stopAt) side.gain.linearRampToValueAtTime(point[i + 1], a.ctx + (t - a.media)); }
      split.connect(side, i); side.connect(merge, 0, i);
    });
    merge.connect(voice ? this.voiceBus! : (c.d3 || rule?.d3) ? this.bus3! : this.bus2!);
    const endCtx = a.ctx + (stopAt - a.media);
    let stolen = 0;
    if (!voice && rule?.max) {
      // max instances (an event's limit in the banks; stealing "oldest"): the instances of this event still sounding when this one starts; the oldest are stopped so that at most max remain
      const same = [...this.live].filter((l) => l.cue.event?.toLowerCase() === c.event!.toLowerCase() && l.when <= when + 1e-4 && l.end > when && l.cutAt > when).sort((x, y) => x.when - y.when || x.seq - y.seq);
      for (const v of same.slice(0, Math.max(0, same.length - rule.max + 1))) { this.cutLive(v, when, this.rules!.steal.fade); stolen++; }
    }
    src.start(when, offset);
    if (looping || (c.end !== undefined && c.end < natural)) src.stop(endCtx);   // (the curve is already down at `end`: no fade of its own)
    const l: Live = { cue: c, src, gain, when, end: endCtx, cutAt: Infinity, seq: this.seq++ };
    this.live.add(l);
    src.onended = () => { this.live.delete(l); src.disconnect(); gain.disconnect(); split.disconnect(); merge.disconnect(); };
    this.log.push({ file, when, offset, start: c.start, opt: c.option, kind: c.kind, stolen });
    if (this.log.length > 1000) this.log.shift();
  }

  /** stops a live (or still pending) cue at context time `at`: a cue that has not started by then is dropped, a running one fades out over `fade` */
  private cutLive(l: Live, at: number, fade: number) {
    l.cutAt = at;
    try {
      const g = l.gain.gain;
      if (l.when >= at - 5e-4) { g.cancelScheduledValues(0); g.setValueAtTime(0, 0); l.src.stop(at); l.end = at; return; } // starts in the same instant: never heard
      g.cancelScheduledValues(at); g.setValueAtTime(1, at); g.linearRampToValueAtTime(0, at + fade); l.src.stop(at + fade);
      l.end = Math.min(l.end, at + fade);
    } catch { /* ended */ }
  }
}
