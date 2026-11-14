// 거울 던전 어시스트 모드 상태 타입. 상태를 만드는 run-normalize.ts와 상태를 바꾸는 run-types.ts가 같이 읽는다.

import type { Difficulty, IdentitySlot, EgoSlot, PlannerState, SkillDistribution } from '@/lib/planner/types'
type RunPhase = 'setup' | 'playing' | 'completed'
type FloorSubTab = 'deck' | 'theme' | 'event' | 'gift'

export interface DeckChange {
  type: 'swap_identity' | 'swap_ego' | 'rearrange_skill'
  sinnerId: string
  detail: string
}

export interface FloorLog {
  floor: number
  difficulty: Difficulty
  themeId: string | null
  acquiredGifts: string[]
  removedGifts: string[]
  deckChanges: DeckChange[]
  selectedEventOptions: { eventId: number; optionIndex: number; rewardGiftIds?: string[]; uncertainRewardGiftIds?: string[] }[]
  memo: string
  completedAt: string | null
  /** The pack card's CLEAR BONUS as read on the selection screen: beating the floor's boss offers these (game_id strings). */
  clearBonus?: string[]
}

export interface RunState {
  phase: RunPhase
  sourcePlanSnapshot?: Partial<PlannerState> | null
  difficulty: Difficulty
  startFloor: number
  maxFloors: number
  currentFloor: number
  activeSubTab: FloorSubTab

  identitySlots: IdentitySlot[]
  egoSlots: EgoSlot[]
  skillArrangements: Record<string, string[]>

  floorLogs: FloorLog[]
  giftInventory: string[]

  sourcePlanEncoded: string | null
  targetGifts: string[]  // 플래너에서 선정한 목표 기프트 game_id (final_ prefix 파싱)
}

export type RunAction =
  | { type: 'INIT'; difficulty: Difficulty; startFloor?: number }
  | { type: 'START_RUN' }
  | { type: 'LOAD_FROM_PLAN'; planState: Partial<PlannerState>; startFloor?: number }

  /** null clears the current floor's pack; the floor, inventory and logs stay as they are. */
  | { type: 'SET_FLOOR_THEME'; themeId: string | null }
  | { type: 'OBSERVE_FLOOR_THEME'; floor: number; themeId: string; completedAt: string }
  | { type: 'SET_FLOOR_CLEAR_BONUS'; floor: number; giftIds: string[] }
  | { type: 'NEXT_FLOOR' }
  | { type: 'GO_TO_FLOOR'; floor: number }
  | { type: 'COMPLETE_RUN' }
  | { type: 'SET_SUB_TAB'; tab: FloorSubTab }

  | { type: 'SWAP_IDENTITY'; sinnerId: string; newSlot: IdentitySlot }
  | { type: 'REMOVE_IDENTITY'; sinnerId: string }
  | { type: 'SWAP_EGO'; sinnerId: string; newEgo: EgoSlot }
  | { type: 'REMOVE_EGO'; egoId: string }
  | { type: 'REARRANGE_SKILLS'; identityId: string; skillOrder: string[] }
  | { type: 'SET_SKILL_DISTRIBUTION'; sinnerId: string; distribution: SkillDistribution }

  // floor: omitted = current floor; null = inventory only, when the floor it was gained on is not known.
  | { type: 'ACQUIRE_GIFT'; giftId: string; floor?: number | null }
  | { type: 'REMOVE_GIFT'; giftId: string }
  /** `resultId` null: the result is not recorded (a vestige); the materials still leave. */
  | { type: 'CRAFT_FUSION'; materialIds: string[]; resultId: string | null }

  | { type: 'SELECT_EVENT_OPTION'; eventId: number; optionIndex: number; rewardGiftIds?: string[] }

  | { type: 'SET_FLOOR_MEMO'; memo: string }
  | { type: 'ADD_TARGET_GIFT'; giftId: string }
  | { type: 'REMOVE_TARGET_GIFT'; giftId: string }
  | { type: 'LOAD_RUN'; state: RunState }
  | { type: 'RESET' }
