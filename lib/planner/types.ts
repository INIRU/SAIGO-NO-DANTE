// 거울 던전 플래너 상태 타입

export type Difficulty = 'normal' | 'hard' | 'overlap' | 'extreme'
export type PlannerTab = 'deck' | 'blessing' | 'floor' | 'fusion' | 'summary'

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
}

export interface FloorEntry {
  floor: number
  theme_id: string | null
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
  | { type: 'ADD_GIFT'; giftId: string }
  | { type: 'REMOVE_GIFT'; giftId: string }
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
    floorPlan: Array.from({ length: floors }, (_, i) => ({ floor: i + 1, theme_id: null })),
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
          f.floor === action.floor ? { ...f, theme_id: action.themeId } : f
        ),
      }
    case 'ADD_GIFT':
      return { ...state, giftInventory: [...state.giftInventory, action.giftId] }
    case 'REMOVE_GIFT':
      return { ...state, giftInventory: state.giftInventory.filter(id => id !== action.giftId) }
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

export interface GiftData {
  id: string
  game_id: number
  name: string
  keyword: string | null
  grade: string | null
  image_url: string | null
  effect_base: string | null
  theme_ids: number[] | null
}

export interface RecipeData {
  id: number
  material_1: number | null
  material_2: number | null
  material_3: number | null
  result: number | null
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
