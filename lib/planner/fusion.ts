import { FINAL_FLOOR, type RecipeData, type GiftData } from '@/lib/planner/types'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'

/**
 * A recipe's ingredient gift ids in the order of `ingredients`: the stored game ids when the row has them (one per
 * ingredient), else looked up by name (undefined = no such gift). Names can collide or drift; ids cannot.
 */
export function recipeIngredientIds(recipe: RecipeData, idByName: ReadonlyMap<string, number>): (number | undefined)[] {
  const ids = recipe.ingredient_ids
  if (ids && ids.length === recipe.ingredients.length) return [...ids]
  return recipe.ingredients.map(name => idByName.get(name))
}

/** A recipe's result gift id: the stored result_id, else looked up by result_name. */
export function recipeResultId(recipe: RecipeData, idByName: ReadonlyMap<string, number>): number | undefined {
  return recipe.result_id ?? idByName.get(recipe.result_name)
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
  const recipesByResult = new Map<number, RecipeData[]>()
  for (const recipe of recipes) {
    const result = recipeResultId(recipe, idByName)
    if (result !== undefined && recipe.result_name !== KEPT_INGREDIENTS_RESULT) {
      recipesByResult.set(result, [...(recipesByResult.get(result) ?? []), recipe])
    }
  }
  const blocked = new Set<number>()
  const visit = (resultId: number, root: number, seen: Set<number>) => {
    if (seen.has(resultId)) return
    seen.add(resultId)
    for (const recipe of recipesByResult.get(resultId) ?? []) {
      for (const id of recipeIngredientIds(recipe, idByName)) {
        if (id === undefined) continue
        if (id !== root) blocked.add(id)
        visit(id, root, seen)
      }
    }
  }
  for (const id of selectedFinalGiftIds) {
    if (giftMap.has(id)) visit(id, id, new Set())
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
  const idByName = giftIdsByName(giftMap)

  return recipes
    .map(recipe => {
      const known = recipeIngredientIds(recipe, idByName).map(id => id === undefined ? undefined : giftMap.get(id))
      const materials = known.filter(Boolean) as GiftData[]
      const pseudoIngredients = recipe.ingredients.filter((_, index) => !known[index])
      const resultId = recipeResultId(recipe, idByName)
      const result = resultId === undefined ? null : giftMap.get(resultId) ?? null
      // a pseudo-ingredient (no such gift) never blocks
      const canCraft = materials.every(gift => invSet.has(String(gift.game_id)))

      return { recipe, materials, pseudoIngredients, result, canCraft }
    })
    .sort((a, b) => {
      if (a.canCraft !== b.canCraft) return a.canCraft ? -1 : 1
      return 0
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
/**
 * Combat keywords of a formation: how many identities carry each (once per identity). With `deployed` (one flag per
 * identity, true for SELECTED slots 1–DEPLOYED_SLOT_COUNT) each row also counts the deployed ones; sorted by count.
 */
export function computeKeywordDistribution(
  keywords: string[][],
  deployed?: readonly boolean[],
): { keyword: string; count: number; deployed?: number }[] {
  const counts = new Map<string, { count: number; deployed: number }>()
  keywords.forEach((kws, index) => {
    // 인격당 정규화 후 유니크 (중복 카운트 방지)
    const normalized = new Set(kws.map(normalizeThemeKeyword))
    for (const kw of normalized) {
      if (!COMBAT_KEYWORDS.has(kw)) continue
      const row = counts.get(kw) ?? { count: 0, deployed: 0 }
      row.count++
      if (deployed?.[index]) row.deployed++
      counts.set(kw, row)
    }
  })
  return Array.from(counts.entries())
    .map(([keyword, row]) => (deployed ? { keyword, count: row.count, deployed: row.deployed } : { keyword, count: row.count }))
    .sort((a, b) => b.count - a.count || (b.deployed ?? 0) - (a.deployed ?? 0))
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
    // Floors 1-5 of an overlap or extreme run are hard floors.
    if (floor <= 5) return [{ key: '하드', offset: 0 }]
    if (floor <= 10) return [{ key: '평행중첩', offset: 5 }]
    return [{ key: '익스트림', offset: 10 }]
  }
  // A floor is normal or hard on its own (FloorEntry.difficulty), and every pack on a normal floor list also has a
  // hard list, so each reads only its own list: 기어오는 심연 is normal 4-5 but hard 3-4.
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
  const idByName = giftIdsByName(giftMap)
  const owned = new Set(inventory.map(id => parseInt(id, 10)).filter(Number.isInteger))
  const queue = [...owned]
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (!giftMap.has(id)) continue
    for (const recipe of recipes) {
      if (recipeResultId(recipe, idByName) !== id) continue
      for (const ingredientId of recipeIngredientIds(recipe, idByName)) {
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
 * Variants that contain every material read on the fusion's dialog (`read`) are tried first: two variants of one result
 * (피안개: 3 or 4 ingredients) can both be held.
 */
export function recipeIngredientsInInventory(resultId: number, inventory: readonly string[], recipes: readonly RecipeData[],
  giftMap: Map<number, GiftData>, read: readonly string[] = []): string[] | null {
  if (!giftMap.has(resultId)) return null
  const idByName = giftIdsByName(giftMap)
  const variants = recipes.filter(recipe => recipeResultId(recipe, idByName) === resultId)
  const hasRead = (recipe: RecipeData) => read.every(id => recipeIngredientIds(recipe, idByName).includes(parseInt(id, 10)))
  for (const recipe of [...variants.filter(hasRead), ...variants.filter(recipe => !hasRead(recipe))]) {
    const keys = heldIngredientKeys(recipe, inventory, idByName)
    if (keys) return keys
  }
  return mixedFusionKeys(resultId, inventory, read)
}

/** Inventory keys holding one recipe's ingredients (a key per ingredient), or null when one is not held. */
function heldIngredientKeys(recipe: RecipeData, inventory: readonly string[], idByName: Map<string, number>): string[] | null {
  const remaining = [...inventory]
  const keys: string[] = []
  for (const ingredientId of recipeIngredientIds(recipe, idByName)) {
    const index = remaining.findIndex(key => parseInt(key, 10) === ingredientId)
    if (index < 0) return null
    keys.push(...remaining.splice(index, 1))
  }
  return keys
}

/**
 * Mixed fusions (egoGiftCombineFixedTable.combineMixed, mirror-dungeon-common-data md8): `aNeed` gifts out of group A and
 * `bNeed` out of group B make the result, whichever ones. There is one: 달의 기억 (9083) from 2 of the 7 first-tier
 * fragments (9105...9136) and 3 of the 3 second-tier ones (9142, 9147, 9152). Not in ego_gift_recipes.
 */
export interface MixedRecipe { aIds: readonly number[]; aNeed: number; bIds: readonly number[]; bNeed: number; resultId: number }
export const MIXED_RECIPES: readonly MixedRecipe[] = [
  { aIds: [9105, 9110, 9116, 9121, 9126, 9131, 9136], aNeed: 2, bIds: [9142, 9147, 9152], bNeed: 3, resultId: 9083 },
]

/** The mixed recipe whose group A and B hold exactly these materials (distinct gift ids), or null. */
export function mixedResultFromMaterials(materials: readonly string[], mixed: readonly MixedRecipe[] = MIXED_RECIPES): number | null {
  const ids = materials.map(Number)
  if (new Set(ids).size !== ids.length) return null
  return mixed.find(recipe => ids.length === recipe.aNeed + recipe.bNeed &&
    ids.filter(id => recipe.aIds.includes(id)).length === recipe.aNeed && ids.filter(id => recipe.bIds.includes(id)).length === recipe.bNeed)?.resultId ?? null
}

/** Inventory keys a mixed fusion of `resultId` would consume (materials read first), or null when the groups cannot be filled. */
export function mixedFusionKeys(resultId: number, inventory: readonly string[], read: readonly string[] = [],
  mixed: readonly MixedRecipe[] = MIXED_RECIPES): string[] | null {
  const recipe = mixed.find(item => item.resultId === resultId)
  if (!recipe) return null
  const remaining = [...inventory]
  const wanted = new Set(read.map(Number))
  const pick = (ids: readonly number[], need: number): string[] | null => {
    const picked: string[] = []
    for (const id of [...ids].sort((a, b) => Number(wanted.has(b)) - Number(wanted.has(a)))) {
      if (picked.length === need) break
      const index = remaining.findIndex(key => parseInt(key, 10) === id)
      if (index >= 0) picked.push(...remaining.splice(index, 1))
    }
    return picked.length === need ? picked : null
  }
  const a = pick(recipe.aIds, recipe.aNeed)
  const b = a && pick(recipe.bIds, recipe.bNeed)
  return a && b ? [...a, ...b] : null
}

/**
 * Random fusion tiers (egoGiftCombineTierTable, md8): each material scores by its tier and the sum maps to the result
 * tier. combineTwo/combineThree are this same table (checked for all 16 rows). Starlight-enhanced fusions use lower bounds.
 */
const COMBINE_SCORE_BY_TIER: Record<number, number> = { 1: 3, 2: 6, 3: 10, 4: 15, 5: 30 }
const COMBINE_TIER_BY_SCORE = [[6, 1], [11, 2], [17, 3], [25, 4]] as const
const ENHANCED_COMBINE_TIER_BY_SCORE = [[6, 1], [10, 2], [15, 3], [22, 4]] as const

/** Result tier of a random fusion of materials of these tiers, or null (fewer than two, a tier without a score, too low a sum). */
export function randomFusionTier(materialTiers: readonly number[], enhanced = false): number | null {
  if (materialTiers.length < 2 || materialTiers.some(tier => COMBINE_SCORE_BY_TIER[tier] === undefined)) return null
  const score = materialTiers.reduce((sum, tier) => sum + COMBINE_SCORE_BY_TIER[tier], 0)
  const table = enhanced ? ENHANCED_COMBINE_TIER_BY_SCORE : COMBINE_TIER_BY_SCORE
  return [...table].reverse().find(([min]) => score >= min)?.[1] ?? null
}

/** A gift's tier from its grade (1-5; EX is tier 5 with the extra tag), or null when unknown. */
export function giftTier(gift: Pick<GiftData, 'grade'> | undefined): number | null {
  const grade = gift?.grade === 'EX' ? 5 : Number(gift?.grade)
  return Number.isInteger(grade) && grade >= 1 && grade <= 5 ? grade : null
}

/**
 * Tiers a random fusion of the materials read can give (plain and starlight-enhanced), or null when this is not a clear
 * random fusion: the dialog's N/M count was not all read, a material is unknown, or the materials are a fixed or mixed recipe.
 */
function randomFusionTiers(evidence: RecipePopupEvidence, recipes: readonly RecipeData[], giftMap: Map<number, GiftData>): Set<number> | null {
  const materials = evidence.materials ?? []
  if (materials.length < 2 || evidence.materialCount !== materials.length) return null
  const tiers = materials.map(id => giftTier(giftMap.get(Number(id))))
  if (tiers.some(tier => tier === null)) return null
  const idByName = giftIdsByName(giftMap)
  const read = materials.map(Number).sort((a, b) => a - b).join()
  const isRecipe = recipes.some(recipe => recipeIngredientIds(recipe, idByName).map(id => id ?? -1).sort((a, b) => a - b).join() === read)
  if (isRecipe || mixedResultFromMaterials(materials) !== null) return null
  const result = [false, true].map(enhanced => randomFusionTier(tiers as number[], enhanced)).filter((tier): tier is number => tier !== null)
  return result.length ? new Set(result) : null
}

/**
 * All materials of a fixed-recipe fusion whose dialog was only partly read (icons not yet drawn when it closed): the one
 * recipe for `resultId` with `count` ingredients that contains every material read (vestiges aside) and is fully held.
 * Null unless exactly one recipe fits, so a random fusion or an ambiguous read keeps what was read.
 */
export function recipeFusionMaterials(read: readonly string[], count: number, resultId: string, inventory: readonly string[],
  recipes: readonly RecipeData[], giftMap: Map<number, GiftData>, excluded: ReadonlySet<string>): string[] | null {
  if (!giftMap.has(Number(resultId))) return null
  const idByName = giftIdsByName(giftMap)
  const fits = new Map<string, string[]>()
  for (const recipe of recipes) {
    if (recipeResultId(recipe, idByName) !== Number(resultId) || recipe.ingredients.length !== count) continue
    const left = recipeIngredientIds(recipe, idByName)
    const contains = read.filter(id => !excluded.has(id)).every(id => {
      const index = left.indexOf(parseInt(id, 10))
      return index >= 0 && left.splice(index, 1).length > 0
    })
    const keys = contains ? heldIngredientKeys(recipe, inventory, idByName) : null
    if (keys) fits.set(recipeIngredientIds(recipe, idByName).map(String).sort().join('|'), keys)
  }
  return fits.size === 1 ? [...fits.values()][0] : null
}

/** Evidence of one result popup, split by strength, plus the materials read on the fusion that preceded it. */
export interface RecipePopupEvidence {
  /** Gifts whose exact name was read on the popup's plate. */
  named: readonly string[]
  /** Everything else it points at: look-alike icons, near names, effect owners. */
  others: readonly string[]
  /** Material gift ids read on the confirmation dialog or wheel so far (may be partial or look-alike). */
  materials?: readonly string[]
  /** How many materials the dialog's "N/M" said were chosen; the tier check below runs only when all of them were read. */
  materialCount?: number
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
    pool = [...new Set(recipes.filter(recipe => recipeIngredientIds(recipe, idByName).some(id =>
      id !== undefined && held.has(id) && candidates.includes(String(id))))
      .map(recipe => recipeResultId(recipe, idByName)).filter(craftable))]
  }
  if (pool.length <= 1) return one(pool)
  // Several siblings are craftable: keep those whose recipe holds the most materials read on the fusion.
  const materials = (evidence.materials ?? []).map(Number)
  const score = (id: number) => Math.max(0, ...recipes.filter(recipe => recipeResultId(recipe, idByName) === id)
    .map(recipe => materials.filter(material => recipeIngredientIds(recipe, idByName).includes(material)).length))
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
    recipeIngredientIds(recipe, idByName).map(id => id ?? -1).sort((a, b) => a - b).join() === read)
    .map(recipe => recipeResultId(recipe, idByName))
    .filter((id): id is number => id !== undefined && !held.has(id) && recipeIngredientsInInventory(id, inventory, recipes, giftMap) !== null))
  if (results.size === 0) {
    const mixed = mixedResultFromMaterials(materials)
    if (mixed !== null && !held.has(mixed) && recipeIngredientsInInventory(mixed, inventory, recipes, giftMap) !== null) return String(mixed)
  }
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
export function settleResultPopup(evidence: RecipePopupEvidence, verdictRead: string | null, inventory: readonly string[],
  recipes: readonly RecipeData[], giftMap: Map<number, GiftData>, inFusion: boolean): string | null {
  let verdict = verdictRead
  const exact = recipeFromMaterials(evidence.materials ?? [], inventory, recipes, giftMap)
  if (exact && (verdict === null || !evidence.named.includes(verdict))) return exact
  // A random fusion's result tier follows from its materials: an icon or effect look-alike of another tier is dropped
  // (a name read exactly stands, as the materials may be look-alikes).
  const tiers = verdict === null || evidence.named.includes(verdict) ? null : randomFusionTiers(evidence, recipes, giftMap)
  const verdictTier = verdict === null ? null : giftTier(giftMap.get(Number(verdict)))
  if (tiers && verdictTier !== null && !tiers.has(verdictTier)) verdict = null
  if (verdict === null) return resolveRecipeResult(evidence, inventory, recipes, giftMap, inFusion)
  const id = Number(verdict)
  const idByName = giftIdsByName(giftMap)
  const recipeResult = giftMap.has(id) && recipes.some(recipe => recipeResultId(recipe, idByName) === id)
  if (!recipeResult || evidence.named.includes(verdict) || recipeIngredientsInInventory(id, inventory, recipes, giftMap)) return verdict
  return resolveRecipeResult(evidence, inventory, recipes, giftMap, inFusion) ?? (inFusion ? verdict : null)
}

type ThemeGiftLists = { ego_gift_ids?: number[] | null; specific_ego_gift_ids?: number[] | null; fixed_reward_gift_ids?: number[] | null }

/**
 * Gifts only this pack gives: its exclusive pool and the clear rewards outside its regular pool. A reward in the regular
 * pool is shared with other packs: 뽕.황 (3001) also rewards 믿음, 인연 조각 and 달의 기억 (9081~9083), which 89 other
 * packs offer, while the extreme packs' rewards (9250~9255, 9827~9830) exist nowhere else.
 */
export function themeExclusiveGiftIds(theme: ThemeGiftLists | null | undefined): number[] {
  const regular = new Set(theme?.ego_gift_ids ?? [])
  return [...new Set([...(theme?.specific_ego_gift_ids ?? []), ...(theme?.fixed_reward_gift_ids ?? []).filter(id => !regular.has(id))])]
}

/** A floor's planned gift keys plus its pack's clear rewards, which a plan with that pack always obtains. The last floor has none. */
export function withThemeRewards(giftIds: string[], theme: ThemeGiftLists | null | undefined, floor: number | undefined): string[] {
  if (floor === FINAL_FLOOR) return giftIds
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
