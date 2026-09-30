interface DeviceNavigator {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  userAgentData?: { mobile?: boolean }
}

/**
 * Phones and tablets, by the browser's own device report (never by window size, so a small desktop window still
 * counts as a desktop). iPadOS reports a Mac platform but exposes touch points.
 */
export function isMobileDevice(device: DeviceNavigator | undefined): boolean {
  if (!device) return false
  if (device.userAgentData?.mobile === true) return true
  const agent = device.userAgent ?? ''
  if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone|webOS|BlackBerry/i.test(agent)) return true
  return device.platform === 'MacIntel' && (device.maxTouchPoints ?? 0) > 1
}

/** Why screen recognition is refused: no WebGPU in the browser, no usable GPU adapter, or GPU models that failed. */
export type GpuBlock = 'unsupported' | 'unavailable' | 'failed'

interface GpuNavigator {
  gpu?: { requestAdapter(options?: object): Promise<{ isFallbackAdapter?: boolean; info?: { isFallbackAdapter?: boolean } } | null> }
}

/**
 * Screen recognition needs a hardware WebGPU adapter: on the CPU (Tesseract text, WASM scene models) it read far slower
 * and missed most fusions and sales (samples 2026-09), so it is refused instead. A browser that offers no adapter most
 * often has graphics acceleration turned off in its settings, or a GPU (driver) it blocks; a software (fallback)
 * adapter counts as none, as in the OCR and scene workers.
 */
export async function webgpuBlock(device: GpuNavigator | undefined): Promise<GpuBlock | null> {
  const gpu = device?.gpu
  if (!gpu) return 'unsupported'
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' })
    return adapter && !adapter.isFallbackAdapter && !adapter.info?.isFallbackAdapter ? null : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

/**
 * Whether a running capture settled on the CPU anyway (the workers' own GPU load failed): Tesseract reads text only while
 * the GPU text models load or retry, so this is null until they give up, and null on the GPU.
 */
export function cpuFallback(ocr: { engine: 'paddle' | 'tesseract'; loading: boolean; reason?: string } | null,
  inference: { provider: 'webgpu' | 'wasm' } | null): GpuBlock | null {
  if (!ocr || ocr.loading) return null
  if (ocr.engine === 'paddle' && inference?.provider !== 'wasm') return null
  if (ocr.reason === 'webgpu-unsupported') return 'unsupported'
  if (ocr.reason === 'webgpu-unavailable') return 'unavailable'
  return 'failed'
}
