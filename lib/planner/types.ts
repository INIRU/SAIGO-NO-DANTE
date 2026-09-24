import { normalizeConstraints } from './constraints'
// 거울 던전 플래너 상태 타입
import {
  getLegacyPlanFloorDifficulty,
  isAllowedFloorDifficulty,
  isFloorDifficulty,
  normalizePlanDifficulty,
  type FloorDifficulty,
} from './floor-difficulty'

export type Difficulty = 'normal' | 'hard' | 'overlap' | 'extreme'
export type PlannerTab = 'deck' | 'blessing' | 'gift' | 'floor' | 'summary'
export type { FloorDifficulty }

export const DIFFICULTY_CONFIG = {
  normal:  { label: '노말', floors: 5 },
  hard:    { label: '하드', floors: 5 },
  overlap: { label: '평행중첩', floors: 10 },
  extreme: { label: '익스트림', floors: 15 },
} as const

export const DIFFICULTY_FLOOR_KEY: Record<Difficulty, string> = {
  normal: '노말',
  hard: '하드',
  overlap: '평행중첩',
  extreme: '익스트림',
}

export interface IdentitySlot {
  identity_id: string
  sinner_id: string
  name_kr: string
  rarity: number
  keywords: string[]
  skill_keyword_list?: string[] | null
  affiliation?: string | null
  association_list?: string[] | null
  s1_count?: number | null
  s2_count?: number | null
  s3_count?: number | null
  game_id: string | null
  folder_name: string | null
  slot_order: number
}

export interface EgoSlot {
  ego_id: string
  sinner_id: string
  name_kr: string
  grade: string
  sin_affinity?: string | null
}

export interface FloorEntry {
  constraints?: number[]
  floor: number
  difficulty: FloorDifficulty
  theme_id: string | null
  gift_ids: string[]  // 이 층에서 획득할 기프트 game_id
  memo: string        // 층별 플랜 메모 (마크다운 + chip)
}

export interface PlannerState {
  difficulty: Difficulty
  title: string
  description: string
  mainKeywords?: string[]
  mainKeywordsManual?: boolean
  identitySlots: IdentitySlot[]
  egoSlots: EgoSlot[]
  floorPlan: FloorEntry[]
  giftInventory: string[]  // gift game_id
  activeTab: PlannerTab
}

export type PlannerAction =
  | { type: 'SET_DIFFICULTY'; difficulty: Difficulty }
  | { type: 'SET_TITLE'; title: string }
  | { type: 'SET_DESCRIPTION'; description: string }
  | { type: 'SET_MAIN_KEYWORDS'; keywords: string[]; manual?: boolean }
  | { type: 'SET_TAB'; tab: PlannerTab }
  | { type: 'ADD_IDENTITY'; slot: IdentitySlot }
  | { type: 'REMOVE_IDENTITY'; sinnerId: string }
  | { type: 'SET_SKILL_DISTRIBUTION'; sinnerId: string; distribution: SkillDistribution }
  | { type: 'SET_FLOOR_DIFFICULTY'; floor: number; difficulty: FloorDifficulty; clearSelection?: boolean }
  | { type: 'SET_FLOOR_THEME'; floor: number; themeId: string | null }
  | { type: 'SET_FLOOR_GIFTS'; floor: number; giftIds: string[] }
  | { type: 'SET_FLOOR_CONSTRAINTS'; floor: number; ids: number[] }
  | { type: 'SET_FLOOR_MEMO'; floor: number; memo: string }
  | { type: 'ADD_GIFT'; giftId: string }
  | { type: 'REMOVE_GIFT'; giftId: string }
  | { type: 'REPLACE_GIFT'; oldId: string; newId: string }
  | { type: 'ADD_EGO'; slot: EgoSlot }
  | { type: 'REMOVE_EGO'; egoId: string }
  | { type: 'LOAD_PLAN'; state: Partial<PlannerState> }
  | { type: 'RESET' }

export type SkillDistribution = [number, number, number]
export const DEFAULT_SKILL_DISTRIBUTION: SkillDistribution = [3, 2, 1]

export function normalizeSkillDistribution(
  dist: readonly (number | null | undefined)[] = DEFAULT_SKILL_DISTRIBUTION,
): SkillDistribution {
  const next = [0, 0, 0] as SkillDistribution
  for (let index = 0; index < next.length; index++) {
    const value = dist[index]
    next[index] = Number.isFinite(value) ? Math.min(6, Math.max(0, Math.trunc(value as number))) : 0
  }

  let total = next[0] + next[1] + next[2]
  while (total < 6) {
    const receiver = next.reduce((best, value, idx) => (value < next[best] ? idx : best), 0)
    next[receiver] += 1
    total += 1
  }
  while (total > 6) {
    const donor = next.reduce((best, value, idx) => (value > next[best] ? idx : best), 0)
    if (next[donor] === 0) break
    next[donor] -= 1
    total -= 1
  }

  return next
}

export function getIdentitySkillDistribution(slot: Pick<IdentitySlot, 's1_count' | 's2_count' | 's3_count'>): SkillDistribution {
  if (![slot.s1_count, slot.s2_count, slot.s3_count].some(value => Number.isFinite(value))) {
    return DEFAULT_SKILL_DISTRIBUTION
  }
  return normalizeSkillDistribution([slot.s1_count, slot.s2_count, slot.s3_count])
}

function normalizeIdentitySlotSkillCounts<T extends IdentitySlot>(slot: T): T {
  const [s1_count, s2_count, s3_count] = getIdentitySkillDistribution(slot)
  return { ...slot, s1_count, s2_count, s3_count }
}

export function createInitialState(difficulty: Difficulty = 'hard'): PlannerState {
  const floors = Math.max(DIFFICULTY_CONFIG[difficulty].floors, 15)
  const normalizedDifficulty = normalizePlanDifficulty(difficulty)
  return {
    difficulty,
    title: '',
    description: '',
    mainKeywords: [],
    mainKeywordsManual: false,
    identitySlots: [],
    egoSlots: [],
    floorPlan: Array.from({ length: floors }, (_, i) => ({
      floor: i + 1,
      difficulty: getLegacyPlanFloorDifficulty(normalizedDifficulty, i + 1),
      theme_id: null,
      gift_ids: [],
      memo: '',
    })),
    giftInventory: [],
    activeTab: 'deck',
  }
}

export function normalizePlannerThemeId(themeId: unknown): string | null {
  if (typeof themeId === 'string') return themeId
  if (typeof themeId === 'number' && Number.isFinite(themeId)) return String(themeId)
  return null
}

function normalizeFloorGiftIds(giftIds: unknown): string[] {
  if (!Array.isArray(giftIds)) return []
  return giftIds
    .filter((giftId): giftId is string | number =>
      (typeof giftId === 'string' && giftId.length > 0) ||
      (typeof giftId === 'number' && Number.isFinite(giftId))
    )
    .map(giftId => String(giftId))
}

type LoadableFloorEntry = Partial<Omit<FloorEntry, 'theme_id' | 'gift_ids'>> & {
  theme_id?: unknown
  gift_ids?: unknown
}

function normalizeFloorEntry(entry: LoadableFloorEntry | undefined, index: number, planDifficulty: Difficulty): FloorEntry {
  const floor = typeof entry?.floor === 'number' && Number.isFinite(entry.floor) ? Math.floor(entry.floor) : index + 1
  const difficulty = isFloorDifficulty(entry?.difficulty) && isAllowedFloorDifficulty(entry.difficulty, floor)
    ? entry.difficulty
    : getLegacyPlanFloorDifficulty(planDifficulty, floor)

  return {
    floor,
    difficulty,
    theme_id: normalizePlannerThemeId(entry?.theme_id),
    gift_ids: normalizeFloorGiftIds(entry?.gift_ids),
    memo: typeof entry?.memo === 'string' ? entry.memo : '',
    constraints: Array.isArray(entry?.constraints) ? entry.constraints.filter(Number.isInteger) : [],
  }
}

function normalizeFloorPlanEntries(
  floorPlan: LoadableFloorEntry[] | undefined,
  planDifficulty: Difficulty,
  minFloors = Math.max(DIFFICULTY_CONFIG[planDifficulty].floors, 15),
): FloorEntry[] {
  const source = Array.isArray(floorPlan) ? floorPlan : []
  const floorCount = Math.max(source.length, minFloors)
  return normalizeConstraints(Array.from({ length: floorCount }, (_, i) => normalizeFloorEntry(source[i], i, planDifficulty)))
}

export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case 'SET_DIFFICULTY': {
      const floors = Math.max(DIFFICULTY_CONFIG[action.difficulty].floors, state.floorPlan.length, 15)
      const normalizedDifficulty = normalizePlanDifficulty(action.difficulty)
      return {
        ...state,
        difficulty: action.difficulty,
        floorPlan: Array.from({ length: floors }, (_, i) => ({
          floor: i + 1,
          difficulty: state.floorPlan[i]?.difficulty ?? getLegacyPlanFloorDifficulty(normalizedDifficulty, i + 1),
          theme_id: state.floorPlan[i]?.theme_id ?? null,
          gift_ids: state.floorPlan[i]?.gift_ids ?? [],
          memo: state.floorPlan[i]?.memo ?? '',
        })),
      }
    }
    case 'SET_TITLE':
      return { ...state, title: action.title }
    case 'SET_DESCRIPTION':
      return { ...state, description: action.description }
    case 'SET_MAIN_KEYWORDS':
      return {
        ...state,
        mainKeywords: action.keywords,
        mainKeywordsManual: action.manual ?? state.mainKeywordsManual ?? false,
      }
    case 'SET_TAB':
      return { ...state, activeTab: action.tab }
    case 'ADD_IDENTITY': {
      const filtered = state.identitySlots.filter(s => s.sinner_id !== action.slot.sinner_id)
      return { ...state, identitySlots: [...filtered, normalizeIdentitySlotSkillCounts(action.slot)] }
    }
    case 'REMOVE_IDENTITY':
      return { ...state, identitySlots: state.identitySlots.filter(s => s.sinner_id !== action.sinnerId) }
    case 'SET_SKILL_DISTRIBUTION': {
      const [s1_count, s2_count, s3_count] = normalizeSkillDistribution(action.distribution)
      return {
        ...state,
        identitySlots: state.identitySlots.map(slot =>
          slot.sinner_id === action.sinnerId
            ? { ...slot, s1_count, s2_count, s3_count }
            : slot
        ),
      }
    }
    case 'SET_FLOOR_DIFFICULTY':
      return {
        ...state,
        floorPlan: state.floorPlan.map(f =>
          f.floor === action.floor
            ? {
              ...f,
              difficulty: action.difficulty,
              theme_id: action.clearSelection ? null : f.theme_id,
              gift_ids: action.clearSelection ? [] : f.gift_ids,
            }
            : f
        ),
      }
    case 'SET_FLOOR_THEME':
      return {
        ...state,
        floorPlan: state.floorPlan.map(f =>
          f.floor === action.floor ? { ...f, theme_id: action.themeId, gift_ids: [], memo: f.memo } : f
        ),
      }
    case 'SET_FLOOR_GIFTS':
      return {
        ...state,
        floorPlan: state.floorPlan.map(f =>
          f.floor === action.floor ? { ...f, gift_ids: action.giftIds } : f
        ),
      }
    case 'SET_FLOOR_CONSTRAINTS': {
      const updated = state.floorPlan.map(f => f.floor === action.floor ? { ...f, constraints: action.ids } : f)
      const normalized = new Map(normalizeConstraints(updated).map(f => [f.floor, f.constraints]))
      return { ...state, floorPlan: updated.map(f => ({ ...f, constraints: normalized.get(f.floor) })) }
    }
    case 'SET_FLOOR_MEMO':
      return {
        ...state,
        floorPlan: state.floorPlan.map(f =>
          f.floor === action.floor ? { ...f, memo: action.memo } : f
        ),
      }
    case 'ADD_GIFT':
      return { ...state, giftInventory: [...state.giftInventory, action.giftId] }
    case 'REMOVE_GIFT':
      return { ...state, giftInventory: state.giftInventory.filter(id => id !== action.giftId) }
    case 'REPLACE_GIFT':
      return { ...state, giftInventory: state.giftInventory.map(id => id === action.oldId ? action.newId : id) }
    case 'ADD_EGO': {
      const filtered = state.egoSlots.filter(s => s.sinner_id !== action.slot.sinner_id || s.grade !== action.slot.grade)
      return { ...state, egoSlots: [...filtered, action.slot] }
    }
    case 'REMOVE_EGO':
      return { ...state, egoSlots: state.egoSlots.filter(s => s.ego_id !== action.egoId) }
    case 'LOAD_PLAN':
      return {
        ...state,
        ...action.state,
        identitySlots: Array.isArray(action.state.identitySlots)
          ? action.state.identitySlots.map(slot => normalizeIdentitySlotSkillCounts(slot))
          : state.identitySlots,
        floorPlan: normalizeFloorPlanEntries(
          action.state.floorPlan,
          action.state.difficulty ?? state.difficulty,
        ),
      }
    case 'RESET':
      return createInitialState(state.difficulty)
    default:
      return state
  }
}

// 서버에서 받는 데이터 타입
export interface ThemeData {
  id: string
  name: string
  name_en?: string | null
  name_jp?: string | null
  dungeon_id: string | null
  ego_gift_ids: number[] | null
  specific_ego_gift_ids: number[] | null
  /** Gifts the pack always gives when its boss is cleared (extreme packs). */
  fixed_reward_gift_ids?: number[] | null
  image_url: string | null
  difficulty: string | null
  floor_info: Record<string, number[] | string> | null
}

export interface GiftActivationCondition {
  type: 'keyword' | 'multi_keyword' | 'affiliation' | 'skill'
  keyword?: string
  keywords?: string[]
  affiliation?: string
  affiliations?: string[]
  count?: number
}

export interface GiftData {
  id: string
  game_id: number
  name: string
  name_en?: string | null
  name_jp?: string | null
  keyword: string | null
  grade: string | null
  image_url: string | null
  effect_base: string | null
  effect_base_en?: string | null
  effect_base_jp?: string | null
  effect_plus: string | null
  effect_plus_en?: string | null
  effect_plus_jp?: string | null
  effect_plusplus: string | null
  effect_plusplus_en?: string | null
  effect_plusplus_jp?: string | null
  theme_ids: number[] | null
  activation_condition: GiftActivationCondition | null
}

export interface RecipeData {
  id: string
  result_name: string
  keyword: string
  ingredients: string[]
  final_result: string | null
}

export interface IdentityData {
  id: string
  sinner_id: string
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
  rarity: number
  keywords: string[] | null
  skill_keyword_list?: string[] | null
  affiliation?: string | null
  association_list?: string[] | null
  game_id: string | null
  folder_name: string | null
}

export interface SinnerData {
  name_en?: string | null
  name_jp?: string | null
  id: string
  name_kr: string
  order_num: number
}

export interface EgoData {
  max_construe_level?: number
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  name_en?: string | null
  name_jp?: string | null
  grade: string
  sin_affinity: string | null
  image_url: string | null
  cost: number[] | null
}

export interface SkillSummary {
  identity_id: string
  name: string
  sin_affinity: string
  skill_type: string
  skill_order: number
  uptie_level: number | null
}

export interface PassiveData {
  id: string
  name: string
  name_en?: string | null
  name_jp?: string | null
  identity_id: string
  passive_type: string  // 'battle' | 'support'
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null  // 'resonance' | 'stock' | null
  description: string | null
  description_en?: string | null
  description_jp?: string | null
  uptie_level: number | null
}
