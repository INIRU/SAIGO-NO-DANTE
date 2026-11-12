// WebGL2 compositor for the layered video: draws one video frame as base + the sum of the wanted layers' differences (each layer tile holds what switching that buff on changes in the
// picture, signed, bloom included). Version 5: three grey tiles per layer, the difference's Y / Co / Cg, each e = sign * sqrt(|v|) stored as 0.5 + 0.5 * e (grey keeps its full
// resolution in H.264 4:2:0; a colour tile lost half its colour and thin red lines turned to dots). Version 4: one colour tile, d = sign * sqrt(|diff|) per channel.
// No framework, no dependency: copy this file with compositor-shaders.ts into a Next.js client component.

import { MAX_LAYERS, VERT, FRAG, GF_EPS, GF_EPS_PIC, PIC_DROP, GF_A, GF_B, GF_C, GF_FINAL } from './compositor-shaders';
import { LayerVideo } from './layer-video';

/** a tile in the video's pixels; w / h absent = the base size (meta.tile): version 2 exports had one tile size */
export interface Rect { x: number; y: number; w?: number; h?: number }
export interface LayerMeta { id: string; label: string; /** version 4: the layer's difference tile */ delta?: Rect; /** version 5 / 7: its Y / Co / Cg grey tiles */ ycocg?: { y: Rect; co: Rect; cg: Rect }; /** version 8: per frame (cropStride numbers) the screen box (x, y, w, h; w 0 = nothing), the tile w, h and the Y, Co, Cg tiles x, y */ crops?: number[]; /** version 9: the video holding the crops' tiles (next to layers.json) */ file?: string; enabled?: boolean; /** never drawn in this skill (its tiles are empty) */ empty?: boolean; /** 시작 때 꺼짐: the game switches it off when the skill starts */ offAtSkill?: boolean; /** the frame ranges [from, to) in which the game shows it (absent: always) */ visible?: [number, number][] }
export interface LayerSetMeta {
  /** version 7: the base picture (every layer on) as BT.709 full-range Y / Cb / Cr grey planes; layers are taken away when unticked */
  basePlanes?: { y: Rect; cb?: Rect; cr?: Rect }; // (version 10: Y only, Cb / Cr in `chroma`)
  baseAllOn?: boolean;
  /** version 8: the numbers per frame in a layer's crops (12) */
  cropStride?: number;
  /** version 9: the size of a layer's own video */
  layerVideo?: { w: number; h: number };
  /** version 10 (QHD): the video holds the Y plane only (basePlanes.y); Cb / Cr are in this video (next to layers.json), decoded frame by frame */
  chroma?: { file: string; w: number; h: number; cb: Rect; cr: Rect };
  /** version 9: the frame number in the base video: `bits` blocks of `block` px in a row from x, y (top-left), bit 0 first, white = 1 */
  frameCode?: { x: number; y: number; bits: number; block: number };
  skill: { name: string; identity?: string };
  fps: number;
  frames: number;
  tile: { w: number; h: number };
  /** H.264 4:2:0 (every browser) */
  video: { file: string; w: number; h: number };
  /** the MP4's audio track: format 2 (2026-10-27) a SILENT track as long as the sound (the cues are `sounds`); older: the sound effects mixed in, the voices in `voices` */
  audio?: { cues?: number; seconds?: number; tail?: number; voices?: number; format?: number; sounds?: number; critical?: number; sfx?: number } | null; // seconds = the sound's length, tail = how far it runs past the last picture frame (frames / fps); critical = the critical-hit sound cues; sfx = the level of one effect cue
  /** every sound cue over the video and the random choices behind them (sounds.ts; out/_handoff_choeae/UPDATE-2026-10-27-all-sounds.md) */
  sounds?: import("./sounds").SoundCue[];
  soundPools?: import("./sounds").SoundPoolMeta[];
  /** before format 2: the voices over the video (UPDATE-2026-10-27-voice-pools.md) */
  voices?: import("./sounds").SoundCue[];
  voicePools?: import("./sounds").SoundPoolMeta[];
  base: Rect;
  layers: LayerMeta[]; // compositing order, bottom first
}

export class LayerCompositor {
  readonly gl: WebGL2RenderingContext;
  private tex: WebGLTexture;
  private prog: WebGLProgram;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  /** enabled flag per layer, in meta order */
  readonly on: boolean[];
  /** version 7: the guided layer-off path (null: no float render targets, the plain path) */
  private guided: GuidedPath | null = null;
  /** version 9: each layer's video, opened when it is first unticked */
  private streams: (LayerVideo | null)[] = [];
  private code: { prog: WebGLProgram; fbo: WebGLFramebuffer; tex: WebGLTexture; px: Uint8Array; buf: WebGLBuffer; sync: WebGLSync | null; want: number } | null = null;
  /** version 9: barcode − the frame number the page passed (0 in Chrome; corrected when a check finds otherwise) */
  private codeShift = 0;
  /** version 9: called when a layer frame the last draw waited for has been decoded (a paused page draws again) */
  onReady: (() => void) | null = null;

  /** layerUrl (version 9): the URL of a layer's video file (layers.json's `file`, next to it) */
  constructor(readonly canvas: HTMLCanvasElement, readonly meta: LayerSetMeta, private layerUrl?: (file: string) => string) {
    if (meta.layers.length > MAX_LAYERS) throw new Error(`at most ${MAX_LAYERS} layers`);
    canvas.width = meta.tile.w;
    canvas.height = meta.tile.h;
    // (No kept drawing buffer: nothing reads the canvas after a frame is shown, and the copy is a full picture of memory on a phone.)
    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    const prog = (this.prog = link(gl, VERT, FRAG));
    gl.useProgram(prog);
    for (const n of ["uVideo", "uBase", "uCb", "uCr", "uPlanes", "uCount", "uDelta", "uCo", "uCg", "uYcocg", "uOn", "uTexel"]) this.loc[n] = gl.getUniformLocation(prog, n);
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    // LINEAR: the layer tiles (half size) are upsampled smoothly; tuv() keeps every lookup inside its tile
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const { w, h } = meta.video, r = (p: Rect) => [p.x / w, p.y / h, (p.w ?? meta.tile.w) / w, (p.h ?? meta.tile.h) / h];
    gl.uniform2f(this.loc.uTexel, 1 / w, 1 / h);
    gl.uniform1i(this.loc.uVideo, 0);
    gl.uniform4fv(this.loc.uBase, r(meta.basePlanes ? meta.basePlanes.y : meta.base));
    gl.uniform4fv(this.loc.uCb, meta.basePlanes?.cb ? r(meta.basePlanes.cb) : [0, 0, 0, 0]);
    gl.uniform4fv(this.loc.uCr, meta.basePlanes?.cr ? r(meta.basePlanes.cr) : [0, 0, 0, 0]);
    gl.uniform1f(this.loc.uPlanes, meta.basePlanes ? 1 : 0);
    gl.uniform1i(this.loc.uCount, meta.layers.length);
    gl.uniform4fv(this.loc.uDelta, pad(meta.layers.map((l) => (l.ycocg ? r(l.ycocg.y) : l.delta ? r(l.delta) : [0, 0, 0, 0]))));
    gl.uniform4fv(this.loc.uCo, pad(meta.layers.map((l) => (l.ycocg ? r(l.ycocg.co) : [0, 0, 0, 0]))));
    gl.uniform4fv(this.loc.uCg, pad(meta.layers.map((l) => (l.ycocg ? r(l.ycocg.cg) : [0, 0, 0, 0]))));
    gl.uniform1fv(this.loc.uYcocg, Float32Array.from({ length: MAX_LAYERS }, (_, k) => (meta.layers[k]?.ycocg ? 1 : 0)));
    this.on = meta.layers.map((l) => l.enabled !== false);
    gl.viewport(0, 0, meta.tile.w, meta.tile.h);
    if (meta.baseAllOn) this.guided = GuidedPath.create(gl, meta);
  }

  /** free the GL objects (the page builds a new compositor when another skill / state is loaded) */
  dispose(): void {
    this.gl.deleteTexture(this.tex);
    this.gl.deleteProgram(this.prog);
    this.guided?.dispose();
    for (const v of this.streams) v?.close();
    this.chromaVideo?.close();
    if (this.v10) { this.gl.deleteProgram(this.v10.prog); this.gl.deleteTexture(this.v10.tex); }
    if (this.code) { const gl = this.gl; gl.deleteProgram(this.code.prog); gl.deleteFramebuffer(this.code.fbo); gl.deleteTexture(this.code.tex); gl.deleteBuffer(this.code.buf); if (this.code.sync) gl.deleteSync(this.code.sync); }
  }

  /** version 9: the barcode of the frame now in the video texture drawn into the code target (bits x 1 texels); read: readPixels now (a stall), or into the buffer */
  private codePass(toBuffer: boolean) {
    const gl = this.gl, fc = this.meta.frameCode!;
    if (!this.code) {
      const prog = link(gl, VERT, `#version 300 es
precision highp float;
uniform sampler2D uVideo; uniform ivec4 uCode;
out vec4 o;
void main() { int i = int(gl_FragCoord.x); o = vec4(texelFetch(uVideo, uCode.xy + ivec2(i * uCode.w + uCode.w / 2, uCode.w / 2), 0).g); }`);
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, fc.bits, 1);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, fc.bits * 4, gl.STREAM_READ);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      this.code = { prog, fbo, tex, px: new Uint8Array(fc.bits * 4), buf, sync: null, want: 0 };
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
    }
    const c = this.code;
    gl.useProgram(c.prog);
    gl.uniform1i(gl.getUniformLocation(c.prog, "uVideo"), 0);
    gl.uniform4i(gl.getUniformLocation(c.prog, "uCode"), fc.x, fc.y, fc.bits, fc.block);
    gl.bindFramebuffer(gl.FRAMEBUFFER, c.fbo);
    gl.viewport(0, 0, fc.bits, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (toBuffer) {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, c.buf);
      gl.readPixels(0, 0, fc.bits, 1, gl.RGBA, gl.UNSIGNED_BYTE, 0);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    } else gl.readPixels(0, 0, fc.bits, 1, gl.RGBA, gl.UNSIGNED_BYTE, c.px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.meta.tile.w, this.meta.tile.h);
  }
  private codeValue(): number {
    const fc = this.meta.frameCode!, px = this.code!.px;
    let n = 0;
    for (let i = 0; i < fc.bits; i++) if (px[i * 4 + 1] > 127) n |= 1 << i;
    return n;
  }
  /** version 9: the number of the frame now in the video texture, from its barcode, now (a GPU stall of a few ms: paused / seeking) */
  private frameCode(): number {
    this.codePass(false);
    return this.codeValue();
  }
  /** version 9, playing: the frame drawn was taken as n; its barcode is read without waiting and compared a frame or two later. A disagreement (a browser whose
   * mediaTime is a frame off its picture) shifts every later number by it */
  private checkCode(n: number) {
    const gl = this.gl, c = this.code;
    if (c?.sync) {
      if (gl.clientWaitSync(c.sync, 0, 0) === gl.TIMEOUT_EXPIRED) return; // (still in flight: a later frame checks)
      gl.deleteSync(c.sync);
      c.sync = null;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, c.buf);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, c.px);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      const got = this.codeValue();
      if (got !== c.want && got < this.meta.frames) { this.codeShift += got - c.want; console.warn(`layer frames: the picture was frame ${got}, the clock said ${c.want}: shift ${this.codeShift}`); }
    }
    this.codePass(true);
    this.code!.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    this.code!.want = n;
  }

  /** version 10: the chroma video and its program / texture */
  private chromaVideo: LayerVideo | null = null;
  private v10: { prog: WebGLProgram; tex: WebGLTexture } | null = null;
  /** version 10: draw frame n's picture (the video's Y, the chroma video's frame n); false = that chroma frame is not decoded yet */
  private drawV10(n: number): boolean {
    const gl = this.gl, m = this.meta, c = m.chroma!;
    if (!this.chromaVideo) {
      if (!this.layerUrl || typeof VideoDecoder === "undefined") return false;
      this.chromaVideo = new LayerVideo(this.layerUrl(c.file), m.fps, m.frames);
      this.chromaVideo.onFrame = () => this.onReady?.();
    }
    const f = this.chromaVideo.frame(n);
    if (!f) return false;
    if (!this.v10) {
      const prog = link(gl, VERT, `#version 300 es
precision highp float;
uniform sampler2D uVideo; uniform sampler2D uChroma; uniform ivec2 uY; uniform ivec2 uCb; uniform ivec2 uCr; uniform int uH;
out vec4 o;
void main() {
  ivec2 p = ivec2(int(gl_FragCoord.x), uH - 1 - int(gl_FragCoord.y));
  float y = texelFetch(uVideo, uY + p, 0).g, cb = texelFetch(uChroma, uCb + p, 0).g - 0.5, cr = texelFetch(uChroma, uCr + p, 0).g - 0.5;
  o = vec4(clamp(vec3(y + 1.5748 * cr, y - 0.1873 * cb - 0.4681 * cr, y + 1.8556 * cb), 0.0, 1.0), 1.0);
}`);
      const tex = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      for (const q of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, q, gl.NEAREST);
      for (const q of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, q, gl.CLAMP_TO_EDGE);
      gl.activeTexture(gl.TEXTURE0);
      this.v10 = { prog, tex };
    }
    const { prog, tex } = this.v10;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, f); // (a VideoFrame into a 2D texture stays on the GPU)
    gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(prog);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    gl.uniform1i(u("uVideo"), 0);
    gl.uniform1i(u("uChroma"), 1);
    gl.uniform2i(u("uY"), m.basePlanes!.y.x, m.basePlanes!.y.y);
    gl.uniform2i(u("uCb"), c.cb.x, c.cb.y);
    gl.uniform2i(u("uCr"), c.cr.x, c.cr.y);
    gl.uniform1i(u("uH"), m.tile.h);
    gl.viewport(0, 0, m.tile.w, m.tile.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(this.prog);
    return true;
  }

  /** version 9: layer k's video (opened on first use) */
  private stream(k: number): LayerVideo | null {
    const l = this.meta.layers[k];
    if (!l.file || !this.layerUrl || typeof VideoDecoder === "undefined") return null;
    if (!this.streams[k]) {
      this.streams[k] = new LayerVideo(this.layerUrl(l.file), this.meta.fps, this.meta.frames);
      this.streams[k]!.onFrame = () => this.onReady?.();
    }
    return this.streams[k];
  }

  /** draw the video's current frame with the current layer switches. Version 9: false = a layer's frame is not decoded yet; the canvas keeps the last picture
   * (onReady fires when it is). Layers unticked in a browser without WebCodecs: drawn with them on. exact: `frame` is the frame the video hands over now
   * (requestVideoFrameCallback's mediaTime, playing: checked against the barcode without a stall); otherwise the barcode is read */
  draw(video: HTMLVideoElement, frame: number, exact = false): boolean {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    if (this.meta.chroma) {
      const n = exact ? frame + this.codeShift : this.frameCode();
      const f = n >= 0 && n < this.meta.frames ? n : frame; // (a misread code: the clock's frame)
      if (exact) this.checkCode(f);
      return this.drawV10(f);
    }
    if (this.meta.frameCode && this.guided) {
      const off = this.meta.layers.map((_, k) => k).filter((k) => !this.on[k] && this.meta.layers[k].crops && !this.meta.layers[k].empty && this.stream(k));
      if (off.length) {
        const n = exact ? frame + this.codeShift : this.frameCode();
        const f = n >= 0 && n < this.meta.frames ? n : frame; // (a misread code: the clock's frame)
        if (exact) this.checkCode(f);
        const pics = off.map((k) => this.stream(k)!.frame(f));
        if (pics.some((x) => x === undefined)) return false; // (null: the layer changes nothing in this frame)
        this.guided.draw(off, f, pics as (VideoFrame | null)[]);
        gl.useProgram(this.prog);
        return true;
      }
    }
    // version 7: the picture has every layer as the game shows it; an unticked one is taken away (its tiles are empty where the game hides it). Before: ticked ones added
    const all = !!this.meta.baseAllOn;
    const off = all ? this.meta.layers.map((_, k) => k).filter((k) => !this.on[k] && (this.meta.layers[k].ycocg || this.meta.layers[k].crops) && !this.meta.layers[k].empty) : [];
    if (this.guided && off.length && !this.meta.frameCode) {
      this.guided.draw(off, frame);
      gl.useProgram(this.prog);
      return true;
    }
    gl.uniform1fv(this.loc.uOn, Float32Array.from({ length: MAX_LAYERS }, (_, k) => (k >= this.meta.layers.length || this.meta.frameCode ? 0 : all ? (this.on[k] ? 0 : -1) : this.on[k] && visibleAt(this.meta.layers[k], frame) ? 1 : 0)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  }
}

/** a layer's part of one frame: its screen box and its Y / Co / Cg tiles (video pixels, top-down) */
interface Crop { box: [number, number, number, number]; tiles: [number, number, number, number][]; kind: number }

/** the version 7 / 8 layer-off path: the programs, and (with float render targets) three atlas textures over the layer area for the guided passes */
class GuidedPath {
  private progs: Record<string, WebGLProgram> = {};
  private loc = new Map<WebGLProgram, Record<string, WebGLUniformLocation | null>>();
  private tex: WebGLTexture[] = [];
  private fbo: WebGLFramebuffer[] = [];
  private guided = false;
  private ax = 0;
  private ay = 0;
  private aw = 0;
  private ah = 0;
  /** version 9: the tiles are in the layers' own videos (uLayers, a texture per unticked layer, units 2..); the guided passes' tiles are packed into the atlas per frame */
  private sep = false;
  private layerTex: WebGLTexture[] = [];
  static create(gl: WebGL2RenderingContext, meta: LayerSetMeta): GuidedPath | null {
    if (!meta.basePlanes || !meta.layers.some((l) => l.ycocg || l.crops)) return null;
    try {
      return new GuidedPath(gl, meta);
    } catch {
      return null;
    }
  }
  private constructor(private gl: WebGL2RenderingContext, private meta: LayerSetMeta) {
    if (meta.layerVideo) {
      this.sep = true;
      [this.ax, this.ay, this.aw, this.ah] = [0, 0, meta.layerVideo.w, meta.layerVideo.h];
    } else if (meta.layers.some((l) => l.crops)) {
      // version 8: the crops' tiles change every frame inside the bottom-right quarter
      [this.ax, this.ay, this.aw, this.ah] = [meta.tile.w, meta.tile.h, meta.tile.w, meta.tile.h];
    } else {
      const rs = meta.layers.flatMap((l) => (l.ycocg ? [l.ycocg.y, l.ycocg.co, l.ycocg.cg] : []));
      this.ax = Math.min(...rs.map((r) => r.x));
      this.ay = Math.min(...rs.map((r) => r.y));
      this.aw = Math.max(...rs.map((r) => r.x + (r.w ?? 0))) - this.ax;
      this.ah = Math.max(...rs.map((r) => r.y + (r.h ?? 0))) - this.ay;
    }
    this.progs.F = link(gl, VERT, GF_FINAL);
    const f32 = !!gl.getExtension("EXT_color_buffer_float");
    if (!f32 && !gl.getExtension("EXT_color_buffer_half_float")) return; // bilinear for the scaled tiles
    try {
      for (const [n, src] of [["A", GF_A], ["B", GF_B], ["C", GF_C]] as const) this.progs[n] = link(gl, VERT, src);
      for (let i = 0; i < 3; i++) {
        const t = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, t);
        // (version 9: two channels, half floats: the atlas is a layer video's size; 2560x1440 RG16F = 15 MB a texture)
        gl.texStorage2D(gl.TEXTURE_2D, 1, this.sep ? (f32 ? gl.RG16F : gl.RGBA16F) : f32 ? gl.RGBA32F : gl.RGBA16F, this.aw, this.ah);
        for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
        const fb = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("float framebuffer");
        this.tex.push(t);
        this.fbo.push(fb);
      }
      this.guided = true;
    } catch {
      this.guided = false;
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  }
  private u(p: WebGLProgram, n: string) {
    let m = this.loc.get(p);
    if (!m) this.loc.set(p, (m = {}));
    if (!(n in m)) m[n] = this.gl.getUniformLocation(p, n);
    return m[n];
  }
  /** a tile's atlas viewport (x, y bottom-up, w, h) */
  private vp(t: number[]): number[] {
    return [t[0] - this.ax, this.ah - (t[1] - this.ay) - t[3], t[2], t[3]];
  }
  private useBase(p: WebGLProgram) {
    const gl = this.gl, P = this.meta.basePlanes!;
    gl.useProgram(p);
    gl.uniform1i(this.u(p, "uVideo"), 0);
    gl.uniform2i(this.u(p, "uBY"), P.y.x, P.y.y);
    gl.uniform2i(this.u(p, "uBCb"), P.cb!.x, P.cb!.y);
    gl.uniform2i(this.u(p, "uBCr"), P.cr!.x, P.cr!.y);
    gl.uniform1iv(this.u(p, "uLayers"), Int32Array.from({ length: MAX_LAYERS }, (_, i) => 2 + i));
    gl.uniform1i(this.u(p, "uSep"), this.sep ? 1 : 0);
  }
  /** version 9: the frames of the unticked layers into the textures on units 2.. (texImage2D of a VideoFrame stays on the GPU: 0.1-0.3 ms; texSubImage3D into a
   * texture array went through the CPU, 18 ms a 2560x1440 frame in Chrome) */
  private upload(pics: VideoFrame[]) {
    const gl = this.gl;
    pics.forEach((f, i) => {
      gl.activeTexture(gl.TEXTURE2 + i);
      if (!this.layerTex[i]) {
        this.layerTex[i] = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this.layerTex[i]);
        for (const q of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, q, gl.NEAREST);
        for (const q of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, q, gl.CLAMP_TO_EDGE);
      } else gl.bindTexture(gl.TEXTURE_2D, this.layerTex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, f);
    });
    gl.activeTexture(gl.TEXTURE0);
  }
  /** layer k's part of frame f (null: nothing to take away) */
  private crop(k: number, f: number): Crop | null {
    const l = this.meta.layers[k];
    if (l.crops) {
      const st = this.meta.cropStride ?? 12, c = l.crops.slice(f * st, f * st + st);
      if (c.length < st || !c[2]) return null;
      const kind = st > 12 ? c[12] : 0, cw = kind === 1 ? (c[4] + 1) >> 1 : c[4], ch = kind === 1 ? (c[5] + 1) >> 1 : c[5]; // a picture crop: Cb / Cr at the Y tile size (2) or half (1)
      return { box: [c[0], c[1], c[2], c[3]], tiles: [[c[6], c[7], c[4], c[5]], [c[8], c[9], cw, ch], [c[10], c[11], cw, ch]], kind };
    }
    if (!l.ycocg) return null;
    const r = (q: Rect): [number, number, number, number] => [q.x, q.y, q.w!, q.h!];
    return { box: [0, 0, this.meta.tile.w, this.meta.tile.h], tiles: [r(l.ycocg.y), r(l.ycocg.co), r(l.ycocg.cg)], kind: 0 };
  }
  /** draw frame f (the video texture on unit 0) with the layers `off` taken away; version 9: pics = their frames (null: nothing to take away in it) */
  draw(off: number[], f: number, pics?: (VideoFrame | null)[]) {
    const gl = this.gl;
    const both = off.map((k, i) => ({ c: this.crop(k, f), pic: pics?.[i] ?? null })).filter((x) => x.c && (!this.sep || x.pic));
    const crops = both.map((x) => x.c!);
    if (this.sep) this.upload(both.map((x) => x.pic!));
    // the tiles to upsample: every difference tile, a picture's planes smaller than the box (slot: the crop's slice, version 9)
    const scaled = crops.flatMap((c, slot) =>
      c.tiles.map((t, j) => ({ t, box: c.box, plane: c.kind ? j : -1, slot })).filter(({ t, box, plane }) => plane < 0 || t[2] !== box[2] || t[3] !== box[3]),
    );
    // version 9: the tiles of different layers overlap in their videos' coordinates: shelf-packed into the atlas for this frame (one that does not fit: bilinear)
    const packed = new Map<number[], number[]>();
    if (this.sep) {
      let x = 0, y = 0, shelf = 0;
      for (const { t } of [...scaled].sort((a, b) => b.t[3] - a.t[3])) {
        if (x + t[2] > this.aw) { x = 0; y += shelf; shelf = 0; }
        if (t[2] > this.aw || y + t[3] > this.ah) continue;
        packed.set(t, [x, this.ah - y - t[3], t[2], t[3]]);
        x += t[2]; shelf = Math.max(shelf, t[3]);
      }
    }
    const vpOf = (t: number[]) => (this.sep ? packed.get(t) ?? [0, 0, 0, 0] : this.vp(t));
    if (this.guided && scaled.length) {
      const pass = (name: string, target: number, src: number, extra: (p: WebGLProgram) => void) => {
        const p = this.progs[name];
        this.useBase(p);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[target]);
        if (src >= 0) {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, this.tex[src]);
          gl.activeTexture(gl.TEXTURE0);
        }
        extra(p);
        for (const { t, box, plane, slot } of scaled) {
          const v = vpOf(t);
          if (!v[2]) continue;
          gl.uniform1i(this.u(p, "uSlot"), slot);
          gl.viewport(v[0], v[1], v[2], v[3]);
          gl.uniform4i(this.u(p, "uVp"), v[0], v[1], v[2], v[3]);
          gl.uniform4i(this.u(p, "uTile"), t[0], t[1], t[2], t[3]);
          gl.uniform4i(this.u(p, "uBox"), box[0], box[1], box[2], box[3]);
          gl.uniform1i(this.u(p, "uPlane"), plane);
          gl.uniform1f(this.u(p, "uEps"), plane < 0 ? GF_EPS : GF_EPS_PIC);
          gl.uniform1f(this.u(p, "uDrop"), PIC_DROP);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
      };
      pass("A", 0, -1, () => {});
      pass("B", 1, 0, (p) => gl.uniform1i(this.u(p, "uA"), 1));
      pass("C", 2, 1, (p) => gl.uniform1i(this.u(p, "uB"), 1));
    }
    const p = this.progs.F;
    this.useBase(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (this.guided) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[2]);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(this.u(p, "uC"), 1);
    }
    gl.uniform1i(this.u(p, "uGuided"), this.guided ? 1 : 0);
    gl.uniform1i(this.u(p, "uN"), crops.length);
    gl.uniform1iv(this.u(p, "uKinds"), Int32Array.from({ length: MAX_LAYERS }, (_, k) => crops[k]?.kind ?? 0));
    const boxes = new Int32Array(MAX_LAYERS * 4), tiles = new Int32Array(MAX_LAYERS * 3 * 4), vps = new Int32Array(MAX_LAYERS * 3 * 4);
    crops.forEach((c, k) => {
      boxes.set(c.box, k * 4);
      c.tiles.forEach((t, j) => {
        tiles.set(t, (3 * k + j) * 4);
        vps.set(vpOf(t), (3 * k + j) * 4);
      });
    });
    gl.uniform4iv(this.u(p, "uBoxes"), boxes);
    gl.uniform4iv(this.u(p, "uTiles"), tiles);
    gl.uniform4iv(this.u(p, "uVps"), vps);
    gl.viewport(0, 0, this.meta.tile.w, this.meta.tile.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  dispose() {
    for (const t of this.layerTex) this.gl.deleteTexture(t);
    for (const t of this.tex) this.gl.deleteTexture(t);
    for (const f of this.fbo) this.gl.deleteFramebuffer(f);
    for (const p of Object.values(this.progs)) this.gl.deleteProgram(p);
  }
}

/** whether the game shows the layer's effect at this frame (the checkbox only says whether the visitor wants it) */
export const visibleAt = (l: LayerMeta | undefined, frame: number): boolean => !l?.visible || l.visible.some(([a, b]) => frame >= a && frame < b);

const pad = (v: number[][]): Float32Array => {
  const a = new Float32Array(MAX_LAYERS * 4);
  v.forEach((q, i) => a.set(q, i * 4));
  return a;
};

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
  return p;
}
