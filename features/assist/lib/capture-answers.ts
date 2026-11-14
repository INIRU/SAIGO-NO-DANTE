/**
 * What the capture makes of the workers' answers (features/assist/hooks/useAssistCapture.ts): the text reader's backend report,
 * a popup read's fields, the exploration banner's reads and what a floor read counts for, and the checks on the scene worker's
 * answers (cursor, formation, blessings, clear bonus, owned list). A malformed answer is null, never a guess. No React, no refs.
 */
import type { OcrWord } from '@/features/assist/lib/ocr-match'
import type { PopupLabelRead } from '@/features/assist/lib/popup-evidence'
import type { CursorSample } from '@/features/assist/lib/event-pick'
import type { ClearBonusCard } from '@/features/assist/lib/clear-bonus'

/** The text reader one worker runs: GPU PP-OCR (`paddle`) or Tesseract (also while PP-OCR loads). */
export interface OcrEngine { engine: 'paddle' | 'tesseract'; adapter: string; loading: boolean; reason?: string }

/** A worker's backend report as its engine: the adapter only means something for PP-OCR, loading only for Tesseract. */
export function parseOcrBackend(report: { engine?: string; adapter?: string; loading?: boolean; reason?: string }): OcrEngine {
  return { engine: report.engine === 'paddle' ? 'paddle' : 'tesseract',
    adapter: report.engine === 'paddle' && typeof report.adapter === 'string' ? report.adapter.slice(0, 60) : '',
    loading: report.engine !== 'paddle' && report.loading === true,
    ...(typeof report.reason === 'string' ? { reason: report.reason.slice(0, 40) } : {}) }
}

/**
 * The engine the capture shows for its workers' engines: while any worker has not reported, the first that has (or null);
 * once all have, PP-OCR only if every one runs it.
 */
export function mergeOcrEngines(engines: readonly (OcrEngine | null)[]): OcrEngine | null {
  if (engines.some(engine => !engine)) return engines.find(Boolean) ?? null
  const all = engines as OcrEngine[]
  const paddle = all.every(engine => engine.engine === 'paddle')
  return { engine: paddle ? 'paddle' : 'tesseract', adapter: paddle ? all[0].adapter : '', loading: all.some(engine => engine.loading),
    ...(all.find(engine => engine.reason)?.reason ? { reason: all.find(engine => engine.reason)!.reason } : {}) }
}

/**
 * The fields of a popup read besides its header. Older worker bundles send only the raw plate read and no effect panel
 * (`labels` then missing or malformed: the plate read is the one label).
 */
export function parsePopupRead(result: { label: string; labelWords: OcrWord[]; labels?: PopupLabelRead[]; body?: unknown; lexicon?: { id?: unknown } | null }) {
  const labels = Array.isArray(result.labels) && result.labels.every(read => typeof read?.text === 'string' &&
    Array.isArray(read.words)) ? result.labels : [{ text: result.label, words: result.labelWords }]
  const body = typeof result.body === 'string' ? result.body : ''
  const lexiconId = typeof result.lexicon?.id === 'string' ? result.lexicon.id : null
  return { labels, body, lexiconId }
}

/** The exploration banner's pack-name reads: arrays of words with text. */
export function parseThemeReads(raw: unknown): OcrWord[][] {
  return Array.isArray(raw) ? raw.filter(Array.isArray).map(read => read.filter((word: { text?: unknown }) => typeof word?.text === 'string')) : []
}

/** What a banner's floor number counts for, given the floor read before it and the run's current floor. */
export function floorReadVerdict({ floor, at, previous, runFloor }: {
  floor: number
  at: number
  previous: { floor: number; at: number } | null
  runFloor: number | null
}) {
  const elapsed = previous ? at - previous.at : -1
  return {
    // a single exact pack read may confirm only under the current or next floor, or one an earlier capture also read
    agreed: (runFloor !== null && (floor === runFloor || floor === runFloor + 1)) ||
      (previous?.floor === floor && elapsed > 0 && elapsed <= 180000),
    // the same floor read again between 1 s and 60 s later is the floor the run is on
    observed: previous?.floor === floor && elapsed >= 1000 && elapsed <= 60000,
    // only a newer read replaces the one kept
    keep: !previous || at > previous.at,
  }
}

/** The cursor the worker found over the choice list as a sample at `at`, or null when none (or not a point). */
export function parseCursorSample(cursor: { x?: unknown; y?: unknown; pressed?: unknown } | null | undefined, at: number): CursorSample | null {
  return cursor && typeof cursor.x === 'number' && typeof cursor.y === 'number' && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)
    ? { at, x: cursor.x, y: cursor.y, pressed: cursor.pressed === true } : null
}

/** The twelve formation slots of the bottom bar: an Identity id or null each. */
export function parseFormationIds(ids: unknown): (string | null)[] | null {
  return Array.isArray(ids) && ids.length === 12 && ids.every(id => id === null || typeof id === 'string') ? ids as (string | null)[] : null
}

/** The ten Star Blessing cards' levels, 0 to 3. */
export function parseBlessingLevels(levels: unknown): number[] | null {
  return Array.isArray(levels) && levels.length === 10 && levels.every(level => Number.isInteger(level) && level >= 0 && level <= 3)
    ? levels as number[] : null
}

/** The CLEAR BONUS cards the worker read: a place and gift ids each. */
export function parseBonusCards(cards: unknown): ClearBonusCard[] | null {
  return Array.isArray(cards) && cards.every(card => card && typeof card.place === 'number' && Array.isArray(card.gifts) &&
    card.gifts.every((gift: unknown) => typeof gift === 'string')) ? cards as ClearBonusCard[] : null
}

/** The sell window's owned list: gift ids. */
export function parseOwnedGifts(gifts: unknown): string[] | null {
  return Array.isArray(gifts) && gifts.every(gift => typeof gift === 'string') ? gifts as string[] : null
}
