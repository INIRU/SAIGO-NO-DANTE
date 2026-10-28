// WebGL2 compositor for the layered video: draws one video frame as base + the sum of the wanted layers' differences (each layer tile holds what switching that buff on changes in the
// picture, signed, bloom included). Version 5: three grey tiles per layer, the difference's Y / Co / Cg, each e = sign * sqrt(|v|) stored as 0.5 + 0.5 * e (grey keeps its full
// resolution in H.264 4:2:0; a colour tile lost half its colour and thin red lines turned to dots). Version 4: one colour tile, d = sign * sqrt(|diff|) per channel.
// No framework, no dependency: copy this file as it is into a Next.js client component.

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

const MAX_LAYERS = 8;

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); // fullscreen triangle
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// uBase / uDelta = x, y, w, h of a tile in video uv (y down: uv 0 is the video's top row, the texture is not flipped)
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVideo;
uniform vec4 uBase; // version 7: the Y plane
uniform vec4 uCb;
uniform vec4 uCr;
uniform float uPlanes; // 1: version 7
uniform int uCount;
uniform vec4 uDelta[${MAX_LAYERS}]; // version 4: the colour tile; version 5: the Y tile
uniform vec4 uCo[${MAX_LAYERS}];
uniform vec4 uCg[${MAX_LAYERS}];
uniform float uYcocg[${MAX_LAYERS}];
uniform float uOn[${MAX_LAYERS}];
uniform vec2 uTexel; // one video texel in uv
// a point of a tile (t in 0..1, y down), kept half a texel inside it: LINEAR filtering never reads the neighbouring tile
vec2 tuv(vec4 r, vec2 t) { return r.xy + clamp(t * r.zw, 0.5 * uTexel, r.zw - 0.5 * uTexel); }
void main() {
  vec2 t = vec2(vUv.x, 1.0 - vUv.y); // canvas y is up, tiles are y down
  vec3 c;
  if (uPlanes > 0.5) {
    float y = texture(uVideo, tuv(uBase, t)).g, cb = texture(uVideo, tuv(uCb, t)).g - 0.5, cr = texture(uVideo, tuv(uCr, t)).g - 0.5;
    c = vec3(y + 1.5748 * cr, y - 0.1873 * cb - 0.4681 * cr, y + 1.8556 * cb);
  } else c = texture(uVideo, tuv(uBase, t)).rgb;
  for (int k = 0; k < ${MAX_LAYERS}; k++) {
    if (k >= uCount) break;
    if (uOn[k] == 0.0) continue; // the layer's weight: +1 add (version <= 5, ticked and shown), -1 take away (version 7, unticked)
    if (uYcocg[k] > 0.5) {
      vec3 e = vec3(texture(uVideo, tuv(uDelta[k], t)).g, texture(uVideo, tuv(uCo[k], t)).g, texture(uVideo, tuv(uCg[k], t)).g) * 2.0 - 1.0;
      vec3 v = sign(e) * e * e; // Y, Co, Cg
      c += uOn[k] * vec3(v.x + v.y - v.z, v.x + v.z, v.x - v.y - v.z);
    } else {
      vec3 d = texture(uVideo, tuv(uDelta[k], t)).rgb * 2.0 - 1.0;
      c += uOn[k] * sign(d) * d * d;
    }
  }
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

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
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
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

// ---------------------------------------------------------------- versions 7 / 8: the layer-off view
// Version 8 crops each layer per frame (`crops`: the screen box where it changes the picture and the PICTURE WITHOUT IT there, Y / Cb / Cr tiles like the base's
// planes): unticking swaps that picture in. A tile at the box size is used texel by texel; a smaller one (Cb / Cr at half, a large crop the export scaled down) and
// version 7's fixed small difference tiles are upsampled with a guided filter (He & Sun 2015, "Fast Guided Filter"): per low-res texel a linear model
// tile ≈ a · G + b over a 3x3 window (G = the base's same plane for a picture, the base's Y / Co / Cg 3-vector for a difference), the coefficients averaged and
// applied at full resolution: the effects come off without outlines and the rest stays as sharp as the base. Without float render targets: bilinear.
const GF_EPS = 1e-5; // a difference tile
const GF_EPS_PIC = 1e-5; // a picture plane's difference from the base
const PIC_DROP = 2 / 255; // a smaller difference is codec noise (the crop's and the base's): dropped, so where the layer changes nothing the view is the base itself
const GF_COMMON = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uVideo;
uniform ivec2 uBY; uniform ivec2 uBCb; uniform ivec2 uBCr; // the base planes' top-left texels
uniform sampler2D uLayers[${MAX_LAYERS}]; uniform int uSep; // version 9: the unticked layers' video frames, one texture each
// a crop tile's texel p: in the slot's layer frame (version 9) or in the video
float tileTex(int slot, ivec2 p) {
  if (uSep == 0) return texelFetch(uVideo, p, 0).g;
  ${Array.from({ length: MAX_LAYERS }, (_, i) => `if (slot == ${i}) return texelFetch(uLayers[${i}], p, 0).g;`).join("\n  ")}
  return 0.5;
}
// the base picture and its guide (Y, Co, Cg) at screen pixel p (top-down)
vec3 baseRgb(ivec2 p) {
  float y = texelFetch(uVideo, uBY + p, 0).g, cb = texelFetch(uVideo, uBCb + p, 0).g - 0.5, cr = texelFetch(uVideo, uBCr + p, 0).g - 0.5;
  return vec3(y + 1.5748 * cr, y - 0.1873 * cb - 0.4681 * cr, y + 1.8556 * cb);
}
// plane c (0 Y, 1 Cb, 2 Cr; Cb / Cr centred on 0) of the base at p
float basePlane(int c, ivec2 p) { return texelFetch(uVideo, (c == 0 ? uBY : c == 1 ? uBCb : uBCr) + p, 0).g - (c == 0 ? 0.0 : 0.5); }
// plane c of the base at continuous screen position q (texel centres at + 0.5), bilinear
float baseBil(int c, vec2 q) {
  vec2 u = clamp(q - 0.5, vec2(0.0), vec2(1918.999, 1078.999)); ivec2 i = ivec2(floor(u)); vec2 f = u - vec2(i);
  return mix(mix(basePlane(c, i), basePlane(c, i + ivec2(1, 0)), f.x), mix(basePlane(c, i + ivec2(0, 1)), basePlane(c, i + ivec2(1, 1)), f.x), f.y);
}
// plane c of the base at a crop tile's texel l, downscaled as the export downscaled the crop (LayerExport mode 4: four bilinear taps a quarter footprint apart)
float baseDown(int c, ivec4 box, ivec4 tile, ivec2 l) {
  vec2 s = vec2(box.zw) / vec2(tile.zw), q = vec2(box.xy) + (vec2(l) + 0.5) * s, d = 0.25 * s;
  return 0.25 * (baseBil(c, q + vec2(-d.x, -d.y)) + baseBil(c, q + vec2(d.x, -d.y)) + baseBil(c, q + vec2(-d.x, d.y)) + baseBil(c, q + vec2(d.x, d.y)));
}
vec3 guide(vec3 c) { return vec3((c.r + 2.0 * c.g + c.b) * 0.25, (c.r - c.b) * 0.5, (2.0 * c.g - c.r - c.b) * 0.25); }
float decode(float t) { float e = t * 2.0 - 1.0; return sign(e) * e * e; }
// a tile's low-res texel l (top-down) in the atlas framebuffer of viewport vp (x, y bottom-up, w, h)
ivec2 atl(ivec4 vp, ivec2 l) { return ivec2(vp.x + l.x, vp.y + vp.w - 1 - l.y); }
`;
// pass A, per tile: the low-res guide and the low-res difference. uPlane -1: a difference tile (G = the base's Y / Co / Cg averaged over the texel's footprint in xyz,
// the value decoded in w); 0..2: a picture plane (G = the base's same plane downscaled as the export did in x, the tile - G in y, 0 below uDrop)
const GF_A = GF_COMMON + `
uniform ivec4 uTile; uniform ivec4 uBox; uniform ivec4 uVp; uniform int uPlane; uniform float uDrop; uniform int uSlot;
out vec4 o;
void main() {
  ivec2 l = ivec2(int(gl_FragCoord.x) - uVp.x, uVp.w - 1 - (int(gl_FragCoord.y) - uVp.y));
  vec2 s = vec2(uBox.zw) / vec2(uTile.zw);
  ivec2 p0 = uBox.xy + ivec2(floor(vec2(l) * s)), p1 = min(uBox.xy + ivec2(ceil(vec2(l + 1) * s)), uBox.xy + uBox.zw);
  vec3 g = vec3(0.0); float n = 0.0;
  float t = tileTex(uSlot, uTile.xy + l);
  if (uPlane >= 0) {
    float g = baseDown(uPlane, uBox, uTile, l), d = t - (uPlane == 0 ? 0.0 : 0.5) - g;
    o = vec4(g, abs(d) < uDrop ? 0.0 : d, 0.0, 0.0);
    return;
  }
  for (int j = 0; j < 16; j++) { if (p0.y + j >= p1.y) break;
    for (int i = 0; i < 16; i++) { if (p0.x + i >= p1.x) break; g += guide(baseRgb(p0 + ivec2(i, j))); n += 1.0; } }
  o = vec4(g / max(n, 1.0), decode(t));
}`;
// pass B: the 3x3 statistics -> a (3-vector), b; a picture plane (uPlane >= 0): a, b of the scalar guide in x, y
const GF_B = GF_COMMON + `
uniform sampler2D uA; uniform ivec4 uVp; uniform float uEps; uniform int uPlane;
out vec4 o;
void main() {
  ivec2 l = ivec2(int(gl_FragCoord.x) - uVp.x, uVp.w - 1 - (int(gl_FragCoord.y) - uVp.y));
  if (uPlane >= 0) {
    float mi = 0.0, mp = 0.0, ii = 0.0, ip = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 t = texelFetch(uA, atl(uVp, clamp(l + ivec2(i, j), ivec2(0), uVp.zw - 1)), 0).xy;
      mi += t.x; mp += t.y; ii += t.x * t.x; ip += t.x * t.y;
    }
    mi /= 9.0; mp /= 9.0; ii /= 9.0; ip /= 9.0;
    float a = (ip - mi * mp) / (ii - mi * mi + uEps);
    o = vec4(a, mp - a * mi, 0.0, 0.0);
    return;
  }
  vec3 mg = vec3(0.0); float mp = 0.0; vec3 gp = vec3(0.0); vec3 d = vec3(0.0), od = vec3(0.0); // od: (01, 02, 12)
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec4 t = texelFetch(uA, atl(uVp, clamp(l + ivec2(i, j), ivec2(0), uVp.zw - 1)), 0);
    mg += t.xyz; mp += t.w; gp += t.xyz * t.w; d += t.xyz * t.xyz; od += vec3(t.x * t.y, t.x * t.z, t.y * t.z);
  }
  mg /= 9.0; mp /= 9.0; gp /= 9.0; d /= 9.0; od /= 9.0;
  mat3 S = mat3(d.x - mg.x * mg.x + uEps, od.x - mg.x * mg.y, od.y - mg.x * mg.z,
                od.x - mg.x * mg.y, d.y - mg.y * mg.y + uEps, od.z - mg.y * mg.z,
                od.y - mg.x * mg.z, od.z - mg.y * mg.z, d.z - mg.z * mg.z + uEps);
  vec3 a = inverse(S) * (gp - mg * mp);
  o = vec4(a, mp - dot(a, mg));
}`;
// pass C: a, b averaged over 3x3
const GF_C = GF_COMMON + `
uniform sampler2D uB; uniform ivec4 uVp;
out vec4 o;
void main() {
  ivec2 l = ivec2(int(gl_FragCoord.x) - uVp.x, uVp.w - 1 - (int(gl_FragCoord.y) - uVp.y));
  vec4 s = vec4(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) s += texelFetch(uB, atl(uVp, clamp(l + ivec2(i, j), ivec2(0), uVp.zw - 1)), 0);
  o = s / 9.0;
}`;
// final: the base minus every unticked layer's difference inside its box: a full-size crop texel by texel, a scaled one guided (or bilinear)
const GF_FINAL = GF_COMMON + `
uniform sampler2D uC; uniform int uN; uniform int uGuided;
uniform ivec4 uBoxes[${MAX_LAYERS}];
uniform int uKinds[${MAX_LAYERS}];   // 1 / 2: the crop is the picture without the layer (Y / Cb / Cr), 0: the difference (Y / Co / Cg)
uniform ivec4 uTiles[${MAX_LAYERS * 3}]; // the unticked layers' Y, Co, Cg tiles in the video
uniform ivec4 uVps[${MAX_LAYERS * 3}];   // and their atlas viewports
out vec4 outColor;
vec2 lowPos(ivec4 box, ivec4 tile, ivec2 p) { return clamp((vec2(p - box.xy) + 0.5) * vec2(tile.zw) / vec2(box.zw) - 0.5, vec2(0.0), vec2(tile.zw - 1)); }
float comp(ivec4 box, ivec4 tile, ivec4 vp, ivec2 p, vec3 g) {
  if (tile.zw == box.zw && uGuided == 0) return decode(texelFetch(uVideo, tile.xy + (p - box.xy), 0).g);
  vec2 u = lowPos(box, tile, p);
  ivec2 i0 = ivec2(floor(u)), i1 = min(i0 + 1, tile.zw - 1); vec2 f = u - vec2(i0);
  if (uGuided == 0) {
    float a = decode(texelFetch(uVideo, tile.xy + i0, 0).g), b = decode(texelFetch(uVideo, tile.xy + ivec2(i1.x, i0.y), 0).g);
    float c = decode(texelFetch(uVideo, tile.xy + ivec2(i0.x, i1.y), 0).g), d = decode(texelFetch(uVideo, tile.xy + i1, 0).g);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  vec4 ab = mix(mix(texelFetch(uC, atl(vp, i0), 0), texelFetch(uC, atl(vp, ivec2(i1.x, i0.y)), 0), f.x),
                mix(texelFetch(uC, atl(vp, ivec2(i0.x, i1.y)), 0), texelFetch(uC, atl(vp, i1), 0), f.x), f.y);
  return dot(ab.xyz, g) + ab.w;
}
// plane c of a picture crop at screen pixel p: the tile texel when the tile is the box's size, else the base + the guided difference (or the tile bilinear)
float pic(int c, ivec4 box, ivec4 tile, ivec4 vp, int slot, ivec2 p) {
  float off = c == 0 ? 0.0 : 0.5;
  if (tile.zw == box.zw) return tileTex(slot, tile.xy + (p - box.xy)) - off;
  vec2 u = lowPos(box, tile, p);
  ivec2 i0 = ivec2(floor(u)), i1 = min(i0 + 1, tile.zw - 1); vec2 f = u - vec2(i0);
  if (uGuided == 0 || vp.z == 0) // (no float targets, or the tile did not fit the atlas)
    return mix(mix(tileTex(slot, tile.xy + i0), tileTex(slot, tile.xy + ivec2(i1.x, i0.y)), f.x),
               mix(tileTex(slot, tile.xy + ivec2(i0.x, i1.y)), tileTex(slot, tile.xy + i1), f.x), f.y) - off;
  vec2 ab = mix(mix(texelFetch(uC, atl(vp, i0), 0).xy, texelFetch(uC, atl(vp, ivec2(i1.x, i0.y)), 0).xy, f.x),
                mix(texelFetch(uC, atl(vp, ivec2(i0.x, i1.y)), 0).xy, texelFetch(uC, atl(vp, i1), 0).xy, f.x), f.y);
  float g = basePlane(c, p);
  return g + ab.x * g + ab.y;
}
void main() {
  ivec2 p = ivec2(int(gl_FragCoord.x), 1079 - int(gl_FragCoord.y));
  vec3 c = baseRgb(p), g = guide(c);
  for (int k = 0; k < ${MAX_LAYERS}; k++) {
    if (k >= uN) break;
    ivec4 b = uBoxes[k];
    if (p.x < b.x || p.y < b.y || p.x >= b.x + b.z || p.y >= b.y + b.w) continue;
    if (uKinds[k] > 0) {
      float y = pic(0, b, uTiles[3 * k], uVps[3 * k], k, p), cb = pic(1, b, uTiles[3 * k + 1], uVps[3 * k + 1], k, p), cr = pic(2, b, uTiles[3 * k + 2], uVps[3 * k + 2], k, p);
      c += vec3(y + 1.5748 * cr, y - 0.1873 * cb - 0.4681 * cr, y + 1.8556 * cb) - baseRgb(p); // swap the layer-off picture in (several off: their changes add)
      continue;
    }
    float y = comp(b, uTiles[3 * k], uVps[3 * k], p, g), co = comp(b, uTiles[3 * k + 1], uVps[3 * k + 1], p, g), cg = comp(b, uTiles[3 * k + 2], uVps[3 * k + 2], p, g);
    c -= vec3(y + co - cg, y + cg, y - co - cg);
  }
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

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

/** version 9: a layer's own video (MP4, H.264 without B-frames: sample n = frame n), decoded with WebCodecs. frame(n) hands over exactly frame n — the page asks for the
 * number it read from the base frame it draws, so the two can never drift apart (two <video> elements can: their clocks only roughly follow each other) */
export class LayerVideo {
  private data: Uint8Array | null = null;
  private samples: { off: number; size: number; key: boolean }[] = [];
  private keys: number[] = [];
  private config: VideoDecoderConfig | null = null;
  private dec: VideoDecoder | null = null;
  private next = 0; // the next sample to decode
  private want = -1;
  private frames = new Map<number, VideoFrame>();
  private failed = false;
  /** a frame the last frame() call waited for is ready */
  onFrame: (() => void) | null = null;
  static AHEAD = 8; // frames decoded ahead of the asked one (playback asks for the next ones soon)

  constructor(url: string, private fps: number, private count: number) {
    fetch(url).then((r) => r.arrayBuffer()).then((b) => this.open(new Uint8Array(b))).catch((e) => { console.error("layer video", url, e); this.failed = true; });
  }
  private open(b: Uint8Array) {
    const m = parseMp4(b);
    this.data = b;
    this.samples = m.samples;
    this.keys = m.samples.map((s, i) => (s.key ? i : -1)).filter((i) => i >= 0);
    this.config = { codec: m.codec, description: m.avcC, codedWidth: m.w, codedHeight: m.h, optimizeForLatency: true };
    if (this.want >= 0) this.frame(this.want);
  }
  /** frame n: the frame, null when it does not exist / failed, undefined while it is being decoded */
  frame(n: number): VideoFrame | null | undefined {
    if (this.failed || n >= this.count) return null;
    this.want = n;
    for (const [i, f] of this.frames) if (i < n - 1 || i > n + LayerVideo.AHEAD + 4) { f.close(); this.frames.delete(i); }
    if (!this.data || !this.config) return undefined;
    const have = this.frames.get(n);
    // restart at the key frame before n when n is behind the decoder or a key frame lies between it and n (a seek)
    const key = this.keys.filter((i) => i <= n).pop() ?? 0;
    if (!have && (!this.dec || this.dec.state !== "configured" || n < this.next - (this.dec.decodeQueueSize + 4) || key > this.next)) this.restart(key);
    this.feed();
    return have;
  }
  private restart(from: number) {
    if (!this.dec || this.dec.state === "closed") {
      this.dec = new VideoDecoder({
        output: (f) => {
          const i = Math.round((f.timestamp * this.fps) / 1e6);
          if (i < this.want - 1 || i > this.want + LayerVideo.AHEAD + 4 || this.frames.has(i)) { f.close(); return; }
          this.frames.set(i, f);
          if (i === this.want) this.onFrame?.();
          this.feed();
        },
        error: (e) => { console.error("layer video decode", e); this.dec = null; },
      });
      this.dec.addEventListener("dequeue", () => this.feed());
    } else this.dec.reset();
    this.dec.configure(this.config!);
    this.next = from;
  }
  private feed() {
    const d = this.dec;
    if (!d || d.state !== "configured" || !this.data) return;
    const end = Math.min(this.want + LayerVideo.AHEAD, this.samples.length - 1);
    while (this.next <= end && d.decodeQueueSize < 12) {
      const s = this.samples[this.next];
      d.decode(new EncodedVideoChunk({ type: s.key ? "key" : "delta", timestamp: Math.round((this.next * 1e6) / this.fps), data: this.data.subarray(s.off, s.off + s.size) }));
      this.next++;
    }
    if (this.next >= this.samples.length && d.decodeQueueSize === 0) d.flush().catch(() => {}); // (the last frames: a decoder may hold them until more input)
  }
  close() {
    for (const f of this.frames.values()) f.close();
    this.frames.clear();
    if (this.dec && this.dec.state !== "closed") this.dec.close();
    this.dec = null;
  }
}

/** the one video track of an MP4 (a layer video from LimbusViewer.LayerExport.cs): the codec string, avcC, size, and every sample's place and key flag */
function parseMp4(b: Uint8Array) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let avcC: Uint8Array | null = null, w = 0, h = 0, sizes: number[] = [], chunks: number[] = [], stsc: [number, number][] = [], sync: Set<number> | null = null;
  const walk = (s: number, e: number) => {
    for (let p = s; p + 8 <= e; ) {
      let size = dv.getUint32(p), hd = 8;
      const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
      if (size === 1) { size = Number(dv.getBigUint64(p + 8)); hd = 16; } else if (size === 0) size = e - p;
      const c = p + hd, end = p + size;
      if (type === "moov" || type === "trak" || type === "mdia" || type === "minf" || type === "stbl") walk(c, end);
      else if (type === "stsd") walk(c + 8, end);
      else if (type === "avc1") { w = dv.getUint16(c + 24); h = dv.getUint16(c + 26); walk(c + 78, end); }
      else if (type === "avcC") avcC = b.slice(c, end);
      else if (type === "stsz") { const fixed = dv.getUint32(c + 4), n = dv.getUint32(c + 8); sizes = Array.from({ length: n }, (_, i) => fixed || dv.getUint32(c + 12 + 4 * i)); }
      else if (type === "stco") chunks = Array.from({ length: dv.getUint32(c + 4) }, (_, i) => dv.getUint32(c + 8 + 4 * i));
      else if (type === "co64") chunks = Array.from({ length: dv.getUint32(c + 4) }, (_, i) => Number(dv.getBigUint64(c + 8 + 8 * i)));
      else if (type === "stsc") stsc = Array.from({ length: dv.getUint32(c + 4) }, (_, i) => [dv.getUint32(c + 8 + 12 * i), dv.getUint32(c + 12 + 12 * i)] as [number, number]);
      else if (type === "stss") sync = new Set(Array.from({ length: dv.getUint32(c + 4) }, (_, i) => dv.getUint32(c + 8 + 4 * i) - 1));
      p = end;
    }
  };
  walk(0, b.length);
  if (!avcC || !sizes.length || !chunks.length) throw new Error("not an H.264 MP4");
  const samples: { off: number; size: number; key: boolean }[] = [];
  for (let ci = 0, si = 0; ci < chunks.length; ci++) {
    let per = 0;
    for (const [first, n] of stsc) if (first <= ci + 1) per = n;
    for (let j = 0, off = chunks[ci]; j < per && si < sizes.length; j++, si++) { samples.push({ off, size: sizes[si], key: sync ? (sync as Set<number>).has(si) : true }); off += sizes[si]; }
  }
  const a = avcC as Uint8Array;
  const codec = "avc1." + [a[1], a[2], a[3]].map((x) => x.toString(16).padStart(2, "0")).join("");
  return { codec, avcC: a, w, h, samples };
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
