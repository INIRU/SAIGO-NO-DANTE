import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createTranslator } from 'use-intl/core'
import { expect, it } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

const root = resolve(__dirname, '../../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const BLOCKS = ['unsupported', 'unavailable', 'failed'] as const

it('refuses screen recognition without WebGPU instead of reading on the CPU', () => {
  const hook = read('features/assist/hooks/useAssistCapture.ts')
  // Checked before the screen is shared, and again once the workers settle (cpuFallback) while running.
  expect(hook).toMatch(/const block = await gpuBlocked\(\)\s+if \(run !== generation\.current\) return\s+setGpu\(block\)\s+if \(block\) \{\s+setStatus\('idle'\)\s+return block/)
  expect(hook.indexOf('await gpuBlocked()')).toBeLessThan(hook.indexOf('getDisplayMedia('))
  expect(hook).toContain("status === 'running' ? cpuFallback(ocrEngine, inference) : null")
  // Before the worker reports its backend the GPU models may still load: that gap is not a CPU fallback (it stopped
  // every capture as soon as the text worker was ready).
  expect(hook).toContain("lane.engine ??= { engine: 'tesseract', adapter: '', loading: true }")
  expect(read('features/assist/lib/ocr-worker.ts')).toContain("'gpu' in self.navigator ? 'webgpu-unavailable' : 'webgpu-unsupported'")
})

it('explains the fix in a modal opened by connecting without WebGPU or by a capture stopped for it', () => {
  const client = read('app/[lang]/planner/run/RunClient.tsx')
  expect(client).toContain('if (gpuRefused) { setGpuHelp(true); return }')
  expect(client).toContain("void capture.start().then(block => { if (block) setGpuHelp(true) })")
  expect(client).toContain("if (capture.gpu === 'failed') setGpuHelp(true)")
  expect(client).toContain('data-capture-gpu={capture.gpu}')
  expect(client).toContain('<GpuRequiredModal block={capture.gpu} open={gpuHelp}')
  const modal = read('components/planner/run/GpuRequiredModal.tsx')
  expect(modal).toContain("import BaseModal from '@/components/ui/BaseModal'")
  for (const step of [1, 2, 3]) expect(modal).toContain(`<Callout step={${step}}`)
})

it('words every GPU notice in three languages, with the settings names filled in', () => {
  for (const [locale, messages] of [['ko', ko], ['en', en], ['ja', ja]] as const) {
    const run = messages.planner.run as Record<string, string>
    for (const block of BLOCKS) {
      expect(run[`captureGpu_${block}`]?.length).toBeGreaterThan(0)
      expect(run[`gpuHelpTitle_${block}`]?.length).toBeGreaterThan(0)
    }
    for (const gone of ['captureGpuRequired', 'inferenceWasm', 'ocrTesseract', 'ocrTesseractLoadingGpu']) expect(run[gone]).toBeUndefined()
    // An ASCII apostrophe before "{" quotes the placeholder in ICU messages, which would print "{label}" as is.
    const t = createTranslator({ locale, messages, namespace: 'planner.run' })
    const label = t('gpuHelpSettingsLabel'), relaunch = t('gpuHelpRelaunch')
    expect(t('gpuHelpStepToggle', { label })).toContain(label)
    expect(t('gpuHelpStepRelaunch', { relaunch })).toContain(relaunch)
    expect(t('gpuHelpStepToggle', { label })).not.toContain('{')
  }
  expect(ko.planner.run.gpuHelpSettingsLabel).toBe('가능한 경우 그래픽 가속 사용')
})
