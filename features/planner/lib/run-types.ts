// 거울 던전 어시스트 모드 상태 타입
// Design Ref: §2 — RunState/RunAction 독립 상태 관리

import type { Difficulty, IdentitySlot, EgoSlot, PlannerState, SkillDistribution } from '@/lib/planner/types'
import { DIFFICULTY_CONFIG, normalizePlannerThemeId, normalizeSkillDistribution } from '@/lib/planner/types'
import { getLegacyPlanFloorDifficulty, isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'
import { createFloorLog, createInitialRunState, floorNumber, isRecord, normalizePlanSnapshot, normalizeRunState, stringArray } from './run-normalize'

export type RunPhase = 'setup' | 'playing' | 'completed'
export type FloorSubTab = 'deck' | 'theme' | 'event' | 'gift'

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

// 초기 상태 생성과 저장본 복원은 run-normalize.ts에 있다. 기존 가져오기 경로를 그대로 쓰도록 다시 내보낸다.
export { createInitialRunState, normalizeRunState } from './run-normalize'

// ── 현재 FloorLog 헬퍼 ──────────────────────────────────────────────────────

function updateCurrentLog(state: RunState, updater: (log: FloorLog) => FloorLog): FloorLog[] {
  return state.floorLogs.map((log, i) =>
    i === state.currentFloor - 1 ? updater(log) : log
  )
}

function markRewardsUncertain(logs: FloorLog[], removedIds: string[]): FloorLog[] {
  const removed = new Set(removedIds)
  if (!removed.size) return logs
  return logs.map(log => ({
    ...log,
    selectedEventOptions: log.selectedEventOptions.map(option => {
      const affected = option.rewardGiftIds?.filter(id => removed.has(id)) ?? []
      return affected.length
        ? { ...option, uncertainRewardGiftIds: [...new Set([...(option.uncertainRewardGiftIds ?? []), ...affected])] }
        : option
    }),
  }))
}

// ── Reducer ─────────────────────────────────────────────────────────────────

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    // ── 셋업 ──
    case 'INIT': {
      const maxFloors = DIFFICULTY_CONFIG[action.difficulty].floors
      const startFloor = floorNumber(action.startFloor, 1, maxFloors)
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
        sourcePlanSnapshot: state.sourcePlanSnapshot,
      }
    }

    case 'START_RUN':
      return { ...state, phase: 'playing' }

    case 'LOAD_FROM_PLAN': {
      const raw = isRecord(action.planState) ? action.planState : {}
      const difficulty = typeof raw.difficulty === 'string' && Object.hasOwn(DIFFICULTY_CONFIG, raw.difficulty)
        ? raw.difficulty as Difficulty : state.difficulty
      const ps = normalizePlanSnapshot(raw, difficulty)!
      const maxFloors = DIFFICULTY_CONFIG[difficulty].floors
      const startFloor = floorNumber(action.startFloor, 1, maxFloors)
      const floorLogs = Array.from({ length: maxFloors }, (_, i) => {
        const planEntry = ps.floorPlan?.[i]
        const floorDifficulty = isFloorDifficulty(planEntry?.difficulty) && isAllowedFloorDifficulty(planEntry.difficulty, i + 1)
          ? planEntry.difficulty
          : getLegacyPlanFloorDifficulty(difficulty, i + 1)
        const log = createFloorLog(i + 1, floorDifficulty)
        return log
      })
      // 플래너 giftInventory에서 final_ prefix 파싱 → targetGifts
      const rawGifts = ps.giftInventory ?? []
      const targetGifts: string[] = []
      for (const id of rawGifts) {
        if (typeof id === 'string' && id.startsWith('final_')) {
          const gid = id.replace('final_', '').replace('_plusplus', '').replace('_plus', '')
          if (gid && !targetGifts.includes(gid)) targetGifts.push(gid)
        }
      }
      return {
        ...createInitialRunState(difficulty),
        sourcePlanSnapshot: structuredClone(ps),
        difficulty,
        maxFloors,
        startFloor,
        currentFloor: startFloor,
        identitySlots: ps.identitySlots ?? state.identitySlots,
        egoSlots: ps.egoSlots ?? state.egoSlots,
        floorLogs,
        giftInventory: [],
        targetGifts,
      }
    }

    // ── 층 진행 ──
    case 'SET_FLOOR_THEME':
      return {
        ...state,
        floorLogs: updateCurrentLog(state, log => ({ ...log, themeId: normalizePlannerThemeId(action.themeId) })),
      }

    // Screen observation: moves forward to the seen floor (closing the one left, like NEXT_FLOOR) and records its pack.
    case 'OBSERVE_FLOOR_THEME': {
      const themeId = normalizePlannerThemeId(action.themeId)
      if (state.phase !== 'playing' || !themeId || !Number.isInteger(action.floor) ||
        action.floor < state.currentFloor || action.floor > state.maxFloors) return state
      const advancing = action.floor > state.currentFloor
      return {
        ...state,
        currentFloor: action.floor,
        floorLogs: state.floorLogs.map(log => log.floor === action.floor ? { ...log, themeId }
          : advancing && log.floor === state.currentFloor ? { ...log, completedAt: log.completedAt ?? action.completedAt } : log),
      }
    }

    case 'SET_FLOOR_CLEAR_BONUS': {
      const giftIds = [...new Set(action.giftIds.filter(id => typeof id === 'string' && id))]
      if (!Number.isInteger(action.floor)) return state
      return { ...state, floorLogs: state.floorLogs.map(log => log.floor === action.floor ? { ...log, clearBonus: giftIds } : log) }
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
      // 같은 인격의 편성 번호만 바뀐 것은 교체가 아니라서 기록하지 않는다.
      if (oldSlot?.identity_id === action.newSlot.identity_id) return { ...state, identitySlots: newSlots }
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

    case 'SET_SKILL_DISTRIBUTION': {
      const slot = state.identitySlots.find(item => item.sinner_id === action.sinnerId)
      if (!slot || !Array.isArray(action.distribution)) return state
      const [s1_count, s2_count, s3_count] = normalizeSkillDistribution(action.distribution)
      if (slot.s1_count === s1_count && slot.s2_count === s2_count && slot.s3_count === s3_count) return state
      const change: DeckChange = {
        type: 'rearrange_skill', sinnerId: action.sinnerId,
        detail: `스킬 배분 변경: ${slot.identity_id} (${s1_count}/${s2_count}/${s3_count})`,
      }
      return {
        ...state,
        identitySlots: state.identitySlots.map(item => item.sinner_id === action.sinnerId
          ? { ...item, s1_count, s2_count, s3_count } : item),
        floorLogs: updateCurrentLog(state, log => ({ ...log, deckChanges: [...log.deckChanges, change] })),
      }
    }

    // ── 기프트 ──
    case 'ACQUIRE_GIFT': {
      const floor = action.floor === undefined ? state.currentFloor : action.floor
      return {
        ...state,
        giftInventory: [...state.giftInventory, action.giftId],
        floorLogs: state.floorLogs.map(log => log.floor === floor
          ? { ...log, acquiredGifts: [...log.acquiredGifts, action.giftId] } : log),
      }
    }

    case 'REMOVE_GIFT': {
      // giftInventory에서 첫 번째 매칭만 제거 (중복 기프트 대응)
      const removeIdx = state.giftInventory.indexOf(action.giftId)
      const newInventory = removeIdx === -1
        ? state.giftInventory
        : [...state.giftInventory.slice(0, removeIdx), ...state.giftInventory.slice(removeIdx + 1)]
      if (removeIdx === -1) return state
      return {
        ...state,
        giftInventory: newInventory,
        floorLogs: markRewardsUncertain(updateCurrentLog(state, log => ({
          ...log, removedGifts: [...log.removedGifts, action.giftId],
        })), [action.giftId]),
      }
    }

    case 'CRAFT_FUSION': {
      if (!action.materialIds.length || action.resultId === '') return state
      const remaining = [...state.giftInventory]
      for (const matId of action.materialIds) {
        const idx = remaining.indexOf(matId)
        if (idx === -1) return state
        remaining.splice(idx, 1)
      }
      // A result already held (a gift is never owned twice) or not recorded is not added; the materials still leave.
      const result = action.resultId
      const owned = result === null || remaining.includes(result)
      if (!owned) remaining.push(result)
      return {
        ...state,
        giftInventory: remaining,
        floorLogs: markRewardsUncertain(updateCurrentLog(state, log => ({
          ...log,
          removedGifts: [...log.removedGifts, ...action.materialIds],
          acquiredGifts: owned ? log.acquiredGifts : [...log.acquiredGifts, result],
        })), action.materialIds),
      }
    }

    // ── 이벤트 ──
    case 'SELECT_EVENT_OPTION': {
      const currentLog = state.floorLogs[state.currentFloor - 1]
      const selected = currentLog?.selectedEventOptions.find(
        o => o.eventId === action.eventId && o.optionIndex === action.optionIndex
      )

      if (selected) {
        // 해제: 선택 제거 + 보상 기프트 제거
        let newInventory = [...state.giftInventory]
        const removedGifts: string[] = []
        const uncertain = new Set(selected.uncertainRewardGiftIds ?? [])
        if (selected.rewardGiftIds?.length) {
          for (const gid of selected.rewardGiftIds) {
            if (uncertain.has(gid)) continue
            const idx = newInventory.indexOf(gid)
            if (idx !== -1) { newInventory.splice(idx, 1); removedGifts.push(gid) }
          }
        }
        return {
          ...state,
          giftInventory: newInventory,
          floorLogs: markRewardsUncertain(updateCurrentLog(state, log => {
            const newOpts = log.selectedEventOptions.filter(
              o => !(o.eventId === action.eventId && o.optionIndex === action.optionIndex)
            )
            return { ...log, selectedEventOptions: newOpts, removedGifts: [...log.removedGifts, ...removedGifts] }
          }), removedGifts),
        }
      }

      // 선택: 추가한 보상을 선택 기록에 남겨 해제 시 기존 보유 기프트를 지우지 않는다.
      const newGifts = stringArray(action.rewardGiftIds)
      return {
        ...state,
        giftInventory: [...state.giftInventory, ...newGifts],
        floorLogs: updateCurrentLog(state, log => ({
          ...log,
          selectedEventOptions: [...log.selectedEventOptions, { eventId: action.eventId, optionIndex: action.optionIndex, rewardGiftIds: newGifts }],
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
      return normalizeRunState(action.state)

    case 'RESET':
      return createInitialRunState(state.difficulty)

    default:
      return state
  }
}
