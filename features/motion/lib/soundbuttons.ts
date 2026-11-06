// The sound buttons of the 연계 section (USER 2026-10-27 "라운드 시작 연계 대사는 연계 칸에 소리 버튼으로 넣자"): audio-only lines the game says because of another Identity on the side (voice_links.json,
// written by web/layer-proto/voice_links.mjs; contract: out/_handoff_choeae/UPDATE-2026-10-27-voice-link-buttons.md). A button plays the entry's cues once, in order, each at its `start`
// seconds after the click, from the shared voice library (voices/<line>-<hash>.m4a) — no video. The pools (the lines the game picks one of) are drawn by their odds at every click, as voices.ts does per play.
export interface LinkCue { start: number; file: string; volume: number; seconds: number; name?: string; unit?: string; clipIn?: number; cut?: number; fade?: number; pool?: string; option?: number; roll?: string; }
export interface LinkPool { id: string; kind: string; options: { weight: number; silence?: boolean }[]; }
export interface VoiceLink {
  id: string;
  /** every Identity id (5 digits) the button belongs to: it is listed in each one's 연계 section */
  identities: string[];
  main: string;
  /** the Identities standing on the side that the line needs (alive) / the ones that died in the last round */
  partners: string[];
  dead: string[];
  when: "roundStart" | "roundEnd";
  /** the game's Korean: who + when (labelEn likewise; the site may build its own from partners / dead / when) */
  label: string;
  labelEn?: string;
  cues: LinkCue[];
  pools: LinkPool[];
  seconds: number;
}

const FADE = 0.05;

export class SoundButtons {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer | null>();
  private live: { src: AudioBufferSourceNode; gain: GainNode; vol: number }[] = [];
  private token = 0;
  // the same master as the skill videos (sounds.ts): the game's output gain (sound_rules.json `output`, the library files are the game's output x 0.25) x the page's volume
  // (VIEWER, half at the start), then a last peak catch at -1 dBFS — the cues carry the game's voice instance volume 0.5 (voice_lib.mjs GAME_VOICE)
  private master: GainNode | null = null;
  private output = 4;
  private vol = 0.5;
  constructor(private root: string) {}

  /** voice_links.json; [] when the data root has none (also reads sound_rules.json's output gain) */
  async list(): Promise<VoiceLink[]> {
    try { const r = await fetch(this.root + "sound_rules.json"); if (r.ok) this.output = (await r.json()).output ?? this.output; } catch { /* the default */ }
    try {
      const r = await fetch(this.root + "voice_links.json");
      return r.ok ? ((await r.json()).links as VoiceLink[]) : [];
    } catch { return []; }
  }

  private voiceOpt = 1;
  /** the voice volume 0..1 (as SoundPlayer.setVoiceVolume): the next click's lines and those sounding now */
  setVoiceVolume(v: number) {
    this.voiceOpt = Math.max(0, Math.min(1, v));
    if (this.ctx) for (const x of this.live) x.gain.gain.setValueAtTime(x.vol * this.voiceOpt, this.ctx.currentTime);
  }

  /** the page's volume 0..1 (as SoundPlayer.setVolume) */
  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.output * this.vol;
  }

  /** the lines a click plays: one option per pool by weight (the silence option plays nothing), a cue whose pool/roll picked another option is out */
  private wanted(l: VoiceLink): LinkCue[] {
    const picks = new Map<string, number>();
    for (const p of l.pools) {
      let r = Math.random() * p.options.reduce((s, o) => s + o.weight, 0), i = 0;
      for (; i < p.options.length - 1; i++) { r -= p.options[i].weight; if (r < 0) break; }
      picks.set(p.id, i);
    }
    return l.cues.filter((c) => (!c.pool || picks.get(c.pool) === c.option) && (!c.roll || picks.get(c.roll) === 0));
  }

  stop() {
    this.token++;
    const t = this.ctx ? this.ctx.currentTime : 0;
    for (const x of this.live) { try { x.gain.gain.setValueAtTime(x.gain.gain.value, t); x.gain.gain.linearRampToValueAtTime(0, t + 0.02); x.src.stop(t + 0.02); } catch { /* ended */ } }
    this.live = [];
  }

  /** plays the button (inside the click: the context may only be created / resumed in a gesture on iOS Safari); resolves when the last cue has ended or another click stopped it */
  async play(l: VoiceLink): Promise<void> {
    this.stop();
    const token = this.token;
    if (!this.ctx) { const AC = window.AudioContext || (window as any).webkitAudioContext; this.ctx = new AC(); }
    const ctx = this.ctx!;
    if (!this.master) {
      this.master = ctx.createGain();
      const lim = ctx.createDynamicsCompressor(); // (a hard knee, fast ratio-20 compressor just under full scale: the voices alone rarely reach it)
      lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.05;
      this.master.connect(lim).connect(ctx.destination);
    }
    this.master.gain.value = this.output * this.vol;
    if (ctx.state !== "running") await ctx.resume();
    const cues = this.wanted(l);
    await Promise.all([...new Set(cues.map((c) => c.file))].filter((f) => !this.buffers.has(f)).map(async (f) => {
      try {
        const data = await (await fetch(this.root + f)).arrayBuffer();
        this.buffers.set(f, await new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(data, res, rej))); // (the callback form: Safari before 14.1 has no promise)
      } catch { this.buffers.set(f, null); }
    }));
    if (token !== this.token) return;
    const t0 = ctx.currentTime + 0.05;
    let end = t0;
    for (const c of cues) {
      const buf = this.buffers.get(c.file);
      if (!buf) continue; // (a file that did not load: that line stays silent)
      const clipIn = c.clipIn ?? 0, natural = c.start + buf.duration - clipIn, stopAt = c.cut !== undefined ? Math.min(natural, c.cut + (c.fade ?? FADE)) : natural;
      const gain = ctx.createGain(), src = ctx.createBufferSource();
      gain.gain.value = c.volume * this.voiceOpt;
      src.buffer = buf;
      src.connect(gain).connect(this.master);
      if (c.cut !== undefined) { const t = t0 + c.cut, f = c.fade ?? FADE; gain.gain.setValueAtTime(c.volume * this.voiceOpt, t); gain.gain.linearRampToValueAtTime(0, t + f); src.stop(t + f); }
      src.start(t0 + c.start, clipIn);
      const x = { src, gain, vol: c.volume };
      this.live.push(x);
      src.onended = () => { this.live = this.live.filter((y) => y !== x); src.disconnect(); gain.disconnect(); };
      end = Math.max(end, t0 + stopAt);
    }
    await new Promise<void>((res) => window.setTimeout(res, Math.max(0, (end - ctx.currentTime) * 1000)));
  }
}
