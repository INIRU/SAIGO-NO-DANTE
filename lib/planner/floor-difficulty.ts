export type FloorDifficulty = 'normal' | 'hard' | 'overlap' | 'extreme'

const FLOOR_DIFFICULTIES = ['normal', 'hard', 'overlap', 'extreme'] as const

type FloorEntryRecord = Record<string, unknown>

export type NormalizeFloorPlanResult = {
  floorPlan: unknown[]
  changed: boolean
}

export function isFloorDifficulty(value: unknown): value is FloorDifficulty {
  return typeof value === 'string' && FLOOR_DIFFICULTIES.includes(value as FloorDifficulty)
}

export function normalizePlanDifficulty(value: unknown, fallback: FloorDifficulty = 'hard'): FloorDifficulty {
  return isFloorDifficulty(value) ? value : fallback
}

export function getLegacyPlanFloorDifficulty(planDifficulty: unknown, floor: number): FloorDifficulty {
  const difficulty = normalizePlanDifficulty(planDifficulty)

  if (floor <= 5) return difficulty === 'normal' ? 'normal' : 'hard'
  if (floor <= 10) return 'overlap'
  return 'extreme'
}

export function isAllowedFloorDifficulty(value: FloorDifficulty, floor: number) {
  if (floor <= 5) return value === 'normal' || value === 'hard'
  if (floor <= 10) return value === 'overlap'
  return value === 'extreme'
}

function getEntryFloor(entry: FloorEntryRecord, index: number) {
  return typeof entry.floor === 'number' && Number.isFinite(entry.floor) && entry.floor >= 1
    ? Math.floor(entry.floor)
    : index + 1
}

function normalizeEntryDifficulty(entry: FloorEntryRecord, planDifficulty: unknown, floor: number) {
  const current = entry.difficulty
  if (isFloorDifficulty(current) && isAllowedFloorDifficulty(current, floor)) return current
  return getLegacyPlanFloorDifficulty(planDifficulty, floor)
}

export function normalizeFloorPlanDifficulty(
  floorPlan: unknown,
  planDifficulty: unknown,
): NormalizeFloorPlanResult {
  if (!Array.isArray(floorPlan)) {
    return {
      floorPlan: [],
      changed: floorPlan !== undefined && floorPlan !== null,
    }
  }

  let changed = false
  const normalized = floorPlan.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry

    const record = entry as FloorEntryRecord
    const floor = getEntryFloor(record, index)
    const difficulty = normalizeEntryDifficulty(record, planDifficulty, floor)
    if (record.difficulty === difficulty) return entry

    changed = true
    return {
      ...record,
      difficulty,
    }
  })

  return { floorPlan: normalized, changed }
}
