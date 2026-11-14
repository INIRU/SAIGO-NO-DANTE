import type { DeckChange, FloorLog, RunState } from './run-model'
import type { Difficulty, IdentitySlot, EgoSlot, PlannerState } from '@/lib/planner/types'
import { DIFFICULTY_CONFIG, getIdentitySkillDistribution, normalizePlannerThemeId } from '@/lib/planner/types'
import { getLegacyPlanFloorDifficulty, isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'

// ── 초기 상태 생성 ──────────────────────────────────────────────────────────

export function createFloorLog(floor: number, difficulty: Difficulty = getLegacyPlanFloorDifficulty('hard', floor)): FloorLog {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function stringArray(value: unknown): string[] {
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

export function normalizePlanSnapshot(value: unknown, difficulty: Difficulty): Partial<PlannerState> | null {
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

export function floorNumber(value: unknown, fallback: number, max: number): number {
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
      ...(Array.isArray(raw.clearBonus) ? { clearBonus: stringArray(raw.clearBonus) } : {}),
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
