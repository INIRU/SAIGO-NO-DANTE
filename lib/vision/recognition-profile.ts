/**
 * Recognition modes. Evidence rules and thresholds are identical in every mode; modes only change how much reading is
 * done: OCR workers running at once, capture cadence, full-frame detection size or tiling, and popup frames read.
 * Heaviest last: fastest < performance < balanced < quality.
 */
export type RecognitionMode = 'fastest' | 'performance' | 'balanced' | 'quality'

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
  /** Full-frame detection as grid x grid overlapping tiles, each enlarged by tileScale; 1 means a single pass at fullFrameDetSide. */
  fullFrameGrid: 1 | 2
  fullFrameTileScale: number
  /** Separate frames read per gift popup. */
  popupAttempts: number
}

export const RECOGNITION_PROFILES: Record<RecognitionMode, RecognitionProfile> = {
  fastest: { ocrWorkers: 1, sceneIntervalMs: 2000, recognizeMs: { idle: 5000, event: 1600 }, exploreMs: { idle: 4000, recent: 1000 },
    fullFrameDetSide: 640, fullFrameGrid: 1, fullFrameTileScale: 1, popupAttempts: 2 },
  performance: { ocrWorkers: 1, sceneIntervalMs: 1500, recognizeMs: { idle: 4000, event: 1200 }, exploreMs: { idle: 3000, recent: 800 },
    fullFrameDetSide: 736, fullFrameGrid: 1, fullFrameTileScale: 1, popupAttempts: 2 },
  // The former quality settings: users reported they run smoothly, so they are the default now.
  balanced: { ocrWorkers: 2, sceneIntervalMs: 1000, recognizeMs: { idle: 2000, event: 700 }, exploreMs: { idle: 1500, recent: 500 },
    fullFrameDetSide: 1280, fullFrameGrid: 1, fullFrameTileScale: 1, popupAttempts: 3 },
  // 2x2 tiles at 1.5x zoom: about 1.5x the detector pixels per text line of a native 1080p pass, for small event text.
  quality: { ocrWorkers: 2, sceneIntervalMs: 750, recognizeMs: { idle: 1500, event: 600 }, exploreMs: { idle: 1200, recent: 400 },
    fullFrameDetSide: 1280, fullFrameGrid: 2, fullFrameTileScale: 1.5, popupAttempts: 4 },
}

export const RECOGNITION_MODE_STORAGE_KEY = 'limbus-assist-recognition-mode'

/** Stored mode, or balanced when nothing (or something invalid) is stored. */
export function readRecognitionMode(storage: Pick<Storage, 'getItem'> | null | undefined): RecognitionMode {
  try {
    const value = storage?.getItem(RECOGNITION_MODE_STORAGE_KEY)
    return value === 'fastest' || value === 'performance' || value === 'balanced' || value === 'quality' ? value : 'balanced'
  } catch {
    return 'balanced'
  }
}
