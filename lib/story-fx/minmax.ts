// Unity MinMaxCurve / MinMaxGradient / Gradient evaluation (compact forms written by pipeline/extract_fx.py).
export type Keys = [number, number, number | null, number | null][];
export interface MMC { m: number; s: number; n: number; max: Keys; min: Keys }
export interface Grad { c: [number, number, number, number][]; a: [number, number][]; mode: number }
export interface MMG { m: number; cmin: { r: number; g: number; b: number; a: number }; cmax: { r: number; g: number; b: number; a: number }; gmax: Grad; gmin: Grad }

export function keys(k: Keys, t: number): number {
  if (!k.length) return 0;
  if (t <= k[0][0]) return k[0][1];
  const last = k[k.length - 1];
  if (t >= last[0]) return last[1];
  let i = 0;
  while (i < k.length - 2 && t > k[i + 1][0]) i++;
  const a = k[i], b = k[i + 1], dt = b[0] - a[0];
  if (dt <= 0) return b[1];
  if (a[3] == null || b[2] == null) return a[1]; // infinite tangent: stepped
  const p = (t - a[0]) / dt, p2 = p * p, p3 = p2 * p;
  return (2 * p3 - 3 * p2 + 1) * a[1] + (p3 - 2 * p2 + p) * a[3] * dt + (-2 * p3 + 3 * p2) * b[1] + (p3 - p2) * b[2] * dt;
}

/** t: normalized time (0..1) for curves, r: the particle's random (0..1). */
export function mmc(c: MMC | undefined, t: number, r: number): number {
  if (!c) return 0;
  switch (c.m) {
    case 0: return c.s;
    case 1: return keys(c.max, t) * c.s;
    case 2: { const a = keys(c.min, t) * c.s, b = keys(c.max, t) * c.s; return a + (b - a) * r; }
    case 3: return c.n + (c.s - c.n) * r;
  }
  return c.s;
}

export function grad(g: Grad, t: number): [number, number, number, number] {
  const ev = <T extends number[]>(arr: T[], n: number): number[] => {
    if (!arr.length) return new Array(n).fill(1);
    if (t <= arr[0][0]) return arr[0].slice(1);
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[i], b = arr[i + 1];
      if (t <= b[0]) {
        if (g.mode === 1) return b.slice(1); // fixed
        const u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return a.slice(1).map((v, j) => v + (b[j + 1] - v) * u);
      }
    }
    return arr[arr.length - 1].slice(1);
  };
  const [r, gg, b] = ev(g.c as unknown as number[][], 3);
  const [a] = ev(g.a as unknown as number[][], 1);
  return [r, gg, b, a];
}

export function mmg(c: MMG | undefined, t: number, r: number): [number, number, number, number] {
  if (!c) return [1, 1, 1, 1];
  const C = (x: { r: number; g: number; b: number; a: number }): [number, number, number, number] => [x.r, x.g, x.b, x.a];
  const lerp = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] - v) * r) as [number, number, number, number];
  switch (c.m) {
    case 0: return C(c.cmax);
    case 1: return grad(c.gmax, t);
    case 2: return lerp(C(c.cmin), C(c.cmax));
    case 3: return lerp(grad(c.gmin, t), grad(c.gmax, t));
    case 4: return grad(c.gmax, r);
  }
  return C(c.cmax);
}

/** Deterministic random (mulberry32). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
