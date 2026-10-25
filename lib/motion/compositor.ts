// WebGL2 compositor for the layered video. No framework, no dependency: copy this file as it is into a Next.js client component.
// Version 7 (`basePlanes`): the base is the Unity picture with every layer on, stored as three grey planes (Y, Cb, Cr, BT.709
// full range: grey keeps full resolution through H.264 4:2:0); each switched-off layer takes its YCoCg difference out
// (e = g * 2 - 1, v = sign(e) * e^2). Versions 4 and 5 (`delta`): the base has every layer off and each switched-on layer adds
// its signed RGB difference (d = sign * sqrt(|diff|) stored as 0.5 + 0.5 * d) in the frames the game shows it.

/** a tile in the video's pixels; w / h absent = the base size (meta.tile): version 2 exports had one tile size */
export interface Rect { x: number; y: number; w?: number; h?: number }
export interface LayerMeta {
  id: string; label: string;
  /** versions 4 and 5: the layer's RGB difference tile */
  delta?: Rect;
  /** version 7: the layer's difference as Y, Co and Cg grey tiles (sizes vary with the layer count) */
  ycocg?: { y: Rect; co: Rect; cg: Rect };
  enabled?: boolean;
  /** never drawn in this skill (its tiles are empty) */
  empty?: boolean;
  /** 시작 때 꺼짐: the game switches it off when the skill starts */
  offAtSkill?: boolean;
  /** versions 4 and 5: the frame ranges [from, to) in which the game shows it (absent: always); version 7 has it in the picture */
  visible?: [number, number][];
}
export interface LayerSetMeta {
  version?: number;
  /** version 7: the base picture has every layer on */
  baseAllOn?: boolean;
  skill: { name: string; identity?: string };
  fps: number;
  frames: number;
  /** the canvas size */
  tile: { w: number; h: number };
  video: { file: string; w: number; h: number };
  /** the MP4 carries an AAC track of the skill's sound cues */
  audio?: { cues: number } | null;
  /** versions 4 and 5: the base picture (version 7 keeps it equal to basePlanes.y for older players) */
  base: Rect;
  /** version 7: the base picture as BT.709 full-range grey planes */
  basePlanes?: { y: Rect; cb: Rect; cr: Rect };
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

// Tiles are x, y, w, h in video uv (y down: uv 0 is the video's top row, the texture is not flipped).
// uPlanes: 1 = version 7 (uBase / uCb / uCr are the Y / Cb / Cr planes, uDelta / uCo / uCg a layer's Y / Co / Cg tiles,
// uOn = 0 takes a layer out); 0 = versions 4 and 5 (uBase is RGB, uDelta a layer's RGB difference, uOn = 1 adds it).
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVideo;
uniform int uPlanes;
uniform vec4 uBase;
uniform vec4 uCb;
uniform vec4 uCr;
uniform int uCount;
uniform vec4 uDelta[${MAX_LAYERS}];
uniform vec4 uCo[${MAX_LAYERS}];
uniform vec4 uCg[${MAX_LAYERS}];
uniform float uOn[${MAX_LAYERS}];
uniform vec2 uTexel; // one video texel in uv
// a point of a tile (t in 0..1, y down), kept half a texel inside it: LINEAR filtering never reads the neighbouring tile
vec2 tuv(vec4 r, vec2 t) { return r.xy + clamp(t * r.zw, 0.5 * uTexel, r.zw - 0.5 * uTexel); }
float grey(vec4 r, vec2 t) { return texture(uVideo, tuv(r, t)).g; }
vec3 signedSquare(vec3 e) { return sign(e) * e * e; }
void main() {
  vec2 t = vec2(vUv.x, 1.0 - vUv.y); // canvas y is up, tiles are y down
  vec3 c;
  if (uPlanes == 1) {
    float y = grey(uBase, t), cb = grey(uCb, t) - 0.5, cr = grey(uCr, t) - 0.5;
    c = vec3(y + 1.5748 * cr, y - 0.1873 * cb - 0.4681 * cr, y + 1.8556 * cb);
    for (int k = 0; k < ${MAX_LAYERS}; k++) {
      if (k >= uCount) break;
      if (uOn[k] > 0.5) continue; // on: already in the picture, nothing is read
      vec3 v = signedSquare(vec3(grey(uDelta[k], t), grey(uCo[k], t), grey(uCg[k], t)) * 2.0 - 1.0);
      c -= vec3(v.x + v.y - v.z, v.x + v.z, v.x - v.y - v.z);
    }
  } else {
    c = texture(uVideo, tuv(uBase, t)).rgb;
    for (int k = 0; k < ${MAX_LAYERS}; k++) {
      if (k >= uCount) break;
      if (uOn[k] < 0.5) continue;
      c += signedSquare(texture(uVideo, tuv(uDelta[k], t)).rgb * 2.0 - 1.0);
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

  constructor(readonly canvas: HTMLCanvasElement, readonly meta: LayerSetMeta) {
    if (meta.layers.length > MAX_LAYERS) throw new Error(`at most ${MAX_LAYERS} layers`);
    canvas.width = meta.tile.w;
    canvas.height = meta.tile.h;
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    const prog = (this.prog = link(gl, VERT, FRAG));
    gl.useProgram(prog);
    for (const n of ["uVideo", "uPlanes", "uBase", "uCb", "uCr", "uCount", "uDelta", "uCo", "uCg", "uOn", "uTexel"]) this.loc[n] = gl.getUniformLocation(prog, n);
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
    const planes = meta.basePlanes, none = [0, 0, 0, 0];
    gl.uniform1i(this.loc.uPlanes, planes ? 1 : 0);
    gl.uniform1i(this.loc.uCount, meta.layers.length);
    if (planes) {
      gl.uniform4fv(this.loc.uBase, r(planes.y));
      gl.uniform4fv(this.loc.uCb, r(planes.cb));
      gl.uniform4fv(this.loc.uCr, r(planes.cr));
      gl.uniform4fv(this.loc.uDelta, pad(meta.layers.map((l) => (l.ycocg ? r(l.ycocg.y) : none))));
      gl.uniform4fv(this.loc.uCo, pad(meta.layers.map((l) => (l.ycocg ? r(l.ycocg.co) : none))));
      gl.uniform4fv(this.loc.uCg, pad(meta.layers.map((l) => (l.ycocg ? r(l.ycocg.cg) : none))));
    } else {
      gl.uniform4fv(this.loc.uBase, r(meta.base));
      gl.uniform4fv(this.loc.uDelta, pad(meta.layers.map((l) => (l.delta ? r(l.delta) : none))));
    }
    this.on = meta.layers.map((l) => l.enabled !== false);
    gl.viewport(0, 0, meta.tile.w, meta.tile.h);
  }

  /** free the GL objects (the page builds a new compositor when another skill / state is loaded) */
  dispose(): void {
    this.gl.deleteTexture(this.tex);
    this.gl.deleteProgram(this.prog);
  }

  /** draw the video's current frame with the current layer switches */
  draw(video: HTMLVideoElement, frame: number): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.uniform1fv(this.loc.uOn, Float32Array.from({ length: MAX_LAYERS }, (_, k) => (layerDrawn(this.meta, k, this.on[k], frame) ? 1 : 0)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

/** whether the game shows the layer's effect at this frame (the checkbox only says whether the visitor wants it) */
export const visibleAt = (l: LayerMeta | undefined, frame: number): boolean => !l?.visible || l.visible.some(([a, b]) => frame >= a && frame < b);

/**
 * Whether layer k's effect is in the drawn picture. Version 7: unless switched off (an empty layer has no tiles and stays
 * in); the frames the game hides it are already blank in its tiles. Versions 4 and 5: switched on and visible at the frame.
 */
function layerDrawn(meta: LayerSetMeta, k: number, on: boolean | undefined, frame: number): boolean {
  const layer = meta.layers[k];
  if (meta.basePlanes) return Boolean(on) || !layer?.ycocg || Boolean(layer.empty);
  return Boolean(on) && visibleAt(layer, frame);
}

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
