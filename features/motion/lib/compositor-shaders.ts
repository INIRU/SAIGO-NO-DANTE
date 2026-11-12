// GLSL sources and the numbers they share with compositor.ts (the layer compositor's draw program and the version 7 / 8 guided-filter programs).
// The strings are the shaders as they run; nothing here is computed at runtime.

export const MAX_LAYERS = 8;

export const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); // fullscreen triangle
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// uBase / uDelta = x, y, w, h of a tile in video uv (y down: uv 0 is the video's top row, the texture is not flipped)
export const FRAG = `#version 300 es
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
uniform float uGrey; // 1: the video texture has one channel (red)
float plane(vec4 r, vec2 t) { vec4 p = texture(uVideo, tuv(r, t)); return uGrey > 0.5 ? p.r : p.g; }
void main() {
  vec2 t = vec2(vUv.x, 1.0 - vUv.y); // canvas y is up, tiles are y down
  vec3 c;
  if (uPlanes > 0.5) {
    float y = plane(uBase, t), cb = plane(uCb, t) - 0.5, cr = plane(uCr, t) - 0.5;
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

// ---------------------------------------------------------------- versions 7 / 8: the layer-off view
// Version 8 crops each layer per frame (`crops`: the screen box where it changes the picture and the PICTURE WITHOUT IT there, Y / Cb / Cr tiles like the base's
// planes): unticking swaps that picture in. A tile at the box size is used texel by texel; a smaller one (Cb / Cr at half, a large crop the export scaled down) and
// version 7's fixed small difference tiles are upsampled with a guided filter (He & Sun 2015, "Fast Guided Filter"): per low-res texel a linear model
// tile ≈ a · G + b over a 3x3 window (G = the base's same plane for a picture, the base's Y / Co / Cg 3-vector for a difference), the coefficients averaged and
// applied at full resolution: the effects come off without outlines and the rest stays as sharp as the base. Without float render targets: bilinear.
export const GF_EPS = 1e-5; // a difference tile
export const GF_EPS_PIC = 1e-5; // a picture plane's difference from the base
export const PIC_DROP = 2 / 255; // a smaller difference is codec noise (the crop's and the base's): dropped, so where the layer changes nothing the view is the base itself
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
export const GF_A = GF_COMMON + `
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
export const GF_B = GF_COMMON + `
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
export const GF_C = GF_COMMON + `
uniform sampler2D uB; uniform ivec4 uVp;
out vec4 o;
void main() {
  ivec2 l = ivec2(int(gl_FragCoord.x) - uVp.x, uVp.w - 1 - (int(gl_FragCoord.y) - uVp.y));
  vec4 s = vec4(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) s += texelFetch(uB, atl(uVp, clamp(l + ivec2(i, j), ivec2(0), uVp.zw - 1)), 0);
  o = s / 9.0;
}`;
// final: the base minus every unticked layer's difference inside its box: a full-size crop texel by texel, a scaled one guided (or bilinear)
export const GF_FINAL = GF_COMMON + `
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
