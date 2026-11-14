/**
 * The queued popup frames and the reads merged for one popup (features/assist/hooks/useAssistCapture.ts): which waiting frame the
 * text or image reader takes next, which are too old, which one gives way to a better one, and what the frames of one popup
 * read so far say together. Pure: the hook passes in its queue items, its pending map and the time.
 */
import { acquiredGiftFromPopup, type PopupLabelRead } from '@/features/assist/lib/popup-evidence'
import type { OcrReference } from '@/features/assist/lib/ocr-match'

/** A queued frame with no read pending, or one captured more than 8 s ago, is given up. */
export const popupStale = (pending: { capturedAt: number } | undefined, now: number) => !pending || now - pending.capturedAt > 8000

/**
 * The frame to read next from one queue: the ready one (settled for its wait) with the highest priority, the earliest on a tie;
 * and the request ids of stale or unknown frames, to be dropped.
 */
export function pickReadyPopup<T extends { requestId: number }>(items: readonly T[],
  pendings: ReadonlyMap<number, { capturedAt: number; readyAt: number; priority: number }>, now: number): { best: T | null; stale: number[] } {
  let best: T | null = null
  let bestPriority = -1
  const stale: number[] = []
  for (const item of items) {
    const pending = pendings.get(item.requestId)
    if (!pending || popupStale(pending, now)) {
      stale.push(item.requestId)
      continue
    }
    if (pending.readyAt <= now && pending.priority > bestPriority) {
      best = item
      bestPriority = pending.priority
    }
  }
  return { best, stale }
}

/** Request ids of the stale frames among these. */
export function staleFrames(items: readonly { requestId: number }[], pendings: ReadonlyMap<number, { capturedAt: number }>, now: number): number[] {
  return items.filter(item => popupStale(pendings.get(item.requestId), now)).map(item => item.requestId)
}

/**
 * The frame of a full queue that gives way to a new one of this priority and quality: the lowest priority, then the weakest
 * quality, and only if it is below the new one. Null when no frame is weaker than the new one.
 */
export function weakestPopupFrame(full: readonly { requestId: number }[],
  pendings: ReadonlyMap<number, { priority: number; quality: number }>, priority: number, quality: number): number | null {
  let weakest: number | null = null
  let weakestPriority = priority
  let weakestQuality = quality
  for (const item of full) {
    const pending = pendings.get(item.requestId)
    const itemPriority = pending?.priority ?? -1
    const itemQuality = pending?.quality ?? 0
    if (itemPriority < weakestPriority || (itemPriority === weakestPriority && itemQuality < weakestQuality)) {
      weakest = item.requestId
      weakestPriority = itemPriority
      weakestQuality = itemQuality
    }
  }
  return weakest
}

/** The reads of the frames of one popup so far. */
export interface PopupReads { headers: string[]; labels: PopupLabelRead[]; icons: string[]; effects: string[] }

/**
 * What the frames of one popup say together: the frames must agree, so two different icons abstain (verdict null); the same
 * icon, names and effect owners in every frame give the gift the popup names.
 */
export function popupReadSummary(reads: PopupReads, gifts: OcrReference[]) {
  const icons = [...new Set(reads.icons)]
  const effects = [...new Set(reads.effects)]
  const header = reads.headers.join('\n')
  const verdict = icons.length > 1 ? null : acquiredGiftFromPopup({ header, labels: reads.labels, iconGiftId: icons[0] ?? null,
    effectGiftIds: effects, gifts })
  return { icons, effects, header, verdict }
}
