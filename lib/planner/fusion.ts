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
  result: GiftData | null
  canCraft: boolean  // 인벤토리에 재료가 있는지
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
      const result = nameMap.get(recipe.result_name) ?? null
      const canCraft = recipe.ingredients.every(name => {
        const gift = nameMap.get(name)
        return gift && invSet.has(String(gift.game_id))
      })

      return { recipe, materials, result, canCraft }
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
      const result = nameMap.get(targetName) ?? null
      return { recipe, materials, result, canCraft: false }
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
export function getGiftsFromThemes(
  selectedThemeIds: (string | null)[],
  themes: { id: string; ego_gift_ids: number[] | null; specific_ego_gift_ids: number[] | null }[],
  giftMap: Map<number, GiftData>,
): GiftData[] {
  const giftIds = new Set<number>()
  const themeMap = new Map(themes.map(t => [t.id, t]))

  for (const tid of selectedThemeIds) {
    if (!tid) continue
    const theme = themeMap.get(tid)
    if (!theme) continue
    for (const gid of theme.ego_gift_ids ?? []) giftIds.add(gid)
    for (const gid of theme.specific_ego_gift_ids ?? []) giftIds.add(gid)
  }

  return Array.from(giftIds).map(id => giftMap.get(id)).filter(Boolean) as GiftData[]
}
