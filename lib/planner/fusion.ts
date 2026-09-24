import type { RecipeData, GiftData } from './types'
import { normalizeThemeKeyword } from '../constants/keywords'

// ── 기프트 활성화 상태 ─────────────────────────────────────────────────────
// Design Ref: §4.6 — 키워드 매칭 기반 확률업 하이라이트

export type ActivationLevel = 'met' | 'almost' | 'specific' | 'unmet'

export function getGiftActivationStatus(
  gift: GiftData,
  formationKeywords: Record<string, number>,
  allKeywords: Record<string, number>,
  specificIds: Set<number>,
): ActivationLevel {
  if (specificIds.has(gift.game_id)) return 'specific'
  const cond = gift.activation_condition
  if (!cond || !cond.count) return 'met'

  // multi_keyword: 여러 키워드 중 하나라도 충족
  if (cond.type === 'multi_keyword' && cond.keywords) {
    const formMet = cond.keywords.some(kw => (formationKeywords[normalizeThemeKeyword(kw)] ?? 0) >= cond.count!)
    if (formMet) return 'met'
    const allMet = cond.keywords.some(kw => (allKeywords[normalizeThemeKeyword(kw)] ?? 0) >= cond.count!)
    if (allMet) return 'almost'
    return 'unmet'
  }

  // single keyword
  const keyword = normalizeThemeKeyword(cond.keyword ?? '')
  const formCount = formationKeywords[keyword] ?? 0
  const allCount = allKeywords[keyword] ?? 0

  if (formCount >= cond.count) return 'met'
  if (allCount >= cond.count) return 'almost'
  return 'unmet'
}

export interface FusionResult {
  recipe: RecipeData
  materials: GiftData[]
  pseudoIngredients: string[]
  result: GiftData | null
  canCraft: boolean  // 인벤토리에 재료가 있는지
}

export function parseFinalGiftId(inventoryId: string): number | null {
  if (!inventoryId.startsWith('final_')) return null
  const rawId = inventoryId
    .replace('final_', '')
    .replace('_plusplus', '')
    .replace('_plus', '')
  const parsed = parseInt(rawId, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export function parseFinalGiftIds(inventory: Iterable<string>): Set<number> {
  const ids = new Set<number>()
  for (const inventoryId of inventory) {
    const parsed = parseFinalGiftId(inventoryId)
    if (parsed !== null) ids.add(parsed)
  }
  return ids
}

export function getFinalGiftVariantIds(gameId: number): string[] {
  return [`final_${gameId}`, `final_${gameId}_plus`, `final_${gameId}_plusplus`]
}

/** 달의 기억 is fused from any of its fragments, which the run keeps: its ingredients never leave the final set. */
export const KEPT_INGREDIENTS_RESULT = '달의 기억'

/**
 * Gifts consumed by fusing the selected fixed-recipe results: every ingredient of every recipe variant, through nested
 * recipes. 달의 기억's ingredients are kept.
 */
export function deriveBlockedFinalFusionMaterialIds({
  selectedFinalGiftIds,
  recipes,
  giftMap,
  gifts,
}: {
  selectedFinalGiftIds: Iterable<number>
  recipes: RecipeData[]
  giftMap: Map<number, GiftData>
  gifts?: GiftData[]
}): Set<number> {
  const idByName = new Map([...(gifts ?? giftMap.values())].map(gift => [gift.name, gift.game_id]))
  const recipesByResult = new Map<string, RecipeData[]>()
  for (const recipe of recipes) {
    const result = recipe.final_result ?? recipe.result_name
    if (result !== KEPT_INGREDIENTS_RESULT) recipesByResult.set(result, [...(recipesByResult.get(result) ?? []), recipe])
  }
  const blocked = new Set<number>()
  const visit = (name: string, root: string, seen: Set<string>) => {
    if (seen.has(name)) return
    seen.add(name)
    for (const recipe of recipesByResult.get(name) ?? []) {
      for (const ingredient of recipe.ingredients) {
        const id = idByName.get(ingredient)
        if (id !== undefined && ingredient !== root) blocked.add(id)
        visit(ingredient, root, seen)
      }
    }
  }
  for (const id of selectedFinalGiftIds) {
    const name = giftMap.get(id)?.name
    if (name) visit(name, name, new Set())
  }
  return blocked
}

/**
 * 정방향: 인벤토리에서 조합 가능한 레시피 찾기
 */
export function findAvailableFusions(
  inventory: string[],
  recipes: RecipeData[],
  giftMap: Map<number, GiftData>,
): FusionResult[] {
  const invSet = new Set(inventory)
  const nameMap = new Map<string, GiftData>()
  for (const g of giftMap.values()) nameMap.set(g.name, g)

  return recipes
    .map(recipe => {
      const materials = recipe.ingredients.map(name => nameMap.get(name)).filter(Boolean) as GiftData[]
      const pseudoIngredients = recipe.ingredients.filter(name => !nameMap.has(name))
      const result = nameMap.get(recipe.result_name) ?? null
      const canCraft = recipe.ingredients.every(name => {
        if (!nameMap.has(name)) return true  // pseudo-ingredient, skip
        const gift = nameMap.get(name)!
        return invSet.has(String(gift.game_id))
      })

      return { recipe, materials, pseudoIngredients, result, canCraft }
    })
    .sort((a, b) => {
      if (a.canCraft !== b.canCraft) return a.canCraft ? -1 : 1
      return 0
    })
}

/**
 * 역방향: 특정 기프트를 만들 수 있는 레시피 찾기
 */
export function findRecipesFor(
  targetName: string,
  recipes: RecipeData[],
  giftMap: Map<number, GiftData>,
): FusionResult[] {
  const nameMap = new Map<string, GiftData>()
  for (const g of giftMap.values()) nameMap.set(g.name, g)

  return recipes
    .filter(r => r.result_name === targetName)
    .map(recipe => {
      const materials = recipe.ingredients.map(name => nameMap.get(name)).filter(Boolean) as GiftData[]
      const pseudoIngredients = recipe.ingredients.filter(name => !nameMap.has(name))
      const result = nameMap.get(targetName) ?? null
      return { recipe, materials, pseudoIngredients, result, canCraft: false }
    })
}

/**
 * 기프트 목록 → game_id 기반 Map 생성
 */
export function buildGiftMap(gifts: GiftData[]): Map<number, GiftData> {
  const map = new Map<number, GiftData>()
  for (const g of gifts) map.set(g.game_id, g)
  return map
}

// 거울 던전 관련 전투 키워드만 (소속/기타 키워드 제외)
const COMBAT_KEYWORDS = new Set([
  '출혈', '화상', '진동', '파열', '침잠', '호흡', '충전',
  '참격', '관통', '타격', '공통',
])

/**
 * 키워드 분포 계산 (전투 키워드만 필터링)
 */
export function computeKeywordDistribution(
  keywords: string[][],
): { keyword: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const kws of keywords) {
    // 인격당 정규화 후 유니크 (중복 카운트 방지)
    const normalized = new Set(kws.map(normalizeThemeKeyword))
    for (const kw of normalized) {
      if (!COMBAT_KEYWORDS.has(kw)) continue
      counts.set(kw, (counts.get(kw) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * 층 번호에 해당하는 floor_info 키 + 오프셋 결정
 * 익스트림(15층): 1-5 노말/하드, 6-10 평행중첩, 11-15 익스트림
 * 평행중첩(10층): 1-5 노말/하드, 6-10 평행중첩
 * 하드(5층): 1-5 노말/하드
 * 노말(5층): 1-5 노말
 */
function getFloorKeys(difficultyKey: string, floor: number): Array<{ key: string; offset: number }> {
  if (difficultyKey === '익스트림' || difficultyKey === '평행중첩') {
    if (floor <= 5) return [{ key: '노말', offset: 0 }, { key: '하드', offset: 0 }]
    if (floor <= 10) return [{ key: '평행중첩', offset: 5 }]
    return [{ key: '익스트림', offset: 10 }]
  }
  if (difficultyKey === '하드') {
    return [{ key: '노말', offset: 0 }, { key: '하드', offset: 0 }]
  }
  return [{ key: difficultyKey, offset: 0 }]
}

/**
 * 테마팩 필터링: 해당 난이도 + 층에 출현 가능한 테마팩
 * 층 범위에 따라 올바른 floor_info 키를 자동 결정
 */
export function getAvailableThemes<T extends { floor_info: Record<string, number[] | string> | null }>(
  themes: T[],
  difficultyKey: string,
  floor: number,
): T[] {
  const keys = getFloorKeys(difficultyKey, floor)

  return themes.filter(t => {
    if (!t.floor_info) return false
    return keys.some(({ key, offset }) => {
      const floors = t.floor_info![key]
      if (!floors) return false
      if (floors === '전체') return true
      const localFloor = floor - offset
      return Array.isArray(floors) && floors.includes(localFloor)
    })
  })
}

/**
 * 선택한 테마팩들의 기프트 합산
 */
/**
 * Gift ids counted as owned: the inventory plus every ingredient of an owned fixed-recipe result, through nested recipes.
 * Fusing a recipe removes its ingredients, and getting one again only turns it into an afterimage (잔영), so they are no
 * longer sought. Mixed fusions such as 달의 기억 (any two and three of two groups) are not recipes here and imply nothing.
 */
export function recipeOwnedGiftIds(inventory: readonly string[], recipes: readonly RecipeData[], giftMap: Map<number, GiftData>): Set<number> {
  const idByName = new Map([...giftMap.values()].map(gift => [gift.name, gift.game_id]))
  const owned = new Set(inventory.map(id => parseInt(id, 10)).filter(Number.isInteger))
  const queue = [...owned]
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const name = giftMap.get(id)?.name
    for (const recipe of recipes) {
      if (!name || (recipe.final_result ?? recipe.result_name) !== name) continue
      for (const ingredient of recipe.ingredients) {
        const ingredientId = idByName.get(ingredient)
        if (ingredientId !== undefined && !owned.has(ingredientId)) { owned.add(ingredientId); queue.push(ingredientId) }
      }
    }
  }
  return owned
}

const giftIdsByName = (giftMap: Map<number, GiftData>) => new Map([...giftMap.values()].map(gift => [gift.name, gift.game_id]))

/**
 * Inventory keys a fixed-recipe result consumes: the first recipe variant whose ingredients are all held, or null when the
 * gift has no fixed recipe or none is complete. Recipe results are obtainable only by fusing their ingredients.
 */
export function recipeIngredientsInInventory(resultId: number, inventory: readonly string[], recipes: readonly RecipeData[],
  giftMap: Map<number, GiftData>): string[] | null {
  const name = giftMap.get(resultId)?.name
  if (!name) return null
  const idByName = giftIdsByName(giftMap)
  for (const recipe of recipes) {
    if ((recipe.final_result ?? recipe.result_name) !== name) continue
    const remaining = [...inventory]
    const keys: string[] = []
    for (const ingredient of recipe.ingredients) {
      const index = remaining.findIndex(key => parseInt(key, 10) === idByName.get(ingredient))
      if (index < 0) break
      keys.push(...remaining.splice(index, 1))
    }
    if (keys.length === recipe.ingredients.length) return keys
  }
  return null
}

/** Evidence of one result popup, split by strength, plus the materials read on the fusion that preceded it. */
export interface RecipePopupEvidence {
  /** Gifts whose exact name was read on the popup's plate. */
  named: readonly string[]
  /** Everything else it points at: look-alike icons, near names, effect owners. */
  others: readonly string[]
  /** Material gift ids read on the confirmation dialog or wheel so far (may be partial or look-alike). */
  materials?: readonly string[]
}

/**
 * A result popup whose own evidence (name, icon, effect text) disagrees or is too weak: a fixed-recipe result is only
 * obtainable by fusing its ingredients, so it must be craftable from the inventory. Such results share art with their
 * ingredients and siblings (회중시계 types, 탁마), so the choice narrows step by step until one is left: craftable results
 * whose exact name was read; any craftable candidate; on the fusion screen, craftable recipes using a held candidate
 * ingredient; then the recipes containing the most materials read on the fusion. Anything else stays unresolved.
 */
export function resolveRecipeResult(evidence: RecipePopupEvidence, inventory: readonly string[], recipes: readonly RecipeData[],
  giftMap: Map<number, GiftData>, inFusion: boolean): string | null {
  const held = new Set(inventory.map(key => parseInt(key, 10)))
  const idByName = giftIdsByName(giftMap)
  const craftable = (id: number | undefined): id is number => id !== undefined && !held.has(id) &&
    recipeIngredientsInInventory(id, inventory, recipes, giftMap) !== null
  const one = (ids: Iterable<number>) => { const unique = [...new Set(ids)]; return unique.length === 1 ? String(unique[0]) : null }
  const named = evidence.named.map(Number).filter(craftable)
  if (named.length) return one(named)
  const candidates = [...evidence.named, ...evidence.others]
  let pool = [...new Set(candidates.map(Number).filter(craftable))]
  if (!pool.length && inFusion) {
    pool = [...new Set(recipes.filter(recipe => recipe.ingredients.some(name => {
      const id = idByName.get(name)
      return id !== undefined && held.has(id) && candidates.includes(String(id))
    })).map(recipe => idByName.get(recipe.final_result ?? recipe.result_name)).filter(craftable))]
  }
  if (pool.length <= 1) return one(pool)
  // Several siblings are craftable: keep those whose recipe holds the most materials read on the fusion.
  const materials = (evidence.materials ?? []).map(Number)
  const score = (id: number) => Math.max(0, ...recipes.filter(recipe => idByName.get(recipe.final_result ?? recipe.result_name) === id)
    .map(recipe => materials.filter(material => recipe.ingredients.some(name => idByName.get(name) === material)).length))
  const best = Math.max(...pool.map(score))
  return best > 0 ? one(pool.filter(id => score(id) === best)) : null
}

/**
 * The result of a fusion whose materials are exactly one fixed recipe's ingredients: such a fusion always makes that
 * recipe's result. Null unless exactly one recipe matches and its result can be made from the inventory.
 */
export function recipeFromMaterials(materials: readonly string[], inventory: readonly string[], recipes: readonly RecipeData[],
  giftMap: Map<number, GiftData>): string | null {
  if (!materials.length) return null
  const idByName = giftIdsByName(giftMap)
  const held = new Set(inventory.map(key => parseInt(key, 10)))
  const read = materials.map(Number).sort((a, b) => a - b).join()
  const results = new Set(recipes.filter(recipe =>
    recipe.ingredients.map(name => idByName.get(name) ?? -1).sort((a, b) => a - b).join() === read)
    .map(recipe => idByName.get(recipe.final_result ?? recipe.result_name))
    .filter((id): id is number => id !== undefined && !held.has(id) && recipeIngredientsInInventory(id, inventory, recipes, giftMap) !== null))
  return results.size === 1 ? String([...results][0]) : null
}

/**
 * Final gift for an acquisition popup with its header read, given the recognizer's own verdict (null when it abstained).
 * A fixed recipe's ingredients always fuse into its result, and that result has no other source. So: materials that are
 * exactly a recipe decide it unless the plate named the verdict exactly; a recipe result the popup did not name and the
 * inventory cannot make (a look-alike icon or effect match) yields to a result that can be made, or is dropped off the
 * fusion screen; an abstained popup falls back to resolveRecipeResult. Named results stand, as their ingredients may
 * simply not have been recorded.
 */
export function settleResultPopup(evidence: RecipePopupEvidence, verdict: string | null, inventory: readonly string[],
  recipes: readonly RecipeData[], giftMap: Map<number, GiftData>, inFusion: boolean): string | null {
  const exact = recipeFromMaterials(evidence.materials ?? [], inventory, recipes, giftMap)
  if (exact && (verdict === null || !evidence.named.includes(verdict))) return exact
  if (verdict === null) return resolveRecipeResult(evidence, inventory, recipes, giftMap, inFusion)
  const id = Number(verdict)
  const recipeResult = recipes.some(recipe => (recipe.final_result ?? recipe.result_name) === giftMap.get(id)?.name)
  if (!recipeResult || evidence.named.includes(verdict) || recipeIngredientsInInventory(id, inventory, recipes, giftMap)) return verdict
  return resolveRecipeResult(evidence, inventory, recipes, giftMap, inFusion) ?? (inFusion ? verdict : null)
}

type ThemeGiftLists = { specific_ego_gift_ids?: number[] | null; fixed_reward_gift_ids?: number[] | null }

/** Gifts only this pack gives: its exclusive pool and its clear rewards. */
export function themeExclusiveGiftIds(theme: ThemeGiftLists | null | undefined): number[] {
  return [...(theme?.specific_ego_gift_ids ?? []), ...(theme?.fixed_reward_gift_ids ?? [])]
}

/** A floor's planned gift keys plus its pack's clear rewards, which a plan with that pack always obtains. */
export function withThemeRewards(giftIds: string[], theme: ThemeGiftLists | null | undefined): string[] {
  const rewards = (theme?.fixed_reward_gift_ids ?? []).filter(id => !giftIds.some(key => parseInt(key, 10) === id))
  return [...giftIds, ...rewards.map(String)]
}

export function getGiftsFromThemes(
  selectedThemeIds: (string | null)[],
  themes: { id: string; ego_gift_ids: number[] | null; specific_ego_gift_ids: number[] | null; fixed_reward_gift_ids?: number[] | null }[],
  giftMap: Map<number, GiftData>,
): GiftData[] {
  const giftIds = new Set<number>()
  const themeMap = new Map(themes.map(t => [t.id, t]))

  for (const tid of selectedThemeIds) {
    if (!tid) continue
    const theme = themeMap.get(tid)
    if (!theme) continue
    for (const gid of theme.ego_gift_ids ?? []) giftIds.add(gid)
    for (const gid of themeExclusiveGiftIds(theme)) giftIds.add(gid)
  }

  return Array.from(giftIds).map(id => giftMap.get(id)).filter(Boolean) as GiftData[]
}
