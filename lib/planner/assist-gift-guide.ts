import { normalizeThemeKeyword } from '../constants/keywords'
import { isDeployedSlot } from '../constants/game'
import { giftCount, pairCount, type PlanGiftStats } from '../meta/plan-gift-stats'
import { findAvailableFusions, type FusionResult } from './fusion'
import { getIdentityGiftConditionKeywords } from './gift-condition-status'
import { giftGameId } from './run-priority-gifts'
import type { GiftData, IdentitySlot, RecipeData } from './types'

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
  const byName = new Map([...giftMap.values()].map(gift => [gift.name, gift]))
  const finals = [...new Set(targets.flatMap(entry => { const id = giftGameId(entry); return id === null || owned.has(id) ? [] : [id] }))]
  const finalSet = new Set(finals)
  const finalRecipes = recipes.flatMap(recipe => {
    const result = byName.get(recipe.result_name)
    return result && finalSet.has(result.game_id)
      ? [{ recipe, result, ingredients: recipe.ingredients.flatMap(name => byName.get(name) ?? []) }] : []
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

export type GiftReason =
  | { kind: 'final' }
  | { kind: 'material'; result: GiftData; complete: boolean }
  | { kind: 'keyword'; keyword: string }
  | { kind: 'synergy' }
  | { kind: 'popular'; share: number }
export interface GiftAdvice { gift: GiftData; score: number; reasons: GiftReason[] }

/** Plans counted as if this many more held nothing, so a gift of a handful of plans does not look popular. */
const ADOPTION_PRIOR = 10
/** A reason is shown once its part of the score reaches this. */
const SHOWN = 5

/**
 * The gifts on screen ranked for this run. Score: final gift 100; material of a final recipe 60 (80 when it completes
 * one); committed keyword 30, or −10 for another keyword once the run is committed; plan synergy with held gifts
 * (10·log2 of observed over expected pair count, ±20 at most); adoption among public plans shrunk toward 0 (0–10).
 * Popularity weighs least: human picks carry biases (it measures what plans take, not what wins).
 */
export function recommendGifts({ candidates, inventory, targets, recipes, giftMap, committed, stats, limit = 3 }: {
  candidates: readonly number[]; inventory: readonly string[]; targets: readonly string[]; recipes: readonly RecipeData[]
  giftMap: Map<number, GiftData>; committed: readonly string[]; stats: PlanGiftStats | null; limit?: number
}): GiftAdvice[] {
  const owned = held(inventory)
  const { finalSet, finalRecipes } = goals({ targets, recipes, giftMap, owned })
  const ranked = [...new Set(candidates)].flatMap(id => {
    const gift = giftMap.get(id)
    if (!gift || owned.has(id)) return []
    const reasons: GiftReason[] = []
    let score = 0
    if (finalSet.has(id)) { score += 100; reasons.push({ kind: 'final' }) }
    const feeds = finalRecipes.filter(item => item.ingredients.some(material => material.game_id === id))
      .map(item => ({ result: item.result, complete: item.ingredients.every(material => material.game_id === id || owned.has(material.game_id)) }))
      .sort((a, b) => Number(b.complete) - Number(a.complete))[0]
    if (feeds) { score += feeds.complete ? 80 : 60; reasons.push({ kind: 'material', ...feeds }) }
    const keyword = gift.keyword ? normalizeThemeKeyword(gift.keyword) : ''
    if (committed.includes(keyword)) { score += 30; reasons.push({ kind: 'keyword', keyword }) }
    else if (committed.length && GIFT_KEYWORDS.has(keyword)) score -= 10
    if (stats && stats.plans > 0) {
      const count = giftCount(stats, id)
      let synergy = 0
      for (const other of owned) {
        const otherCount = giftCount(stats, other)
        if (!otherCount || !count) continue
        synergy += 10 * Math.log2((pairCount(stats, id, other) + 1) / (count * otherCount / stats.plans + 1))
      }
      synergy = Math.max(-20, Math.min(20, synergy))
      score += synergy
      if (synergy >= SHOWN) reasons.push({ kind: 'synergy' })
      const adoption = Math.min(10, 20 * count / (stats.plans + ADOPTION_PRIOR))
      score += adoption
      if (adoption >= SHOWN) reasons.push({ kind: 'popular', share: count / stats.plans })
    }
    return [{ gift, score, reasons }]
  })
  return ranked.sort((a, b) => b.score - a.score).slice(0, limit)
}
