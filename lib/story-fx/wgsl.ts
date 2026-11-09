// WebGPU (WGSL) twins of the effect shaders in shaders.ts and map-shaders.ts: the same maths line by line, so PixiJS can
// draw the story map effects with its WebGPU renderer (iOS 26 Safari, Chrome) and fall back to the GLSL ones on WebGL.
// The fx uniform struct is generated in the UniformGroup's own order (PixiJS lays the buffer out the same way); each
// texture resource uX gets a sampler resource uXSampler. Samples use textureSampleLevel(.., 0): WGSL allows the
// implicit-LOD sample only in uniform control flow, and the game's textures have no mipmaps anyway.
import { BURN, CITYPAPER, GLASS, LINELIGHT2, MASTER_DISSOLVE, SMOKE1, SPOTLIGHT, SQUARE, VORTEX, WATERFISH } from "./map-shaders";
import { COMPACT, MAINCUSTOM, OUTLINE, PLAIN } from "./shaders";

const VERTEX = /* wgsl */ `
struct GlobalUniforms { uProjectionMatrix: mat3x3<f32>, uWorldTransformMatrix: mat3x3<f32>, uWorldColorAlpha: vec4<f32>, uResolution: vec2<f32> }
struct LocalUniforms { uTransformMatrix: mat3x3<f32>, uColor: vec4<f32>, uRound: f32 }
@group(0) @binding(0) var<uniform> globalUniforms: GlobalUniforms;
@group(1) @binding(0) var<uniform> localUniforms: LocalUniforms;
struct VOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vUV: vec2<f32>, @location(1) vColor: vec4<f32>, @location(2) vC1: vec4<f32>, @location(3) vC2: vec4<f32>, @location(4) vRand: vec2<f32>,
}
@vertex fn mainVert(@location(0) aPosition: vec2<f32>, @location(1) aUV: vec2<f32>, @location(2) aColor: vec4<f32>,
    @location(3) aCustom1: vec4<f32>, @location(4) aCustom2: vec4<f32>, @location(5) aRand: vec2<f32>) -> VOut {
  let mvp = globalUniforms.uProjectionMatrix * globalUniforms.uWorldTransformMatrix * localUniforms.uTransformMatrix;
  var o: VOut;
  o.pos = vec4<f32>((mvp * vec3<f32>(aPosition, 1.0)).xy, 0.0, 1.0);
  o.vUV = aUV; o.vColor = aColor; o.vC1 = aCustom1; o.vC2 = aCustom2; o.vRand = aRand;
  return o;
}
`;

// shaders.ts HEAD and map-shaders.ts MAP helpers, and T: one texture sample at level 0
const HELPERS = /* wgsl */ `
fn T(t: texture_2d<f32>, s: sampler, uv: vec2<f32>) -> vec4<f32> { return textureSampleLevel(t, s, uv, 0.0); }
fn flag(b: f32) -> f32 { return floor(fx.uFlags / b) % 2.0; }
fn rot2(uv: vec2<f32>, deg: f32) -> vec2<f32> { let a = deg * 0.017453; let s = sin(a); let c = cos(a); let q = uv - 0.5; return vec2<f32>(dot(q, vec2<f32>(c, s)), dot(q, vec2<f32>(-s, c))) + 0.5; }
fn sstep(x0: f32) -> f32 { let x = clamp(x0, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
fn rw(v: vec3<f32>, c1: vec4<f32>, vcol: vec3<f32>) -> vec3<f32> {
  let zn = min(c1.z, 0.0); let wn = min(c1.w, 0.0); let zp = max(c1.z, 0.0); let wp = max(c1.w, 0.0);
  return (v * (zp - wp) + wp) * vcol + (v * (zn - wn) + wn);
}
fn srgb(c: vec3<f32>) -> vec3<f32> { return mix(c * 12.92321, 1.055 * pow(abs(c), vec3<f32>(0.416667)) - 0.055, step(vec3<f32>(0.003131), c)); }
fn srgb1(c: f32) -> f32 { if (c <= 0.003131) { return c * 12.92321; } return 1.055 * pow(abs(c), 0.416667) - 0.055; }
fn step01(x: f32) -> f32 { return select(0.0, 1.0, x >= 0.01); }
fn h21(p: vec2<f32>) -> f32 { return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.546875); }
fn vnoise(p: vec2<f32>) -> f32 {
  let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2<f32>(1.0, 0.0)), f.x), mix(h21(i + vec2<f32>(0.0, 1.0)), h21(i + vec2<f32>(1.0, 1.0)), f.x), f.y);
}
fn snoise(uv: vec2<f32>, scale: f32) -> f32 { return vnoise(uv * scale) * 0.125 + vnoise(uv * scale * 0.5) * 0.25 + vnoise(uv * scale * 0.25) * 0.5; }
fn voronoi(uv: vec2<f32>, density: f32) -> f32 {
  let g = floor(uv * density); let f = fract(uv * density); var m = 8.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let l = vec2<f32>(f32(x), f32(y)); let c = g + l;
      let rv = vec2<f32>(sin(2.0 * fract(sin(dot(c, vec2<f32>(47.63, 89.98))))) * 0.5 + 0.5, cos(2.0 * fract(sin(dot(c, vec2<f32>(15.27, 99.41))))) * 0.5 + 0.5);
      m = min(m, length(l + rv - f));
    }
  }
  return m;
}
`;

// The fragment bodies, T(uX, uv) sampling texture uX: the GLSL main()s of shaders.ts / map-shaders.ts
const BODY = new Map<string, string>([
  [PLAIN, `let m = T(uMain, vUV); let a = m.a * vColor.a; return vec4<f32>(m.rgb * vColor.rgb * a, a);`],
  [COMPACT, `
  var sc = fract(fx.uTime * fx.uSpeed.zwxy);
  if (flag(2.0) > 0.5) { sc = sc + vRand.xyxy; }
  let nuv = (vUV * vC2.xy + sc.xy) * fx.uNoiseST.xy + fx.uNoiseST.zw;
  let n = (T(uNoise, nuv).xyxy - 0.5) * vC1.x;
  let k = vec4<f32>(fx.uMulti.xx, fx.uMulti.yy) * n + 1.0;
  var q = vec4<f32>(vUV - 0.5, vUV - 0.5) * select(vec4<f32>(1.0), k, flag(4.0) > 0.5) + 0.5;
  if (flag(4.0) < 0.5) { q = q + vec4<f32>(n.xy * fx.uMulti.x, n.zw * fx.uMulti.y); }
  let duv = (q.zw * vC2.zw + sc.zw) * fx.uDissST.xy + fx.uDissST.zw;
  let m = T(uMain, q.xy * fx.uMainST.xy + fx.uMainST.zw);
  let d = T(uDissolve, duv).x;
  let isRW = flag(1.0);
  let shape = select(m.w, m.x, isRW > 0.5);
  let x = sstep((shape * d + vC1.y - fx.uDissHard) / (1.0 - fx.uDissHard));
  let a = clamp(clamp(vC1.y, 1.0, 100.0) * shape * x * vColor.a, 0.0, 1.0);
  let c = select(rw(m.rgb, vC1, vColor.rgb), rw(vec3<f32>(m.x), vC1, vColor.rgb), isRW > 0.5);
  return vec4<f32>(c * a, a);`],
  [OUTLINE, `
  let stab = select(vec2<f32>(0.0), vRand, flag(2.0) > 0.5);
  let nr = rot2(vUV, fx.uRotate.y);
  let nuv = vec2<f32>(nr.y * fx.uTwist.y + nr.x, nr.y) * fx.uNoiseTO.xy + fract(fx.uTime * vec2<f32>(fx.uSpeedU.y, fx.uSpeedV.y)) + fx.uNoiseTO.zw;
  let n = (T(uNoise, nuv).xy - 0.5) * vC1.x;
  let dr = rot2(vUV, fx.uRotate.z);
  let duv = (n * fx.uMulti.y + vec2<f32>(dr.y * fx.uTwist.x + dr.x, dr.y)) * fx.uDissTO.xy + fract(fx.uTime * vec2<f32>(fx.uSpeedU.z, fx.uSpeedV.z)) + fx.uDissTO.zw + stab;
  let d = T(uDissolve, duv).x;
  let mr = rot2(vUV, fx.uRotate.x);
  let muv = (n * fx.uMulti.x + vec2<f32>(mr.y * fx.uTwist.x + mr.x, mr.y)) * vC2.zw + fract(fx.uTime * vec2<f32>(fx.uSpeedU.x, fx.uSpeedV.x)) + vC2.xy;
  let m = T(uMain, muv).x;
  let inv = 1.0 - vC1.y;
  let w = m * d - 2.0 * inv + 1.0;
  let bodyv = clamp((m * w - inv) / (1.0 - fx.uHard.z), 0.0, 1.0);
  let edge = clamp((m * w - (inv + fx.uHard.x)) / (1.0 - fx.uHard.y), 0.0, 1.0);
  let outline = (1.0 - sstep(edge)) * fx.uOutlineColor.a;
  let cr = rot2(vUV, fx.uRotate.w);
  let cuv = (n * fx.uMulti.z + vec2<f32>(cr.y * fx.uTwist.w + cr.x, cr.y)) * fx.uColorTO.xy + fract(fx.uTime * vec2<f32>(fx.uSpeedU.w, fx.uSpeedV.w)) + fx.uColorTO.zw + stab;
  let ct = T(uColor, cuv);
  let lo = fx.uColorHard.y - 0.5 + fx.uColorHard.x;
  let wdt = (fx.uColorHard.y - 0.5 - fx.uColorHard.x + 1.0) - lo;
  var s = clamp((vec4<f32>(ct.x, ct.x, ct.y, ct.z) - lo) / wdt, vec4<f32>(0.0), vec4<f32>(1.0));
  s = s * s * (3.0 - 2.0 * s);
  let zn = min(vC1.z, 0.0); let wn = min(vC1.w, 0.0); let zp = max(vC1.z, 0.0); let wp = max(vC1.w, 0.0);
  let dark = s.x * (zn - wn) + wn;
  let bright = s.yzw * (zp - wp) + wp;
  let c = mix(bright * vColor.rgb + dark, srgb(fx.uOutlineColor.rgb), vec3<f32>(outline));
  let a = min(sstep(bodyv), 1.0) * vColor.a;
  return vec4<f32>(c * a, a);`],
  [MAINCUSTOM, `
  let nr = rot2(vUV, fx.uRotate.y);
  let nuv = vec2<f32>(nr.y * fx.uTwist.y + nr.x, nr.y) * fx.uNoiseTO.xy + fract(fx.uTime * fx.uSpeed.zw) + fx.uNoiseTO.zw;
  let n = (T(uNoise, nuv).xy - 0.5) * vC1.x;
  let dr = rot2(vUV, fx.uRotate.z);
  let duv = (fx.uMulti.y * n + vec2<f32>(dr.y * fx.uTwist.x + dr.x, dr.y)) * fx.uDissTO.xy + fract(fx.uTime * fx.uDSpeed) + fx.uDissTO.zw;
  let kr = rot2(vUV, fx.uRotate.w);
  let mask = clamp(T(uMask, kr * fx.uMaskTO.xy + fx.uMaskTO.zw).x * fx.uMulti.z, 0.0, 1.0);
  let d = T(uDissolve, duv).x * mask;
  let mr = rot2(vUV, fx.uRotate.x);
  let muv = (fx.uMulti.x * n + vec2<f32>(mr.y * fx.uTwist.x + mr.x, mr.y)) * vC2.zw + fract(fx.uTime * fx.uSpeed.xy) + vC2.xy;
  let m = T(uMain, muv);
  let x0 = sstep((m.x * d + vC1.y - fx.uDissHard) / (1.0 - fx.uDissHard)) * vColor.a;
  let x = clamp(m.x * x0, 0.0, 1.0);
  let a = min(clamp(vC1.y, 1.0, 100.0) * x, 1.0);
  let c = rw(vec3<f32>(m.x), vC1, vColor.rgb);
  return vec4<f32>(c * a, a);`],
  [BURN, `
  let r = 1.0 - max(1.0 - 2.0 * length(vUV - 0.5), 0.0);
  let a = clamp(1.0 - (r * 1.7320508 - vColor.g) / max(vColor.b, 0.00001), 0.0, 1.0) * vColor.a;
  return vec4<f32>(srgb(fx.uColorMain.rgb) * a, a);`],
  [SMOKE1, `
  let n = T(uNoise, vUV * fx.uTiling * 0.75 + vRand).x * 0.75;
  let y = clamp((n - 0.450004) * 6.666835, 0.0, 1.0); let z = clamp((n - 0.6) * 2.5, 0.0, 1.0);
  let yz = select(vec2<f32>(0.33, 0.67), vec2<f32>(0.66, 0.34), step01(y) > 0.5);
  let g0 = srgb1(step01(z) * yz.y + yz.x);
  let g = fx.uP.x * (n - g0) + g0;
  let rgb = g * srgb(fx.uColorMain.rgb);
  let dd = 2.0 * (vColor.r - 0.5);
  let th = fx.uP.w * (fx.uP.z - dd) + dd;
  let m = clamp(n - th, 0.0, 1.0);
  let s = T(uMain, vUV).x;
  let q = step01(clamp((s * m - 0.332998) * 1.499245, 0.0, 1.0));
  let ab = fx.uP.x * (s * m - q) + q;
  let a = (fx.uP.w * (fx.uP.y - vColor.a) + vColor.a) * ab;
  return vec4<f32>(rgb * a, a);`],
  [GLASS, `
  let x = clamp((snoise(vUV, 50.0) - 2.0 * (vColor.r - 0.5) - 0.250004) * 3.999939, 0.0, 1.0);
  let a = clamp(srgb1(x), 0.0, 1.0) * T(uMain, vUV).x * vColor.a;
  return vec4<f32>(srgb(fx.uColorMain.rgb) * a, a);`],
  [SQUARE, `
  let t = T(uMain, vUV).x;
  let s = step01(clamp((t - 0.2) * 1.25, 0.0, 1.0));
  let v = fx.uP.y * (s - t) + t;
  let a = v * fx.uP.x;
  return vec4<f32>(v * srgb(fx.uColorMain.rgb) * a, a);`],
  [LINELIGHT2, `
  let t = T(uMain, vUV).x;
  let v = clamp(t - 2.0 * (vColor.r - 0.5), 0.0, 1.0) * t;
  let a = v * vColor.a;
  return vec4<f32>(v * srgb(fx.uColorMain.rgb) * a, a);`],
  [CITYPAPER, `
  let a = vColor.a;
  return vec4<f32>(srgb(fx.uColorMain.rgb) * T(uMain, vUV).rgb * a, a);`],
  [SPOTLIGHT, `
  let t = T(uMain, vUV).x * fx.uAlp;
  let a = t * vColor.a;
  return vec4<f32>(vec3<f32>(clamp(t, 0.0, 1.0)) * a, a);`],
  [MASTER_DISSOLVE, `
  let ang = fx.uC.y * 0.017453; let s = sin(ang); let c = cos(ang);
  let p = vUV - 0.5;
  let muv = (vec2<f32>(dot(p, vec2<f32>(c, s)), dot(p, vec2<f32>(-s, c))) + 0.5) * fx.uTilingMain;
  let mk = T(uMask, muv); let mn = T(uMain, muv);
  let m = fx.uC.z * (clamp(mk.a, 0.0, 1.0) - mk.r) + mk.r;
  let th = fx.uA.z * (fx.uA.x - vC1.x) + vC1.x;
  let nuv = fx.uPanner * fx.uTime + vRand.xyxy + vUV.xyxy * fx.uTiling;
  let n2 = T(uNoise2, nuv.zw).x;
  let d = clamp((T(uNoise1, nuv.xy).x * n2 - th) * m, 0.0, 1.0);
  let va = fx.uB.z * 0.017453;
  let vm = dot(p, vec2<f32>(cos(va), sin(va))) + 0.5;
  let pw = fx.uA.z * (fx.uB.w - vC1.y) + vC1.y;
  let vx = fx.uB.y * (clamp((vm * fx.uC.x + pw) * n2, 0.0, 1.0) - 1.0) + 1.0;
  let dv = d * vx;
  let sy = step01(clamp((dv - 0.250004) * 1.33334, 0.0, 1.0)); let sw = step01(clamp((dv - 0.2) * 1.25, 0.0, 1.0));
  let x0 = fx.uA.y * (sy - dv) + dv; let y0 = fx.uA.y * (sw - dv) + dv;
  let c4 = mn.rgb * srgb(fx.uColorMain.rgb);
  let col = c4 * x0 + srgb(fx.uColorOut.rgb) * (1.0 - x0) - c4;
  let rgb = fx.uB.x * col + c4;
  let a = (fx.uA.z * (fx.uA.w - vColor.a) + vColor.a) * y0;
  return vec4<f32>(rgb * a, a);`],
  [WATERFISH, `
  let t0 = T(uMain, vUV).x; let t1 = T(uMask, vUV).x;
  let n = snoise(vUV * fx.uTiling.xy + fx.uTime * fx.uPanner.xy, 15.0);
  let v = voronoi(vUV * fx.uTiling.zw + fx.uTime * fx.uPanner.zw, 10.0);
  let w = n * (1.0 - v) + 0.1;
  let th = fx.uP.y * (2.0 * (vColor.r - 0.5) - fx.uP.x) + fx.uP.x;
  let k = t1 * w - th;
  let yz = clamp((t1 * k + vec2<f32>(-0.089998, -0.099855)) * vec2<f32>(101.447304, 4.289221), vec2<f32>(0.0), vec2<f32>(1.0));
  let y2 = clamp(yz.y * (0.25 - yz.x) + yz.x, 0.0, 1.0);
  let lum = w * 0.285714 + t0 * t0 + y2;
  let x = clamp(y2 * (y2 + t0), 0.0, 1.0);
  let yv = x * fx.uP.z;
  let a = fx.uP.y * (x * vColor.a - yv) + yv;
  return vec4<f32>(lum * srgb(fx.uColorMain.rgb) * a, a);`],
  // gl_FragCoord counts y from the bottom; WebGPU's position from the top
  [VORTEX, `
  let q = vUV.yx - 0.5;
  let d = length(q); let e = min(2.0 * d, 1.0);
  let s = sin(d * 10.0); let c = cos(d * 10.0);
  let tw = vec2<f32>(c * q.x + q.y * s, c * q.y - q.x * s);
  let r3 = tw.yx + 0.5;
  let n = snoise(r3 * fx.uSubTP.xy + fx.uTime * fx.uSubTP.zw, 25.0);
  let v = voronoi(r3 * fx.uMainTP.xy + fx.uTime * fx.uMainTP.zw, 5.0);
  let th = fx.uP.z * (2.0 * (vColor.r - 0.5) - fx.uP.x) + fx.uP.x;
  let m = clamp(max(1.0 - 2.0 * d, 0.0) * n * v * (v - th), 0.0, 1.0);
  let cut = step01(clamp((e * m - 0.080003) * 3.952655, 0.0, 1.0));
  let m2 = min(m * 3.003025, 1.0);
  let fc = vec2<f32>(vin.pos.x, fx.uView.y - vin.pos.y);
  let suv = min(fc / fx.uView + fx.uP.y * m2 * e, vec2<f32>(1.0) - 0.5 / fx.uView);
  let rgb = srgb(fx.uColorMain.rgb) * cut * T(uScene, vec2<f32>(suv.x, 1.0 - suv.y)).rgb;
  let a = (fx.uP.z * (vColor.a - fx.uP.w) + fx.uP.w) * m2;
  return vec4<f32>(rgb * a, a);`],
]);

/** The WGSL program for a GLSL fragment of shaders.ts / map-shaders.ts, its uniforms (UniformGroup order and types)
 * and its texture names; null for a fragment without a WGSL twin. */
export function wgslFor(frag: string, uniforms: Record<string, { type: string }>, textures: string[]): string | null {
  const body = BODY.get(frag);
  if (!body) return null;
  const fields = Object.entries(uniforms).map(([k, u]) => `${k}: ${u.type}`).join(", ");
  const binds = textures.map((t, i) => `@group(2) @binding(${1 + 2 * i}) var ${t}: texture_2d<f32>;\n@group(2) @binding(${2 + 2 * i}) var ${t}Sampler: sampler;`).join("\n");
  return `${VERTEX}
struct Fx { ${fields} }
@group(2) @binding(0) var<uniform> fx: Fx;
${binds}
${HELPERS}
@fragment fn mainFrag(vin: VOut) -> @location(0) vec4<f32> {
  let vUV = vin.vUV; let vColor = vin.vColor; let vC1 = vin.vC1; let vC2 = vin.vC2; let vRand = vin.vRand;
  ${body.replace(/T\((\w+), /g, "T($1, $1Sampler, ")}
}`;
}
