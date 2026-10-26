// WebGL2 compositor for the skill motion video. No framework, no dependency: copy this file as it is into a Next.js client component.
// The video holds the Unity picture (every effect on, as the game shows it) as three grey planes, Y, Cb and Cr in BT.709
// full range: grey keeps full resolution through H.264 4:2:0. The compositor turns them back into RGB. Versions 7 and 9
// (version 9 has no layers); the frame code in the fourth quarter is not drawn.

/** a tile in the video's pixels */
export interface Rect { x: number; y: number; w: number; h: number }
export interface LayerSetMeta {
  version?: number;
  skill?: { name: string; identity?: string };
  fps: number;
  frames: number;
  /** the canvas size */
  tile: { w: number; h: number };
  video: { file: string; w: number; h: number };
  /** the MP4 carries an AAC track of the skill's sound cues */
  audio?: { cues: number } | null;
  /** the picture as BT.709 full-range grey planes; absent before version 7, which this compositor does not draw */
  basePlanes?: { y: Rect; cb: Rect; cr: Rect };
}

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); // fullscreen triangle
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Tiles are x, y, w, h in video uv (y down: uv 0 is the video's top row, the texture is not flipped).
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVideo;
uniform vec4 uY;
uniform vec4 uCb;
uniform vec4 uCr;
uniform vec2 uTexel; // one video texel in uv
// a point of a tile (t in 0..1, y down), kept half a texel inside it: LINEAR filtering never reads the neighbouring tile
vec2 tuv(vec4 r, vec2 t) { return r.xy + clamp(t * r.zw, 0.5 * uTexel, r.zw - 0.5 * uTexel); }
float grey(vec4 r, vec2 t) { return texture(uVideo, tuv(r, t)).g; }
void main() {
  vec2 t = vec2(vUv.x, 1.0 - vUv.y); // canvas y is up, tiles are y down
  float y = grey(uY, t), cb = grey(uCb, t) - 0.5, cr = grey(uCr, t) - 0.5;
  outColor = vec4(clamp(vec3(y + 1.5748 * cr, y - 0.1873 * cb - 0.4681 * cr, y + 1.8556 * cb), 0.0, 1.0), 1.0);
}`;

export class LayerCompositor {
  readonly gl: WebGL2RenderingContext;
  private tex: WebGLTexture;
  private prog: WebGLProgram;

  constructor(readonly canvas: HTMLCanvasElement, readonly meta: LayerSetMeta) {
    const planes = meta.basePlanes;
    if (!planes) throw new Error("layers.json before version 7");
    canvas.width = meta.tile.w;
    canvas.height = meta.tile.h;
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    const prog = (this.prog = link(gl, VERT, FRAG));
    gl.useProgram(prog);
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const { w, h } = meta.video, at = (n: string) => gl.getUniformLocation(prog, n);
    const r = (p: Rect) => [p.x / w, p.y / h, p.w / w, p.h / h];
    gl.uniform2f(at("uTexel"), 1 / w, 1 / h);
    gl.uniform1i(at("uVideo"), 0);
    gl.uniform4fv(at("uY"), r(planes.y));
    gl.uniform4fv(at("uCb"), r(planes.cb));
    gl.uniform4fv(at("uCr"), r(planes.cr));
    gl.viewport(0, 0, meta.tile.w, meta.tile.h);
  }

  /** free the GL objects (the page builds a new compositor when another skill / state is loaded) */
  dispose(): void {
    this.gl.deleteTexture(this.tex);
    this.gl.deleteProgram(this.prog);
  }

  /** draw the video's current frame */
  draw(video: HTMLVideoElement): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

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
