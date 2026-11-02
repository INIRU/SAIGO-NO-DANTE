// Every sound of a skill video, composed by Web Audio over its silent video. layers.json lists the cues; a cue's `mix` is its whole level: [frame, left, right] points holding the game's volume, the lowering
// under a voice, the 3D distance and pan and the fade at a stop. Nothing else is multiplied but the effects and voice options and the master. The time of a frame is on one clock:
// time = the AudioContext time of video 0 s + frame / fps.
export interface SoundCue {
  start: number; files: string[]; seconds: number; kind?: "sfx" | "loop" | "voice"; d3?: boolean; event?: string; end?: number;
  /** [frame, left, right]: straight lines between the points, the first / last value outside them */
  mix: [number, number, number][];
  pool?: string; option?: number; roll?: string;
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

/** The limiter AudioWorklet (public/motion-sfx-limiter.js): a same-origin file, as the CSP allows no blob: scripts. */
export const LIMITER_URL = '/motion-sfx-limiter.js';

const LOOK = 0.3;      // seconds of cues scheduled ahead
const STEP_MS = 25;    // the scheduler's period
const DEFAULT_VOLUME = 0.5;   // the page's volume at the start; 1 = the game's own loudness
const MASTER_CEILING = 0.977, MASTER_RELEASE = 0.05;

/** A cue's [left, right] level at a frame. */
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

/** Lays one side of a cue's curve on a gain: its value at the context time `when` (media time `from`), then every later point at the time of its frame. */
export function setCurve(param: AudioParam, mix: SoundCue["mix"], side: 0 | 1, fps: number, zero: number, when: number, from: number) {
  param.setValueAtTime(gainAt(mix, from * fps)[side], when);
  for (const point of mix) { const t = point[0] / fps; if (t > from) param.linearRampToValueAtTime(point[side + 1], zero + t); }
}

/** One play's draw: an option of every pool by weight, then the cues it keeps with one of their `files` each, at the same odds. */
export function pickCues(cues: readonly SoundCue[], pools: readonly SoundPoolMeta[]) {
  const picked = new Map<string, number>();
  for (const p of pools) {
    let r = Math.random() * p.options.reduce((s, o) => s + o.weight, 0), i = 0;
    for (; i < p.options.length - 1; i++) { r -= p.options[i].weight; if (r < 0) break; }
    picked.set(p.id, i);
  }
  const play = cues.filter((c) => (!c.pool || picked.get(c.pool) === c.option) && (!c.roll || picked.get(c.roll) === 0));
  return { play, files: new Map(play.map((c) => [c, c.files[Math.floor(Math.random() * c.files.length)]])) };
}

/** Where a cue's sound ends on the video's clock, by its file. */
const cueEnd = (c: SoundCue, seconds: number) => Math.min(c.start + seconds, c.end ?? Infinity);

/**
 * The cues the `max` of their event takes off: each cue counts for itself, every cue of a frame included; when one more
 * starts than the limit, the oldest stop there. The result is the same wherever playback starts.
 */
export function limitCues(play: readonly SoundCue[], seconds: (c: SoundCue) => number, rules: SoundRules | null) {
  const stolen = new Map<SoundCue, number>(), open = new Map<string, SoundCue[]>();
  for (const c of play) {
    const key = c.event?.toLowerCase(), max = c.kind !== "voice" && key ? rules?.events[key]?.max : undefined;
    if (!key || !max) continue;
    const at = Math.max(c.start, 0), now = (open.get(key) ?? []).filter((o) => cueEnd(o, seconds(o)) > at && !stolen.has(o));
    while (now.length >= max) stolen.set(now.shift()!, at);
    now.push(c);
    open.set(key, now);
  }
  return stolen;
}

interface Buses { d2: GainNode; d3: GainNode; voice: GainNode; master: GainNode; limiters: (AudioWorkletNode | null)[] }

/** 2D effects -> limiter, 3D effects -> limiter, voices with no limiter of their own; all into the master -> its limiter -> the speakers. */
function makeBuses(ctx: AudioContext, onLimiters: () => void): Buses {
  const master = ctx.createGain(), d2 = ctx.createGain(), d3 = ctx.createGain(), voice = ctx.createGain();
  master.connect(ctx.destination);
  for (const bus of [d2, d3, voice]) bus.connect(master);
  const buses: Buses = { d2, d3, voice, master, limiters: [null, null] };
  void ctx.audioWorklet?.addModule(LIMITER_URL).then(() => {
    const limiter = () => new AudioWorkletNode(ctx, "sfx-limiter", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit" });
    [d2, d3].forEach((bus, k) => { const n = limiter(); bus.disconnect(); bus.connect(n); n.connect(master); buses.limiters[k] = n; });
    const last = limiter();
    last.parameters.get("ceiling")!.value = MASTER_CEILING; last.parameters.get("release")!.value = MASTER_RELEASE;
    master.disconnect(); master.connect(last); last.connect(ctx.destination);
    onLimiters();
  }).catch(() => { /* no worklet: nothing is limited */ });
  return buses;
}

interface Live { src: AudioBufferSourceNode; gain: GainNode }

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
  private play: SoundCue[] = [];
  private files = new Map<SoundCue, string>();
  private stolen = new Map<SoundCue, number>();
  private done = new Set<SoundCue>();
  private live = new Set<Live>();
  private zero = 0;          // the context time of video 0 s
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
  /** the page's volume 0..1, on the master */
  setVolume(v: number) { this.vol = Math.max(0, Math.min(1, v)); this.level(); }
  get volume() { return this.vol; }
  /** the effects option 0..1: every effect cue, also those sounding now (the bus is before the limiter, so it multiplies the mix) */
  setSfxVolume(v: number) { this.sfxOpt = Math.max(0, Math.min(1, v)); this.level(); }
  get sfxVolume() { return this.sfxOpt; }
  /** the voice option 0..1 */
  setVoiceVolume(v: number) { this.voiceOpt = Math.max(0, Math.min(1, v)); this.level(); }
  get voiceVolume() { return this.voiceOpt; }

  private level() {
    const b = this.buses;
    if (!b) return;
    b.master.gain.value = this.muted ? 0 : (this.rules?.output ?? 1) * this.vol;
    b.d2.gain.value = b.d3.gain.value = this.sfxOpt;
    b.voice.gain.value = this.voiceOpt;
  }

  private make() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = (this.ctx = new AC());
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
    this.cues = (m.sounds ?? []).slice().sort((a, b) => a.start - b.start);
    this.pools = m.soundPools ?? [];
    this.play = []; this.files.clear(); this.stolen.clear(); this.log = []; this.over = false; this.last = 0;
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
    const { play, files } = pickCues(this.cues, this.pools);
    this.play = play; this.files = files;
    this.stolen = limitCues(play, (c) => this.buffers.get(files.get(c)!)?.duration ?? 0, this.rules);
  }
  /** a new draw (a test hook too) */
  pickAll() { this.draw(); }
  /** the cues that sound in this play */
  wanted(): SoundCue[] { return this.play; }

  /** everything stops */
  stop() {
    const t = this.ctx?.currentTime ?? 0;
    for (const l of this.live) { try { l.gain.gain.cancelScheduledValues(t); l.gain.gain.setValueAtTime(1, t); l.gain.gain.linearRampToValueAtTime(0, t + 0.01); l.src.stop(t + 0.01); } catch { /* ended */ } }
    this.live.clear();
    this.done.clear();
    this.running = false;
  }

  /** the clock from where the video is now, and what sounds there from its place */
  private sync() {
    this.stop();
    const ctx = this.ctx;
    if (!ctx) return;
    const latency = (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0;
    this.zero = ctx.currentTime + latency - this.video.currentTime;
    this.running = true;
  }

  private pump() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !this.running) return;
    const shown = this.video.currentTime;
    if (!this.video.ended && shown < this.last - 0.5) { this.last = shown; this.draw(); this.sync(); } // the loop wrapped: a new play
    this.last = shown;
    const T = ctx.currentTime - this.zero;
    for (const c of this.play) {
      if (c.start > T + LOOK) break;
      if (this.done.has(c)) continue;
      const buf = this.buffers.get(this.files.get(c)!);
      if (buf === undefined) continue;
      this.done.add(c);
      if (buf) this.playCue(c, buf, T);
    }
  }

  private playCue(c: SoundCue, buf: AudioBuffer, T: number) {
    const ctx = this.ctx!, b = this.buses!, zero = this.zero, fade = this.rules?.steal.fade ?? 0;
    const at = Math.max(c.start, 0), stolen = this.stolen.get(c) ?? Infinity;
    if (stolen <= at) return;                              // taken off in the instant it starts
    const looping = c.kind === "loop" && c.end !== undefined && buf.duration < c.end - c.start;
    const stop = Math.min(looping ? Infinity : c.start + buf.duration, c.end ?? Infinity, stolen === Infinity ? Infinity : stolen + fade);
    if (stop <= T) return;
    let when = zero + at, offset = at - c.start;
    if (when < ctx.currentTime) { offset += ctx.currentTime - when; when = ctx.currentTime; }
    const from = when - zero;
    const src = ctx.createBufferSource(), gain = ctx.createGain(), split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
    src.buffer = buf;
    if (looping) { src.loop = true; src.loopEnd = buf.duration; offset %= buf.duration; }
    // src -> gain (the fade of a stolen cue) -> left, right (each channel its curve) -> merger -> bus; a mono file is spread to both first
    gain.channelCount = 2; gain.channelCountMode = "explicit"; gain.channelInterpretation = "speakers";
    src.connect(gain); gain.connect(split);
    ([0, 1] as const).forEach((side) => {
      const level = ctx.createGain();
      setCurve(level.gain, c.mix, side, this.fps, zero, when, from);
      split.connect(level, side).connect(merge, 0, side);
    });
    merge.connect(c.kind === "voice" ? b.voice : c.d3 ? b.d3 : b.d2);
    if (stolen !== Infinity) { gain.gain.setValueAtTime(1, zero + stolen); gain.gain.linearRampToValueAtTime(0, zero + stolen + fade); }
    src.start(when, offset);
    if (stop !== Infinity && stop < c.start + buf.duration || looping) src.stop(zero + stop);
    const l: Live = { src, gain };
    this.live.add(l);
    src.onended = () => { this.live.delete(l); src.disconnect(); gain.disconnect(); split.disconnect(); merge.disconnect(); };
    this.log.push({ file: this.files.get(c)!, when, offset, start: c.start, opt: c.option, kind: c.kind });
    if (this.log.length > 1000) this.log.shift();
  }
}
