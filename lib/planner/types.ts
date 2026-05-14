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
  | { type: 'SET_TAB'; tab: PlannerTab }
  | { type: 'ADD_IDENTITY'; slot: IdentitySlot }
  | { type: 'REMOVE_IDENTITY'; sinnerId: string }
  | { type: 'SET_FLOOR_DIFFICULTY'; floor: number; difficulty: FloorDifficulty; clearSelection?: boolean }
  | { type: 'SET_FLOOR_THEME'; floor: number; themeId: string | null }
  | { type: 'SET_FLOOR_GIFTS'; floor: number; giftIds: string[] }
  | { type: 'SET_FLOOR_MEMO'; floor: number; memo: string }
  | { type: 'ADD_GIFT'; giftId: string }
  | { type: 'REMOVE_GIFT'; giftId: string }
  | { type: 'REPLACE_GIFT'; oldId: string; newId: string }
  | { type: 'ADD_EGO'; slot: EgoSlot }
  | { type: 'REMOVE_EGO'; egoId: string }
  | { type: 'LOAD_PLAN'; state: Partial<PlannerState> }
  | { type: 'RESET' }

export function createInitialState(difficulty: Difficulty = 'hard'): PlannerState {
  const floors = Math.max(DIFFICULTY_CONFIG[difficulty].floors, 15)
  const normalizedDifficulty = normalizePlanDifficulty(difficulty)
  return {
    difficulty,
    title: '',
    description: '',
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

function normalizeFloorEntry(entry: Partial<FloorEntry> | undefined, index: number, planDifficulty: Difficulty): FloorEntry {
  const floor = typeof entry?.floor === 'number' && Number.isFinite(entry.floor) ? Math.floor(entry.floor) : index + 1
  const difficulty = isFloorDifficulty(entry?.difficulty) && isAllowedFloorDifficulty(entry.difficulty, floor)
    ? entry.difficulty
    : getLegacyPlanFloorDifficulty(planDifficulty, floor)

  return {
    floor,
    difficulty,
    theme_id: typeof entry?.theme_id === 'string' ? entry.theme_id : null,
    gift_ids: Array.isArray(entry?.gift_ids) ? entry.gift_ids : [],
    memo: typeof entry?.memo === 'string' ? entry.memo : '',
  }
}

function normalizeFloorPlanEntries(
  floorPlan: Partial<FloorEntry>[] | undefined,
  planDifficulty: Difficulty,
  minFloors = Math.max(DIFFICULTY_CONFIG[planDifficulty].floors, 15),
): FloorEntry[] {
  const source = Array.isArray(floorPlan) ? floorPlan : []
  const floorCount = Math.max(source.length, minFloors)
  return Array.from({ length: floorCount }, (_, i) => normalizeFloorEntry(source[i], i, planDifficulty))
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
    case 'SET_TAB':
      return { ...state, activeTab: action.tab }
    case 'ADD_IDENTITY': {
      const filtered = state.identitySlots.filter(s => s.sinner_id !== action.slot.sinner_id)
      return { ...state, identitySlots: [...filtered, action.slot] }
    }
    case 'REMOVE_IDENTITY':
      return { ...state, identitySlots: state.identitySlots.filter(s => s.sinner_id !== action.sinnerId) }
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
  game_id: string | null
  folder_name: string | null
}

export interface SinnerData {
  id: string
  name_kr: string
  order_num: number
}

export interface EgoData {
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
