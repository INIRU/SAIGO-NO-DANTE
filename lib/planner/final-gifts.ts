import { deriveBlockedFinalFusionMaterialIds } from './fusion'
import type { GiftData, RecipeData } from './types'

export type FinalGiftSource = 'start' | 'observe' | 'final'
export interface FinalGift { id: number; level: number; source: FinalGiftSource }

const ENTRY = /^(start|observe|final)_(\d+)(?:_(plus|plusplus))?$/
const RANK: Record<FinalGiftSource, number> = { start: 0, observe: 1, final: 2 }

/**
 * The run's final gifts, derived from the stored inventory: picked finals plus the start and observed gifts, which the
 * run always holds, minus everything a fixed-recipe result in that set consumed (see deriveBlockedFinalFusionMaterialIds).
 * Each gift appears once, in inventory order; source is where it came from (start/observe win over a pick), level its
 * enhancement, which only final_ keys carry.
 */
export function deriveFinalGifts(inventory: readonly string[], recipes: RecipeData[], giftMap: Map<number, GiftData>) {
  const byId = new Map<number, FinalGift>()
  for (const key of inventory) {
    const match = ENTRY.exec(key)
    if (!match) continue
    const id = Number(match[2])
    const source = match[1] as FinalGiftSource
    const level = match[3] === 'plusplus' ? 2 : match[3] ? 1 : 0
    const prev = byId.get(id)
    byId.set(id, { id, level: Math.max(prev?.level ?? 0, level), source: prev && RANK[prev.source] < RANK[source] ? prev.source : source })
  }
  const consumed = deriveBlockedFinalFusionMaterialIds({ selectedFinalGiftIds: byId.keys(), recipes, giftMap })
  return { gifts: [...byId.values()].filter(gift => !consumed.has(gift.id)), consumed }
}

/**
 * The final key a floor pick adds to the inventory, or null. A floor may always plan any gift; a material a final
 * fusion result consumes is planned on its floor but never becomes a final gift itself.
 */
export function finalKeyForFloorPick(id: number, final: { gifts: FinalGift[]; consumed: Set<number> }): string | null {
  return final.consumed.has(id) || final.gifts.some(gift => gift.id === id) ? null : `final_${id}`
}

/**
 * Inventory edit that sets a final gift's enhancement: swap its stored final_ key, or for a start/observe gift with none,
 * add one (and drop it again at level 0). Apply as REPLACE (both), ADD (newId only) or REMOVE (oldId only).
 */
export function finalEnhanceEdit(inventory: readonly string[], gift: FinalGift, level: number): { oldId?: string; newId?: string } {
  const key = (value: number) => `final_${gift.id}${value === 2 ? '_plusplus' : value === 1 ? '_plus' : ''}`
  const oldId = [0, 1, 2].map(key).find(id => inventory.includes(id))
  const newId = level === 0 && gift.source !== 'final' ? undefined : key(level)
  return oldId === newId ? {} : { oldId, newId }
}

/** Next level when tapping an enhanceable gift: 0 → + → ++ (when it has one) → 0. */
export function nextEnhanceLevel(gift: Pick<GiftData, 'effect_plus' | 'effect_plusplus'>, level: number): number {
  const max = gift.effect_plusplus ? 2 : gift.effect_plus ? 1 : 0
  return max === 0 ? 0 : (level + 1) % (max + 1)
}
