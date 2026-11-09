import { dir, euler, fromZTo, ident, mul, norm, point, scaleOf, trs, type M4, type V3 } from "./math";
import { mmc, mmg, rng } from "./minmax";

/**
 * A Unity ParticleSystem driven by its serialized modules (pipeline/extract_fx.py → fx.json). Generic: nothing in here
 * knows about a particular Identity. Implemented: main module (lifetime, speed, size/rotation 3D, colour, gravity,
 * delay, duration/looping, simulation space, scaling mode), emission (rate over time, bursts with cycles/interval/
 * probability), shape (cone, cone volume, circle, box, donut, sphere, hemisphere; position/rotation/scale, arc, radius
 * thickness), velocity over lifetime, limit velocity (dampen, drag), colour / size / rotation over lifetime, texture
 * sheet (sprites and grid), custom data (vectors and colours), noise (value-noise approximation), world collision
 * (against the floor plane y = 0), emission over distance, birth sub-emitters.
 * Time steps are fixed (1/60 s) so a seek replays the same particles.
 */
export const DT = 1 / 60;
// the game's Physics.gravity (DATA: globalgamemanagers PhysicsManager m_Gravity y −120, not Unity's default −9.81);
// a particle's gravityModifier scales it
const G = 120;

export interface Particle {
  p: V3; // position: system local (local space) or world (world space)
  v: V3; // velocity, same space
  age: number;
  life: number;
  size: V3;
  rot: V3; // radians
  col: [number, number, number, number];
  r: Float32Array; // randoms
  flip: number;
  parentScale: number;
  subAcc?: number[]; // birth sub-emitter accumulators
  subBursts?: number[][];
}

export interface SysCtx {
  /** World matrix of the system's transform at system time t (seconds since the effect started). */
  matrix: (t: number) => M4;
  /** Same, with the ancestors' scale removed (scalingMode Local). */
  localScaleMatrix: (t: number) => M4;
}

export class ParticleSim {
  particles: Particle[] = [];
  time = 0;
  private acc = 0;
  private burstDone = new Map<string, boolean>();
  private rand: () => number;
  private delay: number;
  readonly world: boolean;
  subs: { sim: ParticleSim; props: number; prob: number }[] = [];
  isSub = false;
  emitting = true;

  constructor(readonly ps: any, readonly ctx: SysCtx, private seed: number) {
    this.rand = rng(seed);
    this.delay = mmc(ps.startDelay, 0, this.rand());
    this.world = ps.moveWithTransform === 1;
  }

  reset() {
    this.particles = [];
    this.time = 0;
    this.acc = 0;
    this.burstDone.clear();
    this.rand = rng(this.seed);
    this.delay = mmc(this.ps.startDelay, 0, this.rand());
    for (const s of this.subs) s.sim.reset();
  }

  get duration() {
    return this.ps.lengthInSec || 1;
  }

  /** Advance one fixed step. */
  step() {
    const t0 = this.time, t1 = t0 + DT;
    this.time = t1;
    if (!this.isSub && this.emitting) this.emit(t0, t1);
    this.advanceParticles(t1, this.world);
    // birth sub-emitters: children emitted along each living parent particle
    for (const s of this.subs) s.sim.stepAsSub(this, s.props, s.prob, t1);
  }

  /** Move every particle one step (all modules). `world`: positions are in world space (a world-space system, or the
   *  children of a sub-emitter, which are born at their parent's world position). One update for both - Unity runs
   *  a sub-emitter's particles through all of its own modules like any system (UNITY-DOC: sub emitters are systems). */
  private advanceParticles(t1: number, world: boolean) {
    const ps = this.ps;
    const im = ps.InitialModule;
    const gravity = mmc(im.gravityModifier, Math.min(1, t1 / this.duration), 0.5) * G;
    const vol = ps.VelocityModule?.enabled ? ps.VelocityModule : null;
    const rol = ps.RotationModule?.enabled ? ps.RotationModule : null;
    const noise = ps.NoiseModule?.enabled ? ps.NoiseModule : null;
    const lim = ps.ClampVelocityModule?.enabled ? ps.ClampVelocityModule : null;
    const col = ps.CollisionModule?.enabled ? ps.CollisionModule : null;
    const M = world ? null : this.ctx.matrix(t1);
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.age += DT;
      if (p.age >= p.life) continue;
      const a = p.age / p.life;
      if (gravity) {
        if (world) p.v[1] -= gravity * DT;
        else { const g = M ? invDir(M, [0, -gravity * DT, 0]) : [0, -gravity * DT, 0]; p.v[0] += g[0]; p.v[1] += g[1]; p.v[2] += g[2]; }
      }
      if (lim) limitVelocity(lim, p, a);
      let vx = p.v[0], vy = p.v[1], vz = p.v[2];
      if (vol) {
        const sm = mmc(vol.speedModifier, a, p.r[9]) || 1;
        let o: V3 = [mmc(vol.x, a, p.r[6]), mmc(vol.y, a, p.r[7]), mmc(vol.z, a, p.r[8])];
        if (vol.inWorldSpace && !world && M) o = invDir(M, o);
        else if (!vol.inWorldSpace && world) o = dir(this.ctx.matrix(t1), o[0], o[1], o[2]);
        vx = vx * sm + o[0]; vy = vy * sm + o[1]; vz = vz * sm + o[2];
      }
      p.p[0] += vx * DT; p.p[1] += vy * DT; p.p[2] += vz * DT;
      if (vol) orbitRadial(vol, p, a, world ? this.ctx.matrix(t1) : null);
      if (col && !collideGround(col, p, a, M)) continue;
      if (noise) {
        const st = mmc(noise.strength, a, p.r[10]) * (mmc(noise.positionAmount, a, 0.5) || 1);
        const f = noise.frequency || 0.5, sc = mmc(noise.scrollSpeed, a, 0.5) * t1;
        const n = (x: number, y: number) => Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;
        p.p[0] += st * DT * (n(p.p[0] * f + sc, p.r[11] * 9) * 2 - 1);
        p.p[1] += st * DT * (n(p.p[1] * f - sc, p.r[12] * 9) * 2 - 1);
      }
      if (rol) {
        if (rol.separateAxes) { p.rot[0] += mmc(rol.x, a, p.r[13]) * DT; p.rot[1] += mmc(rol.y, a, p.r[13]) * DT; }
        p.rot[2] += mmc(rol.curve, a, p.r[13]) * DT;
      }
      alive.push(p);
    }
    this.particles = alive;
  }

  private emit(t0: number, t1: number) {
    const ps = this.ps, em = ps.EmissionModule;
    if (!em?.enabled) return;
    const d = this.duration, lt0 = t0 - this.delay, lt1 = t1 - this.delay;
    if (lt1 <= 0) return;
    if (!ps.looping && lt0 >= d) return;
    const local = (x: number) => (ps.looping ? ((x % d) + d) % d : x);
    const norm01 = Math.min(1, Math.max(0, local(Math.max(lt0, 0)) / d));
    this.acc += mmc(em.rateOverTime, norm01, this.rand()) * DT;
    // rate over distance: per world unit the system's transform moved during the step
    const rod = mmc(em.rateOverDistance, norm01, 0.5);
    if (rod > 0) {
      const A = this.ctx.matrix(t0), B = this.ctx.matrix(t1);
      this.acc += rod * Math.hypot(B[12] - A[12], B[13] - A[13], B[14] - A[14]);
    }
    let n = Math.floor(this.acc);
    this.acc -= n;
    (em.m_Bursts || []).forEach((b: any, bi: number) => {
      const cycles = b.cycleCount || 0, interval = b.repeatInterval || d;
      for (let c = 0; cycles === 0 ? c < 1000 : c < cycles; c++) {
        const bt = b.time + c * interval;
        if (bt > d && !ps.looping) break;
        // within this loop of the system
        const loop = ps.looping ? Math.floor(Math.max(lt0, 0) / d) : 0;
        const at = loop * d + bt;
        const key = `${bi}:${c}:${loop}`;
        if (at >= Math.max(lt0, 0) - 1e-9 && at < lt1 - 1e-9 && !this.burstDone.get(key)) {
          this.burstDone.set(key, true);
          if (this.rand() <= (b.probability ?? 1)) n += Math.round(mmc(b.countCurve, Math.min(1, bt / d), this.rand()));
        }
        if (bt > Math.max(lt1, 0) + interval) break;
      }
    });
    const max = ps.InitialModule.maxNumParticles || 1000;
    for (let i = 0; i < n && this.particles.length < max; i++) this.spawn(t1, Math.min(1, local(Math.max(lt0, 0)) / d), null);
  }

  /** One new particle. `parent`: the emitting parent particle (sub-emitter), positions then in world space. */
  spawn(t: number, sys01: number, parent: { p: V3; v: V3; frame: M4 | null; size?: number; col?: number[]; props?: number } | null) {
    const ps = this.ps, im = ps.InitialModule, R = this.rand;
    const r = new Float32Array(16);
    for (let i = 0; i < r.length; i++) r[i] = R();
    let [lp, ld] = shapeSample(ps.ShapeModule, R);
    let speed = mmc(im.startSpeed, sys01, r[0]);
    const M = parent ? null : ps.scalingMode === 1 ? this.ctx.localScaleMatrix(t) : this.ctx.matrix(t);
    let p: V3, v: V3;
    if (parent) {
      // the child's shape in a frame whose +Z follows the parent particle's velocity (shortest rotation)
      const F = parent.frame ?? ident();
      const sp = point(F, lp[0], lp[1], lp[2]);
      const sd = dir(F, ld[0], ld[1], ld[2]);
      p = [parent.p[0] + sp[0], parent.p[1] + sp[1], parent.p[2] + sp[2]];
      v = [sd[0] * speed, sd[1] * speed, sd[2] * speed];
    } else if (this.world) {
      p = point(M!, lp[0], lp[1], lp[2]);
      const d = norm(dir(M!, ld[0], ld[1], ld[2]));
      const sc = scaleOf(M!);
      speed *= ps.scalingMode === 0 ? (sc[0] + sc[1]) / 2 : 1;
      v = [d[0] * speed, d[1] * speed, d[2] * speed];
    } else {
      p = lp;
      v = [ld[0] * speed, ld[1] * speed, ld[2] * speed];
    }
    const s0 = mmc(im.startSize, sys01, r[1]);
    let size: V3 = im.size3D ? [s0, mmc(im.startSizeY, sys01, r[2]), mmc(im.startSizeZ, sys01, r[3])] : [s0, s0, s0];
    if (parent && parent.props && parent.props & 2 && parent.size) size = size.map((x) => x * parent.size!) as V3;
    const rot: V3 = im.rotation3D ? [mmc(im.startRotationX, sys01, r[4]), mmc(im.startRotationY, sys01, r[4]), mmc(im.startRotation, sys01, r[4])] : [0, 0, mmc(im.startRotation, sys01, r[4])];
    if (im.randomizeRotationDirection && r[14] < im.randomizeRotationDirection) rot[2] = -rot[2];
    let col = mmg(im.startColor, sys01, r[5]);
    if (parent && parent.props && parent.props & 1 && parent.col) col = col.map((x, i) => x * parent.col![i]) as typeof col;
    const life = Math.max(1e-3, mmc(im.startLifetime, sys01, r[15]));
    const flipR = R();
    this.particles.push({ p, v, age: 0, life, size, rot, col, r, flip: flipR, parentScale: 1 });
  }

  /** As a birth sub-emitter of `parent`: emit along each parent particle by this system's own emission. */
  stepAsSub(parent: ParticleSim, props: number, prob: number, t: number) {
    const em = this.ps.EmissionModule, d = this.duration;
    const PM = parent.world ? null : parent.ctx.matrix(t);
    for (const pp of parent.particles) {
      if (!pp.subAcc) {
        pp.subAcc = [0];
        pp.subBursts = [[]];
        if (R01(pp.r[3] * 7.1) > prob) { pp.subAcc = [-1e9]; }
      }
      if (pp.subAcc[0] < -1e8) continue;
      const a0 = pp.age - DT, a1 = pp.age;
      if (!this.ps.looping && a0 >= d) continue;
      const wp = PM ? point(PM, pp.p[0], pp.p[1], pp.p[2]) : pp.p;
      const wv = PM ? dir(PM, pp.v[0], pp.v[1], pp.v[2]) : pp.v;
      const frame = (wv[0] || wv[1] || wv[2]) ? fromZTo(wv) : null;
      let n = 0;
      if (em?.enabled) {
        pp.subAcc[0] += mmc(em.rateOverTime, Math.min(1, a1 / d), this.rand()) * DT;
        n = Math.floor(pp.subAcc[0]);
        pp.subAcc[0] -= n;
        (em.m_Bursts || []).forEach((b: any, bi: number) => {
          if (b.time >= a0 && b.time < a1 && !pp.subBursts![0].includes(bi)) {
            pp.subBursts![0].push(bi);
            n += Math.round(mmc(b.countCurve, 0, this.rand()));
          }
        });
      }
      const size = (pp.size[0] + pp.size[1]) / 2;
      for (let i = 0; i < n; i++) this.spawn(t, Math.min(1, a1 / d), { p: [...wp] as V3, v: wv, frame, size, col: pp.col, props });
    }
    // advance the children themselves: born at world positions, through all of this system's modules
    this.advanceParticles(t, true);
  }
}

const R01 = (x: number) => { const v = Math.sin(x * 127.1) * 43758.5453; return v - Math.floor(v); };

/** Velocity over Lifetime, orbital (rad/s about the system's X/Y/Z axes through the orbital offset) and radial
 *  (units/s away from that centre), scaled by the speed modifier. In the system's local frame; for a world-space
 *  system the frame is the system's transform now (W). */
function orbitRadial(vol: any, p: Particle, a: number, W: M4 | null) {
  const sm = mmc(vol.speedModifier, a, p.r[9]) || 1;
  const ox = mmc(vol.orbitalX, a, p.r[6]) * sm, oy = mmc(vol.orbitalY, a, p.r[7]) * sm, oz = mmc(vol.orbitalZ, a, p.r[8]) * sm;
  const rad = mmc(vol.radial, a, p.r[9]) * sm;
  if (!ox && !oy && !oz && !rad) return;
  const off: V3 = [mmc(vol.orbitalOffsetX, a, 0.5), mmc(vol.orbitalOffsetY, a, 0.5), mmc(vol.orbitalOffsetZ, a, 0.5)];
  // particle relative to the centre, in the system's frame
  let q: V3 = W ? invDir(W, [p.p[0] - W[12], p.p[1] - W[13], p.p[2] - W[14]]) : [...p.p];
  q = [q[0] - off[0], q[1] - off[1], q[2] - off[2]];
  const rotA = (u: number, v: number, ang: number): [number, number] => [u * Math.cos(ang) - v * Math.sin(ang), u * Math.sin(ang) + v * Math.cos(ang)];
  if (ox) [q[1], q[2]] = rotA(q[1], q[2], ox * DT);
  if (oy) [q[2], q[0]] = rotA(q[2], q[0], oy * DT);
  if (oz) [q[0], q[1]] = rotA(q[0], q[1], oz * DT);
  if (rad) {
    const l = Math.hypot(q[0], q[1], q[2]);
    if (l > 1e-6) for (let i = 0; i < 3; i++) q[i] += (q[i] / l) * rad * DT;
  }
  q = [q[0] + off[0], q[1] + off[1], q[2] + off[2]];
  p.p = W ? point(W, q[0], q[1], q[2]) : q;
}

/** Limit Velocity over Lifetime: above the limit the speed loses `dampen` of the excess (per 1/30 s, framerate
 *  independent), plus drag (× size, × speed² as flagged). Applied to the particle's own velocity. */
function limitVelocity(m: any, p: Particle, a: number) {
  const k = 1 - Math.pow(1 - Math.min(1, Math.max(0, m.dampen ?? 0)), DT * 30);
  if (m.separateAxis) {
    const lims = [mmc(m.x, a, p.r[6]), mmc(m.y, a, p.r[7]), mmc(m.z, a, p.r[8])];
    for (let i = 0; i < 3; i++) {
      const l = Math.abs(lims[i]), v = p.v[i];
      if (Math.abs(v) > l) p.v[i] = Math.sign(v) * (Math.abs(v) - (Math.abs(v) - l) * k);
    }
  } else {
    const l = Math.abs(mmc(m.magnitude, a, p.r[6]));
    const s = Math.hypot(p.v[0], p.v[1], p.v[2]);
    if (s > l && s > 0) {
      const ns = s - (s - l) * k;
      for (let i = 0; i < 3; i++) p.v[i] *= ns / s;
    }
  }
  const drag = mmc(m.drag, a, p.r[9]);
  if (drag > 0) {
    const s = Math.hypot(p.v[0], p.v[1], p.v[2]);
    if (s > 0) {
      let f = drag;
      if (m.multiplyDragByParticleSize) f *= p.size[0];
      f *= m.multiplyDragByParticleVelocity ? s * s : s;
      const ns = Math.max(0, s - f * DT);
      for (let i = 0; i < 3; i++) p.v[i] *= ns / s;
    }
  }
}

/** Collision (World type): the battle scene's floor is taken as the plane y = 0 (assumption — the scene's colliders
 *  are not part of the effect data). Bounce / dampen / lifetime loss / kill speeds from the module. Returns false when
 *  the particle dies. M: the system's world matrix (local simulation) or null (world simulation). */
function collideGround(m: any, p: Particle, a: number, M: M4 | null): boolean {
  if (m.type !== 1) return true; // planes type: its plane Transforms are not exported
  const wp = M ? point(M, p.p[0], p.p[1], p.p[2]) : p.p;
  if (wp[1] >= 0) return true;
  let wv: V3 = M ? dir(M, p.v[0], p.v[1], p.v[2]) : [...p.v];
  if (wv[1] >= 0) return true;
  const bounce = mmc(m.m_Bounce, a, p.r[10]), dampen = mmc(m.m_Dampen, a, p.r[11]);
  wv = [wv[0] * (1 - dampen), -wv[1] * bounce * (1 - dampen), wv[2] * (1 - dampen)];
  const speed = Math.hypot(wv[0], wv[1], wv[2]);
  if (speed < (m.minKillSpeed ?? 0) || speed > (m.maxKillSpeed ?? Infinity)) return false;
  p.life -= p.life * mmc(m.m_EnergyLossOnCollision, a, p.r[12]);
  if (p.age >= p.life) return false;
  const lp: V3 = [wp[0], 0, wp[2]];
  if (M) {
    const lv = invDir(M, wv);
    const inv = invDir(M, [lp[0] - M[12], lp[1] - M[13], lp[2] - M[14]]);
    p.v = lv;
    p.p = inv;
  } else {
    p.v = wv;
    p.p = lp;
  }
  return true;
}

function invDir(M: M4, v: V3): V3 {
  // inverse of the upper 3×3 (rotation·scale) applied to a direction
  const a = M[0], b = M[4], c = M[8], d = M[1], e = M[5], f = M[9], g = M[2], h = M[6], i = M[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  const inv = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((x) => x / det);
  return [inv[0] * v[0] + inv[1] * v[1] + inv[2] * v[2], inv[3] * v[0] + inv[4] * v[1] + inv[5] * v[2], inv[6] * v[0] + inv[7] * v[1] + inv[8] * v[2]];
}

/** Position and direction in the system's local space for the shape module. */
export function shapeSample(sh: any, R: () => number): [V3, V3] {
  if (!sh || !sh.enabled) return [[0, 0, 0], [0, 0, 1]];
  const rad = sh.radius?.value ?? 1, thick = sh.radiusThickness ?? 1, arc = ((sh.arc?.value ?? 360) * Math.PI) / 180;
  const ang = (sh.angle ?? 0) * (Math.PI / 180), length = sh.length ?? 1;
  let p: V3 = [0, 0, 0], d: V3 = [0, 0, 1];
  const radial = () => rad * (1 - thick * (1 - Math.sqrt(R()))); // area-uniform within the thickness band
  switch (sh.type) {
    case 4: case 7: case 8: case 9: { // cone (base / shell / volume / volume shell)
      const th = R() * arc, rr = sh.type === 7 || sh.type === 9 ? rad : radial();
      const u = rad > 0 ? rr / rad : 0;
      const bx = Math.cos(th) * rr, by = Math.sin(th) * rr;
      const tilt = Math.atan(Math.tan(ang) * u);
      d = norm([Math.cos(th) * Math.sin(tilt), Math.sin(th) * Math.sin(tilt), Math.cos(tilt)]);
      p = [bx, by, 0];
      if (sh.type === 8 || sh.type === 9) { const k = R() * length / Math.max(1e-4, d[2]); p = [bx + d[0] * k * d[2], by + d[1] * k * d[2], d[2] * k * d[2]]; }
      break;
    }
    case 10: case 11: { // circle / edge (XY plane), outward
      const th = R() * arc, rr = sh.type === 11 ? rad : radial();
      p = [Math.cos(th) * rr, Math.sin(th) * rr, 0];
      d = [Math.cos(th), Math.sin(th), 0];
      break;
    }
    case 5: case 15: case 16: { // box (volume / shell / edge): unit box scaled by the shape scale below
      p = [R() - 0.5, R() - 0.5, R() - 0.5];
      d = [0, 0, 1];
      break;
    }
    case 17: { // donut
      const th = R() * arc, ph = R() * Math.PI * 2, tr = (sh.donutRadius ?? 0.2) * Math.sqrt(R());
      const cx = Math.cos(th) * rad, cy = Math.sin(th) * rad;
      const ox = Math.cos(th) * Math.cos(ph) * tr, oy = Math.sin(th) * Math.cos(ph) * tr, oz = Math.sin(ph) * tr;
      p = [cx + ox, cy + oy, oz];
      d = norm([ox, oy, oz]);
      break;
    }
    case 0: case 1: case 2: case 3: { // sphere / hemisphere (+ shells)
      let v: V3;
      do v = [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1]; while (v[0] * v[0] + v[1] * v[1] + v[2] * v[2] > 1);
      if (sh.type >= 2) v[2] = Math.abs(v[2]);
      d = norm(v);
      const rr = sh.type === 1 || sh.type === 3 ? rad : radial();
      p = [d[0] * rr, d[1] * rr, d[2] * rr];
      break;
    }
  }
  if (sh.randomDirectionAmount) d = norm(d.map((x) => x + (R() * 2 - 1) * sh.randomDirectionAmount) as V3);
  if (sh.sphericalDirectionAmount) { const s = norm(p); d = norm(d.map((x, i) => x + (s[i] - x) * sh.sphericalDirectionAmount) as V3); }
  const pos = sh.m_Position ?? { x: 0, y: 0, z: 0 }, rot = sh.m_Rotation ?? { x: 0, y: 0, z: 0 }, sc = sh.m_Scale ?? { x: 1, y: 1, z: 1 };
  const T = trs([pos.x, pos.y, pos.z], euler(rot.x, rot.y, rot.z), [sc.x, sc.y, sc.z]);
  const wp = point(T, p[0], p[1], p[2]);
  const wd = norm(dir(mul(T, ident()), d[0], d[1], d[2]));
  return [wp, wd];
}
