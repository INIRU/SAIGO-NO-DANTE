import { expect, it } from 'vitest'
import { RECOGNITION_MODE_STORAGE_KEY, RECOGNITION_PROFILES, readRecognitionMode } from '@/features/assist/lib/recognition-profile'
import { popupCaptureAction } from '@/features/assist/lib/popup-detect'
import { RECOGNITION_MODES } from '@/features/planner/components/RecognitionModeControl'

it('defaults to balanced and keeps only a valid stored mode', () => {
  const storage = (value: string | null) => ({ getItem: (key: string) => key === RECOGNITION_MODE_STORAGE_KEY ? value : null })
  expect(readRecognitionMode(storage(null))).toBe('balanced')
  expect(readRecognitionMode(storage('quality'))).toBe('quality')
  expect(readRecognitionMode(storage('performance'))).toBe('performance')
  expect(readRecognitionMode(storage('fastest'))).toBe('fastest')
  expect(readRecognitionMode(storage('turbo'))).toBe('balanced')
  expect(readRecognitionMode(null)).toBe('balanced')
  expect(readRecognitionMode({ getItem: () => { throw new Error('blocked') } })).toBe('balanced')
})

it('maps every control option to a real processing profile, each mode reading at least as much as the lighter one', () => {
  expect(Object.keys(RECOGNITION_PROFILES).sort()).toEqual([...RECOGNITION_MODES].sort())
  const { fastest, performance, balanced, quality } = RECOGNITION_PROFILES
  expect([fastest, performance, balanced, quality].map(p => p.ocrWorkers)).toEqual([1, 1, 2, 2])
  for (const [light, heavy] of [[fastest, performance], [performance, balanced], [balanced, quality]]) {
    expect(heavy.sceneIntervalMs).toBeLessThanOrEqual(light.sceneIntervalMs)
    expect(heavy.recognizeMs.idle).toBeLessThan(light.recognizeMs.idle)
    expect(heavy.recognizeMs.event).toBeLessThan(light.recognizeMs.event)
    expect(heavy.popupAttempts).toBeGreaterThanOrEqual(light.popupAttempts)
    expect(heavy.fullFrameDetSide * heavy.fullFrameGrid * heavy.fullFrameTileScale)
      .toBeGreaterThanOrEqual(light.fullFrameDetSide * light.fullFrameGrid * light.fullFrameTileScale)
  }
  // Every mode reads the frame in one pass; quality reads balanced's pass more often (tiling made each read too slow).
  expect([fastest, performance, balanced, quality].map(p => p.fullFrameGrid)).toEqual([1, 1, 1, 1])
  expect(quality.fullFrameDetSide).toBe(balanced.fullFrameDetSide)
})

it('reads up to maxAttempts separate frames of one popup, each a new comparable capture', () => {
  const base = { quality: 100, queuedQuality: null, capturedQuality: 100 }
  expect(popupCaptureAction({ ...base, at: 1000, attempts: 1, capturedAt: 800 })).toBe('enqueue')
  expect(popupCaptureAction({ ...base, at: 1000, attempts: 2, capturedAt: 800 })).toBe('skip')
  expect(popupCaptureAction({ ...base, at: 1000, attempts: 2, capturedAt: 800, maxAttempts: 3 })).toBe('enqueue')
  expect(popupCaptureAction({ ...base, at: 1000, attempts: 3, capturedAt: 800, maxAttempts: 3 })).toBe('skip')
  // Too soon after the previous frame, or a clearly worse frame: never a copy.
  expect(popupCaptureAction({ ...base, at: 850, attempts: 2, capturedAt: 800, maxAttempts: 3 })).toBe('skip')
  expect(popupCaptureAction({ ...base, quality: 80, at: 1000, attempts: 2, capturedAt: 800, maxAttempts: 3 })).toBe('skip')
})
