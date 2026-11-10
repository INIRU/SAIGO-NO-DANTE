import type { DungeonRect, RGBA } from '@/lib/story-map'

/** Draws the story dungeon map the way the game's camera does (WebGL2): every Unity Image is a quad on the map canvas
 * (world y 0), drawn in the game's order with UI/Default's colour (texture × colour, SrcAlpha / OneMinusSrcAlpha),
 * seen by a perspective camera (vertical FOV, pitch about x, near 0.3, far 1000: the dungeon scene's Main Camera),
 * into an HDR target (URP supportsHDR, msaaSampleCount 1: no antialiasing), then URP's Bloom and the uber pass.
 * QualitySettings.activeColorSpace is Gamma: the scene's values are gamma-encoded, as in the game.
 * World axes: x = map x, y = up, z = map y. */

export type Cam = { x: number; h: number; zc: number }
export interface Slice { border: [number, number, number, number]; uv: [number, number, number, number]; fill: boolean }
/** Every item may carry `y`, its world height: MapSpawnManager.InstantiateMapFloor moves floor i by (0, 0, 5 i) in
 * the map canvas's space, 5 i below the first floor. */
export type Item = (
  /** An Image on the map canvas: rect in map units, rotated about its centre (degrees, counter-clockwise), Sliced
   * when `slice`, clipped to a Mask rect; tex '' is a plain colour */
  | { k: 'img'; tex: string; color: RGBA; rect: DungeonRect; rot?: number; tilt?: number; /** mirrored about its centre before the turn (a negative localScale: 8-20 2F panels y -1) */ flip?: [boolean, boolean]; slice?: Slice; clip?: DungeonRect; fit?: boolean
      /** UI/Grayscale (UI_Default_Grayscale: a cleared room's StoryDungeonNodeGrayscale) */
      gray?: boolean
      /** Inside a Unity Mask: drawn where that Image's sprite (fitted in its rect when fit) has alpha above 0.001 */
      mask?: { tex: string; rect: DungeonRect; fit?: boolean } }
  /** A LineRenderer (LineAlignment.View, 0 corner / cap vertices, texture mode Stretch): its points on the map
   * canvas, width in map units; `fx`: drawn with the cleared-line material (setLineFx), else Default-Line (colour) */
  | { k: 'line'; pts: [number, number][]; width: number; color: RGBA; fx?: boolean; soft?: boolean }
  /** TextMeshProUGUI, one line centred in its rect (HorizontalAlignment Center, VerticalAlignment Middle) */
  | { k: 'text'; text: string; font: string; size: number; color: RGBA; rect: DungeonRect; scale?: number }
  /** PlayerToken: a RectTransform standing on (x, y) of the map canvas, tilted `tilt` degrees about x against it */
  | { k: 'token'; tex: string; at: [number, number]; size: [number, number]; pivot: [number, number]; tilt: number; preserveAspect: boolean }
  /** An area name (TextMeshProUGUI, 1~3장 MapTexts): a rect standing on `at` (pivot (0.5, 0)), tilted about x, lifted by
   * -z; laid out as TMP does: auto size within sizeRange, spacing (character, word, line) in em / 100, lines from the
   * font's FaceInfo (per em), centred across and on the glyphs' bounds (VerticalAlignment Geometry), wrapped at spaces */
  | { k: 'label'; text: string; font: string; face: { lineHeight: number; ascent: number; descent: number }; at: [number, number]; size: [number, number]
      pivot?: [number, number]; align?: number; margin?: [number, number, number, number]; tilt: number; q?: [number, number, number, number]; z: number; color: RGBA; fontSize: number; autoSize: boolean; sizeRange: [number, number]; spacing: [number, number, number]; wrap: boolean }
) & { y?: number }

/** The cleared line's material (Shader Graphs/FX_Grp_0_Master_Dissolve): textures by property with their wrap mode
 * (Unity TextureWrapMode: 0 Repeat, 1 Clamp, 2 Mirror), floats and colours by property name */
export interface LineFx { textures: Record<string, { url: string; wrap: [number, number] }>; floats: Record<string, number>; colors: Record<string, number[]> }
/** URP Bloom (VolumeManager stack) */
export interface Bloom { threshold: number; intensity: number; scatter: number; clamp: number; tint: number[]; maxIterations: number; skipIterations: number; downscale: string }

const VS = `#version 300 es
layout(location = 0) in vec3 aPos; layout(location = 1) in vec2 aUv; layout(location = 2) in vec4 aCol;
layout(location = 3) in vec3 aTan; layout(location = 4) in float aSide;
layout(location = 5) in vec2 aMuv; layout(location = 6) in float aGray; layout(location = 7) in vec3 aNext;
uniform mat4 uVP; uniform vec3 uEye; uniform vec2 uRes; uniform float uFocal;
out vec2 vUv; out vec4 vCol; out vec2 vMuv; out float vGray; out float vLine;
void main() {
  vec4 c = uVP * vec4(aPos, 1.0);
  vLine = 0.0;
  if (aSide != 0.0) {
    // A line vertex (aTan: the previous point, aNext: the next one, aSide: the signed half width in world units).
    // LineAlignment.View keeps the ribbon facing the camera with its width in world units, so it is expanded on screen:
    // the three points projected (x by the aspect, so lengths are even), the join's miter n between the segment
    // directions, its length 1 / dot(n, the segment normal) up to 4 (instanced-lines miter join; butt ends, as the
    // LineRenderer has no cap vertices), the width at this depth: half width x focal / w in NDC y.
    vec4 ca = uVP * vec4(aTan, 1.0), cb = uVP * vec4(aNext, 1.0);
    vec2 asp = vec2(uRes.x / uRes.y, 1.0);
    vec2 sp = c.xy / c.w * asp, sa = ca.xy / ca.w * asp, sb = cb.xy / cb.w * asp;
    vec2 d1 = sp - sa, d2 = sb - sp;
    vec2 da = dot(d1, d1) > 1e-12 ? normalize(d1) : normalize(d2);
    vec2 db = dot(d2, d2) > 1e-12 ? normalize(d2) : da;
    vec2 t = da + db;
    t = dot(t, t) > 1e-8 ? normalize(t) : da;
    vec2 n = vec2(-t.y, t.x);
    float ml = 1.0 / max(dot(n, vec2(-da.y, da.x)), 0.25);
    c.xy += n * (aSide * uFocal / c.w * ml) / asp * c.w;
    vLine = 1.0;
  }
  gl_Position = c;
  vUv = aUv; vCol = aCol; vMuv = aMuv; vGray = aGray;
}`
// UI/Default (and Default-Line): texture × vertex colour. UI/Grayscale (the game's DX11 code): the same colour's
// luminance 0.262 r + 0.678 g + 0.059 b. A Unity Mask (stencil written where the mask Image's alpha passes the UI alpha
// clip, 0.001): the fragment is dropped outside it.
const FS = `#version 300 es
precision highp float;
in vec2 vUv; in vec4 vCol; in vec2 vMuv; in float vGray; in float vLine; uniform sampler2D uTex; uniform sampler2D uMask; uniform float uHasMask; out vec4 o;
// a line's edges: coverage from the distance across it (v 0..1), about a pixel wide (the canvas has no MSAA)
float lineEdge() { float d = abs(vUv.y * 2.0 - 1.0); float aa = max(fwidth(d), 1e-4); return 1.0 - smoothstep(1.0 - aa, 1.0, d); }
void main() {
  o = texture(uTex, vUv) * vCol;
  if (vLine > 0.5) o.a *= lineEdge();
  if (vGray > 0.5) o.rgb = vec3(dot(o.rgb, vec3(0.262, 0.678, 0.059)));
  if (uHasMask > 0.5 && texture(uMask, vMuv).a <= 0.001) discard;
}`
// Shader Graphs/FX_Grp_0_Master_Dissolve, as lib/story-fx/map-shaders.ts MASTER_DISSOLVE translates it from the
// game's DX11 code; a LineRenderer has no custom vertex streams (Custom1XY, StableRandomXY: 0). URP's transparent
// Unlit output clamps alpha to 0..1 (OutputAlpha); blended SrcAlpha / OneMinusSrcAlpha.
const FS_DISSOLVE = `#version 300 es
precision highp float;
in vec2 vUv; in vec4 vCol; in float vLine; out vec4 o;
uniform sampler2D uMain; uniform sampler2D uMask; uniform sampler2D uNoise1; uniform sampler2D uNoise2;
uniform float uTime;
uniform vec4 uColorMain; uniform vec4 uColorOut;
uniform vec4 uTiling;   // _Tiling_Noise1.xy, _Tiling_Noise2.xy
uniform vec4 uPanner;   // _Panner_Noise1.xy, _Panner_Noise2.xy
uniform vec4 uA;        // _Dissolve, _ToonPower, _Rule, _Alp
uniform vec4 uB;        // _OutLine_OnOff, _VectorMask_OnOff, _VectorMask_Rotate, _VectorMask_MaskPower
uniform vec4 uC;        // _VectorMask_Value, _Rotate_Main, _MaskTex_OutputChange, 0
uniform vec2 uTilingMain;
vec3 srgb(vec3 c) { return mix(c * 12.92321, 1.055 * pow(abs(c), vec3(0.416667)) - 0.055, step(vec3(0.003131), c)); }
float step01(float x) { return x >= 0.01 ? 1.0 : 0.0; }
void main() {
  vec2 vC1 = vec2(0.0), vRand = vec2(0.0);
  float ang = uC.y * 0.017453; float s = sin(ang), c = cos(ang);
  vec2 p = vUv - 0.5;
  vec2 muv = (vec2(dot(p, vec2(c, s)), dot(p, vec2(-s, c))) + 0.5) * uTilingMain;
  vec4 mk = texture(uMask, muv);
  vec4 mn = texture(uMain, muv);
  float m = uC.z * (clamp(mk.a, 0.0, 1.0) - mk.r) + mk.r;
  float th = uA.z * (uA.x - vC1.x) + vC1.x;
  vec4 nuv = uPanner * uTime + vRand.xyxy + vUv.xyxy * uTiling;
  float n2 = texture(uNoise2, nuv.zw).x;
  float d = clamp((texture(uNoise1, nuv.xy).x * n2 - th) * m, 0.0, 1.0);
  float va = uB.z * 0.017453;
  float vm = dot(p, vec2(cos(va), sin(va))) + 0.5;
  float pw = uA.z * (uB.w - vC1.y) + vC1.y;
  float vx = clamp((vm * uC.x + pw) * n2, 0.0, 1.0);
  vx = uB.y * (vx - 1.0) + 1.0;
  float dv = d * vx;
  float sy = step01(clamp((dv - 0.250004) * 1.33334, 0.0, 1.0)), sw = step01(clamp((dv - 0.2) * 1.25, 0.0, 1.0));
  float x0 = uA.y * (sy - dv) + dv, y0 = uA.y * (sw - dv) + dv;
  // the LineRenderer's vertex colour (the LINE_STATE colour, gamma, to linear as Unity passes it) tints _Color_Main: the same
  // material draws a CLEARED line orange-yellow and a DEFAULT (blocked, 8-20) one red, as recorded in the game
  vec3 cm = srgb(uColorMain.rgb * pow(vCol.rgb, vec3(2.2))), c4 = mn.rgb * cm;
  vec3 col = c4 * x0 + srgb(uColorOut.rgb) * (1.0 - x0) - c4;
  vec3 rgb = uB.x * col + c4;
  float a = (uA.z * (uA.w - vCol.a) + vCol.a) * y0;
  float ld = abs(vUv.y * 2.0 - 1.0), aa = max(fwidth(ld), 1e-4);
  o = vec4(rgb, clamp(a, 0.0, 1.0) * (vLine > 0.5 ? 1.0 - smoothstep(1.0 - aa, 1.0, ld) : 1.0));
}`

// URP 17 Bloom.shader and UberPost.shader. In Gamma colour space the bloom chain stores sqrt(colour) (EncodeHDR) and
// squares it back (DecodeHDR); the prefilter thresholds the gamma-encoded scene; the uber pass works in linear
// (SRGBToLinear, + bloom × intensity × tint, LinearToSRGB).
const VS_FULL = `#version 300 es
out vec2 vUv;
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`
const POST_HEAD = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
vec4 enc(vec3 c) { return vec4(sqrt(c), 1.0); }
vec3 dec(vec4 c) { return c.rgb * c.rgb; }
`
const FS_PREFILTER = POST_HEAD + `
uniform sampler2D uSrc; uniform float uThreshold; uniform float uKnee; uniform float uClamp;
void main() {
  vec3 color = min(vec3(uClamp), texture(uSrc, vUv).rgb);
  float brightness = max(color.r, max(color.g, color.b));
  float softness = clamp(brightness - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  softness = (softness * softness) / (4.0 * uKnee + 1e-4);
  float multiplier = max(brightness - uThreshold, softness) / max(brightness, 1e-4);
  o = enc(max(color * multiplier, 0.0));
}`
// 2x downsample with a 9-tap gaussian along x (texel: the source's)
const FS_BLUR_H = POST_HEAD + `
uniform sampler2D uSrc; uniform float uTexel;
void main() {
  float t = uTexel * 2.0;
  vec3 c = dec(texture(uSrc, vUv - vec2(t * 4.0, 0.0))) * 0.01621622 + dec(texture(uSrc, vUv - vec2(t * 3.0, 0.0))) * 0.05405405
    + dec(texture(uSrc, vUv - vec2(t * 2.0, 0.0))) * 0.12162162 + dec(texture(uSrc, vUv - vec2(t, 0.0))) * 0.19459459
    + dec(texture(uSrc, vUv)) * 0.22702703
    + dec(texture(uSrc, vUv + vec2(t, 0.0))) * 0.19459459 + dec(texture(uSrc, vUv + vec2(t * 2.0, 0.0))) * 0.12162162
    + dec(texture(uSrc, vUv + vec2(t * 3.0, 0.0))) * 0.05405405 + dec(texture(uSrc, vUv + vec2(t * 4.0, 0.0))) * 0.01621622;
  o = enc(c);
}`
// the same gaussian along y as 5 bilinear taps
const FS_BLUR_V = POST_HEAD + `
uniform sampler2D uSrc; uniform float uTexel;
void main() {
  float t = uTexel;
  vec3 c = dec(texture(uSrc, vUv - vec2(0.0, t * 3.23076923))) * 0.07027027 + dec(texture(uSrc, vUv - vec2(0.0, t * 1.38461538))) * 0.31621622
    + dec(texture(uSrc, vUv)) * 0.22702703
    + dec(texture(uSrc, vUv + vec2(0.0, t * 1.38461538))) * 0.31621622 + dec(texture(uSrc, vUv + vec2(0.0, t * 3.23076923))) * 0.07027027;
  o = enc(c);
}`
const FS_UPSAMPLE = POST_HEAD + `
uniform sampler2D uSrc; uniform sampler2D uLow; uniform float uScatter;
void main() { o = enc(mix(dec(texture(uSrc, vUv)), dec(texture(uLow, vUv)), uScatter)); }`
const FS_UBER = POST_HEAD + `
uniform sampler2D uSrc; uniform sampler2D uBloom; uniform float uIntensity; uniform vec3 uTint; uniform float uOn;
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
void main() {
  vec3 c = toLinear(max(texture(uSrc, vUv).rgb, 0.0));
  if (uOn > 0.5) c += dec(texture(uBloom, vUv)) * uIntensity * uTint;
  o = vec4(toSrgb(c), 1.0);
}`

const STRIDE = 19 // pos 3, uv 2, colour 4, previous point 3, side 1, mask uv 2, gray 1, next point 3
const NEAR = 0.3, FAR = 1000

type Tex = { t: WebGLTexture; w: number; h: number }
type FontInfo = { face: string; asc: number; desc: number }
type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }
type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }

/** Counts instances so the font names of two maps (one leaving, one arriving) never meet in document.fonts. */
let instances = 0

export class DungeonGL {
  /** destroy() ran: pictures and fonts that arrive later are dropped */
  private dead = false
  private readonly id = ++instances
  /** the FontFaces added to document.fonts, removed again on destroy() */
  private registered: FontFace[] = []
  private gl: WebGL2RenderingContext
  private ui: Prog
  private fx: Prog
  private post: Record<'prefilter' | 'blurH' | 'blurV' | 'up' | 'uber', Prog>
  private vao: WebGLVertexArrayObject
  private buf: WebGLBuffer
  private tex = new Map<string, Tex | null>()
  private white: Tex
  /** across a line (v 0..1): alpha falling off from the middle, for a soft glow line */
  private softTex: Tex
  private fonts = new Map<string, Promise<FontInfo | null>>()
  private fontInfo = new Map<string, FontInfo>()
  private data = new Float32Array(1 << 16)
  private hdr = false
  private scene: Target | null = null
  private down: Target[] = []
  private up: Target[] = []
  private lineFx: LineFx | null = null
  private bloom: Bloom | null = null
  private t0 = performance.now()
  /** a texture or font arrived: draw again */
  onLoad: () => void = () => {}

  constructor(readonly canvas: HTMLCanvasElement) {
    if ((window as unknown as { __dungeonCapture?: boolean }).__dungeonCapture) (window as unknown as { __dungeonGL: DungeonGL }).__dungeonGL = this
    // the drawing kept after each frame lets a page screenshot read the canvas (desktop checks); phones skip that copy
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: !window.matchMedia('(pointer: coarse)').matches })
    if (!gl) throw new Error('WebGL2 unavailable')
    this.gl = gl
    // half-float render targets (the HDR camera target and the bloom mips); without them: no bloom
    this.hdr = !!gl.getExtension('EXT_color_buffer_float')
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const prog = (vs: string, fs: string, names: string[]): Prog => {
      const p = gl.createProgram()!
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs))
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs))
      gl.linkProgram(p)
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
      return { p, u: Object.fromEntries(names.map(n => [n, gl.getUniformLocation(p, n)])) }
    }
    this.ui = prog(VS, FS, ['uVP', 'uEye', 'uRes', 'uFocal', 'uTex', 'uMask', 'uHasMask'])
    this.fx = prog(VS, FS_DISSOLVE, ['uVP', 'uEye', 'uRes', 'uFocal', 'uMain', 'uMask', 'uNoise1', 'uNoise2', 'uTime', 'uColorMain', 'uColorOut', 'uTiling', 'uPanner', 'uA', 'uB', 'uC', 'uTilingMain'])
    this.post = {
      prefilter: prog(VS_FULL, FS_PREFILTER, ['uSrc', 'uThreshold', 'uKnee', 'uClamp']),
      blurH: prog(VS_FULL, FS_BLUR_H, ['uSrc', 'uTexel']),
      blurV: prog(VS_FULL, FS_BLUR_V, ['uSrc', 'uTexel']),
      up: prog(VS_FULL, FS_UPSAMPLE, ['uSrc', 'uLow', 'uScatter']),
      uber: prog(VS_FULL, FS_UBER, ['uSrc', 'uBloom', 'uIntensity', 'uTint', 'uOn']),
    }
    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)
    this.buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    const attr = (l: number, n: number, off: number) => {
      gl.enableVertexAttribArray(l)
      gl.vertexAttribPointer(l, n, gl.FLOAT, false, STRIDE * 4, off * 4)
    }
    attr(0, 3, 0); attr(1, 2, 3); attr(2, 4, 5); attr(3, 3, 9); attr(4, 1, 12); attr(5, 2, 13); attr(6, 1, 15); attr(7, 3, 16)
    this.white = this.upload(new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1), 1, 1)
    const soft = new Uint8ClampedArray(4 * 64)
    for (let i = 0; i < 64; i++) { const v = (i + 0.5) / 64 - 0.5; soft.set([255, 255, 255, Math.round(255 * Math.exp(-((v / 0.2) ** 2)))], 4 * i) }
    this.softTex = this.upload(new ImageData(soft, 1, 64), 1, 64)
  }

  setLineFx(fx: LineFx | null) { this.lineFx = fx }
  /** Checker read-out (window.__dungeonCapture = true): each drawn item's kind, texture, colour and world vertices of
   * the last frame, with the view-projection matrix and canvas size, for the game-vs-site comparison. */
  capture: { m: number[]; w: number; h: number; items: { k: string; tex?: string; color?: number[]; pts: number[][] }[] } | null = null
  setBloom(b: Bloom | null) { this.bloom = b }

  private upload(src: TexImageSource, w: number, h: number, wrap: [number, number] = [1, 1]): Tex {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
    // the game's textures here: bilinear, no mipmaps (m_MipCount 1, FilterMode Bilinear)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    const mode = (m: number) => (m === 0 ? gl.REPEAT : m === 2 ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, mode(wrap[0]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, mode(wrap[1]))
    return { t, w, h }
  }

  private get(url: string, wrap: [number, number] = [1, 1]): Tex | null {
    const key = wrap[0] === 1 && wrap[1] === 1 ? url : `${url}|${wrap.join(',')}`
    if (this.tex.has(key)) return this.tex.get(key)!
    this.tex.set(key, null)
    fetch(url).then(r => (r.ok ? r.blob() : Promise.reject(r.status)))
      .then(b => createImageBitmap(b, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
      .then(bm => {
        if (this.dead) { bm.close(); return }
        this.tex.set(key, this.upload(bm, bm.width, bm.height, wrap)); bm.close(); this.onLoad()
      }, () => {})
    return null
  }

  /** The font file loaded as a web font, with its hhea ascender / descender per em (FreeType's face metrics, which
   * TMP's FaceInfo takes) */
  private font(url: string): FontInfo | null {
    if (!this.fonts.has(url)) {
      this.fonts.set(url, fetch(url).then(r => r.arrayBuffer()).then(async buf => {
        const v = new DataView(buf)
        const tables = new Map<string, number>()
        for (let i = 0, n = v.getUint16(4); i < n; i++) {
          const o = 12 + 16 * i
          tables.set(String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3)), v.getUint32(o + 8))
        }
        const em = v.getUint16(tables.get('head')! + 18), hh = tables.get('hhea')!
        const face = `dungeon-font-${this.id}-${this.fonts.size}`
        const ff = new FontFace(face, buf)
        await ff.load()
        if (this.dead) return null
        document.fonts.add(ff)
        this.registered.push(ff)
        const info = { face, asc: v.getInt16(hh + 4) / em, desc: -v.getInt16(hh + 6) / em }
        this.fontInfo.set(url, info)
        this.onLoad()
        return info
      }).catch(() => null))
    }
    return this.fontInfo.get(url) ?? null
  }

  /** A site web font (url) by a family name of its own, once loaded */
  private webFonts = new Map<string, string | null>()
  private webFont(url: string): string | null {
    if (!this.webFonts.has(url)) {
      this.webFonts.set(url, null)
      const face = `dungeon-web-${this.id}-${this.webFonts.size}`
      const ff = new FontFace(face, `url(${url})`)
      ff.load().then(f => {
        if (this.dead) return
        document.fonts.add(f); this.registered.push(f)
        this.webFonts.set(url, face); this.onLoad()
      }, () => {})
    }
    return this.webFonts.get(url) ?? null
  }

  /** An area name laid out as TMP does, drawn white into a texture (128 px per map unit) with the box it covers in the
   * rect's own units (x from the rect's left, y up from its bottom) */
  private labelTex(it: Extract<Item, { k: 'label' }>): { t: Tex; x0: number; x1: number; y0: number; y1: number } | null {
    const fam = this.webFont(it.font)
    if (!fam) return null
    const key = `label:${it.font}|${it.text}|${it.size.join('x')}|${it.fontSize}|${it.sizeRange.join('-')}|${it.align ?? 2}|${it.margin ?? ''}`
    const hit = this.labels.get(key)
    if (hit) return hit
    const M = 100 // px per em when measuring
    const m = document.createElement('canvas').getContext('2d')!
    m.font = `${M}px "${fam}"`
    const adv = (ch: string) => m.measureText(ch).width / M
    const [cs, ws, ls] = it.spacing.map(v => v * 0.01)
    // a run's width in em: each glyph's advance, the character spacing after each but the last, the word spacing on spaces
    const width = (t: string) => [...t].reduce((a, ch, i, all) => a + adv(ch) + (i < all.length - 1 ? cs : 0) + (ch === ' ' ? ws : 0), 0)
    const [w, h] = it.size
    // m_margin (left, top, right, bottom): the area the text is fitted into (a negative margin lets it run past the rect)
    const [ml, mt, mr, mb] = it.margin ?? [0, 0, 0, 0], fw = w - ml - mr, fh = h - mt - mb
    const lay = (S: number) => {
      const lines: string[] = []
      for (const para of it.text.split('\n')) {
        if (!it.wrap) { lines.push(para); continue }
        let cur = ''
        for (const word of para.split(' ')) {
          const next = cur ? `${cur} ${word}` : word
          if (cur && width(next) * S > w) { lines.push(cur); cur = word } else cur = next
        }
        lines.push(cur)
      }
      return lines
    }
    const step = it.face.lineHeight + ls // line advance in em
    const fits = (S: number) => { const ls2 = lay(S); return Math.max(...ls2.map(width)) * S <= fw + 1e-4 && ((it.face.ascent - it.face.descent) + (ls2.length - 1) * step) * S <= fh + 1e-4 }
    let S = it.fontSize
    if (it.autoSize) {
      // TMP auto size: from the maximum, halving the gap to the last size that did / did not fit, each size rounded to
      // 0.05 (sizes such as 1.35 and 0.7 in 8장), until the gap is under 0.051
      const r20 = (v: number) => Math.floor(v * 20 + 0.5) / 20
      let lo = it.sizeRange[0], hi = it.sizeRange[1]
      S = hi
      for (let i = 0; i < 100; i++) {
        if (!fits(S)) { hi = S; S = Math.max(r20(S - Math.max((S - lo) / 2, 0.05)), it.sizeRange[0]); if (S <= it.sizeRange[0]) break }
        else if (hi - lo > 0.051 && S < it.sizeRange[1]) { lo = S; S = Math.min(r20(S + Math.max((hi - S) / 2, 0.05)), it.sizeRange[1]) }
        else break
      }
    }
    const lines = lay(S)
    // VerticalAlignment Geometry: the glyphs' bounds (first line's ink top to the last line's ink bottom) centred
    const inkTop = m.measureText(lines[0] || ' ').actualBoundingBoxAscent / M, inkBot = m.measureText(lines[lines.length - 1] || ' ').actualBoundingBoxDescent / M
    const geomH = (inkTop + (lines.length - 1) * step + inkBot) * S
    const base0 = h / 2 + geomH / 2 - inkTop * S // first baseline, up from the rect's bottom
    const maxW = Math.max(...lines.map(width)) * S
    // TMP HorizontalAlignmentOptions: 1 Left, 2 Center, 4 Right (others: centred)
    const hx = (lw: number) => (it.align === 1 ? 0 : it.align === 4 ? w - lw : (w - lw) / 2)
    const x0 = Math.min(0, hx(maxW)) - 0.2 * S, x1 = Math.max(w, hx(maxW) + maxW) + 0.2 * S
    const y1 = base0 + (it.face.ascent + 0.2) * S, y0 = base0 - (lines.length - 1) * step * S + (it.face.descent - 0.2) * S
    const R = 128
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.ceil((x1 - x0) * R)); cv.height = Math.max(1, Math.ceil((y1 - y0) * R))
    const c = cv.getContext('2d')!
    c.fillStyle = '#fff'
    c.font = `${S * R}px "${fam}"`
    c.textBaseline = 'alphabetic'
    lines.forEach((line, k) => {
      let x = hx(width(line) * S)
      const by = base0 - k * step * S
      for (const ch of line) {
        c.fillText(ch, (x - x0) * R, (y1 - by) * R)
        x += (adv(ch) + cs + (ch === ' ' ? ws : 0)) * S
      }
    })
    const out = { t: this.upload(cv, cv.width, cv.height), x0, x1, y0, y1 }
    this.labels.set(key, out)
    return out
  }
  private labels = new Map<string, { t: Tex; x0: number; x1: number; y0: number; y1: number }>()

  /** The text drawn white into a texture the size of its rect (128 px per map unit); tinted by the vertex colour */
  private text(it: Extract<Item, { k: 'text' }>): Tex | null {
    const f = this.font(it.font)
    if (!f) return null
    const key = `text:${it.font}|${it.text}|${it.size}|${it.rect[2]}x${it.rect[3]}`
    if (this.tex.has(key)) return this.tex.get(key)!
    const R = 128
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.ceil(it.rect[2] * R))
    cv.height = Math.max(1, Math.ceil(it.rect[3] * R))
    const c = cv.getContext('2d')!
    c.fillStyle = '#fff'
    c.font = `${it.size * R}px "${f.face}"`
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'
    // VerticalAlignment Middle: the line's ascender and descender centred in the rect
    c.fillText(it.text, cv.width / 2, cv.height / 2 + ((f.asc - f.desc) / 2) * it.size * R)
    const t = this.upload(cv, cv.width, cv.height)
    this.tex.set(key, t)
    return t
  }

  /** The screen ray through a pixel of the story screen (landscape.ts local: the canvas fills it), met with the map
   * canvas (world y 0): map (x, y) */
  pick(cx: number, cy: number, cam: Cam, fovDeg: number, pitchDeg: number, planeY = 0): [number, number] | null {
    const r = { left: 0, top: 0, width: this.canvas.clientWidth, height: this.canvas.clientHeight }
    const th = (pitchDeg * Math.PI) / 180, t = Math.tan((fovDeg * Math.PI) / 360)
    const nx = ((cx - r.left) / r.width) * 2 - 1, ny = 1 - ((cy - r.top) / r.height) * 2
    const vx = nx * t * (r.width / r.height), vy = ny * t
    // camera axes: right (1, 0, 0), up (0, cos, sin), forward (0, -sin, cos)
    const dy = vy * Math.cos(th) - Math.sin(th), dz = vy * Math.sin(th) + Math.cos(th)
    if (dy >= 0) return null
    const k = (planeY - cam.h) / dy
    return [cam.x + vx * k, cam.zc + dz * k]
  }

  private target(old: Target | null | undefined, w: number, h: number): Target {
    const gl = this.gl
    if (old && old.w === w && old.h === h) return old
    if (old) { gl.deleteFramebuffer(old.fb); gl.deleteTexture(old.tex) }
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return { fb, tex, w, h }
  }

  /** A full-screen pass of `p` into `dst` (null: the canvas), its textures bound in order to units 0.. */
  private pass(p: Prog, dst: Target | null, w: number, h: number, texs: [string, WebGLTexture][], set: (u: Prog['u']) => void) {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null)
    gl.viewport(0, 0, w, h)
    gl.useProgram(p.p)
    texs.forEach(([name, t], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(p.u[name], i) })
    set(p.u)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.activeTexture(gl.TEXTURE0)
  }

  /** URP Bloom (BloomPostProcessPass): prefilter at the downscaled size, a gaussian pyramid down, scatter blends up */
  private runBloom(w: number, h: number): WebGLTexture | null {
    const b = this.bloom
    if (!b || !this.scene) return null
    const gl = this.gl
    const tw = b.downscale === 'Quarter' ? w >> 2 : w >> 1, th = b.downscale === 'Quarter' ? h >> 2 : h >> 1
    const iterations = Math.floor(Math.log2(Math.max(tw, th)) - 1)
    const mips = Math.max(1, Math.min(iterations - (b.skipIterations ?? 0), b.maxIterations))
    for (let i = 0; i < mips; i++) {
      const mw = Math.max(1, tw >> i), mh = Math.max(1, th >> i)
      this.down[i] = this.target(this.down[i], mw, mh)
      this.up[i] = this.target(this.up[i], mw, mh)
    }
    gl.disable(gl.BLEND)
    // threshold: Mathf.GammaToLinearSpace(threshold), knee half of it
    const thr = Math.pow((b.threshold + 0.055) / 1.055, 2.4)
    this.pass(this.post.prefilter, this.down[0], this.down[0].w, this.down[0].h, [['uSrc', this.scene.tex]], u => {
      gl.uniform1f(u.uThreshold, thr); gl.uniform1f(u.uKnee, thr * 0.5); gl.uniform1f(u.uClamp, b.clamp)
    })
    for (let i = 1; i < mips; i++) {
      const src = this.down[i - 1], mid = this.up[i], dst = this.down[i]
      this.pass(this.post.blurH, mid, mid.w, mid.h, [['uSrc', src.tex]], u => gl.uniform1f(u.uTexel, 1 / src.w))
      this.pass(this.post.blurV, dst, dst.w, dst.h, [['uSrc', mid.tex]], u => gl.uniform1f(u.uTexel, 1 / mid.h))
    }
    const scatter = 0.05 + (0.95 - 0.05) * b.scatter
    for (let i = mips - 2; i >= 0; i--) {
      const low = i === mips - 2 ? this.down[i + 1] : this.up[i + 1], high = this.down[i], dst = this.up[i]
      this.pass(this.post.up, dst, dst.w, dst.h, [['uSrc', high.tex], ['uLow', low.tex]], u => gl.uniform1f(u.uScatter, scatter))
    }
    return mips > 1 ? this.up[0].tex : this.down[0].tex
  }

  draw(items: Item[], cam: Cam, fovDeg: number, pitchDeg: number) {
    const gl = this.gl
    // touch devices draw at 1.5x at most: the HDR target and bloom passes are full-screen
    const dpr = Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2)
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr)
    if (!w || !h) return
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h }
    // the camera's HDR target (gamma-encoded values above 1 kept), or straight to the canvas without float targets
    if (this.hdr) this.scene = this.target(this.scene, w, h)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdr ? this.scene!.fb : null)
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 1) // the Main Camera clears to black (CameraClearFlags.SolidColor, (0, 0, 0))
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)

    const th = (pitchDeg * Math.PI) / 180, t = Math.tan((fovDeg * Math.PI) / 360), a = w / h
    const eye = [cam.x, cam.h, cam.zc]
    const rgt = [1, 0, 0], up = [0, Math.cos(th), Math.sin(th)], fwd = [0, -Math.sin(th), Math.cos(th)]
    const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
    const r0 = rgt.map(v => v / (t * a)), r1 = up.map(v => v / t)
    const zA = (FAR + NEAR) / (FAR - NEAR), zB = (-2 * FAR * NEAR) / (FAR - NEAR)
    const r2 = fwd.map(v => v * zA)
    const rows = [[...r0, -dot(r0, eye)], [...r1, -dot(r1, eye)], [...r2, -dot(r2, eye) + zB], [...fwd, -dot(fwd, eye)]]
    const m = new Float32Array(16)
    for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) m[c * 4 + rr] = rows[rr][c]

    // batches: one program and its textures at a time
    let n = 0, curProg: Prog | null = null, curTex: Tex | null = null
    const flush = () => {
      if (n && curProg) {
        gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, n * STRIDE), gl.STREAM_DRAW)
        gl.drawArrays(gl.TRIANGLES, 0, n)
      }
      n = 0
    }
    let curMaskTex: Tex | null = null
    const useUi = (tx: Tex, mk: Tex | null = null) => {
      if (curProg === this.ui && tx === curTex && mk === curMaskTex) return
      flush()
      if (curProg !== this.ui) {
        gl.useProgram(this.ui.p)
        gl.uniformMatrix4fv(this.ui.u.uVP, false, m)
        gl.uniform3fv(this.ui.u.uEye, eye)
        gl.uniform2f(this.ui.u.uRes, w, h)
        gl.uniform1f(this.ui.u.uFocal, 1 / t)
        gl.uniform1i(this.ui.u.uTex, 0)
        gl.uniform1i(this.ui.u.uMask, 1)
      }
      curProg = this.ui
      curTex = tx
      curMaskTex = mk
      gl.uniform1f(this.ui.u.uHasMask, mk ? 1 : 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, (mk ?? this.white).t)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tx.t)
    }
    const useFx = (): boolean => {
      const fx = this.lineFx
      if (!fx) return false
      const tx = (k: string) => (fx.textures[k] ? this.get(fx.textures[k].url, fx.textures[k].wrap) : null)
      const ts = [tx('_Tex_Main'), tx('_Tex_Mask'), tx('_Tex_Noise1'), tx('_Tex_Noise2')]
      if (ts.some(x => !x)) return false
      if (curProg === this.fx) return true
      flush()
      const u = this.fx.u, f = (k: string) => fx.floats[k] ?? 0, col = (k: string, d = 0) => [0, 1, 2, 3].map(i => fx.colors[k]?.[i] ?? d)
      gl.useProgram(this.fx.p)
      gl.uniformMatrix4fv(u.uVP, false, m)
      gl.uniform3fv(u.uEye, eye)
      gl.uniform2f(u.uRes, w, h)
      gl.uniform1f(u.uFocal, 1 / t)
      ;(['uMain', 'uMask', 'uNoise1', 'uNoise2'] as const).forEach((name, i) => {
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, ts[i]!.t); gl.uniform1i(u[name], i)
      })
      gl.activeTexture(gl.TEXTURE0)
      gl.uniform1f(u.uTime, (performance.now() - this.t0) / 1000)
      gl.uniform4fv(u.uColorMain, col('_Color_Main', 1))
      gl.uniform4fv(u.uColorOut, col('_Color_OutLine'))
      gl.uniform4fv(u.uTiling, [...col('_Tiling_Noise1', 1).slice(0, 2), ...col('_Tiling_Noise2', 1).slice(0, 2)])
      gl.uniform4fv(u.uPanner, [...col('_Panner_Noise1').slice(0, 2), ...col('_Panner_Noise2').slice(0, 2)])
      gl.uniform4fv(u.uA, [f('_Dissolve'), f('_ToonPower'), f('_Rule'), f('_Alp')])
      gl.uniform4fv(u.uB, [f('_OutLine_OnOff'), f('_VectorMask_OnOff'), f('_VectorMask_Rotate'), f('_VectorMask_MaskPower')])
      gl.uniform4fv(u.uC, [f('_VectorMask_Value'), f('_Rotate_Main'), f('_MaskTex_OutputChange'), 0])
      gl.uniform2fv(u.uTilingMain, col('_Tiling_Main', 1).slice(0, 2))
      curProg = this.fx
      curTex = null
      curMaskTex = null
      return true
    }
    // the current Image's mask box (map x0, y0, width, height) and grayscale
    let maskBox: number[] | null = null, grayOn = 0
    const cap = (window as unknown as { __dungeonCapture?: boolean }).__dungeonCapture ? { m: Array.from(m), w, h, items: [] as NonNullable<DungeonGL['capture']>['items'] } : null
    let capIt: { pts: number[][] } | null = null
    const vert = (p: number[], u: number, v: number, c: RGBA, prev: number[] = [0, 0, 0], side = 0, next: number[] = [0, 0, 0]) => {
      // the checker's read-out: a line vertex moved across the line on the floor by its half width (the shader does it on screen)
      if (capIt) { const dx = next[0] - prev[0], dz = next[2] - prev[2], l = Math.hypot(dx, dz) || 1; capIt.pts.push(side ? [p[0] - dz / l * side, p[1], p[2] + dx / l * side] : p) }
      if ((n + 1) * STRIDE > this.data.length) { const d = new Float32Array(this.data.length * 2); d.set(this.data); this.data = d }
      const mu = maskBox ? (p[0] - maskBox[0]) / maskBox[2] : 0, mv = maskBox ? 1 - (p[2] - maskBox[1]) / maskBox[3] : 0
      this.data.set([p[0], p[1], p[2], u, v, c[0], c[1], c[2], c[3], prev[0], prev[1], prev[2], side, mu, mv, grayOn, next[0], next[1], next[2]], n * STRIDE)
      n++
    }
    // a quad of 4 world corners (bottom left, bottom right, top right, top left) and its uv box (v down)
    const quad = (q: number[][], u0: number, v0: number, u1: number, v1: number, c: RGBA) => {
      vert(q[0], u0, v1, c); vert(q[1], u1, v1, c); vert(q[2], u1, v0, c)
      vert(q[0], u0, v1, c); vert(q[2], u1, v0, c); vert(q[3], u0, v0, c)
    }
    // a map-canvas piece x0..x1, y0..y1 (y up) with uv [u0, v top, u1, v bottom], rotated about (cx, cy)
    const piece = (x0: number, y0: number, x1: number, y1: number, uv: number[], c: RGBA, cx: number, cy: number, rot: number, clip?: DungeonRect) => {
      if (clip) {
        const L = clip[0] - clip[2] / 2, R = clip[0] + clip[2] / 2, B = clip[1] - clip[3] / 2, T = clip[1] + clip[3] / 2
        const nx0 = Math.max(x0, L), nx1 = Math.min(x1, R), ny0 = Math.max(y0, B), ny1 = Math.min(y1, T)
        if (nx0 >= nx1 || ny0 >= ny1) return
        const fu = (x: number) => uv[0] + ((x - x0) / (x1 - x0)) * (uv[2] - uv[0])
        const fv = (y: number) => uv[3] + ((y - y0) / (y1 - y0)) * (uv[1] - uv[3])
        uv = [fu(nx0), fv(ny1), fu(nx1), fv(ny0)]
        x0 = nx0; x1 = nx1; y0 = ny0; y1 = ny1
      }
      const cs = Math.cos((rot * Math.PI) / 180), sn = Math.sin((rot * Math.PI) / 180)
      // a turn about x through the centre (a part standing up towards the camera): the rect's local y lifts it by -sin and
      // runs along the floor by cos, as a label's tilt
      const upY = -Math.sin((tiltNow * Math.PI) / 180), upZ = Math.cos((tiltNow * Math.PI) / 180)
      const P = (x: number, y: number) => { const dx = (x - cx) * mirX, dy = (y - cy) * mirY, ry = dx * sn + dy * cs; return [cx + dx * cs - dy * sn, lift + upY * ry, cy + upZ * ry] }
      quad([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], uv[0], uv[1], uv[2], uv[3], c)
    }

    let lift = 0, tiltNow = 0, mirX = 1, mirY = 1
    for (const it of items) {
      lift = it.y ?? 0
      tiltNow = it.k === 'img' ? it.tilt ?? 0 : 0
      mirX = it.k === 'img' && it.flip?.[0] ? -1 : 1
      mirY = it.k === 'img' && it.flip?.[1] ? -1 : 1
      if (cap) { const c = { k: it.k === 'line' && it.soft ? 'halo' : it.k, tex: 'tex' in it ? it.tex : 'text' in it && typeof it.text === 'string' ? it.text : undefined, color: 'color' in it ? it.color : undefined, pts: [] }; cap.items.push(c); capIt = c }
      maskBox = null
      grayOn = 0
      if (it.k === 'img') {
        const tx = it.tex ? this.get(it.tex) : this.white
        if (!tx) continue
        let mk: Tex | null = null
        if (it.mask) {
          mk = this.get(it.mask.tex)
          if (!mk) continue
          let [, , mw, mh] = it.mask.rect
          if (it.mask.fit) { const sa = mk.w / mk.h; if (sa > mw / mh) mh = mw / sa; else mw = mh * sa }
          maskBox = [it.mask.rect[0] - mw / 2, it.mask.rect[1] - mh / 2, mw, mh]
        }
        grayOn = it.gray ? 1 : 0
        useUi(tx, mk)
        const [cx, cy] = it.rect
        let [, , rw, rh] = it.rect
        // Image.preserveAspect: the sprite fitted in the rect about its centre (pivot 0.5)
        if (it.fit && !it.slice) { const sa = tx.w / tx.h; if (sa > rw / rh) rh = rw / sa; else rw = rh * sa }
        const x0 = cx - rw / 2, x1 = cx + rw / 2, y0 = cy - rh / 2, y1 = cy + rh / 2
        const rot = it.rot ?? 0
        if (!it.slice) { piece(x0, y0, x1, y1, [0, 0, 1, 1], it.color, cx, cy, rot, it.clip); continue }
        // Image.Type.Sliced: the borders keep their size, shrunk together when the rect is smaller than both
        // (Image.GetAdjustedBorders)
        let [bl, bb, br, bt] = it.slice.border
        if (bl + br > rw && bl + br > 0) { const s = rw / (bl + br); bl *= s; br *= s }
        if (bb + bt > rh && bb + bt > 0) { const s = rh / (bb + bt); bb *= s; bt *= s }
        const [ul, ub, ur, ut] = it.slice.uv
        const xs = [x0, x0 + bl, x1 - br, x1], us = [0, ul, 1 - ur, 1]
        const ys = [y0, y0 + bb, y1 - bt, y1], vs = [1, 1 - ub, ut, 0] // v down: the bottom edge is v 1
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          if (i === 1 && j === 1 && !it.slice.fill) continue
          if (xs[i + 1] <= xs[i] || ys[j + 1] <= ys[j]) continue
          piece(xs[i], ys[j], xs[i + 1], ys[j + 1], [us[i], vs[j + 1], us[i + 1], vs[j]], it.color, cx, cy, rot, it.clip)
        }
      } else if (it.k === 'text') {
        const tx = this.text(it)
        if (!tx) continue
        useUi(tx)
        // its parent's scale (IconFrame on hover) applied to the rect; the texture is drawn once at scale 1
        const sc = it.scale ?? 1, cx = it.rect[0], cy = it.rect[1], rw = it.rect[2] * sc, rh = it.rect[3] * sc
        piece(cx - rw / 2, cy - rh / 2, cx + rw / 2, cy + rh / 2, [0, 0, 1, 1], it.color, cx, cy, 0)
      } else if (it.k === 'label') {
        const lb = this.labelTex(it)
        if (!lb) continue
        useUi(lb.t)
        // the rect's local up after its tilt about x (as the PlayerToken); its local z lifts it (the canvas's z is down)
        // the rect from its pivot (1~3장: (0.5, 0); 8장: (0, 0)); y measured up from the rect's bottom
        const pv = it.pivot ?? [0.5, 0], bot = -it.size[1] * pv[1]
        const tl = (it.tilt * Math.PI) / 180, upY = -Math.sin(tl), upZ = Math.cos(tl), left = it.at[0] - it.size[0] * pv[0], h0 = lift - it.z
        // the whole local rotation when given (a label turned on the floor too): the rect's local (x, y, 0) from its pivot
        // rotated by q in canvas axes (x, map y, z down), then to the world
        const q = it.q
        const rotQ = (v: number[]) => {
          const [ux, uy, uz, w] = q!, c1 = [uy * v[2] - uz * v[1], uz * v[0] - ux * v[2], ux * v[1] - uy * v[0]]
          const c2 = [uy * c1[2] - uz * c1[1], uz * c1[0] - ux * c1[2], ux * c1[1] - uy * c1[0]]
          return [v[0] + 2 * (w * c1[0] + c2[0]), v[1] + 2 * (w * c1[1] + c2[1]), v[2] + 2 * (w * c1[2] + c2[2])]
        }
        const C = (x: number, yy: number) => {
          if (!q) return [left + x, h0 + upY * (yy + bot), it.at[1] + upZ * (yy + bot)]
          const r = rotQ([x - it.size[0] * pv[0], yy + bot, 0])
          return [it.at[0] + r[0], h0 - r[2], it.at[1] + r[1]]
        }
        quad([C(lb.x0, lb.y0), C(lb.x1, lb.y0), C(lb.x1, lb.y1), C(lb.x0, lb.y1)], 0, 0, 1, 1, it.color)
      } else if (it.k === 'line') {
        if (!(it.fx && useFx())) useUi(it.soft ? this.softTex : this.white)
        // points one after another (a repeated point would leave a join without a direction)
        const P = it.pts.map(([x, y]) => [x, lift, y]).filter((q, i, a) => i === 0 || Math.hypot(q[0] - a[i - 1][0], q[2] - a[i - 1][2]) > 1e-6)
        if (P.length < 2) continue
        // LineTextureMode.Stretch: u along the whole line by length, v across it
        const len = [0]
        for (let i = 1; i < P.length; i++) len.push(len[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][2] - P[i - 1][2]))
        const L = len[len.length - 1] || 1
        const hw = it.width / 2, c = it.color
        // one quad per segment; each vertex carries its point's neighbours, so the two quads at a join meet on the
        // same miter (the shader expands them on screen)
        for (let i = 0; i + 1 < P.length; i++) {
          const A = P[i], B = P[i + 1], pa = P[i - 1] ?? A, nb = P[i + 2] ?? B, ua = len[i] / L, ub = len[i + 1] / L
          vert(A, ua, 0, c, pa, -hw, B); vert(B, ub, 0, c, A, -hw, nb); vert(B, ub, 1, c, A, hw, nb)
          vert(A, ua, 0, c, pa, -hw, B); vert(B, ub, 1, c, A, hw, nb); vert(A, ua, 1, c, pa, hw, B)
        }
      } else {
        const tx = this.get(it.tex)
        if (!tx) continue
        useUi(tx)
        let [w0, h0] = it.size, ox = 0, oy = 0
        // PreserveSpriteAspectRatio: the sprite fitted in the rect, the spare room taken from the side away from the pivot
        if (it.preserveAspect) {
          const sa = tx.w / tx.h
          if (sa > w0 / h0) { const nh = w0 / sa; oy = (h0 - nh) * it.pivot[1]; h0 = nh } else { const nw = h0 * sa; ox = (w0 - nw) * it.pivot[0]; w0 = nw }
        }
        // the rect's local up after its tilt about x, in canvas axes (y, z) = (cos, sin); canvas y is world z, the
        // canvas's z is world down ([Script]MapCanvas: rotation x 90)
        const tl = (it.tilt * Math.PI) / 180
        const upY = -Math.sin(tl), upZ = Math.cos(tl) // world up, world z per unit of the rect's height
        const x0 = it.at[0] - it.size[0] * it.pivot[0] + ox, s0 = -it.size[1] * it.pivot[1] + oy
        const C = (x: number, s: number) => [x, lift + upY * s, it.at[1] + upZ * s]
        quad([C(x0, s0), C(x0 + w0, s0), C(x0 + w0, s0 + h0), C(x0, s0 + h0)], 0, 0, 1, 1, [1, 1, 1, 1])
      }
    }
    flush()
    gl.bindVertexArray(null)
    if (cap) this.capture = cap

    if (this.hdr && this.scene) {
      const bloomTex = this.runBloom(w, h)
      const b = this.bloom
      gl.disable(gl.BLEND)
      this.pass(this.post.uber, null, w, h, [['uSrc', this.scene.tex], ['uBloom', bloomTex ?? this.white.t]], u => {
        gl.uniform1f(u.uOn, bloomTex ? 1 : 0)
        gl.uniform1f(u.uIntensity, b?.intensity ?? 0)
        // tint.linear normalised by its luminance (URP SetupBloom)
        const tl = (b?.tint ?? [1, 1, 1]).slice(0, 3).map(v => Math.pow(v, 2.2))
        const lum = tl[0] * 0.2126729 + tl[1] * 0.7151522 + tl[2] * 0.072175
        gl.uniform3fv(u.uTint, lum > 0 ? tl.map(v => v / lum) : [1, 1, 1])
      })
    }
  }

  destroy() {
    this.dead = true
    for (const f of this.registered) document.fonts.delete(f)
    this.registered = []
    const gl = this.gl
    for (const t of this.tex.values()) if (t) gl.deleteTexture(t.t)
    for (const l of this.labels.values()) gl.deleteTexture(l.t.t)
    gl.deleteTexture(this.white.t)
    for (const tg of [this.scene, ...this.down, ...this.up]) if (tg) { gl.deleteFramebuffer(tg.fb); gl.deleteTexture(tg.tex) }
    gl.deleteBuffer(this.buf)
    gl.deleteVertexArray(this.vao)
    for (const p of [this.ui, this.fx, ...Object.values(this.post)]) gl.deleteProgram(p.p)
  }
}
