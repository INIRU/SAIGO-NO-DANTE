import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import { isDeployedSlot } from '@/lib/constants/game'
import { findAvailableFusions, recipeIngredientIds, recipeResultId, type FusionResult } from '@/lib/planner/fusion'
import { getIdentityGiftConditionKeywords } from '@/lib/planner/gift-condition-status'
import { giftGameId } from './run-priority-gifts'
import type { GiftData, IdentitySlot, RecipeData } from '@/lib/planner/types'

/** Keywords a gift can carry besides 공통; identity keywords outside them (affiliations, effects) never commit a run. */
const GIFT_KEYWORDS = new Set(['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전', '참격', '관통', '타격'])
/** A keyword counted this many times (deployed identities plus held gifts) is the run's direction, as a draft bot commits to a colour. */
export const KEYWORD_COMMIT = 3

export interface FormationCell { sinnerId: string; slot: IdentitySlot | null; position: number | null; deployed: boolean }

/** Every sinner in game order with the run's identity, its formation number (1-based, none on the bench) and whether it is deployed. */
export function formationRow(slots: readonly IdentitySlot[], sinners: readonly { id: string; order_num: number }[]): FormationCell[] {
  const bySinner = new Map(slots.map(slot => [slot.sinner_id, slot]))
  return [...sinners].sort((a, b) => a.order_num - b.order_num).map(sinner => {
    const slot = bySinner.get(sinner.id) ?? null
    const position = slot && slot.slot_order >= 0 && slot.slot_order < 99 ? slot.slot_order + 1 : null
    return { sinnerId: sinner.id, slot, position, deployed: !!slot && isDeployedSlot(slot.slot_order) }
  })
}

const held = (inventory: readonly string[]) => new Set(inventory.flatMap(entry => { const id = giftGameId(entry); return id === null ? [] : [id] }))

/** Keywords the run is committed to, most counted first: each deployed identity counts once per keyword, each held gift once. */
export function committedKeywords(slots: readonly IdentitySlot[], inventory: readonly string[], giftMap: Map<number, GiftData>): string[] {
  const counts = new Map<string, number>()
  const add = (keyword: string) => { if (GIFT_KEYWORDS.has(keyword)) counts.set(keyword, (counts.get(keyword) ?? 0) + 1) }
  for (const slot of slots) if (isDeployedSlot(slot.slot_order)) new Set(getIdentityGiftConditionKeywords(slot).map(normalizeThemeKeyword)).forEach(add)
  for (const entry of inventory) {
    const keyword = giftMap.get(giftGameId(entry) ?? NaN)?.keyword
    if (keyword) add(normalizeThemeKeyword(keyword))
  }
  return [...counts].filter(([, count]) => count >= KEYWORD_COMMIT).sort((a, b) => b[1] - a[1]).map(([keyword]) => keyword)
}

interface GoalContext { targets: readonly string[]; recipes: readonly RecipeData[]; giftMap: Map<number, GiftData>; owned: Set<number> }

/** Unheld final gifts in plan order and, for each recipe that makes one, its real (catalog) ingredients. */
function goals({ targets, recipes, giftMap, owned }: GoalContext) {
  const idByName = new Map([...giftMap.values()].map(gift => [gift.name, gift.game_id]))
  const finals = [...new Set(targets.flatMap(entry => { const id = giftGameId(entry); return id === null || owned.has(id) ? [] : [id] }))]
  const finalSet = new Set(finals)
  const finalRecipes = recipes.flatMap(recipe => {
    const resultId = recipeResultId(recipe, idByName)
    const result = resultId === undefined ? undefined : giftMap.get(resultId)
    return result && finalSet.has(result.game_id)
      ? [{ recipe, result, ingredients: recipeIngredientIds(recipe, idByName).flatMap(id => id === undefined ? [] : giftMap.get(id) ?? []) }] : []
  }).sort((a, b) => finals.indexOf(a.result.game_id) - finals.indexOf(b.result.game_id))
  return { finalSet, finalRecipes }
}

export type FusionReason = 'final' | 'material' | 'keyword' | 'other'
export interface FusionGuide {
  ready: { fusion: FusionResult; reason: FusionReason }[]
  /** Final gifts one material short, with that material. */
  nearly: { fusion: FusionResult; missing: GiftData[] }[]
}
const REASON_ORDER: FusionReason[] = ['final', 'material', 'keyword', 'other']
const gradeRank = (gift: GiftData | null) => gift?.grade === 'EX' ? 6 : Number(gift?.grade) || 0

/**
 * Fusions to make now, in the order they matter: a final gift, a material of a final gift's recipe, a result of a
 * committed keyword, then the rest by grade. A result already held is left out.
 */
export function fusionGuide({ inventory, targets, recipes, giftMap, committed }: { inventory: readonly string[]; targets: readonly string[];
  recipes: readonly RecipeData[]; giftMap: Map<number, GiftData>; committed: readonly string[] }): FusionGuide {
  const owned = held(inventory)
  const { finalSet, finalRecipes } = goals({ targets, recipes, giftMap, owned })
  const materials = new Set(finalRecipes.flatMap(item => item.ingredients.map(gift => gift.game_id)))
  const fusions = findAvailableFusions([...owned].map(String), [...recipes], giftMap)
  const reasonOf = (result: GiftData): FusionReason => finalSet.has(result.game_id) ? 'final' : materials.has(result.game_id) ? 'material'
    : result.keyword && committed.includes(normalizeThemeKeyword(result.keyword)) ? 'keyword' : 'other'
  const ready = fusions.filter(fusion => fusion.canCraft && fusion.result && !owned.has(fusion.result.game_id))
    .map(fusion => ({ fusion, reason: reasonOf(fusion.result!) }))
    .sort((a, b) => REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason) || gradeRank(b.fusion.result) - gradeRank(a.fusion.result))
  const nearly = finalRecipes.flatMap(({ recipe }) => {
    const fusion = fusions.find(item => item.recipe.id === recipe.id)
    const missing = fusion && !fusion.canCraft ? fusion.materials.filter(gift => !owned.has(gift.game_id)) : []
    return fusion && missing.length === 1 ? [{ fusion, missing }] : []
  })
  return { ready, nearly }
}
