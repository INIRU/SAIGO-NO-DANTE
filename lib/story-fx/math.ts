// Small 3D math for the particle runtime. Matrices are column-major Float32Array(16) like WebGL.
export type V3 = [number, number, number];
type Q = [number, number, number, number];
export type M4 = Float32Array;

export const ident = (): M4 => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function trs(p: ArrayLike<number>, q: ArrayLike<number>, s: ArrayLike<number>): M4 {
  const [x, y, z, w] = [q[0], q[1], q[2], q[3]];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  const m = new Float32Array(16);
  m[0] = (1 - (yy + zz)) * s[0]; m[1] = (xy + wz) * s[0]; m[2] = (xz - wy) * s[0];
  m[4] = (xy - wz) * s[1]; m[5] = (1 - (xx + zz)) * s[1]; m[6] = (yz + wx) * s[1];
  m[8] = (xz + wy) * s[2]; m[9] = (yz - wx) * s[2]; m[10] = (1 - (xx + yy)) * s[2];
  m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; m[15] = 1;
  return m;
}

export function mul(a: M4, b: M4): M4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}

export const point = (m: M4, x: number, y: number, z: number): V3 =>
  [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
export const dir = (m: M4, x: number, y: number, z: number): V3 => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];

/** Lossy scale (column lengths). */
export const scaleOf = (m: M4): V3 => [Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10])];

/** Unity Euler (degrees) → quaternion: Z, then X, then Y (q = qy·qx·qz). */
export function euler(xd: number, yd: number, zd: number): Q {
  const r = Math.PI / 360;
  const [sx, cx, sy, cy, sz, cz] = [Math.sin(xd * r), Math.cos(xd * r), Math.sin(yd * r), Math.cos(yd * r), Math.sin(zd * r), Math.cos(zd * r)];
  return [cy * sx * cz + sy * cx * sz, sy * cx * cz - cy * sx * sz, cy * cx * sz - sy * sx * cz, cy * cx * cz + sy * sx * sz];
}

const len = (v: V3) => Math.hypot(v[0], v[1], v[2]);
export const norm = (v: V3): V3 => { const l = len(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Shortest rotation taking +Z onto direction d, as a matrix. */
export function fromZTo(d: V3): M4 {
  const n = norm(d), z: V3 = [0, 0, 1];
  const c = n[2];
  if (c > 0.99999) return ident();
  if (c < -0.99999) return trs([0, 0, 0], [1, 0, 0, 0], [1, 1, 1]);
  const ax = norm(cross(z, n)), half = Math.acos(Math.max(-1, Math.min(1, c))) / 2, s = Math.sin(half);
  return trs([0, 0, 0], [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(half)], [1, 1, 1]);
}
