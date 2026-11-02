// Every sound of a skill video, composed by Web Audio over its silent video. layers.json lists the cues; a cue's `mix` is its whole level: [frame, left, right] points holding the game's volume, the lowering
// under a voice, the 3D distance and pan and the fade of a sound the game stopped. Besides it only the effects and voice options, the game's limits and the master act on a sound.
export interface SoundCue {
  start: number; files: string[]; seconds: number; kind?: "sfx" | "loop" | "voice"; d3?: boolean; event?: string; end?: number;
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

const LOOK = 0.3;      // seconds of cues started ahead (a skill can hold a thousand: not all at once on a phone)
const STEP_MS = 25;    // the scheduler's period
const SAMPLE_RATE = 48000;
const CUT_FADE = 0.043;
const DEFAULT_VOLUME = 0.5;   // the page's volume at the start; 1 = the game's own loudness
const MASTER_CEILING = 0.977, MASTER_RELEASE = 0.05;

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

interface Buses { sfx2: GainNode; sfx3: GainNode; voice: GainNode; output: GainNode; page: GainNode; limiters: (AudioWorkletNode | null)[] }

/**
 * 2D effects -> limiter, 3D effects -> limiter, voices with no limiter; the three summed -> the game's output -> the last
 * limiter -> the page's volume. The effects and voice options sit in front, so they multiply the mix.
 */
function makeBuses(ctx: AudioContext, onLimiters: () => void): Buses {
  const sum = ctx.createGain(), output = ctx.createGain(), page = ctx.createGain(), sfx2 = ctx.createGain(), sfx3 = ctx.createGain(), voice = ctx.createGain();
  for (const bus of [sfx2, sfx3, voice]) bus.connect(sum);
  sum.connect(output).connect(page).connect(ctx.destination);
  const buses: Buses = { sfx2, sfx3, voice, output, page, limiters: [null, null] };
  void ctx.audioWorklet?.addModule(LIMITER_URL).then(() => {
    const limiter = () => new AudioWorkletNode(ctx, "sfx-limiter", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit" });
    [sfx2, sfx3].forEach((bus, k) => { const n = limiter(); bus.disconnect(); bus.connect(n); n.connect(sum); buses.limiters[k] = n; });
    const last = limiter();
    last.parameters.get("ceiling")!.value = MASTER_CEILING; last.parameters.get("release")!.value = MASTER_RELEASE;
    output.disconnect(); output.connect(last); last.connect(page);
    onLimiters();
  }).catch(() => { /* no worklet: nothing is limited */ });
  return buses;
}

export class SoundPlayer {
  private ctx: AudioContext | null = null;
  private buses: Buses | null = null;
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
  private cues: SoundCue[] = [];
  private pools: SoundPoolMeta[] = [];
  private buffers = new Map<string, AudioBuffer | null>();
  private play: PlayCue[] = [];
  private next = 0;          // the first cue of `play` not started
  private live = new Set<AudioBufferSourceNode>();
  private from = 0;          // the video time of the last start
  private at = 0;            // the context time of that video time
  private running = false;   // the clock runs: playing, or in the tail after the end
  private over = false;      // the video reached its end: the next play is a new draw
  private last = 0;          // the last video time seen (a jump back = the loop wrapped)
  /** test hook: every cue started */
  log: { file: string; when: number; offset: number; start: number; opt?: number; kind?: string }[] = [];

  attach(video: HTMLVideoElement) {
    this.video = video;
    video.addEventListener("play", () => { if (this.over) { this.over = false; this.last = 0; this.draw(); } });
    video.addEventListener("playing", () => this.sync());
    video.addEventListener("seeked", () => { if (!video.paused) this.sync(); });
    // (At its end a video pauses: the sound runs on in the tail.)
    video.addEventListener("pause", () => { if (!video.ended) this.stop(); });
    video.addEventListener("ended", () => { this.over = true; });
    video.addEventListener("seeking", () => this.stop());
    video.addEventListener("waiting", () => this.stop());
    this.timer = window.setInterval(() => this.pump(), STEP_MS);
  }

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

  setMuted(m: boolean) { this.muted = m; if (!m) this.unlock(); this.level(); }
  /** the page's volume 0..1, after the last limiter */
  setVolume(v: number) { this.vol = Math.max(0, Math.min(1, v)); this.level(); }
  get volume() { return this.vol; }
  /** the effects option 0..1: every effect cue, also those sounding now */
  setSfxVolume(v: number) { this.sfxOpt = Math.max(0, Math.min(1, v)); this.level(); }
  get sfxVolume() { return this.sfxOpt; }
  /** the voice option 0..1 */
  setVoiceVolume(v: number) { this.voiceOpt = Math.max(0, Math.min(1, v)); this.level(); }
  get voiceVolume() { return this.voiceOpt; }

  private level() {
    const b = this.buses;
    if (!b) return;
    b.output.gain.value = this.rules?.output ?? 1;
    b.page.gain.value = this.muted ? 0 : this.vol;
    b.sfx2.gain.value = b.sfx3.gain.value = this.sfxOpt;
    b.voice.gain.value = this.voiceOpt;
  }

  private make() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = (this.ctx = new AC({ sampleRate: SAMPLE_RATE }));
    this.buses = makeBuses(ctx, () => this.limits());
    this.level();
    // (A context that starts later: the clock is laid again from where the video is.)
    ctx.onstatechange = () => { if (ctx.state === "running" && this.running && !this.video.ended) this.sync(); };
  }

  private limits() {
    const r = this.rules?.limiter;
    this.buses?.limiters.forEach((n, k) => {
      if (!n) return;
      n.parameters.get("ceiling")!.value = r ? (k === 0 ? r.ceiling : r.ceiling3D) : 1e6;
      n.parameters.get("release")!.value = r ? r.release : 0.0052;
    });
  }

  /** the state's sounds: the rules of the data root once, every file of `sounds`, then the first draw */
  async load(root: string, m: SoundMeta) {
    const token = ++this.loading;
    this.stop();
    this.root = root;
    this.fps = m.fps;
    this.cues = m.sounds ?? [];
    this.pools = m.soundPools ?? [];
    this.play = []; this.log = []; this.over = false; this.last = 0;
    if (this.buffers.size > 240) this.buffers.clear();
    if (!this.cues.length) return;
    if (!this.ctx) this.make();
    const ctx = this.ctx!;
    if (this.rulesRoot !== root) {
      this.rulesRoot = root;
      this.rules = null;
      this.rulesLoad = (async () => { try { const r = await fetch(root + "sound_rules.json"); if (r.ok) this.rules = await r.json(); } catch { /* no rules: nothing is limited */ } })();
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
        this.buffers.set(f, await new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(data, res, rej)));
      } catch { this.buffers.set(f, null); }
    }));
    if (token !== this.loading) return;
    this.draw();
    if (!this.video.paused) this.sync();
  }

  /** one play's cues: the draw, and the limit on what it drew */
  private draw() {
    this.play = limitCues(pickCues(this.cues, this.pools), this.rules, (c) => this.buffers.get(c.file)?.duration ?? 0);
  }
  /** a new draw (a test hook too) */
  pickAll() { this.draw(); }
  /** the cues that sound in this play */
  wanted(): PlayCue[] { return this.play; }

  /** everything stops */
  stop() {
    for (const src of this.live) { try { src.stop(); } catch { /* ended */ } }
    this.live.clear();
    this.running = false;
  }

  /** the clock from where the video is now: a sound comes out `latency` after it is started, so it is started that much ahead */
  private sync() {
    this.stop();
    const ctx = this.ctx;
    if (!ctx) return;
    const latency = (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0;
    this.from = this.video.currentTime;
    this.at = ctx.currentTime - latency;
    this.next = 0;
    this.running = true;
  }

  private pump() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !this.running) return;
    const shown = this.video.currentTime;
    if (!this.video.ended && shown < this.last - 0.5) { this.last = shown; this.draw(); this.sync(); } // the loop wrapped: a new play
    this.last = shown;
    const now = this.from + ctx.currentTime - this.at;
    for (; this.next < this.play.length && this.play[this.next].start <= now + LOOK; this.next++) {
      const c = this.play[this.next], buffer = this.buffers.get(c.file);
      if (buffer === undefined) break;                     // still decoding: due again on the next step
      if (buffer) this.playCue(buffer, c, now);            // (null: the file did not load - that cue stays silent)
    }
  }

  /** A cue, from `now` at the latest. How long it plays is its file; only `end` and a cut stop it sooner. */
  private playCue(buffer: AudioBuffer, c: PlayCue, now: number) {
    const ctx = this.ctx!, b = this.buses!, fps = this.fps;
    const looping = c.kind === "loop" && c.end !== undefined && buffer.duration < c.end - c.start;
    const fileEnd = looping ? Infinity : c.start + buffer.duration, stop = Math.min(c.end ?? Infinity, c.cut !== undefined ? c.cut + CUT_FADE : Infinity, fileEnd);
    if (stop <= now) return;                               // already over
    const begin = Math.max(now, this.from, c.start);       // a negative start: the file's middle at video 0 s
    const toTime = (f: number) => this.at + f / fps - this.from;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    if (looping) { src.loop = true; src.loopEnd = buffer.duration; }
    const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2), left = ctx.createGain(), right = ctx.createGain();
    src.connect(split);
    split.connect(left, 0).connect(merge, 0, 0);
    split.connect(right, buffer.numberOfChannels > 1 ? 1 : 0).connect(merge, 0, 1);
    merge.connect(c.kind === "voice" ? b.voice : c.d3 ? b.sfx3 : b.sfx2);
    const fromFrame = begin * fps, cutFrame = c.cut !== undefined ? c.cut * fps : undefined;
    setCurve(left.gain, c.mix, 1, fromFrame, toTime, cutFrame);
    setCurve(right.gain, c.mix, 2, fromFrame, toTime, cutFrame);
    const when = this.at + begin - this.from, offset = looping ? (begin - c.start) % buffer.duration : begin - c.start;
    src.start(when, offset);
    if (stop < fileEnd) src.stop(this.at + stop - this.from);
    this.live.add(src);
    src.onended = () => { this.live.delete(src); src.disconnect(); split.disconnect(); left.disconnect(); right.disconnect(); merge.disconnect(); };
    this.log.push({ file: c.file, when, offset, start: c.start, opt: c.option, kind: c.kind });
    if (this.log.length > 1000) this.log.shift();
  }
}
