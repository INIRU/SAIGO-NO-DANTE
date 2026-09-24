/**
 * Recognition modes. Evidence rules and thresholds are identical in every mode; modes only change how much reading is
 * done: OCR workers running at once, capture cadence, full-frame detection size and separate popup frames read.
 */
export type RecognitionMode = 'performance' | 'balanced' | 'quality'

export interface RecognitionProfile {
  /** 1: popups and screen reads share one OCR worker; 2: a popup lane and a screen (event/pack/banner) lane. */
  ocrWorkers: 1 | 2
  /** Scene/icon inference interval. */
  sceneIntervalMs: number
  /** Full-frame OCR interval: normally, and while an event or pack screen is shown. */
  recognizeMs: { idle: number; event: number }
  /** Exploration banner interval: normally, and right after a banner was read. */
  exploreMs: { idle: number; recent: number }
  /** Long side of the full-frame text detector input (GPU OCR). */
  fullFrameDetSide: number
  /** Separate frames read per gift popup. */
  popupAttempts: number
}

export const RECOGNITION_PROFILES: Record<RecognitionMode, RecognitionProfile> = {
  performance: { ocrWorkers: 1, sceneIntervalMs: 1500, recognizeMs: { idle: 4000, event: 1200 }, exploreMs: { idle: 3000, recent: 800 },
    fullFrameDetSide: 736, popupAttempts: 2 },
  balanced: { ocrWorkers: 2, sceneIntervalMs: 1000, recognizeMs: { idle: 3000, event: 900 }, exploreMs: { idle: 2000, recent: 600 },
    fullFrameDetSide: 960, popupAttempts: 2 },
  quality: { ocrWorkers: 2, sceneIntervalMs: 1000, recognizeMs: { idle: 2000, event: 700 }, exploreMs: { idle: 1500, recent: 500 },
    fullFrameDetSide: 1280, popupAttempts: 3 },
}

export const RECOGNITION_MODE_STORAGE_KEY = 'limbus-assist-recognition-mode'

/** Stored mode, or balanced when nothing (or something invalid) is stored. */
export function readRecognitionMode(storage: Pick<Storage, 'getItem'> | null | undefined): RecognitionMode {
  try {
    const value = storage?.getItem(RECOGNITION_MODE_STORAGE_KEY)
    return value === 'performance' || value === 'balanced' || value === 'quality' ? value : 'balanced'
  } catch {
    return 'balanced'
  }
}
