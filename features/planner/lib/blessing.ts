// 가호 데이터 (게임 값 기준)
export interface Blessing {
  baseId: number
  name: string
  costs: [number, number, number]  // [기본, +, ++]
  effectsByLevel: [string[], string[], string[]]  // [기본, +, ++]
}

export const BLESSING_CONFIGS: Array<Pick<Blessing, 'baseId' | 'costs'>> = [
  { baseId: 100, costs: [10, 20, 30] },
  { baseId: 101, costs: [10, 20, 30] },
  { baseId: 102, costs: [20, 40, 60] },
  { baseId: 103, costs: [20, 40, 60] },
  { baseId: 104, costs: [30, 60, 90] },
  { baseId: 105, costs: [30, 60, 90] },
  { baseId: 106, costs: [40, 80, 120] },
  { baseId: 107, costs: [40, 80, 120] },
  { baseId: 108, costs: [50, 100, 150] },
  { baseId: 109, costs: [60, 120, 180] },
]

export const LEVEL_LABELS = ['', '+', '++'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function normalizeEffectsByLevel(value: unknown): [string[], string[], string[]] | null {
  if (!Array.isArray(value) || value.length !== 3) return null
  if (!value.every(isStringArray)) return null
  return [value[0], value[1], value[2]]
}

export function normalizeBlessingMessages(raw: unknown, fallbackName: (baseId: number) => string): Blessing[] {
  if (!isRecord(raw)) {
    return BLESSING_CONFIGS.map(config => ({
      ...config,
      name: fallbackName(config.baseId),
      effectsByLevel: [[], [], []],
    }))
  }

  return BLESSING_CONFIGS.map(config => {
    const entry = raw[String(config.baseId)]
    if (!isRecord(entry)) {
      return {
        ...config,
        name: fallbackName(config.baseId),
        effectsByLevel: [[], [], []],
      }
    }

    const effectsByLevel = normalizeEffectsByLevel(entry.effectsByLevel)
    return {
      ...config,
      name: typeof entry.name === 'string' ? entry.name : fallbackName(config.baseId),
      effectsByLevel: effectsByLevel ?? [[], [], []],
    }
  })
}

export function getBlessingDisplayName(blessing: Blessing, selectedLevel: number) {
  return selectedLevel > 1 ? `${blessing.name}${LEVEL_LABELS[selectedLevel - 1]}` : blessing.name
}

export function getSelectedBlessingLevels(giftInventory: string[]) {
  const map = new Map<number, number>()
  for (const id of giftInventory) {
    if (!id.startsWith('blessing_')) continue
    const [, baseIdString, levelString] = id.split('_')
    const baseId = Number.parseInt(baseIdString, 10)
    const level = Number.parseInt(levelString, 10)
    if (Number.isFinite(baseId) && level >= 1 && level <= 3) {
      map.set(baseId, level)
    }
  }
  return map
}

export function getSelectedBlessingCost(blessings: Blessing[], selectedBlessings: Map<number, number>) {
  let cost = 0
  for (const [baseId, level] of selectedBlessings) {
    const blessing = blessings.find(item => item.baseId === baseId)
    if (blessing && level > 0) cost += blessing.costs[level - 1]
  }
  return cost
}
