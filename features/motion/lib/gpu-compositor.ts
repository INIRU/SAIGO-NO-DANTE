// The WebGPU way of drawing a skill video: the browser hands the video's current frame to the shader as an external texture
// (importExternalTexture: no copy of the 1920×3240 picture into a texture each frame, which is what the WebGL2 compositor does),
// and the shader joins the Y, Cb, Cr planes exactly as the WebGL2 one. Only for a video without layers; everything else, and
// every browser without WebGPU, stays on compositor.ts.
import type { LayerSetMeta, Rect } from './compositor'

const WGSL = /* wgsl */ `
struct U { y: vec4f, cb: vec4f, cr: vec4f, texel: vec2f, planes: f32 };
@group(0) @binding(0) var smp: sampler;
@group(0) @binding(1) var video: texture_external;
@group(0) @binding(2) var<uniform> u: U;
struct V { @builtin(position) pos: vec4f, @location(0) t: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)); // fullscreen triangle
  return V(vec4f(p * 2.0 - 1.0, 0.0, 1.0), vec2f(p.x, 1.0 - p.y)); // t: y down, as the video
}
// a point of a tile, kept half a texel inside it: the filter never reads the neighbouring tile
fn tuv(r: vec4f, t: vec2f) -> vec2f { return r.xy + clamp(t * r.zw, 0.5 * u.texel, r.zw - 0.5 * u.texel); }
@fragment fn fs(v: V) -> @location(0) vec4f {
  if (u.planes > 0.5) {
    let y = textureSampleBaseClampToEdge(video, smp, tuv(u.y, v.t)).g;
    let cb = textureSampleBaseClampToEdge(video, smp, tuv(u.cb, v.t)).g - 0.5;
    let cr = textureSampleBaseClampToEdge(video, smp, tuv(u.cr, v.t)).g - 0.5;
    return vec4f(y + 1.5748 * cr, y - 0.1873 * cb - 0.4681 * cr, y + 1.8556 * cb, 1.0);
  }
  return vec4f(textureSampleBaseClampToEdge(video, smp, tuv(u.y, v.t)).rgb, 1.0);
}`

let shared: Promise<GPUDevice | null> | null = null
/** One device for the page: null without WebGPU (or when the browser gives no adapter). */
function device(): Promise<GPUDevice | null> {
  return (shared ??= (async () => {
    try {
      if (!navigator.gpu) { GpuCompositor.why = 'no navigator.gpu'; return null }
      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) { GpuCompositor.why = 'no adapter'; return null }
      const d = await adapter.requestDevice()
      void d?.lost.then(() => { shared = null })
      return d
    } catch (e) { GpuCompositor.why = 'device: ' + String(e); return null }
  })())
}

export class GpuCompositor {
  readonly kind = 'webgpu'
  /** why the last create() gave the WebGL2 compositor the video (the `?debug=1` meter shows it) */
  static why = ''
  private failed = ''
  onReady: (() => void) | null = null
  private constructor(private dev: GPUDevice, private ctx: GPUCanvasContext, private pipeline: GPURenderPipeline, private sampler: GPUSampler, private uniforms: GPUBuffer) {}

  /** Null when this browser, this video (layers) or a first frame drawn from `video` (which must have one) does not work here: the caller takes the WebGL2 compositor. */
  static async create(canvas: HTMLCanvasElement, meta: LayerSetMeta, video: HTMLVideoElement): Promise<GpuCompositor | null> {
    if (meta.layers.length || meta.chroma || meta.frameCode || (meta.basePlanes && !(meta.basePlanes.cb && meta.basePlanes.cr))) { GpuCompositor.why = 'video with layers'; return null }
    const dev = await device()
    if (!dev) return null
    try {
      canvas.width = meta.tile.w
      canvas.height = meta.tile.h
      const ctx = canvas.getContext('webgpu') as GPUCanvasContext | null
      if (!ctx) { GpuCompositor.why = 'no webgpu canvas context'; return null }
      const format = navigator.gpu.getPreferredCanvasFormat()
      ctx.configure({ device: dev, format, alphaMode: 'opaque' })
      dev.pushErrorScope('validation')
      const module = dev.createShaderModule({ code: WGSL })
      const pipeline = dev.createRenderPipeline({ layout: 'auto', vertex: { module, entryPoint: 'vs' }, fragment: { module, entryPoint: 'fs', targets: [{ format }] }, primitive: { topology: 'triangle-list' } })
      const { w, h } = meta.video, r = (p: Rect) => [p.x / w, p.y / h, (p.w ?? meta.tile.w) / w, (p.h ?? meta.tile.h) / h]
      const P = meta.basePlanes, none = [0, 0, 0, 0]
      const data = new Float32Array([...r(P ? P.y : meta.base), ...(P?.cb ? r(P.cb) : none), ...(P?.cr ? r(P.cr) : none), 1 / w, 1 / h, P ? 1 : 0, 0])
      const uniforms = dev.createBuffer({ size: data.byteLength, usage: 0x40 | 0x08 }) // GPUBufferUsage.UNIFORM | COPY_DST
      dev.queue.writeBuffer(uniforms, 0, data)
      const comp = new GpuCompositor(dev, ctx, pipeline, dev.createSampler({ magFilter: 'linear', minFilter: 'linear' }), uniforms)
      const drawn = comp.draw(video)
      const error = await dev.popErrorScope()
      if (!drawn || error) { GpuCompositor.why = error ? 'validation: ' + error.message : 'first draw: ' + comp.failed; comp.dispose(); return null }
      GpuCompositor.why = ''
      return comp
    } catch (e) { GpuCompositor.why = 'create: ' + String(e); return null }
  }

  /** draws the video's current frame; false when the video has none to give (the canvas keeps the last picture) */
  draw(video: HTMLVideoElement, _frame?: number, _exact?: boolean): boolean {
    try {
      const dev = this.dev
      const bind = dev.createBindGroup({ layout: this.pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: this.sampler }, { binding: 1, resource: dev.importExternalTexture({ source: video }) }, { binding: 2, resource: { buffer: this.uniforms } },
      ] })
      const encoder = dev.createCommandEncoder()
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] })
      pass.setPipeline(this.pipeline)
      pass.setBindGroup(0, bind)
      pass.draw(3)
      pass.end()
      dev.queue.submit([encoder.finish()])
      return true
    } catch (e) { this.failed = String(e); return false }
  }

  dispose(): void {
    this.uniforms.destroy()
    try { this.ctx.unconfigure() } catch { /* the canvas is gone */ }
  }
}
