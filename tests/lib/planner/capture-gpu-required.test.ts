import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

const root = resolve(__dirname, '../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

it('refuses screen recognition without WebGPU instead of reading on the CPU', () => {
  const hook = read('lib/hooks/useAssistCapture.ts')
  // Checked before the screen is shared, and again once the workers settle (cpuFallback) while running.
  expect(hook).toMatch(/const block = await gpuBlocked\(\)\s+if \(run !== generation\.current\) return\s+setGpu\(block\)\s+if \(block\) \{/)
  expect(hook.indexOf('await gpuBlocked()')).toBeLessThan(hook.indexOf('getDisplayMedia('))
  expect(hook).toContain("status === 'running' ? cpuFallback(ocrEngine, inference) : null")
  // Before the worker reports its backend the GPU models may still load: that gap is not a CPU fallback (it stopped
  // every capture as soon as the text worker was ready).
  expect(hook).toContain("lane.engine ??= { engine: 'tesseract', adapter: '', loading: true }")
  expect(read('lib/vision/ocr-worker.ts')).toContain("'gpu' in self.navigator ? 'webgpu-unavailable' : 'webgpu-unsupported'")

  const client = read('app/[lang]/planner/run/RunClient.tsx')
  expect(client).toContain('disabled={capture.mobile || gpuRefused}')
  expect(client).toContain('data-capture-gpu={capture.gpu}')
  for (const messages of [ko, en, ja]) {
    const run = messages.planner.run as Record<string, string>
    for (const key of ['captureGpuRequired', 'captureGpu_unsupported', 'captureGpu_unavailable', 'captureGpu_failed'])
      expect(run[key]?.length).toBeGreaterThan(0)
    // The CPU engine labels went with the CPU mode.
    for (const gone of ['inferenceWasm', 'ocrTesseract', 'ocrTesseractLoadingGpu']) expect(run[gone]).toBeUndefined()
  }
  expect(ko.planner.run.captureGpu_unavailable).toContain('그래픽 가속')
})
