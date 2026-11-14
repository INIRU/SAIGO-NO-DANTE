import { euler, ident, mul, scaleOf, trs, type M4, type V3 } from "./math";
import { DT, ParticleSim, type SysCtx } from "./particles";

/**
 * Effect activations and instances without any drawing (no PixiJS): where each effect of a playback runs, where it is
 * placed and its particle systems. FxLayer draws them; scripts/snapshot.mjs checks them headless.
 */

/** Where both units are at a time (from the movement simulation). */
export interface Units {
  self: { x: number; y: number; dir: number };
  target: { x: number; y: number; dir: number };
}
export interface Activation {
  T0: number; // global seconds
  T1: number;
  effect: any;
  timeline: string;
  segStart: number; // global time where its timeline starts
  index: number;
  /** ended by an isDisable clip: the object goes off, its particles with it */
  offCut?: boolean;
}
export interface SysView {
  node: any;
  sim: ParticleSim;
  material: any;
}
export interface Instance {
  act: Activation;
  systems: SysView[];
  time: number;
  /** the effect root's placement at effect-local time t */
  place: (t: number, noScale?: boolean) => M4;
  /** a node's world matrix at effect-local time t */
  nodeMatrix: (i: number, t: number, localOnly?: boolean) => M4;
}

/** The activations of a playback: its timelines in order (name + start/end in seconds). */
export function activations(fx: any, segs: { name: string; start: number; end: number; at?: (t: number) => number; until?: number }[]): Activation[] {
  const acts: Activation[] = [];
  // effectActiveInfo.isDisable 1: the clip switches the effect off (DATA 10315 S3 coin 3 "Fx_Nail" isDisable at 0.87 s as
  // the nail is hammered in; skipped, the coin-1 nail stayed over it for its 20 s — USER "못이 박혔는데 위에 남아있는게")
  const offs: { effect: any; T: number }[] = [];
  // The clip holds the effect's disable timer at 0 while it is active, then the timer
  // runs disabletime (real time) — on for the clip + disabletime; a clip that is not isOnceEffect is on for its window only;
  // isNotDisable never times out. The coin hand-over switches nothing off: the next coin's timeline start destroys the old
  // graph and every effect of the coin still on goes off then (isNotDisable ones stay). Off = SetActive(false): no tail.
  segs.forEach((s, si) => {
    const tl = fx.timelines[s.name];
    if (!tl) return;
    const next = segs[si + 1];
    for (const a of tl.activations) {
      const e = fx.effects[a.effect];
      // playback time of the clip time (hit stops push it: playback.ts segTime); reached when not after the last played frame
      const T0 = s.at ? s.at(a.t) : s.start + a.t, reached = s.until != null ? a.t <= s.until + 1e-6 : T0 <= s.end + 1e-6;
      if (e && a.info?.isDisable && reached) offs.push({ effect: e, T: T0 });
      if (!e || a.info?.isDisable) continue;
      if (!reached) continue; // after this coin's last played frame: never reached (playback.ts lastFrameTime)
      const root = e.nodes[0];
      const comp = root.comps.find((c: any) => c.class.startsWith("CharacterAttackEffect"))?.data ?? {};
      const keep = Math.max(0, Number(comp.disabletime) || 0), lasting = !!comp.isNotDisable;
      // the clip's end: a non-last coin's director is frozen from its hand-over, so a clip running past it never ends there
      const end = a.t + a.duration, frozen = next && s.until != null && end > s.until + 1e-6;
      const endT = frozen ? Infinity : s.at ? s.at(end) : s.start + end;
      let T1 = a.exact || a.info?.isOnceEffect === 0 ? endT : lasting ? Infinity : endT + keep;
      if (next && !(lasting && !a.exact && a.info?.isOnceEffect !== 0)) T1 = Math.min(T1, next.start);
      // shortcut: after the last coin the viewer shows at most 3 s of what stays on (the play ends there; unity_export sequence)
      if (!isFinite(T1)) T1 = s.end + 3;
      acts.push({ T0, T1, effect: e, timeline: s.name, segStart: s.start, index: acts.length });
    }
  });
  // switching an effect on again restarts it: the earlier run ends there
  acts.sort((a, b) => a.T0 - b.T0);
  acts.forEach((a, i) => {
    const again = acts.slice(i + 1).find((b) => b.effect === a.effect && b.T0 > a.T0 + 1e-6);
    if (again) a.T1 = Math.min(a.T1, again.T0);
    const off = offs.find((o) => o.effect === a.effect && o.T > a.T0 + 1e-6);
    if (off && off.T < a.T1) { a.T1 = off.T; a.offCut = true; }
    a.index = i;
  });
  return acts;
}

/** An effect instance: placement and particle systems. `centerY`: charInfo.transform_CenterPoint. */
export function instantiate(fx: any, a: Activation, units: (t: number) => Units, centerY: number, origin = 0): Instance {
  const e = a.effect, nodes = e.nodes;
  const root = nodes[0];
  const comp = root.comps.find((c: any) => c.class.startsWith("CharacterAttackEffect")) ?? { class: "", data: {} };
  const v2 = comp.class === "CharacterAttackEffectV2", ptype = comp.data?._effectPositionType ?? 0;
  const paths: string[] = [];
  nodes.forEach((n: any, i: number) => (paths[i] = n.parent < 0 ? e.path : `${paths[n.parent]}/${n.name}`));
  const rec = (fx.timelines[a.timeline]?.recorded ?? []) as any[];
  const chainM = (e.chain as any[]).reduce((m: M4, c: any) => mul(m, trs(c.pos, c.rot, c.scale)), ident());
  const chainNoScale = (e.chain as any[]).reduce((m: M4, c: any) => mul(m, trs(c.pos, c.rot, [1, 1, 1])), ident());
  const active: boolean[] = [];
  // the root is stored switched off: the timeline's activation turns it on
  nodes.forEach((n: any, i: number) => (active[i] = n.parent < 0 ? true : n.active && active[n.parent]));
  const fixed = units(a.T0);

  // the effect's placement at effect-local time t (world units, +x forward of the attacker)
  const place = (t: number, noScale = false): M4 => {
    const u = !v2 || comp.data?._isPosUpdate ? units(a.T0 + t) : fixed;
    const facing = u.self.dir;
    const cy = comp.data?._isCharacterCenterPoint ? centerY * 0.5 : 0;
    if (v2 && (ptype === 2 || ptype === 3)) {
      // Placement: ENEMY follows the target (its centre point
      // with _isCharacterCenterPoint) — _isPosUpdate 1: LateUpdate copies its position every frame, height included;
      // _isPosUpdate 0: placed once, y 0 when _followYPos. ZERO: the world origin (the stage centre, ASSUMED where the map
      // is put: origin)
      const y = ptype === 3 ? 0 : comp.data?._isPosUpdate ? u.target.y + cy : comp.data?._followYPos ? 0 : fixed.target.y + cy;
      const x = ptype === 3 ? origin : u.target.x;
      // the effect's own transforms below keep the hierarchy's scale
      return mul(trs([x, y, 0], [0, 0, 0, 1], [facing, 1, 1]), noScale ? ident() : trs([0, 0, 0], [0, 0, 0, 1], scaleOf(chainM)));
    }
    // NONE / CHARACTER: on the actor; _isPosUpdate 0 places it once: y = the unit's height with _followYPos, else the ground
    // (or the centre point's height with _isCharacterCenterPoint) — DATA 10315 S6 Fx_Nail_S9 (1) Upgrade (USER "이 못도 땅에 박혀야")
    const sy = v2 && !comp.data?._isPosUpdate && !comp.data?._followYPos ? cy : u.self.y;
    return mul(trs([u.self.x, sy, 0], [0, 0, 0, 1], [facing, 1, 1]), noScale ? chainNoScale : chainM);
  };
  // node local matrix at effect-local time t (the timeline's Recorded clips can drive it)
  const local = (i: number, t: number, noScale = false): M4 => {
    const n = nodes[i];
    // a V2 effect placed on a unit (2 target / 3 self): the script sets the root's position, the prefab's own is
    // dropped (DATA: 17 roots carry 6-15 x — the spot the target stood on when the prefab was made, e.g. 11016
    // Fx_Mon_Cp10_Nail x 12: the nail hit flew to empty air past the enemy; USER "날라가는건 저기인데 이미 몸에 박혀있는데")
    let p = i === 0 && v2 && (ptype === 2 || ptype === 3) ? [0, 0, 0] : n.pos, q = n.rot, s = n.scale;
    const tl = a.T0 - a.segStart + t; // time on the timeline
    for (const r of rec) {
      const tr = r.tracks[paths[i]];
      if (!tr) continue;
      if (r.duration != null && (tl < r.start - 1e-6 || tl > r.start + r.duration + 1e-6)) continue;
      const f = Math.max(0, Math.min(Math.round((tl - r.start + (r.clipIn || 0)) * r.fps), (tr.pos ?? tr.euler ?? tr.scale).length - 1));
      if (tr.pos) p = tr.pos[f].map((v: number | null, k: number) => (v == null ? p[k] : v));
      if (tr.euler) q = euler(...(tr.euler[f].map((v: number | null) => v ?? 0) as V3));
      if (tr.scale) s = tr.scale[f].map((v: number | null, k: number) => (v == null ? s[k] : v));
    }
    return trs(p, q, noScale ? [1, 1, 1] : s);
  };
  const nodeMatrix = (i: number, t: number, localOnly = false): M4 => {
    const chain: number[] = [];
    for (let k = i; k >= 0; k = nodes[k].parent) chain.unshift(k);
    let m = place(t, localOnly);
    for (const k of chain) m = mul(m, local(k, t, localOnly && k !== i));
    if (localOnly) {
      // scalingMode Local ignores the parents' scale for the particles (sizes, shape, speeds) only: the system itself
      // still sits where the full hierarchy puts it (Faust's EyeLight1 at y 3.48 x 0.5 = 1.74 = her eye, not 3.48)
      const full = nodeMatrix(i, t, false);
      m = new Float32Array(m);
      m[12] = full[12];
      m[13] = full[13];
      m[14] = full[14];
    }
    return m;
  };

  const systems: SysView[] = [];
  const byGo = new Map<string, SysView>();
  nodes.forEach((n: any, i: number) => {
    if (!n.ps || !active[i] || !n.psr?.enabled) return;
    const ctx: SysCtx = { matrix: (t) => nodeMatrix(i, t), localScaleMatrix: (t) => nodeMatrix(i, t, true) };
    const seed = n.ps.autoRandomSeed ? hash(`${a.index}:${i}`) : (n.ps.randomSeed >>> 0) || 1;
    // an Animator's property block over the material (story_map_fx.py animator_props); its own name keeps the shader cache apart
    const base = fx.materials[n.psr.materials?.[0]], mp = n.matProps;
    const material = base && mp ? { ...base, name: `${base.name}#${n.go}`, colors: { ...base.colors, ...mp.colors }, floats: { ...base.floats, ...mp.floats } } : base;
    const sv: SysView = { node: n, sim: new ParticleSim(n.ps, ctx, seed), material };
    systems.push(sv);
    byGo.set(n.go, sv);
  });
  for (const sv of systems)
    for (const s of sv.node.ps.SubModule?.enabled ? sv.node.ps.SubModule.subEmitters : []) {
      const child = s.emitter && byGo.get(s.emitter);
      if (child && s.type === 0) {
        child.sim.isSub = true;
        sv.sim.subs.push({ sim: child.sim, props: s.properties, prob: s.prob ?? 1 });
      }
    }
  return { act: a, systems, time: 0, place, nodeMatrix };
}

/** Simulate the instance up to effect-local time t (fixed steps; going back replays from the start). */
export function advance(inst: Instance, t: number) {
  if (t < inst.time - 1e-9) {
    for (const s of inst.systems) s.sim.reset();
    inst.time = 0;
  }
  while (inst.time + DT <= t + 1e-9) {
    for (const s of inst.systems) if (!s.sim.isSub) s.sim.step();
    inst.time += DT;
  }
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0 || 1;
}
