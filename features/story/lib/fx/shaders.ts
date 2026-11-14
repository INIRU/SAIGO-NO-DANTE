// The game's FX shaders, rewritten for the browser. Vertex inputs follow the particle renderer's custom vertex streams:
// UV (TEXCOORD0.xy), Custom1.xyzw (TEXCOORD1), Custom2.xyzw (TEXCOORD2), StableRandom.xy (TEXCOORD3.xy), COLOR.
// Output is premultiplied for PixiJS' "normal" blend (the materials use SrcAlpha / OneMinusSrcAlpha).

export const VERTEX = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
in vec4 aColor;
in vec4 aCustom1;
in vec4 aCustom2;
in vec2 aRand;
out vec2 vUV;
out vec4 vColor;
out vec4 vC1;
out vec4 vC2;
out vec2 vRand;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV; vColor = aColor; vC1 = aCustom1; vC2 = aCustom2; vRand = aRand;
}`;

export const HEAD = /* glsl */ `
in vec2 vUV; in vec4 vColor; in vec4 vC1; in vec4 vC2; in vec2 vRand;
out vec4 finalColor;
uniform float uTime;
uniform float uFlags; // bit 1: _R_W_CONVERT, 2: _USE_STABLERANDOM, 4: _USE_CENTERNOISE
float flag(float b) { return mod(floor(uFlags / b), 2.0); }
vec2 rot2(vec2 uv, float deg) { float a = deg * 0.017453; float s = sin(a), c = cos(a); vec2 q = uv - 0.5; return vec2(dot(q, vec2(c, s)), dot(q, vec2(-s, c))) + 0.5; }
float sstep(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
// R/W convert: value v (0..1) → between custom1.w (dark) and custom1.z (bright); positive parts take the vertex colour
vec3 rw(vec3 v, vec4 c1, vec3 vcol) {
  float zn = min(c1.z, 0.0), wn = min(c1.w, 0.0), zp = max(c1.z, 0.0), wp = max(c1.w, 0.0);
  vec3 neg = v * (zn - wn) + wn;
  vec3 pos = v * (zp - wp) + wp;
  return pos * vcol + neg;
}
`;

/** Fx_Team/Fx_Grp_Compact_Shader (t0 _MainTex, t1 _Noise_Tex, t2 _Dissolve_Tex). */
export const COMPACT = HEAD + /* glsl */ `
uniform sampler2D uMain; uniform sampler2D uNoise; uniform sampler2D uDissolve;
uniform vec4 uMainST; uniform vec4 uNoiseST; uniform vec4 uDissST;
uniform vec4 uSpeed;   // (_Dissolve_Speed_U, _Dissolve_Speed_V, _Noise_Speed_U, _Noise_Speed_V)
uniform vec2 uMulti;   // (_Main_Noise_Multi, _Dissolve_Noise_Multi)
uniform float uDissHard;
void main() {
  vec4 sc = fract(uTime * uSpeed.zwxy);
  if (flag(2.0) > 0.5) sc += vRand.xyxy;
  vec2 nuv = (vUV * vC2.xy + sc.xy) * uNoiseST.xy + uNoiseST.zw;
  vec4 n = (texture(uNoise, nuv).xyxy - 0.5) * vC1.x;
  vec4 k = vec4(uMulti.xx, uMulti.yy) * n + 1.0;
  vec4 q = vec4(vUV - 0.5, vUV - 0.5) * (flag(4.0) > 0.5 ? k : vec4(1.0)) + 0.5;
  if (flag(4.0) < 0.5) q += vec4(n.xy * uMulti.x, n.zw * uMulti.y);
  vec2 duv = (q.zw * vC2.zw + sc.zw) * uDissST.xy + uDissST.zw;
  vec4 m = texture(uMain, q.xy * uMainST.xy + uMainST.zw);
  float d = texture(uDissolve, duv).x;
  float isRW = flag(1.0);
  float shape = isRW > 0.5 ? m.x : m.w;
  float x = sstep((shape * d + vC1.y - uDissHard) / (1.0 - uDissHard));
  float a = clamp(clamp(vC1.y, 1.0, 100.0) * shape * x * vColor.a, 0.0, 1.0);
  vec3 c = isRW > 0.5 ? rw(vec3(m.x), vC1, vColor.rgb) : rw(m.rgb, vC1, vColor.rgb);
  finalColor = vec4(c * a, a);
}`;

/** Fx_Team/Fx_Grp_Outline_ColorMask_Shader (t0 _Dissolve_Tex, t1 _Color_Tex, t2 _MainTex, t3 _Noise_Tex). */
export const OUTLINE = HEAD + /* glsl */ `
uniform sampler2D uMain; uniform sampler2D uNoise; uniform sampler2D uDissolve; uniform sampler2D uColor;
uniform vec4 uDissTO; uniform vec4 uNoiseTO; uniform vec4 uColorTO;
uniform vec4 uSpeedU;  // (_Main_Speed_U, _Noise_Speed_U, _Dissolve_Speed_U, _Color_Speed_U)
uniform vec4 uSpeedV;  // (_Main_Speed_V, _Noise_Speed_V, _Dissolve_Speed_V, _Color_Speed_V)
uniform vec4 uRotate;  // (_Main_Rotate, _Noise_Rotate, _Dissolve_Rotate, _Color_Rotate) degrees
uniform vec4 uTwist;   // (_Main_Twist, _Noise_Twist, -, _Color_Twist)
uniform vec4 uMulti;   // (_Main_Noise_Multi, _Dissolve_Noise_Multi, _Color_Noise_Multi, -)
uniform vec4 uOutlineColor;
uniform vec4 uHard;    // (_Outline_Thickness, _Outline_Hardness, _Dissolve_Hardness, -)
uniform vec2 uColorHard; // (_Color_Hardness, _Color_Hardness_Move)
vec3 toSRGB(vec3 c) { return mix(c * 12.92321, 1.055 * pow(abs(c), vec3(0.416667)) - 0.055, step(0.003131, c)); }
void main() {
  vec2 stab = flag(2.0) > 0.5 ? vRand : vec2(0.0);
  // noise
  vec2 nr = rot2(vUV, uRotate.y);
  vec2 nuv = vec2(nr.y * uTwist.y + nr.x, nr.y) * uNoiseTO.xy + fract(uTime * vec2(uSpeedU.y, uSpeedV.y)) + uNoiseTO.zw;
  vec2 n = (texture(uNoise, nuv).xy - 0.5) * vC1.x;
  // dissolve (twist slot shared with main in the compiled code)
  vec2 dr = rot2(vUV, uRotate.z);
  vec2 duv = (n * uMulti.y + vec2(dr.y * uTwist.x + dr.x, dr.y)) * uDissTO.xy + fract(uTime * vec2(uSpeedU.z, uSpeedV.z)) + uDissTO.zw + stab;
  float d = texture(uDissolve, duv).x;
  // main (the particle's sprite)
  vec2 mr = rot2(vUV, uRotate.x);
  vec2 muv = (n * uMulti.x + vec2(mr.y * uTwist.x + mr.x, mr.y)) * vC2.zw + fract(uTime * vec2(uSpeedU.x, uSpeedV.x)) + vC2.xy;
  float m = texture(uMain, muv).x;
  float inv = 1.0 - vC1.y;
  float w = m * d - 2.0 * inv + 1.0;
  float body = clamp((m * w - inv) / (1.0 - uHard.z), 0.0, 1.0);
  float edge = clamp((m * w - (inv + uHard.x)) / (1.0 - uHard.y), 0.0, 1.0);
  float outline = (1.0 - sstep(edge)) * uOutlineColor.a;
  // colour texture → two-tone mask
  vec2 cr = rot2(vUV, uRotate.w);
  vec2 cuv = (n * uMulti.z + vec2(cr.y * uTwist.w + cr.x, cr.y)) * uColorTO.xy + fract(uTime * vec2(uSpeedU.w, uSpeedV.w)) + uColorTO.zw + stab;
  vec4 ct = texture(uColor, cuv);
  float lo = uColorHard.y - 0.5 + uColorHard.x;
  float width = (uColorHard.y - 0.5 - uColorHard.x + 1.0) - lo;
  vec4 s = vec4(ct.x, ct.x, ct.y, ct.z) - lo;
  s = clamp(s / width, 0.0, 1.0); s = s * s * (3.0 - 2.0 * s);
  float zn = min(vC1.z, 0.0), wn = min(vC1.w, 0.0), zp = max(vC1.z, 0.0), wp = max(vC1.w, 0.0);
  float dark = s.x * (zn - wn) + wn;
  vec3 bright = s.yzw * (zp - wp) + wp;
  vec3 c = bright * vColor.rgb + dark;
  c = mix(c, toSRGB(uOutlineColor.rgb), outline);
  float a = min(sstep(body), 1.0) * vColor.a;
  finalColor = vec4(c * a, a);
}`;

/** Fx_Team/Fx_Grp_MainCustom_Shader (t0 _MainTex, t1 _Noise_Tex, t2 _Dissolve_Tex, t3 _Dissolve_Mask_Tex). */
export const MAINCUSTOM = HEAD + /* glsl */ `
uniform sampler2D uMain; uniform sampler2D uNoise; uniform sampler2D uDissolve; uniform sampler2D uMask;
uniform vec4 uNoiseTO; uniform vec4 uDissTO; uniform vec4 uMaskTO;
uniform vec4 uSpeed;   // (_Main_Speed_U, _Main_Speed_V, _Noise_Speed_U, _Noise_Speed_V)
uniform vec2 uDSpeed;  // (_Dissolve_Speed_U, _Dissolve_Speed_V)
uniform vec4 uRotate;  // (_Main_Rotate, _Noise_Rotate, _Dissolve_Rotate, _Dissolve_Mask_Rotate)
uniform vec2 uTwist;   // (_Main_Twist, _Noise_Twist)
uniform vec4 uMulti;   // (_Main_Noise_Multi, _Dissolve_Noise_Multi, _Dissolve_Mask_Multi, -)
uniform float uDissHard;
void main() {
  vec2 nr = rot2(vUV, uRotate.y);
  vec2 nuv = vec2(nr.y * uTwist.y + nr.x, nr.y) * uNoiseTO.xy + fract(uTime * uSpeed.zw) + uNoiseTO.zw;
  vec2 n = (texture(uNoise, nuv).xy - 0.5) * vC1.x;
  vec2 dr = rot2(vUV, uRotate.z);
  vec2 duv = (uMulti.y * n + vec2(dr.y * uTwist.x + dr.x, dr.y)) * uDissTO.xy + fract(uTime * uDSpeed) + uDissTO.zw;
  float d = texture(uDissolve, duv).x;
  vec2 kr = rot2(vUV, uRotate.w);
  float mask = clamp(texture(uMask, kr * uMaskTO.xy + uMaskTO.zw).x * uMulti.z, 0.0, 1.0);
  d *= mask;
  vec2 mr = rot2(vUV, uRotate.x);
  vec2 muv = (uMulti.x * n + vec2(mr.y * uTwist.x + mr.x, mr.y)) * vC2.zw + fract(uTime * uSpeed.xy) + vC2.xy;
  vec4 m = texture(uMain, muv);
  float x = sstep((m.x * d + vC1.y - uDissHard) / (1.0 - uDissHard)) * vColor.a;
  x = clamp(m.x * x, 0.0, 1.0);
  float a = min(clamp(vC1.y, 1.0, 100.0) * x, 1.0);
  vec3 c = rw(vec3(m.x), vec4(vC1.x, vC1.y, vC1.z, vC1.w), vColor.rgb);
  finalColor = vec4(c * a, a);
}`;

/** Fallback for shaders without a translation: sprite × vertex colour. */
export const PLAIN = HEAD + /* glsl */ `
uniform sampler2D uMain;
void main() { vec4 m = texture(uMain, vUV); float a = m.a * vColor.a; finalColor = vec4(m.rgb * vColor.rgb * a, a); }`;
