// Every sound of a skill video over its silent video. layers.json lists the cues; a cue's `mix` is its whole level: [frame, left, right] points holding the game's volume, the lowering under a voice, the 3D
// distance and pan and the fade of a sound the game stopped. All effects are mixed into one track and all voices into another before the play, so what sounds is the same every time, sample for sample.
export interface SoundCue {
  start: number; files: string[]; seconds: number; kind?: "sfx" | "loop" | "voice"; d3?: boolean; event?: string; end?: number;
  /** seconds into the file where the game starts it: a long line spoken on from coin to coin */
  clipIn?: number;
  /** [frame, left, right]: straight lines between the points, the first / last value outside them */
  mix: [number, number, number][];
  pool?: string; option?: number;
}
export interface SoundPoolMeta { id: string; kind: string; options: { weight: number; silence?: boolean }[]; }
export interface SoundMeta { fps: number; sounds?: SoundCue[]; soundPools?: SoundPoolMeta[]; }
export interface SoundRules {
  version: number;
  steal: { fade: number };
  limiter: { release: number; lookahead: number; ceiling: number; ceiling3D: number };
  /** keys in lower case */
  events: Record<string, { max?: number }>;
  output?: number;
}
/** A cue of one play: its file drawn, and the time the limit of its event cuts it. */
export type PlayCue = SoundCue & { file: string; cut?: number };

/** The limiter AudioWorklet (public/motion-sfx-limiter.js): a same-origin file, as the CSP allows no blob: scripts. */
export const LIMITER_URL = '/motion-sfx-limiter.js';

const STEP_MS = 25;    // how often the player looks at the video
const SAMPLE_RATE = 48000;
const CUT_FADE = 0.043;
const DEFAULT_VOLUME = 1;     // the page's volume at the start: the game's own loudness
const MASTER_CEILING = 0.977;
const DRIFT = 0.08;    // how far the picture may run from the sound before the tracks move to it
const REPORT_MS = 400; // how long the first frame's report is waited for (an off-document video may send none)
const LEAD = 0.02;     // seconds ahead the tracks are started, so both begin on the same sample

/** A cue's level at a frame: side 1 left, 2 right. */
export function gainAt(mix: SoundCue["mix"], f: number, side: 1 | 2): number {
  if (!mix.length) return 1;
  if (f <= mix[0][0]) return mix[0][side];
  for (let i = 1; i < mix.length; i++) if (f <= mix[i][0]) {
    const a = mix[i - 1], b = mix[i], u = (f - a[0]) / (b[0] - a[0]);
    return a[side] + (b[side] - a[side]) * u;
  }
  return mix[mix.length - 1][side];
}

/** Lays a cue's curve on a gain from its value at the first frame played, so a start in the middle fits. A cut fades over 0.043 s. */
export function setCurve(param: AudioParam, mix: SoundCue["mix"], side: 1 | 2, fromFrame: number, toTime: (f: number) => number, cutFrame?: number) {
  param.setValueAtTime(gainAt(mix, fromFrame, side), toTime(fromFrame));
  for (const p of mix) {
    if (p[0] <= fromFrame) continue;
    if (cutFrame !== undefined && p[0] >= cutFrame) break;
    param.linearRampToValueAtTime(p[side], toTime(p[0]));
  }
  if (cutFrame !== undefined) {
    param.linearRampToValueAtTime(gainAt(mix, cutFrame, side), toTime(cutFrame));
    param.linearRampToValueAtTime(0, toTime(cutFrame) + CUT_FADE);
  }
}

/** One play's cues: an option of every pool by weight, one of each cue's files at the same odds. Called again each time the video plays anew. */
export function pickCues(cues: readonly SoundCue[], pools: readonly SoundPoolMeta[]): PlayCue[] {
  const chosen: Record<string, number> = {};
  for (const p of pools) {
    let r = Math.random() * p.options.reduce((a, o) => a + o.weight, 0);
    chosen[p.id] = p.options.findIndex((o) => (r -= o.weight) < 0);
  }
  return cues.filter((c) => c.pool === undefined || chosen[c.pool] === c.option)
    .map((c) => ({ ...c, file: c.files[Math.floor(Math.random() * c.files.length)] }));
}

/** The game's limit of an event: starts of one frame beyond `max` are left out; a later start cuts the oldest. Nothing is merged. */
export function limitCues(cues: readonly PlayCue[], rules: Pick<SoundRules, "events"> | null, duration: (c: PlayCue) => number): PlayCue[] {
  const live: Record<string, PlayCue[]> = {}, out: PlayCue[] = [];
  for (const c of [...cues].sort((a, b) => a.start - b.start)) {
    const key = (c.event ?? "").toLowerCase(), max = rules?.events[key]?.max;
    if (!max) { out.push(c); continue; }
    const on = (live[key] = (live[key] ?? []).filter((x) => x.start + duration(x) > c.start));
    if (on.length >= max) {
      if (on[0].start === c.start) continue;
      on.shift()!.cut = c.start;
    }
    on.push(c);
    out.push(c);
  }
  return out;
}

/** Where a cue stops sounding: its file, or sooner at `end` or a cut. */
function cueStop(c: PlayCue, buffer: AudioBuffer) {
  const looping = c.kind === "loop" && c.end !== undefined && buffer.duration < c.end - c.start;
  const fileEnd = looping ? Infinity : c.start + buffer.duration - (c.clipIn ?? 0);
  return { looping, fileEnd, stop: Math.min(c.end ?? Infinity, c.cut !== undefined ? c.cut + CUT_FADE : Infinity, fileEnd) };
}

/** One cue on a track. How long it plays is its file; only `end` and a cut stop it sooner. */
function addCue(ctx: BaseAudioContext, to: AudioNode, buffer: AudioBuffer, c: PlayCue, fps: number) {
  const { looping, fileEnd, stop } = cueStop(c, buffer);
  if (stop <= 0) return;
  const begin = Math.max(0, c.start);                    // a negative start: the file's middle at video 0 s
  const toTime = (f: number) => f / fps;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  if (looping) { src.loop = true; src.loopEnd = buffer.duration; }
  const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2), left = ctx.createGain(), right = ctx.createGain();
  src.connect(split);
  split.connect(left, 0).connect(merge, 0, 0);
  split.connect(right, buffer.numberOfChannels > 1 ? 1 : 0).connect(merge, 0, 1);
  merge.connect(to);
  const fromFrame = begin * fps, cutFrame = c.cut !== undefined ? c.cut * fps : undefined;
  setCurve(left.gain, c.mix, 1, fromFrame, toTime, cutFrame);
  setCurve(right.gain, c.mix, 2, fromFrame, toTime, cutFrame);
  src.start(begin, (c.clipIn ?? 0) + begin - c.start);
  if (stop < fileEnd) src.stop(stop);
}

const limiter = (ctx: BaseAudioContext, ceiling: number, release: number, to: AudioNode) => {
  const n = new AudioWorkletNode(ctx, "sfx-limiter", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit", parameterData: { ceiling, release } });
  n.connect(to);
  return n;
};

/** Cues mixed down to one stereo track; with `limits`, the 2D and 3D effects each through the game's limiter. */
async function mixTrack(cues: readonly PlayCue[], buffers: ReadonlyMap<string, AudioBuffer | null>, fps: number, limits?: SoundRules["limiter"]) {
  const seconds = Math.max(0, ...cues.map((c) => cueStop(c, buffers.get(c.file)!).stop));
  if (!seconds) return null;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  let flat: AudioNode = ctx.destination, spatial: AudioNode = ctx.destination;
  if (limits) {
    try {
      await ctx.audioWorklet.addModule(LIMITER_URL);
      flat = limiter(ctx, limits.ceiling, limits.release, ctx.destination);
      spatial = limiter(ctx, limits.ceiling3D, limits.release, ctx.destination);
    } catch { /* no worklet: nothing is limited */ }
  }
  for (const c of cues) addCue(ctx, c.d3 ? spatial : flat, buffers.get(c.file)!, c, fps);
  return ctx.startRendering();
}

interface Tracks { play: PlayCue[]; sfx: AudioBuffer | null; voice: AudioBuffer | null }
interface Output { sfx: GainNode; voice: GainNode; output: GainNode; page: GainNode; last: AudioWorkletNode | null }

/** The two tracks -> their options -> summed -> the game's output -> the last limiter -> the page's volume. */
function makeOutput(ctx: AudioContext, onLimiter: () => void): Output {
  const sum = ctx.createGain(), output = ctx.createGain(), page = ctx.createGain(), sfx = ctx.createGain(), voice = ctx.createGain();
  sfx.connect(sum); voice.connect(sum);
  sum.connect(output).connect(page).connect(ctx.destination);
  const out: Output = { sfx, voice, output, page, last: null };
  void ctx.audioWorklet?.addModule(LIMITER_URL).then(() => {
    out.last = limiter(ctx, MASTER_CEILING, 0.0052, page);
    output.disconnect(); output.connect(out.last);
    onLimiter();
  }).catch(() => { /* no worklet: nothing is limited */ });
  return out;
}

export class SoundPlayer {
  private ctx: AudioContext | null = null;
  private out: Output | null = null;
  private video!: HTMLVideoElement;
  private timer = 0;
  private muted = true;
  private vol = DEFAULT_VOLUME;
  private sfxOpt = 1;
  private voiceOpt = 1;
  private root = "";
  private fps = 60;
  private rules: SoundRules | null = null;
  private rulesRoot = "";
  private rulesLoad: Promise<void> = Promise.resolve();
  private loading = 0;
  private filling = 0;   // the load whose files are fetched (once)
  private pending: Promise<void> | null = null;   // that fetch, while it runs
  private cues: SoundCue[] = [];
  private pools: SoundPoolMeta[] = [];
  private buffers = new Map<string, AudioBuffer | null>();
  private tracks: Tracks | null = null;
  private spare: Tracks | null = null;   // the next play's draw, mixed ahead
  private live = new Set<AudioBufferSourceNode>();
  private sounding = false;  // this clock's tracks have started
  private from = 0;          // the video time of the last start
  private at = 0;            // the context time of that video time
  private running = false;   // the clock runs: playing, or in the tail after the end
  private waiting = false;   // playback started: the first frame's report starts the sound
  private asked = 0;         // when that report was asked for
  private frame = 0;
  private over = false;      // the video reached its end: the next play is a new draw
  private last = 0;          // the last video time seen (a jump back = the loop wrapped)

  attach(video: HTMLVideoElement) {
    this.video = video;
    video.addEventListener("play", () => { if (this.over) { this.over = false; this.last = 0; this.draw(); } });
    video.addEventListener("playing", () => this.start());
    video.addEventListener("seeked", () => { if (!video.paused) this.start(); });
    // (At its end a video pauses: the sound runs on in the tail.)
    video.addEventListener("pause", () => { if (!video.ended) this.stop(); });
    video.addEventListener("ended", () => { this.over = true; });
    video.addEventListener("seeking", () => this.stop());
    video.addEventListener("waiting", () => this.stop());
    this.timer = window.setInterval(() => this.pump(), STEP_MS);
  }

  dispose() {
    window.clearInterval(this.timer);
    this.video?.cancelVideoFrameCallback?.(this.frame);
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  /** a gesture (the sound button, play): the context may only be created / resumed inside one on iOS Safari */
  unlock() {
    if (!this.ctx) this.make();
    if (this.ctx!.state !== "running") void this.ctx!.resume();
  }

  /** on: the wait for this state's sounds when they still have to be fetched (the page holds the video for it) */
  setMuted(m: boolean): Promise<void> | undefined {
    this.muted = m;
    this.level();
    if (m) return;
    this.unlock();
    return this.fill(this.loading) ?? undefined;
  }
  /** the page's volume 0..1, after the last limiter */
  setVolume(v: number) { this.vol = Math.max(0, Math.min(1, v)); this.level(); }
  get volume() { return this.vol; }
  /** the effects option 0..1, on the effects track */
  setSfxVolume(v: number) { this.sfxOpt = Math.max(0, Math.min(1, v)); this.level(); }
  get sfxVolume() { return this.sfxOpt; }
  /** the voice option 0..1, on the voice track */
  setVoiceVolume(v: number) { this.voiceOpt = Math.max(0, Math.min(1, v)); this.level(); }
  get voiceVolume() { return this.voiceOpt; }

  private level() {
    const o = this.out;
    if (!o) return;
    o.output.gain.value = this.rules?.output ?? 1;
    o.page.gain.value = this.muted ? 0 : this.vol;
    o.sfx.gain.value = this.sfxOpt;
    o.voice.gain.value = this.voiceOpt;
  }

  private make() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = (this.ctx = new AC({ sampleRate: SAMPLE_RATE }));
    this.out = makeOutput(ctx, () => this.limits());
    this.level();
    // (A context that starts later: the clock is laid again from where the video is.)
    // (A phone suspends it when the video changes or the page is left, until it is asked to go on.)
    ctx.onstatechange = () => {
      if (ctx.state === "running") { if (this.running && !this.video.ended) this.start(); }
      else if (ctx.state !== "closed" && !this.muted) void ctx.resume();
    };
  }

  private limits() {
    const release = this.rules?.limiter.release;
    const n = this.out?.last;
    if (n && release !== undefined) n.parameters.get("release")!.value = release;
  }

  /** the state's sounds: the rules of the data root once, every file of `sounds`, then the tracks of the first draw */
  async load(root: string, m: SoundMeta) {
    const token = ++this.loading;
    this.stop();
    this.root = root;
    this.fps = m.fps;
    this.cues = m.sounds ?? [];
    this.pools = m.soundPools ?? [];
    this.tracks = this.spare = null; this.over = false; this.last = 0;
    // Only this state's files stay decoded (stereo PCM, about 0.4 MB a second): a phone that went through many videos ran out of memory.
    const used = new Set(this.cues.flatMap((c) => c.files));
    for (const f of this.buffers.keys()) if (!used.has(f)) this.buffers.delete(f);
    // With the sound off nothing is fetched or decoded; turning it on fills this state.
    if (!this.muted) await this.fill(token);
  }

  /** the loaded state's files and tracks, fetched once: the wait for them, null when there is nothing (left) to wait for */
  private fill(token: number): Promise<void> | null {
    if (!this.cues.length) return null;
    if (this.filling !== token) {
      this.filling = token;
      const run: Promise<void> = this.fetchAll(token).finally(() => { if (this.pending === run) this.pending = null; });
      this.pending = run;
    }
    return this.pending;
  }

  private async fetchAll(token: number) {
    const root = this.root;
    if (!this.ctx) this.make();
    const ctx = this.ctx!;
    if (this.rulesRoot !== root) {
      this.rulesRoot = root;
      this.rules = null;
      this.rulesLoad = (async () => {
        try {
          const url = root + "sound_rules.json";
          let r = await fetch(url);
          if (!r.ok) r = await fetch(`${url}?v=${Date.now()}`);   // (the edge keeps a copy per Origin, a 404 too: without the rules the mix is 12 dB low and unlimited)
          if (r.ok) this.rules = await r.json();
        } catch { /* no rules: nothing is limited */ }
      })();
    }
    await this.rulesLoad;
    if (token !== this.loading) return;
    this.level();
    this.limits();
    await Promise.all([...new Set(this.cues.flatMap((c) => c.files))].filter((f) => !this.buffers.has(f)).map(async (f) => {
      try {
        const response = await fetch(this.root + f);
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.arrayBuffer();
        const buffer = await new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(data, res, rej));
        if (token === this.loading) this.buffers.set(f, buffer);   // (a newer load: its files only)
      } catch { if (token === this.loading) this.buffers.set(f, null); }
    }));
    if (token !== this.loading) return;
    const tracks = await this.mix();
    if (token !== this.loading) return;
    this.tracks = tracks;
    this.mixAhead();
    if (!this.video.paused) this.start();
  }

  /** one play: the draw, the limit on what it drew, and its two tracks */
  private async mix(): Promise<Tracks> {
    const buffers = new Map(this.buffers);   // (its own copy: a newer load drops files while this mix still waits)
    const play = limitCues(pickCues(this.cues, this.pools), this.rules, (c) => (buffers.get(c.file)?.duration ?? 0) - (c.clipIn ?? 0)).filter((c) => buffers.get(c.file));
    const [sfx, voice] = await Promise.all([
      mixTrack(play.filter((c) => c.kind !== "voice"), buffers, this.fps, this.rules?.limiter),
      mixTrack(play.filter((c) => c.kind === "voice"), buffers, this.fps),
    ]);
    return { play, sfx, voice };
  }

  /** The next play's tracks, while this one sounds; data with nothing random has only the one. */
  private mixAhead() {
    this.spare = null;
    if (!this.pools.length && !this.cues.some((c) => c.files.length > 1)) return;
    const token = this.loading;
    void this.mix().then((t) => { if (token === this.loading) this.spare = t; });
  }

  /** a new play takes the tracks mixed ahead (a test hook too) */
  private draw() { if (this.spare) { this.tracks = this.spare; this.mixAhead(); } }
  pickAll() { this.draw(); }
  /** the cues that sound in this play */
  wanted(): PlayCue[] { return this.tracks?.play ?? []; }

  /** the tracks stop; the clock goes on */
  private silence() {
    for (const src of this.live) { try { src.stop(); } catch { /* ended */ } }
    this.live.clear();
    this.sounding = false;
  }

  /** everything stops */
  stop() {
    this.silence();
    this.running = false;
    this.waiting = false;
  }

  /** the context time at which what is started now comes out of the speakers */
  private heard() {
    const ctx = this.ctx!;
    return ctx.currentTime - ((ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0);
  }

  /** Playback (re)starts: the sound waits for the first frame on screen, which a large video can show well after its event. */
  private start() {
    this.stop();
    if (!this.muted) this.unlock();
    const v = this.video;
    if (!v.requestVideoFrameCallback) { this.sync(v.currentTime, 0); return; }
    v.cancelVideoFrameCallback(this.frame);
    this.waiting = true;
    this.asked = performance.now();
    const report = (_: number, md: VideoFrameCallbackMetadata) => {
      const ahead = (md.expectedDisplayTime - performance.now()) / 1000;
      if (this.waiting) this.sync(md.mediaTime, ahead);
      else if (this.running && !v.ended && Math.abs(this.heard() + ahead - (this.at + md.mediaTime - this.from)) > DRIFT) { // a hard jump; a stalling video is already caught by `waiting`
        this.sync(md.mediaTime, ahead);
        this.sound();
      }
      if (!v.paused) this.frame = v.requestVideoFrameCallback(report);
    };
    this.frame = v.requestVideoFrameCallback(report);
  }

  /** the clock: video time `media` is on screen `ahead` seconds from now */
  private sync(media: number, ahead: number) {
    this.stop();
    if (!this.ctx) return;
    this.from = media;
    this.at = this.heard() + ahead;
    this.running = true;
  }

  private pump() {
    const ctx = this.ctx;
    if (this.waiting && !this.video.paused && performance.now() - this.asked > REPORT_MS) this.sync(this.video.currentTime, 0);
    if (!ctx || ctx.state !== "running" || !this.running) return;
    const shown = this.video.currentTime;
    if (!this.video.ended && shown < this.last - 0.5) { this.last = shown; this.draw(); this.start(); return; } // the loop wrapped: a new play
    this.last = shown;
    if (!this.sounding) this.sound();
  }

  /** Both tracks from where the clock is, on one instant. */
  private sound() {
    const ctx = this.ctx!, o = this.out!, t = this.tracks;
    if (!t) return;
    const begin = Math.max(ctx.currentTime + LEAD, this.at), offset = this.from + begin - this.at;
    this.sounding = true;
    for (const [track, to] of [[t.sfx, o.sfx], [t.voice, o.voice]] as const) {
      if (!track || offset >= track.duration) continue;
      const src = ctx.createBufferSource();
      src.buffer = track;
      src.connect(to);
      src.start(begin, offset);
      this.live.add(src);
      src.onended = () => { this.live.delete(src); src.disconnect(); };
    }
  }
}
