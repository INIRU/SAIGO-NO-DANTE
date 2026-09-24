// 거울 던전 어시스트 모드 상태 타입
// Design Ref: §2 — RunState/RunAction 독립 상태 관리

import type { Difficulty, IdentitySlot, EgoSlot, PlannerState, SkillDistribution } from './types'
import { DIFFICULTY_CONFIG, getIdentitySkillDistribution, normalizePlannerThemeId, normalizeSkillDistribution } from './types'
import { getLegacyPlanFloorDifficulty, isAllowedFloorDifficulty, isFloorDifficulty } from './floor-difficulty'

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
  | { type: 'CRAFT_FUSION'; materialIds: string[]; resultId: string }

  | { type: 'SELECT_EVENT_OPTION'; eventId: number; optionIndex: number; rewardGiftIds?: string[] }

  | { type: 'SET_FLOOR_MEMO'; memo: string }
  | { type: 'ADD_TARGET_GIFT'; giftId: string }
  | { type: 'REMOVE_TARGET_GIFT'; giftId: string }
  | { type: 'LOAD_RUN'; state: RunState }
  | { type: 'RESET' }

// ── 초기 상태 생성 ──────────────────────────────────────────────────────────

function createFloorLog(floor: number, difficulty: Difficulty = getLegacyPlanFloorDifficulty('hard', floor)): FloorLog {
  return {
    floor,
    difficulty,
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
    floorLogs: Array.from({ length: maxFloors }, (_, i) => createFloorLog(i + 1, getLegacyPlanFloorDifficulty(difficulty, i + 1))),
    giftInventory: [],
    sourcePlanSnapshot: null,
    sourcePlanEncoded: null,
    targetGifts: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function integerArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => Number.isInteger(item)) : []
}

function normalizeIdentitySlots(value: unknown): IdentitySlot[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(slot => {
    if (!isRecord(slot) || typeof slot.identity_id !== 'string' || typeof slot.sinner_id !== 'string') return []
    const [s1_count, s2_count, s3_count] = getIdentitySkillDistribution(slot)
    return [{
      identity_id: slot.identity_id,
      sinner_id: slot.sinner_id,
      name_kr: typeof slot.name_kr === 'string' ? slot.name_kr : '',
      rarity: typeof slot.rarity === 'number' && Number.isFinite(slot.rarity) ? slot.rarity : 0,
      keywords: stringArray(slot.keywords),
      ...(slot.skill_keyword_list === undefined ? {} : { skill_keyword_list: slot.skill_keyword_list === null ? null : stringArray(slot.skill_keyword_list) }),
      ...(slot.affiliation === undefined ? {} : { affiliation: typeof slot.affiliation === 'string' ? slot.affiliation : null }),
      ...(slot.association_list === undefined ? {} : { association_list: slot.association_list === null ? null : stringArray(slot.association_list) }),
      s1_count, s2_count, s3_count,
      game_id: typeof slot.game_id === 'string' ? slot.game_id : null,
      folder_name: typeof slot.folder_name === 'string' ? slot.folder_name : null,
      slot_order: typeof slot.slot_order === 'number' && Number.isInteger(slot.slot_order) ? slot.slot_order : 99,
      ...(slot.uptie === 1 || slot.uptie === 2 || slot.uptie === 3 ? { uptie: slot.uptie } : {}),
    }]
  })
}

function normalizeEgoSlots(value: unknown): EgoSlot[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(slot => isRecord(slot) && typeof slot.ego_id === 'string' && typeof slot.sinner_id === 'string'
    ? [{
      ego_id: slot.ego_id, sinner_id: slot.sinner_id,
      name_kr: typeof slot.name_kr === 'string' ? slot.name_kr : '',
      grade: typeof slot.grade === 'string' ? slot.grade : '',
      sin_affinity: typeof slot.sin_affinity === 'string' ? slot.sin_affinity : null,
    }]
    : [])
}

function normalizePlanSnapshot(value: unknown, difficulty: Difficulty): Partial<PlannerState> | null {
  if (!isRecord(value)) return null
  const floorPlan = Array.isArray(value.floorPlan) ? value.floorPlan : []
  return {
    ...value,
    difficulty,
    identitySlots: normalizeIdentitySlots(value.identitySlots),
    egoSlots: normalizeEgoSlots(value.egoSlots),
    giftInventory: stringArray(value.giftInventory),
    mainKeywords: stringArray(value.mainKeywords),
    mainKeywordsManual: value.mainKeywordsManual === true,
    title: typeof value.title === 'string' ? value.title : '',
    description: typeof value.description === 'string' ? value.description : '',
    floorPlan: floorPlan.map((item, index) => {
      const entry = isRecord(item) ? item : {}
      const floor = index + 1
      return {
        ...entry,
        floor,
        difficulty: isFloorDifficulty(entry.difficulty) && isAllowedFloorDifficulty(entry.difficulty, floor)
          ? entry.difficulty : getLegacyPlanFloorDifficulty(difficulty, floor),
        theme_id: normalizePlannerThemeId(entry.theme_id),
        gift_ids: stringArray(entry.gift_ids),
        memo: typeof entry.memo === 'string' ? entry.memo : '',
        ...(entry.constraints === undefined ? {} : { constraints: integerArray(entry.constraints) }),
      }
    }),
  }
}

function floorNumber(value: unknown, fallback: number, max: number): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.max(1, Math.min(value, max))
    : fallback
}

/** Restore old or incomplete local drafts without letting missing fields break the run UI. */
export function normalizeRunState(value: unknown): RunState {
  const saved = isRecord(value) ? value : {}
  const difficulty = typeof saved.difficulty === 'string' && Object.hasOwn(DIFFICULTY_CONFIG, saved.difficulty)
    ? saved.difficulty as Difficulty
    : 'hard'
  const initial = createInitialRunState(difficulty)
  const maxFloors = Math.min(15, Math.max(initial.maxFloors,
    typeof saved.maxFloors === 'number' && Number.isInteger(saved.maxFloors) ? saved.maxFloors : 0,
    Array.isArray(saved.floorLogs) ? saved.floorLogs.length : 0))
  const logs = Array.isArray(saved.floorLogs) ? saved.floorLogs : []
  const floorLogs = Array.from({ length: maxFloors }, (_, index) => {
    const floor = index + 1
    const raw = isRecord(logs[index]) ? logs[index] : {}
    const fallback = createFloorLog(floor, getLegacyPlanFloorDifficulty(difficulty, floor))
    return {
      ...fallback,
      difficulty: isFloorDifficulty(raw.difficulty) && isAllowedFloorDifficulty(raw.difficulty, floor)
        ? raw.difficulty : fallback.difficulty,
      themeId: normalizePlannerThemeId(raw.themeId),
      acquiredGifts: stringArray(raw.acquiredGifts),
      removedGifts: stringArray(raw.removedGifts),
      deckChanges: Array.isArray(raw.deckChanges) ? raw.deckChanges.flatMap(item => {
        if (!isRecord(item) || (item.type !== 'swap_identity' && item.type !== 'swap_ego' && item.type !== 'rearrange_skill')) return []
        return [{ type: item.type as DeckChange['type'], sinnerId: typeof item.sinnerId === 'string' ? item.sinnerId : '', detail: typeof item.detail === 'string' ? item.detail : '' }]
      }) : [],
      selectedEventOptions: Array.isArray(raw.selectedEventOptions)
        ? raw.selectedEventOptions.filter((item): item is { eventId: number; optionIndex: number; rewardGiftIds?: string[]; uncertainRewardGiftIds?: string[] } =>
            isRecord(item) && Number.isInteger(item.eventId) && Number.isInteger(item.optionIndex))
          .map(item => ({ ...item, rewardGiftIds: stringArray(item.rewardGiftIds), uncertainRewardGiftIds: stringArray(item.uncertainRewardGiftIds) }))
        : [],
      memo: typeof raw.memo === 'string' ? raw.memo : '',
      completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
    }
  })
  const arrangements = isRecord(saved.skillArrangements) ? saved.skillArrangements : {}
  return {
    ...initial,
    phase: saved.phase === 'playing' || saved.phase === 'completed' ? saved.phase : 'setup',
    difficulty,
    maxFloors,
    startFloor: floorNumber(saved.startFloor, 1, maxFloors),
    currentFloor: floorNumber(saved.currentFloor, 1, maxFloors),
    activeSubTab: saved.activeSubTab === 'theme' || saved.activeSubTab === 'event' || saved.activeSubTab === 'gift' ? saved.activeSubTab : 'deck',
    identitySlots: normalizeIdentitySlots(saved.identitySlots),
    egoSlots: normalizeEgoSlots(saved.egoSlots),
    skillArrangements: Object.fromEntries(Object.entries(arrangements).filter(([, order]) => Array.isArray(order)).map(([id, order]) => [id, stringArray(order)])),
    floorLogs,
    giftInventory: stringArray(saved.giftInventory),
    sourcePlanSnapshot: normalizePlanSnapshot(saved.sourcePlanSnapshot, difficulty),
    sourcePlanEncoded: typeof saved.sourcePlanEncoded === 'string' ? saved.sourcePlanEncoded : null,
    targetGifts: stringArray(saved.targetGifts),
  }
}

// ── 현재 FloorLog 헬퍼 ──────────────────────────────────────────────────────

function getCurrentLog(state: RunState): FloorLog {
  return state.floorLogs[state.currentFloor - 1] ?? createFloorLog(state.currentFloor, getLegacyPlanFloorDifficulty(state.difficulty, state.currentFloor))
}

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
      if (!action.materialIds.length || !action.resultId) return state
      const remaining = [...state.giftInventory]
      for (const matId of action.materialIds) {
        const idx = remaining.indexOf(matId)
        if (idx === -1) return state
        remaining.splice(idx, 1)
      }
      // A result already held (a gift is never owned twice) is not added again; the materials still leave.
      const owned = remaining.includes(action.resultId)
      if (!owned) remaining.push(action.resultId)
      return {
        ...state,
        giftInventory: remaining,
        floorLogs: markRewardsUncertain(updateCurrentLog(state, log => ({
          ...log,
          removedGifts: [...log.removedGifts, ...action.materialIds],
          acquiredGifts: owned ? log.acquiredGifts : [...log.acquiredGifts, action.resultId],
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
