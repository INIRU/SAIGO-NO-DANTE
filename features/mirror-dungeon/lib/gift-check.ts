import type { EgoGift, EgoGiftTheme, Recipe } from '@/features/mirror-dungeon/types'
import { themeExclusiveGiftIds } from '@/lib/planner/fusion'

/** Gift list keyword order: 공통 → status keywords → attack types. */
export const GIFT_KEYWORD_ORDER = ['공통', '화상', '출혈', '진동', '파열', '침잠', '호흡', '충전', '참격', '관통', '타격'] as const

export const GIFT_KEYWORD_ORDER_STORAGE = 'snd-gift-keyword-order'
export const GIFT_CHECK_STORAGE = 'snd-gift-check'

/** A saved keyword order made safe: unknown keywords dropped, missing ones appended in the default order. */
export function normalizeKeywordOrder(saved: unknown): string[] {
  const known: readonly string[] = GIFT_KEYWORD_ORDER
  const kept = Array.isArray(saved) ? [...new Set(saved.filter((key): key is string => known.includes(key)))] : []
  return [...kept, ...known.filter(key => !kept.includes(key))]
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

/** Obtained gifts are stored by game id: row ids change when the data is synced again. */
export const giftCheckKey = (gift: Pick<EgoGift, 'id' | 'game_id'>) => String(gift.game_id ?? gift.id)

/** The stored list of obtained gifts (oldest first), without duplicates or foreign values. */
export function normalizeChecked(saved: unknown): string[] {
  if (!Array.isArray(saved)) return []
  return [...new Set(saved.filter(key => typeof key === 'string' || typeof key === 'number').map(String))]
}

/**
 * The list with the gift added, or without it when it was already there (a second press takes it out). `ingredients`
 * are recorded along with a fusion gift; taking the gift out again leaves them.
 */
export const toggleChecked = (checked: readonly string[], key: string, ingredients: readonly string[] = []) =>
  checked.includes(key) ? checked.filter(other => other !== key) : [...new Set([...checked, ...ingredients, key])]

/** Names of everything a fusion gift is made from: every ingredient of every recipe variant, through nested recipes. */
export function fusionIngredientNames(resultName: string, recipes: readonly Pick<Recipe, 'result_name' | 'ingredients'>[]): string[] {
  const names = new Set<string>()
  const collect = (result: string) => {
    for (const recipe of recipes) {
      if (recipe.result_name !== result) continue
      for (const ingredient of recipe.ingredients) {
        if (names.has(ingredient)) continue
        names.add(ingredient)
        collect(ingredient)
      }
    }
  }
  collect(resultName)
  names.delete(resultName)
  return [...names]
}

export interface GiftCheckMark {
  fusion: boolean
  /** Packs this gift is only found in (see themeExclusiveGiftIds), in theme order. */
  packs: EgoGiftTheme[]
}

/** Gifts that carry a mark in check mode, by gift id: fusion gifts and gifts only some packs give. */
export function giftCheckMarks(gifts: EgoGift[], themes: EgoGiftTheme[]): Map<string, GiftCheckMark> {
  const packsByGameId = new Map<number, EgoGiftTheme[]>()
  for (const theme of themes) {
    for (const id of themeExclusiveGiftIds(theme)) {
      const packs = packsByGameId.get(id)
      if (packs) packs.push(theme)
      else packsByGameId.set(id, [theme])
    }
  }
  const marks = new Map<string, GiftCheckMark>()
  for (const gift of gifts) {
    const packs = gift.game_id == null ? undefined : packsByGameId.get(gift.game_id)
    if (gift.is_synthesis || packs) marks.set(gift.id, { fusion: gift.is_synthesis, packs: packs ?? [] })
  }
  return marks
}
