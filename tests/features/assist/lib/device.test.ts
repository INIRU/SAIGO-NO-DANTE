import { expect, it } from 'vitest'
import { cpuFallback, graphicsSettingsUrl, isMobileDevice, webgpuBlock } from '@/features/assist/lib/device'

it('blocks phones and tablets by the browser device report, not by window size', () => {
  expect(isMobileDevice({ userAgentData: { mobile: true } })).toBe(true)
  expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36' })).toBe(true)
  expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe(true)
  expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true)
})

it('keeps desktop browsers, including touch-screen laptops and small windows', () => {
  expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0', platform: 'Win32', maxTouchPoints: 10,
    userAgentData: { mobile: false } })).toBe(false)
  expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false)
  expect(isMobileDevice(undefined)).toBe(false)
})

const adapter = (value: object | null) => ({ gpu: { requestAdapter: async () => value } })

it('requires a hardware WebGPU adapter for screen recognition', async () => {
  expect(await webgpuBlock({})).toBe('unsupported')
  expect(await webgpuBlock(undefined)).toBe('unsupported')
  // Graphics acceleration off (or a blocked GPU): the browser has WebGPU but offers no adapter.
  expect(await webgpuBlock(adapter(null))).toBe('unavailable')
  expect(await webgpuBlock(adapter({ isFallbackAdapter: true }))).toBe('unavailable')
  expect(await webgpuBlock(adapter({ info: { isFallbackAdapter: true } }))).toBe('unavailable')
  expect(await webgpuBlock({ gpu: { requestAdapter: async () => { throw new Error('denied') } } })).toBe('unavailable')
  expect(await webgpuBlock(adapter({ info: { isFallbackAdapter: false } }))).toBeNull()
})

it('stops a capture only once it settled on the CPU, never while the GPU text models load or retry', () => {
  const webgpu = { provider: 'webgpu' as const }, wasm = { provider: 'wasm' as const }
  expect(cpuFallback(null, webgpu)).toBeNull()
  expect(cpuFallback({ engine: 'tesseract', loading: true }, webgpu)).toBeNull()
  expect(cpuFallback({ engine: 'tesseract', loading: true, reason: 'gpu-ocr-runtime-failed' }, webgpu)).toBeNull()
  expect(cpuFallback({ engine: 'tesseract', loading: true }, wasm)).toBeNull()
  expect(cpuFallback({ engine: 'paddle', loading: false }, webgpu)).toBeNull()
  expect(cpuFallback({ engine: 'paddle', loading: false }, null)).toBeNull()
  expect(cpuFallback({ engine: 'paddle', loading: false }, wasm)).toBe('failed')
  expect(cpuFallback({ engine: 'tesseract', loading: false, reason: 'webgpu-unavailable' }, wasm)).toBe('unavailable')
  expect(cpuFallback({ engine: 'tesseract', loading: false, reason: 'webgpu-unsupported' }, wasm)).toBe('unsupported')
  expect(cpuFallback({ engine: 'tesseract', loading: false, reason: 'gpu-ocr-init-failed' }, webgpu)).toBe('failed')
})

it('points to the browser settings page with the graphics acceleration switch', () => {
  expect(graphicsSettingsUrl('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36'))
    .toBe('chrome://settings/system')
  expect(graphicsSettingsUrl('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0'))
    .toBe('edge://settings/system')
})
