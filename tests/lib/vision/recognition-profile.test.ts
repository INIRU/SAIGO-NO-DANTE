import { expect, it } from 'vitest'
import { RECOGNITION_MODE_STORAGE_KEY, RECOGNITION_PROFILES, readRecognitionMode } from '../../../lib/vision/recognition-profile'
import { popupCaptureAction } from '../../../lib/vision/popup-detect'
import { RECOGNITION_MODES } from '../../../components/planner/run/RecognitionModeControl'

it('defaults to balanced and keeps only a valid stored mode', () => {
  const storage = (value: string | null) => ({ getItem: (key: string) => key === RECOGNITION_MODE_STORAGE_KEY ? value : null })
  expect(readRecognitionMode(storage(null))).toBe('balanced')
  expect(readRecognitionMode(storage('quality'))).toBe('quality')
  expect(readRecognitionMode(storage('performance'))).toBe('performance')
  expect(readRecognitionMode(storage('turbo'))).toBe('balanced')
  expect(readRecognitionMode(null)).toBe('balanced')
  expect(readRecognitionMode({ getItem: () => { throw new Error('blocked') } })).toBe('balanced')
})

it('maps every control option to a real processing profile: 1 OCR worker, then 2, quality reading more', () => {
  expect(Object.keys(RECOGNITION_PROFILES).sort()).toEqual([...RECOGNITION_MODES].sort())
  const { performance, balanced, quality } = RECOGNITION_PROFILES
  expect([performance.ocrWorkers, balanced.ocrWorkers, quality.ocrWorkers]).toEqual([1, 2, 2])
  expect(performance.sceneIntervalMs).toBeGreaterThan(balanced.sceneIntervalMs)
  expect(performance.recognizeMs.idle).toBeGreaterThan(balanced.recognizeMs.idle)
  expect(quality.fullFrameDetSide).toBeGreaterThan(balanced.fullFrameDetSide)
  expect(quality.popupAttempts).toBe(balanced.popupAttempts + 1)
  expect(quality.recognizeMs.event).toBeLessThanOrEqual(balanced.recognizeMs.event)
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
