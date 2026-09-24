import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

const root = resolve(__dirname, '../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

it('keeps no display-only frame copies in the capture hook: analysis frames are its only captures', () => {
  const hook = read('lib/hooks/useAssistCapture.ts')
  for (const gone of ['thumbnail', 'createObjectURL', 'revokeObjectURL', 'toBlob', "createElement('canvas')"]) expect(hook).not.toContain(gone)
})

it('shows a short capture state and the single privacy sentence, in three languages', () => {
  const client = read('app/[lang]/planner/run/RunClient.tsx')
  expect(client).toContain('data-capture-state={capture.status}')
  expect(client).toContain("t('captureFramesPrivacy')")
  for (const gone of ['CaptureFrameStrip', 'captureQueue', 'inferenceWebgpu', 'ocrPaddleWebgpu', 'sceneCandidate', 'screenPreviewOnly']) expect(client).not.toContain(gone)
  for (const messages of [ko, en, ja]) {
    const run = messages.planner.run as Record<string, string>
    for (const state of ['idle', 'requesting', 'loading', 'running', 'unsupported', 'error']) {
      expect(run[`capture_${state}`].length).toBeGreaterThan(0)
      expect(run[`capture_${state}`].length).toBeLessThan(60)
    }
    expect(run.captureFramesLabel).toBeUndefined()
    expect(run.captureFrameAlt).toBeUndefined()
  }
  expect(ko.planner.run.captureFramesPrivacy).toBe('화면은 이 브라우저에서만 분석해요. 저장하거나 전송하지 않아요.')
})
