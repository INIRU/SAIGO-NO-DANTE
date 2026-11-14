// The stage map effects' Shader Graphs, translated from their DX11 disassembly (Limbus Assets
// out/_story_map/fx/<subchapter>_<stage>/shaders/*.fp.asm, pipeline/story_map_fx.py). The vertex inputs are those of
// shaders.ts: TEXCOORD0.xy = vUV; with the renderer's custom streams [.., UV, StableRandomXY] TEXCOORD0.zw = vRand;
// [.., UV, Custom1XY, StableRandomXY] TEXCOORD0.zw = vC1.xy and TEXCOORD1.xy = vRand; COLOR = vColor. Each graph runs
// its colours through a linear → sRGB node (srgb() here) and blends SrcAlpha / OneMinusSrcAlpha: output premultiplied.
import { HEAD } from './shaders'

const MAP = HEAD + /* glsl */ `
vec3 srgb(vec3 c) { return mix(c * 12.92321, 1.055 * pow(abs(c), vec3(0.416667)) - 0.055, step(vec3(0.003131), c)); }
float srgb1(float c) { return c <= 0.003131 ? c * 12.92321 : 1.055 * pow(abs(c), 0.416667) - 0.055; }
float step01(float x) { return x >= 0.01 ? 1.0 : 0.0; }
// Unity's Simple Noise node: value noise, hash fract(sin(dot(p, (12.9898, 78.233))) * 43758.5453), three octaves
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.546875); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float snoise(vec2 uv, float scale) { return vnoise(uv * scale) * 0.125 + vnoise(uv * scale * 0.5) * 0.25 + vnoise(uv * scale * 0.25) * 0.5; }
// Unity's Voronoi node (angle offset 2): the distance to the nearest cell point
float voronoi(vec2 uv, float density) {
  vec2 g = floor(uv * density), f = fract(uv * density);
  float m = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 l = vec2(float(x), float(y)), c = g + l;
    vec2 rv = vec2(sin(2.0 * fract(sin(dot(c, vec2(47.63, 89.98))))) * 0.5 + 0.5, cos(2.0 * fract(sin(dot(c, vec2(15.27, 99.41))))) * 0.5 + 0.5);
    m = min(m, length(l + rv - f));
  }
  return m;
}
uniform vec4 uColorMain;
`

/** Shader Graphs/FX_Grp_Burn: a round spot, burning out by the particle colour (g = edge, b = softness). */
export const BURN = MAP + /* glsl */ `
void main() {
  float r = 1.0 - max(1.0 - 2.0 * length(vUV - 0.5), 0.0);
  float a = clamp(1.0 - (r * 1.7320508 - vColor.g) / max(vColor.b, 0.00001), 0.0, 1.0) * vColor.a;
  finalColor = vec4(srgb(uColorMain.rgb) * a, a);
}`

/** Shader Graphs/FX_Grp_Smoke1 (t0 noise, t1 Tex_Main): smoke dissolving by the particle colour's red. */
export const SMOKE1 = MAP + /* glsl */ `
uniform sampler2D uNoise; uniform sampler2D uMain;
uniform vec2 uTiling;
uniform vec4 uP; // Power_Gradient, Alp, Dissolve, Rule
void main() {
  float n = texture(uNoise, vUV * uTiling * 0.75 + vRand).x * 0.75;
  float y = clamp((n - 0.450004) * 6.666835, 0.0, 1.0), z = clamp((n - 0.6) * 2.5, 0.0, 1.0);
  vec2 yz = step01(y) > 0.5 ? vec2(0.66, 0.34) : vec2(0.33, 0.67);
  float g = srgb1(step01(z) * yz.y + yz.x);
  g = uP.x * (n - g) + g;
  vec3 rgb = g * srgb(uColorMain.rgb);
  float dd = 2.0 * (vColor.r - 0.5);
  float th = uP.w * (uP.z - dd) + dd;
  float m = clamp(n - th, 0.0, 1.0);
  float s = texture(uMain, vUV).x;
  float q = step01(clamp((s * m - 0.332998) * 1.499245, 0.0, 1.0));
  float ab = uP.x * (s * m - q) + q;
  float a = (uP.w * (uP.y - vColor.a) + vColor.a) * ab;
  finalColor = vec4(rgb * a, a);
}`

/** Shader Graphs/FX_Grp_GlassPiece1 (t0 the shard texture): shards broken up by noise, dissolving by the colour's red. */
export const GLASS = MAP + /* glsl */ `
uniform sampler2D uMain;
void main() {
  float x = clamp((snoise(vUV, 50.0) - 2.0 * (vColor.r - 0.5) - 0.250004) * 3.999939, 0.0, 1.0);
  float a = clamp(srgb1(x), 0.0, 1.0) * texture(uMain, vUV).x * vColor.a;
  finalColor = vec4(srgb(uColorMain.rgb) * a, a);
}`

/** Shader Graphs/FX_Grp_Square (t0 the square mask): the mask, hard-cut with _Rule; alpha from Alp only. */
export const SQUARE = MAP + /* glsl */ `
uniform sampler2D uMain;
uniform vec2 uP; // Alp, _Rule
void main() {
  float t = texture(uMain, vUV).x;
  float s = step01(clamp((t - 0.2) * 1.25, 0.0, 1.0));
  float v = uP.y * (s - t) + t;
  float a = v * uP.x;
  finalColor = vec4(v * srgb(uColorMain.rgb) * a, a);
}`

/** Shader Graphs/FX_Grp_LineLight2 (t0 Tex_Main): the texture, eaten from the dark end by the colour's red. */
export const LINELIGHT2 = MAP + /* glsl */ `
uniform sampler2D uMain;
void main() {
  float t = texture(uMain, vUV).x;
  float v = clamp(t - 2.0 * (vColor.r - 0.5), 0.0, 1.0) * t;
  float a = v * vColor.a;
  finalColor = vec4(v * srgb(uColorMain.rgb) * a, a);
}`

/** Shader Graphs/FX_Grp_CC_CityPaper1 (t0 the paper texture): its colours, the particle's alpha. */
export const CITYPAPER = MAP + /* glsl */ `
uniform sampler2D uMain;
void main() {
  float a = vColor.a;
  finalColor = vec4(srgb(uColorMain.rgb) * texture(uMain, vUV).rgb * a, a);
}`

/** Shader Graphs/FX_Grp_UI_7_5_1_SpotLight1 (t0 _MainTex). */
export const SPOTLIGHT = MAP + /* glsl */ `
uniform sampler2D uMain;
uniform float uAlp;
void main() {
  float t = texture(uMain, vUV).x * uAlp;
  float a = t * vColor.a;
  finalColor = vec4(vec3(clamp(t, 0.0, 1.0)) * a, a);
}`

/** Shader Graphs/FX_Grp_0_Master_Dissolve (t0 _Tex_Main, t1 _Tex_Mask, t2/t3 _Tex_Noise1/2; streams Custom1XY,
 * StableRandomXY): rotated main texture, two panning noises for the dissolve, a vector mask and a toon outline. */
export const MASTER_DISSOLVE = MAP + /* glsl */ `
uniform sampler2D uMain; uniform sampler2D uMask; uniform sampler2D uNoise1; uniform sampler2D uNoise2;
uniform vec4 uTiling;   // _Tiling_Noise1.xy, _Tiling_Noise2.xy
uniform vec4 uPanner;   // _Panner_Noise1.xy, _Panner_Noise2.xy
uniform vec4 uA;        // _Dissolve, _ToonPower, _Rule, _Alp
uniform vec4 uB;        // _OutLine_OnOff, _VectorMask_OnOff, _VectorMask_Rotate, _VectorMask_MaskPower
uniform vec4 uC;        // _VectorMask_Value, _Rotate_Main, _MaskTex_OutputChange, 0
uniform vec2 uTilingMain;
uniform vec4 uColorOut;
void main() {
  float ang = uC.y * 0.017453; float s = sin(ang), c = cos(ang);
  vec2 p = vUV - 0.5;
  vec2 muv = (vec2(dot(p, vec2(c, s)), dot(p, vec2(-s, c))) + 0.5) * uTilingMain;
  vec4 mk = texture(uMask, muv);
  vec4 mn = texture(uMain, muv);
  float m = uC.z * (clamp(mk.a, 0.0, 1.0) - mk.r) + mk.r;
  float th = uA.z * (uA.x - vC1.x) + vC1.x;
  vec4 nuv = uPanner * uTime + vRand.xyxy + vUV.xyxy * uTiling;
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
  vec3 cm = srgb(uColorMain.rgb), c4 = mn.rgb * cm;
  vec3 col = c4 * x0 + srgb(uColorOut.rgb) * (1.0 - x0) - c4;
  vec3 rgb = uB.x * col + c4;
  float a = (uA.z * (uA.w - vColor.a) + vColor.a) * y0;
  finalColor = vec4(rgb * a, a);
}`

/** Shader Graphs/FX_Grp_CC_WaterFish_Hammer (t0 the hammer, t1 its mask): noise and Voronoi panning over the mask. */
export const WATERFISH = MAP + /* glsl */ `
uniform sampler2D uMain; uniform sampler2D uMask;
uniform vec4 uTiling;   // Tiling_Noise1.xy, Tiling_Noise2.xy
uniform vec4 uPanner;   // Panner_Noise1.xy, Panner_Noise2.xy
uniform vec3 uP;        // Dissolve, Rule, _Alp
void main() {
  float t0 = texture(uMain, vUV).x, t1 = texture(uMask, vUV).x;
  float n = snoise(vUV * uTiling.xy + uTime * uPanner.xy, 15.0);
  float v = voronoi(vUV * uTiling.zw + uTime * uPanner.zw, 10.0);
  float w = n * (1.0 - v) + 0.1;
  float th = uP.y * (2.0 * (vColor.r - 0.5) - uP.x) + uP.x;
  float k = t1 * w - th;
  vec2 yz = clamp((t1 * k + vec2(-0.089998, -0.099855)) * vec2(101.447304, 4.289221), 0.0, 1.0);
  float y2 = clamp(yz.y * (0.25 - yz.x) + yz.x, 0.0, 1.0);
  float lum = w * 0.285714 + t0 * t0 + y2;
  float x = clamp(y2 * (y2 + t0), 0.0, 1.0);
  float yv = x * uP.z;
  float a = uP.y * (x * vColor.a - yv) + yv;
  finalColor = vec4(lum * srgb(uColorMain.rgb) * a, a);
}`

/** Shader Graphs/FX_Grp_Vortex: a Voronoi x noise swirl that bends the picture behind it (_CameraOpaqueTexture,
 * here uScene: the map drawn under the effects, screen-sized, y up) and darkens where it cuts. */
export const VORTEX = MAP + /* glsl */ `
uniform sampler2D uScene;
uniform vec2 uView;     // screen size in pixels
uniform vec4 uMainTP;   // Tiling_MainNoise.xy, Panner_MainNoise.xy
uniform vec4 uSubTP;    // Tiling_SubNoise.xy, Panner_SubNoise.xy
uniform vec4 uP;        // Dissolve, DistortionPower, Rule, Alp
void main() {
  vec2 q = vUV.yx - 0.5;
  float d = length(q), e = min(2.0 * d, 1.0);
  float s = sin(d * 10.0), c = cos(d * 10.0);
  vec2 tw = vec2(c * q.x + q.y * s, c * q.y - q.x * s);
  vec2 r3 = tw.yx + 0.5;
  float n = snoise(r3 * uSubTP.xy + uTime * uSubTP.zw, 25.0);
  float v = voronoi(r3 * uMainTP.xy + uTime * uMainTP.zw, 5.0);
  float m = max(1.0 - 2.0 * d, 0.0) * n * v;
  float th = uP.z * (2.0 * (vColor.r - 0.5) - uP.x) + uP.x;
  m = clamp(m * (v - th), 0.0, 1.0);
  float cut = step01(clamp((e * m - 0.080003) * 3.952655, 0.0, 1.0));
  float m2 = min(m * 3.003025, 1.0);
  vec2 suv = min(gl_FragCoord.xy / uView + uP.y * m2 * e, vec2(1.0) - 0.5 / uView);
  vec3 rgb = srgb(uColorMain.rgb) * cut * texture(uScene, vec2(suv.x, 1.0 - suv.y)).rgb;
  float a = (uP.z * (vColor.a - uP.w) + uP.w) * m2;
  finalColor = vec4(rgb * a, a);
}`
