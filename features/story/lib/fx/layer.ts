import { Assets, Buffer, BufferUsage, Container, Geometry, Mesh, Shader, Texture, UniformGroup } from "pixi.js";
import { dir, euler, point, scaleOf, trs, type M4, type V3 } from "./math";
import { keys, mmc, mmg } from "./minmax";
import { activations, advance, instantiate, type Activation, type Instance, type SysView, type Units } from "./instance";
import { COMPACT, MAINCUSTOM, OUTLINE, PLAIN, VERTEX } from "./shaders";
import { BURN, CITYPAPER, GLASS, LINELIGHT2, MASTER_DISSOLVE, SMOKE1, SPOTLIGHT, SQUARE, VORTEX, WATERFISH } from "./map-shaders";
import { wgslFor } from "./wgsl";

export type { Units };
/** An instance on screen: the shared instance (fx/instance.ts) + its meshes per system and sprite. */
interface Live {
  inst: Instance;
  meshes: Map<SysView, Map<string, FxMesh>>;
}

type FxMesh = Mesh<Geometry, Shader>;
const STRIDE = 18; // pos2 uv2 col4 c1 4 c2 4 rnd2

export class FxLayer {
  readonly back = new Container();
  readonly front = new Container();
  private textures = new Map<string, Texture>();
  private white = Texture.WHITE;
  private acts: Activation[] = [];
  private live = new Map<number, Live>();
  private shaders = new Map<string, Shader>();
  enabled = true;
  /** The picture under the effects for shaders that bend it (FX_Grp_Vortex's _CameraOpaqueTexture), screen-sized */
  scene: Texture | null = null;
  view: [number, number] = [1, 1];
  /** Drawn by PixiJS' WebGPU renderer: each shader also gets its WGSL twin (wgsl.ts) and a sampler per texture */
  gpu = false;
  disabled = new Set<string>(); // effect names switched off in the UI
  stats = { instances: 0, particles: 0, systems: 0 };
  centerY = 2.2; // charInfo.transform_CenterPoint (character-local, before the 0.5 pivot scale)
  /** Perspective camera: view centre (world units) and its distance to the battle plane z = 0. The world container
   *  scales everything at z = 0; a vertex at depth z is pulled toward the view centre by dist / (dist + z), which is
   *  exactly the perspective projection (Unity +z = away from the camera). */
  cam = { cx: 0, cy: 0, dist: 0 };

  constructor(readonly fx: any, private base: string, private ppu: number) {}

  static async load(base: string, ppu: number): Promise<FxLayer | null> {
    const fx = await fetch(base + "fx.json").then((r) => (r.ok ? r.json() : null), () => null);
    if (!fx) return null;
    const L = new FxLayer(fx, base, ppu);
    // one at a time: decoding many pictures at once crashes iPhone Safari (WebKit bug 302801); a picture that fails is
    // left out (drawn as the white texture) instead of taking the whole effect down
    for (const [k, t] of Object.entries<any>(fx.textures)) if (t.file) await L.loadTex(k, t.file, true);
    for (const [k, s] of Object.entries<any>(fx.sprites)) if (s.file) await L.loadTex(k, s.file, false);
    return L;
  }

  private async loadTex(key: string, file: string, repeat: boolean) {
    const tex = await Assets.load<Texture>(this.base + file).catch(() => null);
    if (!tex) return;
    tex.source.style.addressMode = repeat ? "repeat" : "clamp-to-edge";
    tex.source.style.update?.();
    this.textures.set(key, tex);
  }

  /** The playback: its timelines in order (name + start in seconds). */
  setPlayback(segs: { name: string; start: number; end: number }[]) {
    this.clear();
    this.acts = activations(this.fx, segs);
  }

  /** One effect alone, switched on at time 0 for `seconds`, no timeline (bench.html: compared with the Unity bench). */
  solo(name: string, seconds: number): boolean {
    this.clear();
    const effect = Object.values<any>(this.fx.effects).find((e) => e.name === name);
    this.acts = effect ? [{ T0: 0, T1: seconds, effect, timeline: "", segStart: 0, index: 0 }] : [];
    return !!effect;
  }

  // The stage map plays its effects at normal speed from the moment the map opens (no skill timelines here).
  private effectTime(T: number) {
    return T;
  }

  clear() {
    for (const inst of this.live.values()) this.destroy(inst);
    this.live.clear();
  }

  private destroy(live: Live) {
    for (const ms of live.meshes.values()) for (const m of ms.values()) m.destroy();
  }

  /** Draw the effects at global time T. `units(t)`: unit positions at any global time.
   *  `linger`: the playback ended at that time — whatever was alive then stays alive (and keeps simulating) after it. */
  update(T: number, units: (t: number) => Units, linger?: number) {
    const keepAlive = new Set<number>();
    this.stats = { instances: 0, particles: 0, systems: 0 };
    if (this.enabled)
      for (const a of this.acts) {
        const lingering = linger != null && T >= linger && a.T0 <= linger && a.T1 >= linger - 1 / 60;
        if (T < a.T0 - 1e-9 || (T >= a.T1 && !lingering) || this.disabled.has(a.effect.name)) continue;
        keepAlive.add(a.index);
        let live = this.live.get(a.index);
        if (!live) {
          live = { inst: instantiate(this.fx, a, units, this.centerY), meshes: new Map() };
          this.live.set(a.index, live);
        }
        advance(live.inst, this.effectTime(T) - this.effectTime(a.T0));
        this.draw(live, T);
        this.stats.instances++;
      }
    for (const [k, inst] of this.live)
      if (!keepAlive.has(k)) {
        this.destroy(inst);
        this.live.delete(k);
      }
  }

  // ------------------------------------------------------------------ drawing
  private draw(live: Live, T: number) {
    const inst = live.inst;
    const t = T - inst.act.T0;
    for (const sv of inst.systems) {
      const { node, sim } = sv;
      let meshes = live.meshes.get(sv);
      if (!meshes) live.meshes.set(sv, (meshes = new Map()));
      const ps = node.ps, psr = node.psr;
      // no material on the renderer: Unity draws nothing (the system still simulates, e.g. for its sub-emitters)
      if (!sv.material) {
        for (const m of meshes.values()) m.visible = false;
        continue;
      }
      // scalingMode Local: the system ignores its parents' scale (positions and sizes)
      const BM = ps.scalingMode === 1 ? sim.ctx.localScaleMatrix(t) : sim.ctx.matrix(t);
      // sub-emitter children are born at their parent particle's world position: already world space
      const M = sim.world || sim.isSub ? null : BM;
      const sprites: string[] = ps.UVModule?.enabled && ps.UVModule.mode === 1 ? ps.UVModule.sprites.filter(Boolean) : [];
      const groups = new Map<string, number[]>();
      const parts = sim.particles;
      const order = parts.map((_, i) => i);
      if (psr.sortMode === 3) order.sort((a, b) => parts[b].age - parts[a].age); // youngest in front
      else if (psr.sortMode === 2) order.sort((a, b) => parts[a].age - parts[b].age);
      for (const i of order) {
        const p = parts[i];
        const a = p.age / p.life;
        let key = "";
        if (sprites.length) {
          const uv = ps.UVModule;
          const f = (mmc(uv.frameOverTime, a, p.r[11]) * (uv.cycles || 1) + mmc(uv.startFrame, a, p.r[12])) % 1;
          key = sprites[Math.min(sprites.length - 1, Math.floor(f * sprites.length))];
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(i);
      }
      // meshes per sprite
      for (const [key, m] of meshes) if (!groups.has(key)) { m.visible = false; }
      for (const [key, idx] of groups) {
        const sprite = key ? this.fx.sprites[key] : null;
        const mesh = this.meshFor(sv, meshes, key, psr, sprite);
        mesh.visible = true;
        this.fill(mesh, sv, idx, M, BM, sprite);
        this.stats.particles += idx.length;
      }
      this.stats.systems++;
    }
  }

  private meshFor(sv: SysView, meshes: Map<string, FxMesh>, key: string, psr: any, sprite: any): FxMesh {
    let m = meshes.get(key);
    if (m) return m;
    const shader = this.makeShader(sv.material, key);
    const buffer = new Buffer({ data: new Float32Array(STRIDE * 4), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    const ib = new Buffer({ data: new Uint32Array(6), usage: BufferUsage.INDEX | BufferUsage.COPY_DST });
    const f = (offset: number, format: any) => ({ buffer, format, stride: STRIDE * 4, offset: offset * 4 });
    const geometry = new Geometry({
      attributes: { aPosition: f(0, "float32x2"), aUV: f(2, "float32x2"), aColor: f(4, "float32x4"), aCustom1: f(8, "float32x4"), aCustom2: f(12, "float32x4"), aRand: f(16, "float32x2") },
      indexBuffer: ib,
    });
    m = new Mesh({ geometry, shader }) as FxMesh;
    (m as any)._fxSprite = sprite;
    m.blendMode = sv.material?.floats?._DstBlend === 1 ? "add" : "normal";
    const order = psr.order ?? 0;
    m.zIndex = order * 100 + (psr.fudge ?? 0);
    (order < 0 ? this.back : this.front).addChild(m);
    this.back.sortableChildren = this.front.sortableChildren = true;
    meshes.set(key, m);
    return m;
  }

  private makeShader(mat: any, spriteKey: string): Shader {
    const ck = `${mat?.name}|${spriteKey}`;
    const cached = this.shaders.get(ck);
    if (cached) return cached;
    const name: string = mat?.shader ?? "";
    const fl = mat?.floats ?? {}, co = mat?.colors ?? {}, tx = mat?.textures ?? {};
    const kw: string[] = mat?.keywords ?? [];
    const flags = (kw.includes("_R_W_CONVERT") ? 1 : 0) + (kw.includes("_USE_STABLERANDOM") ? 2 : 0) + (kw.includes("_USE_CENTERNOISE") ? 4 : 0);
    const tex = (slot: string) => (tx[slot]?.tex && this.textures.get(tx[slot].tex)) || this.white;
    // URP's Particles/Unlit keeps its picture in _BaseMap, the built-in and team shaders in _MainTex
    const main = (spriteKey && this.textures.get(spriteKey)) || tex(tx._MainTex?.tex ? "_MainTex" : "_BaseMap");
    const st = (slot: string, fallback = [1, 1, 0, 0]) => (tx[slot] ? [...tx[slot].scale, ...tx[slot].offset] : fallback);
    const v4 = (n: string, d = [1, 1, 0, 0]) => co[n] ?? d;
    const f = (n: string, d = 0) => fl[n] ?? d;
    let frag = PLAIN, uniforms: Record<string, any> = {}, res: Record<string, any> = { uMain: main.source };
    // GUESS: the _Optimized / _N_Compact / _Pub variants draw like the team shader they come from (not yet translated)
    if (name.endsWith("Fx_Grp_Compact_Shader") || name.endsWith("Fx_Grp_Compact_Shader_Optimized")) {
      frag = COMPACT;
      uniforms = {
        uMainST: { value: new Float32Array(st("_MainTex")), type: "vec4<f32>" }, uNoiseST: { value: new Float32Array(st("_Noise_Tex")), type: "vec4<f32>" },
        uDissST: { value: new Float32Array(st("_Dissolve_Tex")), type: "vec4<f32>" },
        uSpeed: { value: new Float32Array([f("_Dissolve_Speed_U"), f("_Dissolve_Speed_V"), f("_Noise_Speed_U"), f("_Noise_Speed_V")]), type: "vec4<f32>" },
        uMulti: { value: new Float32Array([f("_Main_Noise_Multi", 1), f("_Dissolve_Noise_Multi")]), type: "vec2<f32>" },
        uDissHard: { value: f("_Dissolve_Hardness", 0.5), type: "f32" },
      };
      res = { ...res, uNoise: tex("_Noise_Tex").source, uDissolve: tex("_Dissolve_Tex").source };
    } else if (name.endsWith("Fx_Grp_Outline_ColorMask_Shader") || name.endsWith("Fx_Grp_Outline_ColorMask_Shader_N_Compact")) {
      frag = OUTLINE;
      uniforms = {
        uDissTO: { value: new Float32Array(v4("_Dissolve_Tile_Offset")), type: "vec4<f32>" }, uNoiseTO: { value: new Float32Array(v4("_Noise_Tile_Offset")), type: "vec4<f32>" },
        uColorTO: { value: new Float32Array(v4("_Color_Tile_Offset")), type: "vec4<f32>" },
        uSpeedU: { value: new Float32Array([f("_Main_Speed_U"), f("_Noise_Speed_U"), f("_Dissolve_Speed_U"), f("_Color_Speed_U")]), type: "vec4<f32>" },
        uSpeedV: { value: new Float32Array([f("_Main_Speed_V"), f("_Noise_Speed_V"), f("_Dissolve_Speed_V"), f("_Color_Speed_V")]), type: "vec4<f32>" },
        uRotate: { value: new Float32Array([f("_Main_Rotate"), f("_Noise_Rotate"), f("_Dissolve_Rotate"), f("_Color_Rotate")]), type: "vec4<f32>" },
        uTwist: { value: new Float32Array([f("_Main_Twist"), f("_Noise_Twist"), 0, f("_Color_Twist")]), type: "vec4<f32>" },
        uMulti: { value: new Float32Array([f("_Main_Noise_Multi", 1), f("_Dissolve_Noise_Multi"), f("_Color_Noise_Multi"), 0]), type: "vec4<f32>" },
        uOutlineColor: { value: new Float32Array(v4("_Outline_Color", [0, 0, 0, 1])), type: "vec4<f32>" },
        uHard: { value: new Float32Array([f("_Outline_Thickness"), f("_Outline_Hardness"), f("_Dissolve_Hardness", 0.5), 0]), type: "vec4<f32>" },
        uColorHard: { value: new Float32Array([f("_Color_Hardness"), f("_Color_Hardness_Move", 0.5)]), type: "vec2<f32>" },
      };
      res = { ...res, uNoise: tex("_Noise_Tex").source, uDissolve: tex("_Dissolve_Tex").source, uColor: tex("_Color_Tex").source };
    } else if (name.endsWith("Fx_Grp_MainCustom_Shader") || name.endsWith("Fx_Grp_MainCustom_Pub_Shader")) {
      frag = MAINCUSTOM;
      uniforms = {
        uNoiseTO: { value: new Float32Array(v4("_Noise_Tile_Offset")), type: "vec4<f32>" }, uDissTO: { value: new Float32Array(v4("_Dissolve_Tile_Offset")), type: "vec4<f32>" },
        uMaskTO: { value: new Float32Array(v4("_Dissolve_Mask_Tile_Offset")), type: "vec4<f32>" },
        uSpeed: { value: new Float32Array([f("_Main_Speed_U"), f("_Main_Speed_V"), f("_Noise_Speed_U"), f("_Noise_Speed_V")]), type: "vec4<f32>" },
        uDSpeed: { value: new Float32Array([f("_Dissolve_Speed_U"), f("_Dissolve_Speed_V")]), type: "vec2<f32>" },
        uRotate: { value: new Float32Array([f("_Main_Rotate"), f("_Noise_Rotate"), f("_Dissolve_Rotate"), f("_Dissolve_Mask_Rotate")]), type: "vec4<f32>" },
        uTwist: { value: new Float32Array([f("_Main_Twist"), f("_Noise_Twist")]), type: "vec2<f32>" },
        uMulti: { value: new Float32Array([f("_Main_Noise_Multi", 1), f("_Dissolve_Noise_Multi"), f("_Dissolve_Mask_Multi", 1), 0]), type: "vec4<f32>" },
        uDissHard: { value: f("_Dissolve_Hardness", 0.5), type: "f32" },
      };
      res = { ...res, uNoise: tex("_Noise_Tex").source, uDissolve: tex("_Dissolve_Tex").source, uMask: tex("_Dissolve_Mask_Tex").source };
    }
    // The stage map's Shader Graphs (map-shaders.ts). A sampled texture without its own slot name comes from the
    // graph's Sample Texture 2D node: the material lists it under _SampleTexture2D_<id>_Texture_1_Texture2D.
    const sampled = (i = 0) => {
      const slots = Object.keys(tx).filter((k) => k.startsWith("_SampleTexture2D_")).sort();
      const k = slots[i];
      return (k && tx[k]?.tex && this.textures.get(tx[k].tex)) || this.white;
    };
    const vec = (v: number[] | undefined, n: number, d = 0) => new Float32Array(Array.from({ length: n }, (_, i) => v?.[i] ?? d));
    const cm = { uColorMain: { value: vec(co.Color_Main ?? co._Color_Main, 4, 1), type: "vec4<f32>" } };
    const g = name.replace(/^Shader Graphs\//, "");
    if (g === "FX_Grp_Burn") { frag = BURN; uniforms = cm; }
    else if (g === "FX_Grp_Smoke1") {
      frag = SMOKE1;
      uniforms = { ...cm, uTiling: { value: vec(co.Tiling_Noise, 2, 1), type: "vec2<f32>" },
        uP: { value: new Float32Array([f("Power_Gradient"), f("Alp"), f("Dissolve"), f("Rule")]), type: "vec4<f32>" } };
      res = { uMain: tex("Tex_Main").source, uNoise: sampled().source };
    } else if (g === "FX_Grp_GlassPiece1") { frag = GLASS; uniforms = cm; res = { uMain: sampled().source }; }
    else if (g === "FX_Grp_Square") {
      frag = SQUARE; uniforms = { ...cm, uP: { value: new Float32Array([f("Alp"), f("_Rule")]), type: "vec2<f32>" } }; res = { uMain: sampled().source };
    } else if (g === "FX_Grp_LineLight2") { frag = LINELIGHT2; uniforms = cm; res = { uMain: tex("Tex_Main").source }; }
    else if (g === "FX_Grp_CC_CityPaper1") { frag = CITYPAPER; uniforms = cm; res = { uMain: sampled().source }; }
    else if (g === "FX_Grp_UI_7_5_1_SpotLight1") { frag = SPOTLIGHT; uniforms = { uAlp: { value: f("_Alp"), type: "f32" } }; res = { uMain: main.source }; }
    else if (g === "FX_Grp_0_Master_Dissolve") {
      frag = MASTER_DISSOLVE;
      uniforms = { ...cm,
        uTiling: { value: new Float32Array([...vec(co._Tiling_Noise1, 2, 1), ...vec(co._Tiling_Noise2, 2, 1)]), type: "vec4<f32>" },
        uPanner: { value: new Float32Array([...vec(co._Panner_Noise1, 2), ...vec(co._Panner_Noise2, 2)]), type: "vec4<f32>" },
        uA: { value: new Float32Array([f("_Dissolve"), f("_ToonPower"), f("_Rule"), f("_Alp")]), type: "vec4<f32>" },
        uB: { value: new Float32Array([f("_OutLine_OnOff"), f("_VectorMask_OnOff"), f("_VectorMask_Rotate"), f("_VectorMask_MaskPower")]), type: "vec4<f32>" },
        uC: { value: new Float32Array([f("_VectorMask_Value"), f("_Rotate_Main"), f("_MaskTex_OutputChange"), 0]), type: "vec4<f32>" },
        uTilingMain: { value: vec(co._Tiling_Main, 2, 1), type: "vec2<f32>" },
        uColorOut: { value: vec(co._Color_OutLine, 4), type: "vec4<f32>" } };
      res = { uMain: tex("_Tex_Main").source, uMask: tex("_Tex_Mask").source, uNoise1: tex("_Tex_Noise1").source, uNoise2: tex("_Tex_Noise2").source };
    } else if (g === "FX_Grp_CC_WaterFish_Hammer") {
      frag = WATERFISH;
      uniforms = { ...cm,
        uTiling: { value: new Float32Array([...vec(co.Tiling_Noise1, 2, 1), ...vec(co.Tiling_Noise2, 2, 1)]), type: "vec4<f32>" },
        uPanner: { value: new Float32Array([...vec(co.Panner_Noise1, 2), ...vec(co.Panner_Noise2, 2)]), type: "vec4<f32>" },
        uP: { value: new Float32Array([f("Dissolve"), f("Rule"), f("_Alp")]), type: "vec3<f32>" } };
      res = { uMain: sampled(0).source, uMask: sampled(1).source };
    } else if (g === "FX_Grp_Vortex") {
      frag = VORTEX;
      uniforms = { ...cm, uView: { value: new Float32Array(this.view), type: "vec2<f32>" },
        uMainTP: { value: new Float32Array([...vec(co.Tiling_MainNoise, 2, 1), ...vec(co.Panner_MainNoise, 2)]), type: "vec4<f32>" },
        uSubTP: { value: new Float32Array([...vec(co.Tiling_SubNoise, 2, 1), ...vec(co.Panner_SubNoise, 2)]), type: "vec4<f32>" },
        uP: { value: new Float32Array([f("Dissolve"), f("DistortionPower"), f("Rule"), f("Alp")]), type: "vec4<f32>" } };
      res = { uScene: (this.scene ?? this.white).source };
    }
    const group = new UniformGroup({ uTime: { value: 0, type: "f32" }, uFlags: { value: flags, type: "f32" }, ...uniforms });
    let shader: Shader;
    const wgsl = this.gpu ? wgslFor(frag, { uTime: { type: "f32" }, uFlags: { type: "f32" }, ...uniforms }, Object.keys(res)) : null;
    if (wgsl) {
      const samplers = Object.fromEntries(Object.entries(res).map(([k, src]) => [`${k}Sampler`, (src as any).style]));
      shader = Shader.from({ gl: { vertex: VERTEX, fragment: frag }, gpu: { vertex: { source: wgsl, entryPoint: "mainVert" }, fragment: { source: wgsl, entryPoint: "mainFrag" } },
        resources: { fx: group, ...res, ...samplers } });
    } else shader = Shader.from({ gl: { vertex: VERTEX, fragment: frag }, resources: { fx: group, ...res } });
    this.shaders.set(ck, shader);
    return shader;
  }

  setTime(t: number) {
    for (const s of this.shaders.values()) {
      const g = (s.resources as any).fx as UniformGroup;
      g.uniforms.uTime = t;
    }
  }

  private fill(mesh: FxMesh, sv: SysView, idx: number[], M: M4 | null, BM: M4, sprite: any) {
    const { node, sim } = sv;
    const ps = node.ps, psr = node.psr, ppu = this.ppu;
    const meshData = psr.mode === 4 && psr.mesh ? this.fx.meshes[psr.mesh] : null;
    const vpp = meshData ? meshData.v.length / 3 : 4;
    const ipp = meshData ? meshData.i.length : 6;
    const vb = new Float32Array(idx.length * vpp * STRIDE);
    const ib = new Uint32Array(idx.length * ipp);
    const sol = ps.SizeModule?.enabled ? ps.SizeModule : null;
    const col = ps.ColorModule?.enabled ? ps.ColorModule : null;
    const cd = ps.CustomDataModule?.enabled ? ps.CustomDataModule : null;
    const aspect = sprite ? [sprite.w / Math.max(sprite.w, sprite.h), sprite.h / Math.max(sprite.w, sprite.h)] : [1, 1];
    const spPivot = sprite ? [sprite.pivot[0] - 0.5, sprite.pivot[1] - 0.5] : [0, 0];
    const align = psr.align ?? 0;
    // Local alignment: the particle lives in the transform's frame, non-uniform scale included (a (0.5, 5) scaled
    // dot becomes a long streak). Other alignments: screen/world axes, each axis scaled by the transform's lossy scale.
    const lossy = scaleOf(BM);
    let ax: V3 = [lossy[0], 0, 0], ay: V3 = [0, lossy[1], 0], az: V3 = [0, 0, lossy[2]];
    if (align === 2) {
      ax = dir(BM, 1, 0, 0); ay = dir(BM, 0, 1, 0); az = dir(BM, 0, 0, 1);
    }
    const sizeScale = 1;
    let o = 0, io = 0, base = 0;
    for (const i of idx) {
      const p = sim.particles[i];
      const a = p.age / p.life;
      const sx = p.size[0] * (sol ? mmc(sol.curve, a, p.r[10]) : 1) * sizeScale;
      const sy = p.size[1] * (sol ? (sol.separateAxes ? mmc(sol.y, a, p.r[10]) : mmc(sol.curve, a, p.r[10])) : 1) * sizeScale;
      const sz = p.size[2] * (sol ? (sol.separateAxes ? mmc(sol.z, a, p.r[10]) : mmc(sol.curve, a, p.r[10])) : 1) * sizeScale;
      const c = col ? mmg(col.gradient, a, p.r[9]) : [1, 1, 1, 1];
      const rgba = [p.col[0] * c[0], p.col[1] * c[1], p.col[2] * c[2], p.col[3] * c[3]];
      const c1 = custom(cd, 0, a, p.r), c2 = custom(cd, 1, a, p.r);
      const wp = M ? point(M, p.p[0], p.p[1], p.p[2]) : p.p;
      // particle rotation (Unity: Z, X, Y). Billboards turn clockwise for a positive angle; meshes counter-clockwise.
      // GUESS - Unity does not document the sign (skill unity.md, bench test T2). Hong Lu looked right this way (USER).
      const zs = meshData ? 1 : -1;
      const R = trs([0, 0, 0], euler((p.rot[0] * 180) / Math.PI, (p.rot[1] * 180) / Math.PI, (zs * p.rot[2] * 180) / Math.PI), [1, 1, 1]);
      let bx = ax, by = ay, bz = az;
      if (align === 4) {
        // Velocity alignment: the quad's Y follows the velocity in the screen plane. GUESS - which axis follows the
        // velocity is not documented (bench test T1). A camera-facing variant was tried on 2026-10-14 and reverted:
        // Unity's particle lead says velocity alignment has no camera-facing logic, and it changed Sinclair (You) S3.
        const v = M ? dir(M, p.v[0], p.v[1], p.v[2]) : p.v;
        const l = Math.hypot(v[0], v[1]) || 1;
        by = [(v[0] / l) * lossy[1], (v[1] / l) * lossy[1], 0]; bx = [(v[1] / l) * lossy[0], (-v[0] / l) * lossy[0], 0]; bz = [0, 0, lossy[2]];
      }
      const toWorld = (lx: number, ly: number, lz: number): V3 => {
        const r = point(R, lx, ly, lz);
        return [wp[0] + bx[0] * r[0] + by[0] * r[1] + bz[0] * r[2], wp[1] + bx[1] * r[0] + by[1] * r[1] + bz[1] * r[2], wp[2] + bx[2] * r[0] + by[2] * r[1] + bz[2] * r[2]];
      };
      const flipU = psr.flip?.[0] && p.flip < psr.flip[0];
      const cam = this.cam;
      const put = (w: V3, u: number, v: number) => {
        let x = w[0], y = w[1];
        if (cam.dist > 0) {
          const k = cam.dist / Math.max(0.05, cam.dist + w[2]);
          x = cam.cx + (x - cam.cx) * k;
          y = cam.cy + (y - cam.cy) * k;
        }
        vb[o++] = x * ppu; vb[o++] = -y * ppu;
        vb[o++] = flipU ? 1 - u : u; vb[o++] = 1 - v;
        vb[o++] = rgba[0]; vb[o++] = rgba[1]; vb[o++] = rgba[2]; vb[o++] = rgba[3];
        vb[o++] = c1[0]; vb[o++] = c1[1]; vb[o++] = c1[2]; vb[o++] = c1[3];
        vb[o++] = c2[0]; vb[o++] = c2[1]; vb[o++] = c2[2]; vb[o++] = c2[3];
        vb[o++] = p.r[14]; vb[o++] = p.r[15];
      };
      if (meshData) {
        const V = meshData.v, U = meshData.uv;
        for (let k = 0; k < vpp; k++) put(toWorld(V[k * 3] * sx, V[k * 3 + 1] * sy, V[k * 3 + 2] * sz), U[k * 2] ?? 0, U[k * 2 + 1] ?? 0);
        for (const k of meshData.i) ib[io++] = base + k;
      } else {
        const pv = psr.pivot ?? [0, 0, 0];
        const w = sx * aspect[0], h = sy * aspect[1];
        const ox = -(spPivot[0] + pv[0]) * w, oy = -(spPivot[1] + pv[1]) * h;
        put(toWorld(-w / 2 + ox, -h / 2 + oy, 0), 0, 0);
        put(toWorld(w / 2 + ox, -h / 2 + oy, 0), 1, 0);
        put(toWorld(w / 2 + ox, h / 2 + oy, 0), 1, 1);
        put(toWorld(-w / 2 + ox, h / 2 + oy, 0), 0, 1);
        ib[io++] = base; ib[io++] = base + 1; ib[io++] = base + 2; ib[io++] = base; ib[io++] = base + 2; ib[io++] = base + 3;
      }
      base += vpp;
    }
    const g = mesh.geometry;
    const vbuf = g.getAttribute("aPosition").buffer;
    vbuf.data = vb;
    g.indexBuffer.data = ib;
  }
}

function custom(cd: any, which: 0 | 1, a: number, r: Float32Array): [number, number, number, number] {
  if (!cd) return [0, 0, 0, 0];
  const mode = cd[`mode${which}`];
  if (mode === 1) {
    const n = cd[`vectorComponentCount${which}`] ?? 4;
    const out: [number, number, number, number] = [0, 0, 0, 0];
    for (let k = 0; k < n; k++) out[k] = mmc(cd[`vector${which}_${k}`], a, r[(which * 4 + k) % 16]);
    return out;
  }
  if (mode === 2) return mmg(cd[`color${which}`], a, r[which]);
  return [0, 0, 0, 0];
}


export { keys };
