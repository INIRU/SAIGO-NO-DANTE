import type { VisualCandidates } from '@/features/assist/lib/embedding-match'
import { corroboratedChoiceEvent, type EventScreenEvidence, type OcrMatches } from '@/features/assist/lib/ocr-match'
import { popupPurchaseHeader, showsAcquiredHeader } from '@/features/assist/lib/popup-evidence'
import { isSellWindow, sellQuestion } from '@/features/assist/lib/sell-evidence'
import { showsBlessingScreen } from '@/features/assist/lib/blessing-screen'
import type { ClearBonusCard } from '@/features/assist/lib/clear-bonus'
import { showsRunEndScreen } from '@/features/assist/lib/run-end-screen'
import { themeSelectionHeaderFloor } from '@/features/assist/lib/exploration-match'

export type CaptureStatus = 'idle' | 'requesting' | 'loading' | 'running' | 'unsupported' | 'error'
export interface OcrCandidates extends OcrMatches, EventScreenEvidence { observedAt: number; expiresAt: number; floor: number | null }

/** The cards with the pack names read for their places (unchanged cards keep their object; the array too when none changed). */
export function named(cards: ClearBonusCard[], names: ReadonlyMap<number, string[]>): ClearBonusCard[] {
  let changed = false
  const next = cards.map(card => {
    const ids = names.get(card.place)
    if (!ids || card.themeIds?.join('|') === ids.join('|')) return card
    changed = true
    return { ...card, themeIds: ids }
  })
  return changed ? next : cards
}

/** The screens a verdict hangs on, by the text detectors that already decide them (for the log). */
export function screenTags(text: string): string[] {
  return ([['purchase-dialog', popupPurchaseHeader], ['sale-dialog', sellQuestion], ['acquired-header', showsAcquiredHeader],
    ['sell-window', isSellWindow], ['blessings', showsBlessingScreen], ['run-end', showsRunEndScreen],
    ['theme-select', (value: string) => themeSelectionHeaderFloor(value) !== null]] as const)
    .filter(([, shows]) => shows(text)).map(([tag]) => tag)
}

/** A purchase or sale confirmation on screen, from its first to its last full-frame sighting. */
export interface ShopDialog { kind: 'purchase' | 'sale'; firstAt: number; lastAt: number }
/** Sightings under 3 s apart are one dialog; the last eight are kept. */
export function noteShopDialog(items: readonly ShopDialog[], kind: ShopDialog['kind'], at: number): ShopDialog[] {
  const last = items.findLast(item => item.kind === kind)
  if (last && at - last.lastAt < 3000) return items.map(item => item === last ? { ...item, lastAt: at } : item)
  return [...items.slice(-7), { kind, firstAt: at, lastAt: at }]
}


/**
 * Fresh screen evidence for the recorded floor: the one event whose choices or intro are shown (image or event text must
 * identify it first; its result page never opens a summary). How long a summary stays is decided by the scene.
 */
export function captureEvidence({ status, visualCandidates, ocrCandidates }: {
  status: CaptureStatus
  visualCandidates: (VisualCandidates & { floor: number | null }) | null
  ocrCandidates: OcrCandidates | null
}, floor: number | null, now: number) {
  const visual = status === 'running' && visualCandidates && visualCandidates.floor === floor && visualCandidates.expiresAt > now
    ? visualCandidates : null
  const ocr = status === 'running' && ocrCandidates && ocrCandidates.floor === floor && ocrCandidates.expiresAt > now
    ? ocrCandidates : null
  // Events named by their own text; shared art alone never names an event.
  const textEventIds = [...new Set([...(ocr?.events.map(item => item.id) ?? []), ...(ocr?.choiceEventIds ?? []),
    ...(ocr?.bodyEventIds ?? [])])]
  const corroboratedEventIds = [...(visual?.events.map(item => item.id) ?? []), ...textEventIds]
  const listedEventId = ocr ? corroboratedChoiceEvent({ choices: ocr.choices, scopedChoices: ocr.scopedChoices,
    outcomeEventIds: ocr.outcomeEventIds, corroboratedEventIds }) : null
  // Intro and narration pages: one text-identified event previews its known outcomes until its result page appears.
  const choiceEventId = listedEventId ?? (ocr && textEventIds.length === 1 && !ocr.outcomeEventIds.includes(textEventIds[0])
    ? textEventIds[0] : null)
  const eventChoiceEvidence = choiceEventId === null || !ocr ? null
    : { eventId: Number(choiceEventId), observedAt: ocr.observedAt, floor: ocr.floor }
  return { visualCandidates: visual, ocrCandidates: ocr, eventChoiceEvidence }
}
