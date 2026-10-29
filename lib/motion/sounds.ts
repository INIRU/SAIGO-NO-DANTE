// Every sound of a skill video, composed over the video by Web Audio (USER 2026-10-27 "사운드 같은 경우 있잖아 그냥 전부 사이트에서 플레이어에서 합성하는걸로 할까?? … 치명타 on/off도 할 수 있을것 같아서",
// "기본값 켜짐으로 하자 효과음은 전부 플레이어로"; before that, for the voices: "보이스 파일을 따로 r2에 올려서 플레이어에서 합성하는걸로 하면 될듯"; out/_handoff_choeae/UPDATE-2026-10-27-all-sounds.md,
// docs/sound/fmod-runtime.md). The MP4 carries a SILENT audio track only (iOS Safari lets Web Audio past the ringer switch while a video with sound plays; its length is the sound tail). layers.json lists
// every cue (`sounds`: start, file of the shared library sfx/ or voices/, volume, kind sfx | critical | loop | voice, event, clipIn / cut / fade, pool / option / roll) and the random choices behind them
// (`soundPools`). Per PLAY (the first start, and each wrap of the loop) one option is picked in every pool, by the game's odds; a cue sounds when the option of its pool is the picked one (and its S1 / S2
// chance `roll` picked option 0). Scheduling is against the video's media time: the frame sync (requestVideoFrameCallback: mediaTime + expectedDisplayTime) is turned into AudioContext time, and every cue due
// in the next LOOK seconds is started at its exact context time. A seek, a pause or a wrap stops what sounds and schedules again from the new time (a cue that was already running starts in its middle).
//
// The FMOD play-time rules the rendered files do not carry (sound_rules.json next to index.json; pipeline/fmod_runtime_info.py, docs/sound/fmod-runtime.md):
//  - max instances of an event (the 8th Hit, the 4th critical sound, the 4th tremor burst ...): the OLDEST instance is stolen (fades out over steal.fade) - the only stealing mode in the banks;
//  - the SFX bus limiter (a lookahead peak limiter in an AudioWorklet): sums above the ceiling are pulled down, so the tremor burst (event gain +6 dB) sits on the ceiling alone and the critical sound
//    hardly adds to it; the 3D events (hit, guard ...) pass at ceiling3D (the game pans them over the surround speakers and limits each speaker);
//  - snapshot Play_Voice (SFX bus -5.5 dB, voices +4 dB while a voice sounds): on, as in the game (`duck`, from sound_rules.json);
//  - the output gain `output` (4): the library files are the game's output x 0.25 (rendered with the master bus lowered), every cue is at the file's level (the game's volume options all
//    default to 1), so the master multiplies back to the game's loudness (USER 2026-10-27 "소리 설정도 게임이랑 똑같이 하고 플레이어 기본값도 그렇게").
//  - 3D events (hit, guard, evade, clash …: FMOD Pan): a cue's `g` = its [left, right] level where the game hears it (the camera is the listener, the distance counts from a point 2.35 under
//    the camera focus; measured with the game's FMOD, sound_lib.mjs pan3d, USER 2026-10-28 "사이트에 적용하자 훨씬 낫네"); no `g` = centred at the file's level (2D events, older layers.json).
// The critical-hit sound (kind "critical") goes through its own switch (setCritical, default ON): a skill whose critical hit changes the PICTURE stays a video state, the switch only mutes the sound.
// A layers.json from before 2026-10-27 (no `sounds`: the MP4's audio carries the effects, `voices` / `voicePools` the voices) plays as before.
export interface SoundCue { start: number; file: string; volume: number; seconds: number; kind?: "sfx" | "critical" | "loop" | "voice"; event?: string; name?: string; unit?: number; g?: [number, number]; clipIn?: number; cut?: number; fade?: number; loop?: boolean; pool?: string; option?: number; roll?: string; }
export interface SoundPoolMeta { id: string; kind: string; options: { weight: number; silence?: boolean }[]; }
export interface SoundMeta { audio?: { format?: number; sfx?: number; critical?: number } | null; sounds?: SoundCue[]; soundPools?: SoundPoolMeta[]; voices?: SoundCue[]; voicePools?: SoundPoolMeta[]; }
export interface SoundRules {
  version: number;
  steal: { fade: number };
  limiter: { release: number; lookahead: number; ceiling: number; ceiling3D: number };
  snapshots: { Play_Voice: { apply: boolean; sfx: number; voice: number; attack: number; release: number } };
  events: Record<string, { max?: number; d3?: boolean }>;
  output?: number;
}

const LOOK = 0.3;      // seconds of cues scheduled ahead
const STEP_MS = 25;    // the scheduler's period (not rAF: the tail after the last picture frame has no frames)
const FADE = 0.05;     // a voice cut by a newer voice of its unit fades over this (VoiceGenerator.AddMultiVoice stops the unit's earlier voices)
const DEFAULT_SFX = 1;   // an effect cue's level when layers.json does not say (audio.sfx): the file's own
// VIEWER (USER 2026-10-28 "기본 재생이 100%인데 ㅈㄴ 커서 귀 찢어지는줄"): the page's volume (setVolume) starts at half; 1 = the game's own output at its options' defaults
const DEFAULT_VOLUME = 0.5;
// VIEWER (USER 2026-10-28 "찢어지는듯한 소리가 들리는데 이거 리미터라던지 있어야할듯함"): a last peak limiter on the master at -0.2 dBFS. The game's FMOD hands sums over 1.0 to the
// sound device unclipped (core flags 0: no CLIP_OUTPUT; a skill can peak +1.6 dB at the defaults, measured with the game's runtime) — what the device does then is not the game's data
const MASTER_CEILING = 0.977, MASTER_RELEASE = 0.05;

interface Live { cue: SoundCue; src: AudioBufferSourceNode; gain: GainNode; when: number; end: number; cutAt: number; seq: number; }

// the SFX bus limiter (bus:/Master/SFX, FMOD Limiter): a lookahead peak limiter on the stereo bus, linked channels. The audio is delayed by the lookahead; the gain follows ceiling / (the peak of the
// window that will be output within the lookahead), falling fast (0.8 ms) and rising with the release time. Loaded from a Blob (no extra file for the page to ship).
// (site change 2026-10-29, USER "플레이어 좀 최적화 하자 사운드를 합성하는거다 보니"): the window's peak comes from a running maximum (a queue of the falling peaks) instead of a search of
// the whole window per sample (240 reads a sample at 48 kHz, three limiters); the output is the same (tests/lib/motion/sound-limiter.test.ts)
/** The limiter AudioWorklet (public/motion-sfx-limiter.js): a same-origin file, as the CSP allows no blob: scripts. */
export const LIMITER_URL = '/motion-sfx-limiter.js';

export class SoundPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private video!: HTMLVideoElement;
  private muted = true;
  private vol = DEFAULT_VOLUME;                          // the page's volume (setVolume)
  private base = "";
  private cues: SoundCue[] = [];
  private pools = new Map<string, SoundPoolMeta>();
  private picks = new Map<string, number>();
  private buffers = new Map<string, AudioBuffer | null>();
  private rules: SoundRules | null = null;
  private rulesRoot = "";
  private rulesLoad: Promise<void> = Promise.resolve();
  private sfxLevel = DEFAULT_SFX;                        // meta.audio.sfx: the level of one effect cue (the limiter's ceilings are relative to it)
  private legacy = false;                                // a layers.json without `sounds`: the MP4 carries the effects
  private loading = 0;                                   // bumped on each load(): a late decode of an earlier state is dropped
  private done = new Set<SoundCue>();                    // cues started in this play since the last resync
  private live = new Set<Live>();
  private seq = 0;
  private anchor = { media: 0, ctx: 0 };                 // media time `media` is heard at context time `ctx` (the sound of that frame)
  private fresh = false;                                 // the anchor came from a frame callback of this play
  private last = 0;                                      // the last media time seen (a jump back = the loop wrapped)
  private rvfc = 0;
  // the mixer: cue -> (critBus ->) sfx2D / sfx3D -> limiter -> sfxDuck -> master; voices -> voiceDuck -> master
  private crit: GainNode | null = null;
  private bus2: GainNode | null = null;
  private bus3: GainNode | null = null;
  private lim: (AudioWorkletNode | null)[] = [null, null];
  private sfxDuck: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private duckIv: [number, number][] = [];               // context-time spans in which a voice sounds (snapshot Play_Voice)
  private critOn = true;
  // the game's two option sliders (vfx / voice, default 1): on every instance, before the buses (master x option x 0.5)
  private sfxOpt = 1;
  private voiceOpt = 1;

  /** a cue's instance level: its volume (the game's 0.5 is in it) x the effects / voice option */
  private level(c: SoundCue) { return c.volume * (c.kind === "voice" ? this.voiceOpt : this.sfxOpt); }

  /** the effects volume 0..1 (the game's option, 1 at the start): every effect / critical / loop cue, also those sounding now */
  setSfxVolume(v: number) { this.sfxOpt = Math.max(0, Math.min(1, v)); this.relevel(false); }
  get sfxVolume() { return this.sfxOpt; }
  /** the voice volume 0..1 (the game's option, 1 at the start) */
  setVoiceVolume(v: number) { this.voiceOpt = Math.max(0, Math.min(1, v)); this.relevel(true); }
  get voiceVolume() { return this.voiceOpt; }

  /** the live cues of one kind take the new level now (a cue already fading out is left to its fade; a recorded cut is scheduled again at the new level) */
  private relevel(voice: boolean) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const l of this.live) {
      if ((l.cue.kind === "voice") !== voice || l.cutAt <= now) continue;
      const g = l.gain.gain, v = this.level(l.cue);
      g.cancelScheduledValues(now); g.setValueAtTime(v, now);
      if (l.cutAt !== Infinity) { g.setValueAtTime(v, l.cutAt); g.linearRampToValueAtTime(0, l.cutAt + (l.cue.fade ?? FADE)); }
    }
  }
  /** snapshot Play_Voice ducks the effects (and lifts the voices) while a voice sounds: the rules' `apply` by default, the page may change it */
  duck = false;
  /** test hook: every start() the scheduler made { name, when, offset, mediaStart, kind, stolen } */
  log: { name?: string; when: number; offset: number; start: number; opt?: number; kind?: string; stolen?: number }[] = [];

  attach(video: HTMLVideoElement) {
    this.video = video;
    video.addEventListener("play", () => this.onPlay());
    video.addEventListener("pause", () => this.resync());
    video.addEventListener("seeking", () => this.resync());
    video.addEventListener("seeked", () => { this.fresh = false; this.resync(); });
    this.timer = window.setInterval(() => this.pump(), STEP_MS);
  }

  // (site addition) the page leaves: the scheduler stops and the context is closed (a page that comes back makes a new player)
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

  /** the master's gain: 0 muted, else the rules' output gain (the game's loudness; a legacy state, whose MP4 carries the effects, stays at 1) */
  private outGain() { return this.muted ? 0 : (this.legacy ? 1 : this.rules?.output ?? 1) * this.vol; }

  /** the page's volume 0..1 (DEFAULT_VOLUME at the start), on the master after the game's output gain */
  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.outGain();
  }
  get volume() { return this.vol; }

  /** the critical-hit sound (kind "critical") on / off, default on; takes effect at once (also for what is already scheduled) */
  setCritical(on: boolean) {
    this.critOn = on;
    if (this.crit && this.ctx) { const t = this.ctx.currentTime; this.crit.gain.cancelScheduledValues(t); this.crit.gain.setValueAtTime(this.crit.gain.value, t); this.crit.gain.linearRampToValueAtTime(on ? 1 : 0, t + 0.03); }
  }
  get critical() { return this.critOn; }

  private make() {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.outGain();
    this.master.connect(ctx.destination);
    this.sfxDuck = ctx.createGain();
    this.sfxDuck.connect(this.master);
    this.voiceBus = ctx.createGain();
    this.voiceBus.connect(this.master);
    this.bus2 = ctx.createGain(); this.bus2.connect(this.sfxDuck);
    this.bus3 = ctx.createGain(); this.bus3.connect(this.sfxDuck);
    this.crit = ctx.createGain(); this.crit.gain.value = this.critOn ? 1 : 0; this.crit.connect(this.bus2);
    // the limiters sit between the buses and the duck; until the worklet is in (or when there is none) the buses pass straight through
    if (ctx.audioWorklet) {
      ctx.audioWorklet.addModule(LIMITER_URL).then(() => {
        if (this.ctx !== ctx) return;
        const limiter = () => new AudioWorkletNode(ctx, "sfx-limiter", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit" });
        [this.bus2!, this.bus3!].forEach((b, k) => {
          const n = limiter();
          b.disconnect(); b.connect(n); n.connect(this.sfxDuck!);
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
      // no rules (or a legacy state): ceiling far above any sum = a plain delay line
      n.parameters.get("ceiling")!.value = r ? (k === 0 ? r.ceiling : r.ceiling3D) * this.sfxLevel : 1e6;
      n.parameters.get("release")!.value = r ? r.release : 0.0052;
    });
  }

  /** the state's sounds: decodes every file of layers.json `sounds` (base = the data root URL; files are relative to it) and loads the rules of the data root once */
  async load(root: string, m: SoundMeta) {
    const token = ++this.loading;
    this.stop();
    this.legacy = !m.sounds;
    this.cues = (m.sounds ?? (m.voices ?? []).map((v) => ({ ...v, kind: "voice" as const }))).slice().sort((a, b) => a.start - b.start);
    this.pools = new Map((m.soundPools ?? m.voicePools ?? []).map((p) => [p.id, p]));
    this.sfxLevel = m.audio?.sfx || DEFAULT_SFX;
    this.base = root;
    this.log = [];
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
    this.duck = !!this.rules?.snapshots.Play_Voice.apply;
    if (this.master) this.master.gain.value = this.outGain(); // (the rules, or a legacy state, set it)
    this.setLimiter();
    await Promise.all([...new Set(this.cues.map((c) => c.file))].filter((f) => !this.buffers.has(f)).map(async (f) => {
      try {
        const data = await (await fetch(this.base + f)).arrayBuffer();
        // (the callback form: Safari before 14.1 has no promise)
        this.buffers.set(f, await new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(data, res, rej)));
      } catch { this.buffers.set(f, null); }
    }));
    if (token !== this.loading) return;
    this.resync();
  }

  /** one option per pool, by weight (the silence option picks nothing to play) */
  pickAll() {
    this.picks.clear();
    for (const p of this.pools.values()) {
      let r = Math.random() * p.options.reduce((s, o) => s + o.weight, 0), i = 0;
      for (; i < p.options.length - 1; i++) { r -= p.options[i].weight; if (r < 0) break; }
      this.picks.set(p.id, i);
    }
    this.play = this.cues.filter((c) => (!c.pool || this.picks.get(c.pool) === c.option) && (!c.roll || this.picks.get(c.roll) === 0));
  }

  /** the cues that sound in this play (site change: kept from pickAll, not filtered again on every scheduler step) */
  private play: SoundCue[] = [];
  wanted(): SoundCue[] { return this.play; }

  /** everything stops (a state change) */
  stop() {
    this.stopAll(0);
    this.done.clear();
    this.fresh = false;
  }

  private stopAll(fade: number) {
    const t = this.ctx ? this.ctx.currentTime : 0;
    for (const l of this.live) { try { l.gain.gain.cancelScheduledValues(t); l.gain.gain.setValueAtTime(l.gain.gain.value, t); l.gain.gain.linearRampToValueAtTime(0, t + fade); l.src.stop(t + fade); } catch { /* already stopped */ } }
    this.live.clear();
    this.duckIv = [];
    this.applyDuck();
  }

  /** the media time changed under us (pause, seek, play): what sounds stops, the cues due are scheduled again from the new time */
  private resync() {
    this.stopAll(0.01);
    this.done.clear();
    this.anchor = this.here();
  }

  private onPlay() {
    this.resync();
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
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !this.video || this.video.paused || this.video.seeking || !this.cues.length) return;
    if (!this.fresh && this.video.readyState >= 2) this.anchor = this.here(); // (no frame callback yet this play, or in the tail after the last frame: currentTime)
    const T = this.mediaNow();
    if (T < this.last - 0.5) { this.pickAll(); this.stopAll(0.01); this.done.clear(); this.anchor = this.here(); this.fresh = false; } // the loop wrapped: a new play
    this.last = T;
    for (const c of this.wanted()) {
      if (this.done.has(c) || c.start > T + LOOK) continue;
      const buf = this.buffers.get(c.file);
      if (buf === undefined) continue;                      // still decoding: due again on the next step
      this.done.add(c);
      if (buf) this.start(c, buf, T);                       // (null: the file did not load - that cue stays silent)
    }
  }

  private start(c: SoundCue, buf: AudioBuffer, T: number) {
    const ctx = this.ctx!, a = this.anchor, voice = c.kind === "voice";
    const clipIn = c.clipIn ?? 0, len = buf.duration - clipIn, looping = !!c.loop && c.cut !== undefined && len < c.cut - c.start;
    const natural = looping ? Infinity : c.start + len, cut = c.cut !== undefined ? Math.min(natural, c.cut + (c.fade ?? FADE)) : natural;
    if (cut <= T) return;                                   // over before this moment (a seek past it)
    let when = a.ctx + (c.start - a.media), offset = clipIn;
    if (when < ctx.currentTime) { offset += ctx.currentTime - when; when = ctx.currentTime; } // late (or a seek into the middle of it): starts now, from where it would be
    const gain = ctx.createGain(), src = ctx.createBufferSource();
    gain.gain.value = this.level(c);
    src.buffer = buf;
    if (looping) { src.loop = true; src.loopStart = clipIn; src.loopEnd = buf.duration; }
    const rule = !voice && c.event && !this.legacy ? this.rules?.events[c.event.toLowerCase()] : undefined;
    src.connect(gain);
    const tail = c.g ? this.place(gain, c.g) : gain;
    tail.connect(voice ? this.voiceBus! : c.kind === "critical" ? this.crit! : rule?.d3 ? this.bus3! : this.bus2!);
    const end = a.ctx + (cut - a.media);
    let stolen = 0;
    if (voice) {
      // one voice per unit (VoiceGenerator.AddMultiVoice): this voice cuts the earlier ones of its unit that still sound when it starts
      for (const l of this.live) if (l.cue.kind === "voice" && l.cue.unit === c.unit && l.cue.unit !== undefined && l.end > when && l.cutAt > when) this.cutLive(l, when, FADE);
    } else if (rule?.max) {
      // max instances (an event's limit in the banks; stealing "oldest"): the instances of this event still sounding when this one starts; the oldest are stopped so that at most max remain
      const same = [...this.live].filter((l) => l.cue.event?.toLowerCase() === c.event!.toLowerCase() && l.when <= when + 1e-4 && l.end > when && l.cutAt > when).sort((x, y) => x.when - y.when || x.seq - y.seq);
      for (const v of same.slice(0, Math.max(0, same.length - rule.max + 1))) { this.cutLive(v, when, this.rules!.steal.fade); stolen++; }
    }
    src.start(when, offset);
    if (c.cut !== undefined) { const t = Math.max(a.ctx + (c.cut - a.media), when), f = c.fade ?? FADE; gain.gain.setValueAtTime(this.level(c), t); gain.gain.linearRampToValueAtTime(0, t + f); src.stop(t + f); } // (the recorded cut: 0.05 s fade, as the video's old mix)
    const l: Live = { cue: c, src, gain, when, end, cutAt: c.cut !== undefined ? a.ctx + (c.cut - a.media) : Infinity, seq: this.seq++ };
    this.live.add(l);
    src.onended = () => { this.live.delete(l); src.disconnect(); gain.disconnect(); if (tail !== gain) tail.disconnect(); };
    if (voice) { this.duckIv.push([when, end]); this.applyDuck(); }
    this.log.push({ name: c.name, when, offset, start: c.start, opt: c.option, kind: c.kind, stolen });
    if (this.log.length > 1000) this.log.shift();
  }

  /** a 3D event where the game hears it (cue `g` = [left, right], sound_lib.mjs pan3d: the camera listener's angle, the distance from its attenuation point): the stereo file's two
   *  channels at their own levels (a mono file is spread to both first) */
  private place(gain: GainNode, g: [number, number]): AudioNode {
    const ctx = this.ctx!, split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
    gain.channelCount = 2; gain.channelCountMode = "explicit"; gain.channelInterpretation = "speakers";
    gain.connect(split);
    g.forEach((v, i) => { const side = ctx.createGain(); side.gain.value = v; split.connect(side, i).connect(merge, 0, i); });
    return merge;
  }

  /** stops a live (or still pending) cue at context time `at`: a cue that has not started by then is dropped, a running one fades out over `fade` */
  private cutLive(l: Live, at: number, fade: number) {
    l.cutAt = at;
    try {
      const g = l.gain.gain;
      if (l.when >= at - 5e-4) { g.cancelScheduledValues(0); g.setValueAtTime(0, 0); l.src.stop(at); l.end = at; return; } // starts in the same instant: never heard
      g.cancelScheduledValues(at); g.setValueAtTime(this.level(l.cue), at); g.linearRampToValueAtTime(0, at + fade); l.src.stop(at + fade);
      l.end = Math.min(l.end, at + fade);
    } catch { /* ended */ }
  }

  /** snapshot Play_Voice: the effects bus goes to rules.snapshots.Play_Voice.sfx and the voices to .voice while any voice sounds, back with the release time after the last one */
  private applyDuck() {
    if (!this.ctx || !this.sfxDuck || !this.voiceBus) return;
    const r = this.rules?.snapshots.Play_Voice, now = this.ctx.currentTime;
    const iv = this.duckIv.filter((x) => x[1] > now).sort((p, q) => p[0] - q[0]);
    this.duckIv = iv;
    for (const [node, lo] of [[this.sfxDuck, r?.sfx ?? 1], [this.voiceBus, r?.voice ?? 1]] as [GainNode, number][]) {
      const p = node.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.setTargetAtTime(1, now, 0.02);                  // (nothing sounds - or the duck is off: back to 1; a span that holds `now` overrides it at once)
      if (!this.duck || !r) continue;
      let i = 0;
      while (i < iv.length) {
        let s = iv[i][0], e = iv[i][1];
        for (i++; i < iv.length && iv[i][0] <= e; i++) e = Math.max(e, iv[i][1]);
        p.setTargetAtTime(lo, Math.max(now, s), 0.003 + r.attack);
        p.setTargetAtTime(1, e, r.release / Math.LN10);   // (the snapshot's fade-out: 90 % after release seconds)
      }
    }
  }
}
