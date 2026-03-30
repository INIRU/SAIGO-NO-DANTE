// 거울 던전 트리거 모드 상태 타입
// Design Ref: §2 — RunState/RunAction 독립 상태 관리

import type { Difficulty, IdentitySlot, EgoSlot, PlannerState } from './types'
import { DIFFICULTY_CONFIG } from './types'

export type RunPhase = 'setup' | 'playing' | 'completed'
export type FloorSubTab = 'deck' | 'theme' | 'event' | 'gift'

export interface DeckChange {
  type: 'swap_identity' | 'swap_ego' | 'rearrange_skill'
  sinnerId: string
  detail: string
}

export interface FloorLog {
  floor: number
  themeId: string | null
  acquiredGifts: string[]
  removedGifts: string[]
  deckChanges: DeckChange[]
  selectedEventOptions: { eventId: number; optionIndex: number }[]
  memo: string
  completedAt: string | null
}

export interface RunState {
  phase: RunPhase
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

  | { type: 'SET_FLOOR_THEME'; themeId: string }
  | { type: 'NEXT_FLOOR' }
  | { type: 'GO_TO_FLOOR'; floor: number }
  | { type: 'COMPLETE_RUN' }
  | { type: 'SET_SUB_TAB'; tab: FloorSubTab }

  | { type: 'SWAP_IDENTITY'; sinnerId: string; newSlot: IdentitySlot }
  | { type: 'REMOVE_IDENTITY'; sinnerId: string }
  | { type: 'SWAP_EGO'; sinnerId: string; newEgo: EgoSlot }
  | { type: 'REMOVE_EGO'; egoId: string }
  | { type: 'REARRANGE_SKILLS'; identityId: string; skillOrder: string[] }

  | { type: 'ACQUIRE_GIFT'; giftId: string }
  | { type: 'REMOVE_GIFT'; giftId: string }
  | { type: 'CRAFT_FUSION'; materialIds: string[]; resultId: string }

  | { type: 'SELECT_EVENT_OPTION'; eventId: number; optionIndex: number; rewardGiftIds?: string[] }

  | { type: 'SET_FLOOR_MEMO'; memo: string }
  | { type: 'ADD_TARGET_GIFT'; giftId: string }
  | { type: 'REMOVE_TARGET_GIFT'; giftId: string }
  | { type: 'LOAD_RUN'; state: RunState }
  | { type: 'RESET' }

// ── 초기 상태 생성 ──────────────────────────────────────────────────────────

function createFloorLog(floor: number): FloorLog {
  return {
    floor,
    themeId: null,
    acquiredGifts: [],
    removedGifts: [],
    deckChanges: [],
    selectedEventOptions: [],
    memo: '',
    completedAt: null,
  }
}

export function createInitialRunState(difficulty: Difficulty = 'hard'): RunState {
  const maxFloors = DIFFICULTY_CONFIG[difficulty].floors
  return {
    phase: 'setup',
    difficulty,
    startFloor: 1,
    maxFloors,
    currentFloor: 1,
    activeSubTab: 'deck',
    identitySlots: [],
    egoSlots: [],
    skillArrangements: {},
    floorLogs: Array.from({ length: maxFloors }, (_, i) => createFloorLog(i + 1)),
    giftInventory: [],
    sourcePlanEncoded: null,
    targetGifts: [],
  }
}

// ── 현재 FloorLog 헬퍼 ──────────────────────────────────────────────────────

function getCurrentLog(state: RunState): FloorLog {
  return state.floorLogs[state.currentFloor - 1] ?? createFloorLog(state.currentFloor)
}

function updateCurrentLog(state: RunState, updater: (log: FloorLog) => FloorLog): FloorLog[] {
  return state.floorLogs.map((log, i) =>
    i === state.currentFloor - 1 ? updater(log) : log
  )
}

// ── Reducer ─────────────────────────────────────────────────────────────────

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    // ── 셋업 ──
    case 'INIT': {
      const maxFloors = DIFFICULTY_CONFIG[action.difficulty].floors
      const startFloor = Math.min(action.startFloor ?? 1, maxFloors)
      return {
        ...createInitialRunState(action.difficulty),
        startFloor,
        currentFloor: startFloor,
        // 기존 인격/기프트는 보존 (중간 진입 시 사전 입력)
        identitySlots: state.identitySlots,
        egoSlots: state.egoSlots,
        giftInventory: state.giftInventory,
        skillArrangements: state.skillArrangements,
        targetGifts: state.targetGifts,
      }
    }

    case 'START_RUN':
      return { ...state, phase: 'playing' }

    case 'LOAD_FROM_PLAN': {
      const ps = action.planState
      const difficulty = ps.difficulty ?? state.difficulty
      const maxFloors = DIFFICULTY_CONFIG[difficulty].floors
      const startFloor = Math.min(action.startFloor ?? 1, maxFloors)
      const floorLogs = Array.from({ length: maxFloors }, (_, i) => {
        const log = createFloorLog(i + 1)
        if (ps.floorPlan?.[i]?.theme_id) {
          log.themeId = ps.floorPlan[i].theme_id
        }
        return log
      })
      // 플래너 giftInventory에서 final_ prefix 파싱 → targetGifts
      const rawGifts = ps.giftInventory ?? []
      const targetGifts: string[] = []
      const actualGifts: string[] = []
      for (const id of rawGifts) {
        if (typeof id === 'string' && id.startsWith('final_')) {
          const gid = id.replace('final_', '').replace('_plusplus', '').replace('_plus', '')
          if (gid && !targetGifts.includes(gid)) targetGifts.push(gid)
        } else if (typeof id === 'string' && !id.startsWith('observe_') && !id.startsWith('start_')) {
          actualGifts.push(id)
        }
      }
      return {
        ...state,
        difficulty,
        maxFloors,
        startFloor,
        currentFloor: startFloor,
        identitySlots: ps.identitySlots ?? state.identitySlots,
        egoSlots: ps.egoSlots ?? state.egoSlots,
        floorLogs,
        giftInventory: actualGifts,
        targetGifts,
      }
    }

    // ── 층 진행 ──
    case 'SET_FLOOR_THEME':
      return {
        ...state,
        floorLogs: updateCurrentLog(state, log => ({ ...log, themeId: action.themeId })),
      }

    case 'NEXT_FLOOR': {
      if (state.currentFloor >= state.maxFloors) return { ...state, phase: 'completed' }
      return {
        ...state,
        floorLogs: updateCurrentLog(state, log => ({
          ...log,
          completedAt: log.completedAt ?? new Date().toISOString(),
        })),
        currentFloor: state.currentFloor + 1,
        // activeSubTab 유지 (기프트 탭이면 다음 층에서도 기프트 탭)
      }
    }

    case 'GO_TO_FLOOR': {
      const floor = Math.max(1, Math.min(action.floor, state.maxFloors))
      return { ...state, currentFloor: floor }
    }

    case 'COMPLETE_RUN':
      return {
        ...state,
        phase: 'completed',
        floorLogs: updateCurrentLog(state, log => ({
          ...log,
          completedAt: log.completedAt ?? new Date().toISOString(),
        })),
      }

    case 'SET_SUB_TAB':
      return { ...state, activeSubTab: action.tab }

    // ── 덱 수정 ──
    case 'SWAP_IDENTITY': {
      const oldSlot = state.identitySlots.find(s => s.sinner_id === action.sinnerId)
      const newSlots = state.identitySlots.filter(s => s.sinner_id !== action.sinnerId)
      newSlots.push(action.newSlot)
      const change: DeckChange = {
        type: 'swap_identity',
        sinnerId: action.sinnerId,
        detail: `${oldSlot?.name_kr ?? '?'} → ${action.newSlot.name_kr}`,
      }
      return {
        ...state,
        identitySlots: newSlots,
        floorLogs: updateCurrentLog(state, log => ({
          ...log,
          deckChanges: [...log.deckChanges, change],
        })),
      }
    }

    case 'REMOVE_IDENTITY':
      return {
        ...state,
        identitySlots: state.identitySlots.filter(s => s.sinner_id !== action.sinnerId),
      }

    case 'SWAP_EGO': {
      const oldEgo = state.egoSlots.find(s => s.sinner_id === action.sinnerId)
      const newSlots = state.egoSlots.filter(s => s.sinner_id !== action.sinnerId || s.grade !== action.newEgo.grade)
      newSlots.push(action.newEgo)
      const change: DeckChange = {
        type: 'swap_ego',
        sinnerId: action.sinnerId,
        detail: `EGO: ${oldEgo?.name_kr ?? '?'} → ${action.newEgo.name_kr}`,
      }
      return {
        ...state,
        egoSlots: newSlots,
        floorLogs: updateCurrentLog(state, log => ({
          ...log,
          deckChanges: [...log.deckChanges, change],
        })),
      }
    }

    case 'REMOVE_EGO':
      return {
        ...state,
        egoSlots: state.egoSlots.filter(s => s.ego_id !== action.egoId),
      }

    case 'REARRANGE_SKILLS': {
      const change: DeckChange = {
        type: 'rearrange_skill',
        sinnerId: '', // identity-level change
        detail: `스킬 배치 변경: ${action.identityId}`,
      }
      return {
        ...state,
        skillArrangements: {
          ...state.skillArrangements,
          [action.identityId]: action.skillOrder,
        },
        floorLogs: updateCurrentLog(state, log => ({
          ...log,
          deckChanges: [...log.deckChanges, change],
        })),
      }
    }

    // ── 기프트 ──
    case 'ACQUIRE_GIFT':
      return {
        ...state,
        giftInventory: [...state.giftInventory, action.giftId],
        floorLogs: updateCurrentLog(state, log => ({
          ...log,
          acquiredGifts: [...log.acquiredGifts, action.giftId],
        })),
      }

    case 'REMOVE_GIFT': {
      // giftInventory에서 첫 번째 매칭만 제거 (중복 기프트 대응)
      const removeIdx = state.giftInventory.indexOf(action.giftId)
      const newInventory = removeIdx === -1
        ? state.giftInventory
        : [...state.giftInventory.slice(0, removeIdx), ...state.giftInventory.slice(removeIdx + 1)]
      // acquiredGifts에서도 첫 번째 매칭 제거 (동기화)
      return {
        ...state,
        giftInventory: newInventory,
        floorLogs: updateCurrentLog(state, log => {
          const acqIdx = log.acquiredGifts.indexOf(action.giftId)
          const newAcq = acqIdx === -1
            ? log.acquiredGifts
            : [...log.acquiredGifts.slice(0, acqIdx), ...log.acquiredGifts.slice(acqIdx + 1)]
          return { ...log, acquiredGifts: newAcq, removedGifts: [...log.removedGifts, action.giftId] }
        }),
      }
    }

    case 'CRAFT_FUSION': {
      const remaining = [...state.giftInventory]
      for (const matId of action.materialIds) {
        const idx = remaining.indexOf(matId)
        if (idx !== -1) remaining.splice(idx, 1)
      }
      remaining.push(action.resultId)
      return {
        ...state,
        giftInventory: remaining,
        floorLogs: updateCurrentLog(state, log => ({
          ...log,
          removedGifts: [...log.removedGifts, ...action.materialIds],
          acquiredGifts: [...log.acquiredGifts, action.resultId],
        })),
      }
    }

    // ── 이벤트 ──
    case 'SELECT_EVENT_OPTION': {
      const currentLog = state.floorLogs[state.currentFloor - 1]
      const alreadySelected = currentLog?.selectedEventOptions.some(
        o => o.eventId === action.eventId && o.optionIndex === action.optionIndex
      )

      if (alreadySelected) {
        // 해제: 선택 제거 + 보상 기프트 제거
        let newInventory = [...state.giftInventory]
        const removedGifts: string[] = []
        if (action.rewardGiftIds?.length) {
          for (const gid of action.rewardGiftIds) {
            const idx = newInventory.indexOf(gid)
            if (idx !== -1) { newInventory.splice(idx, 1); removedGifts.push(gid) }
          }
        }
        return {
          ...state,
          giftInventory: newInventory,
          floorLogs: updateCurrentLog(state, log => {
            const newOpts = log.selectedEventOptions.filter(
              o => !(o.eventId === action.eventId && o.optionIndex === action.optionIndex)
            )
            let newAcq = [...log.acquiredGifts]
            for (const gid of removedGifts) {
              const idx = newAcq.indexOf(gid)
              if (idx !== -1) newAcq.splice(idx, 1)
            }
            return { ...log, selectedEventOptions: newOpts, acquiredGifts: newAcq, removedGifts: [...log.removedGifts, ...removedGifts] }
          }),
        }
      }

      // 선택: 추가 + 보상 기프트 획득 (중복 방지)
      const newGifts: string[] = []
      if (action.rewardGiftIds?.length) {
        for (const gid of action.rewardGiftIds) {
          if (!state.giftInventory.includes(gid)) newGifts.push(gid)
        }
      }
      return {
        ...state,
        giftInventory: [...state.giftInventory, ...newGifts],
        floorLogs: updateCurrentLog(state, log => ({
          ...log,
          selectedEventOptions: [...log.selectedEventOptions, { eventId: action.eventId, optionIndex: action.optionIndex }],
          acquiredGifts: [...log.acquiredGifts, ...newGifts],
        })),
      }
    }

    // ── 메모 + 저장 ──
    case 'SET_FLOOR_MEMO':
      return {
        ...state,
        floorLogs: updateCurrentLog(state, log => ({ ...log, memo: action.memo })),
      }

    case 'ADD_TARGET_GIFT':
      return {
        ...state,
        targetGifts: (state.targetGifts ?? []).includes(action.giftId)
          ? state.targetGifts
          : [...(state.targetGifts ?? []), action.giftId],
      }

    case 'REMOVE_TARGET_GIFT':
      return {
        ...state,
        targetGifts: (state.targetGifts ?? []).filter(id => id !== action.giftId),
      }

    case 'LOAD_RUN':
      return { ...action.state }

    case 'RESET':
      return createInitialRunState(state.difficulty)

    default:
      return state
  }
}
