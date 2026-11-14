/**
 * Which kinds of screens Assist reads. Turning one off stops that reading work entirely (no OCR or icon matching for
 * it), which also lightens the game. Everything is on unless the user turned it off in this browser.
 */
import { readJson } from '@/lib/utils/local-storage'

export const DETECTION_KINDS = ['gifts', 'themes', 'events'] as const
export type DetectionKind = typeof DETECTION_KINDS[number]
export type DetectionSettings = Record<DetectionKind, boolean>

export const DEFAULT_DETECTION: DetectionSettings = { gifts: true, themes: true, events: true }
export const DETECTION_STORAGE_KEY = 'limbus-assist-detection'

/** Stored switches; anything missing or invalid stays on. */
export function readDetectionSettings(storage: Pick<Storage, 'getItem'> | null | undefined): DetectionSettings {
  const stored = readJson(DETECTION_STORAGE_KEY, storage ?? null)
  const values = stored && typeof stored === 'object' ? stored as Record<string, unknown> : {}
  return Object.fromEntries(DETECTION_KINDS.map(kind => [kind, values[kind] !== false])) as DetectionSettings
}
