// 거울 던전 플래너 상태 타입

export type Difficulty = 'normal' | 'hard' | 'overlap' | 'extreme'
export type PlannerTab = 'deck' | 'blessing' | 'gift' | 'floor' | 'summary'

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
  const floors = DIFFICULTY_CONFIG[difficulty].floors
  return {
    difficulty,
    title: '',
    description: '',
    identitySlots: [],
    egoSlots: [],
    floorPlan: Array.from({ length: floors }, (_, i) => ({ floor: i + 1, theme_id: null, gift_ids: [], memo: '' })),
    giftInventory: [],
    activeTab: 'deck',
  }
}

export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case 'SET_DIFFICULTY': {
      const floors = DIFFICULTY_CONFIG[action.difficulty].floors
      return {
        ...state,
        difficulty: action.difficulty,
        floorPlan: Array.from({ length: floors }, (_, i) => ({
          floor: i + 1,
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
      return { ...state, ...action.state }
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
  dungeon_id: string | null
  ego_gift_ids: number[] | null
  specific_ego_gift_ids: number[] | null
  image_url: string | null
  boss_image_url: string | null
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
  keyword: string | null
  grade: string | null
  image_url: string | null
  effect_base: string | null
  effect_plus: string | null
  effect_plusplus: string | null
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
  rarity: number
  keywords: string[] | null
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
  grade: string
  sin_affinity: string | null
  image_url: string | null
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
  identity_id: string
  passive_type: string  // 'battle' | 'support'
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null  // 'resonance' | 'stock' | null
  description: string | null
  uptie_level: number | null
}
