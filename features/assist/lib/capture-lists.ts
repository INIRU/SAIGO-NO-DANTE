/**
 * How the capture's shown lists and states change with a new reading (features/assist/hooks/useAssistCapture.ts): the confirmed
 * popups, fusions and sales, the skill window, the pending-work counts, the star blessings and the CLEAR BONUS offer. Pure
 * updates, written to be given to a React state setter: an unchanged state keeps its object so nothing re-renders.
 */
import type { GiftSale, SkillExchangeView } from '@/features/assist/lib/capture-helpers'
import type { SkillExchangeRead } from '@/features/assist/lib/skill-exchange'
import { named } from '@/features/assist/lib/capture-evidence'
import { blessingSpent } from '@/features/assist/lib/blessing-screen'
import { offerKey, type ClearBonusCard, type ClearBonusOffer } from '@/features/assist/lib/clear-bonus'

/** A confirmed acquisition joins the list once (by its token); the last sixteen are kept. */
export function addAcquisition<T extends { token: string }>(items: T[], evidence: T): T[] {
  return items.some(item => item.token === evidence.token) ? items : [...items.slice(-15), evidence]
}

/** A dialog's evidence replaces its earlier entry (same token); the last eight are kept. */
export function addFusion<T extends { token: string }>(items: T[], evidence: T): T[] {
  return [...items.filter(item => item.token !== evidence.token).slice(-7), evidence]
}

/** Later sightings of a published dialog (last seen, closed) update its entry. */
export function patchFusion<T extends { token: string }>(items: T[], token: string, change: Partial<T>): T[] {
  return items.some(item => item.token === token) ? items.map(item => item.token === token ? { ...item, ...change } : item) : items
}

/** Confirmed shop sales (capture time of the dialog) join the list, latest last; the last eight are kept. */
export function addSales(items: GiftSale[], sold: readonly { giftId: string; at: number }[]): GiftSale[] {
  return [...items, ...sold.map(sale => ({ giftId: sale.giftId, token: `sell:${sale.at}:${sale.giftId}`, capturedAt: sale.at }))].slice(-8)
}

/**
 * The skill replacement window stays shown until 1.5 s of reads without it, so one missed read does not flicker; a read with
 * misread counts keeps the last counts of the same sinner.
 */
export function nextSkillExchange(previous: SkillExchangeView | null, read: SkillExchangeRead | null, at: number): SkillExchangeView | null {
  if (!read) return previous && at - previous.seenAt > 1500 ? null : previous
  return { sinner: read.sinner, current: read.current ?? (previous?.sinner === read.sinner ? previous.current : null), seenAt: at }
}

/** The counts of work the capture shows; the same counts keep the same object. */
export interface WorkCounts { analyzing: number; frames: number; text: number; image: number }
export function nextWorkCounts(current: WorkCounts, next: WorkCounts): WorkCounts {
  return current.analyzing === next.analyzing && current.frames === next.frames && current.text === next.text &&
    current.image === next.image ? current : next
}

/** The Star Blessing cards, once two reads in a row agree (`key`); the same levels keep the same object. */
export interface Blessings { levels: number[]; spent: number; observedAt: number }
export function nextBlessings(current: Blessings | null, levels: number[], key: string, observedAt: number): Blessings {
  return current && current.levels.join('') === key ? current : { levels, spent: blessingSpent(levels), observedAt }
}

/** The offer's cards with the pack names read for their places; unchanged names keep the same offer. */
export function bonusWithNames(current: ClearBonusOffer | null, names: ReadonlyMap<number, string[]>): ClearBonusOffer | null {
  return current && named(current.cards, names) !== current.cards ? { ...current, cards: named(current.cards, names) } : current
}

/** The CLEAR BONUS offer once two reads in a row agree (`key`); the same cards under the same header keep the same offer. */
export function nextClearBonus(current: ClearBonusOffer | null, key: string, cards: ClearBonusCard[], floor: number | null, observedAt: number): ClearBonusOffer {
  return current && offerKey(current.cards) === key && current.floor === floor ? current : { floor, cards, observedAt }
}
