import { DIFFICULTY_FLOOR_KEY } from '@/lib/planner/types'
import type { FloorDifficulty, FloorEntry, GiftData, PlannerAction, ThemeData } from '@/lib/planner/types'
import { getAvailableThemes, getFinalGiftVariantIds, themeExclusiveGiftIds } from '@/lib/planner/fusion'
import { isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'
import { finalKeyForFloorPick } from '@/features/planner/lib/final-gifts'

// 층 계획 탭(FloorTab)이 쓰는 순수 계산. 기능 입구가 내보내는 파일에는 두지 않는다.

/** The descent rail: its colour marks which stretch of the dungeon a floor belongs to. */
export const LADDER_SEGMENTS = [
  { id: 'early', start: 1, end: 5, rail: '#c8900a', label: '#c8900a' },
  { id: 'loop', start: 6, end: 10, rail: '#e8b030', label: '#e8b030' },
  { id: 'extreme', start: 11, end: Infinity, rail: '#9b2c23', label: '#d0675c' },
] as const

export const FLOOR_FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]'

export function getDifficultyTone(difficulty: FloorDifficulty) {
  if (difficulty === 'extreme') return '#d0675c'
  if (difficulty === 'overlap') return '#e8b030'
  if (difficulty === 'hard') return '#c8900a'
  return '#9c8b73'
}

/** Gifts a pack offers: its regular and exclusive pools and its clear rewards, each gift once. */
export function getThemeGiftCount(theme: ThemeData | null) {
  if (!theme) return 0
  return new Set([...(theme.ego_gift_ids ?? []), ...(theme.specific_ego_gift_ids ?? []), ...(theme.fixed_reward_gift_ids ?? [])]).size
}

export function getMemoPreview(memo: string) {
  return memo
    .replace(/\[(?:s|p|e|k|i|g):([^\]]+)\]/g, '$1')
    .replace(/\{\{([^}|]+)(?:\|[^}]*)?\}\}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_`>~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeFloorDifficulty(entryDifficulty: unknown, floor: number): FloorDifficulty {
  if (isFloorDifficulty(entryDifficulty) && isAllowedFloorDifficulty(entryDifficulty, floor)) return entryDifficulty
  if (floor <= 5) return 'hard'
  if (floor <= 10) return 'overlap'
  return 'extreme'
}

/** The rail's stretches that hold at least one floor, each with its floors. */
export function ladderSegments(floorPlan: FloorEntry[]) {
  return LADDER_SEGMENTS
    .map(segment => ({ ...segment, entries: floorPlan.filter(entry => entry.floor >= segment.start && entry.floor <= segment.end) }))
    .filter(segment => segment.entries.length > 0)
}

/** Packs that can show up on each floor at its (normalised) difficulty. */
export function availableThemesByFloor(floorPlan: FloorEntry[], themes: ThemeData[]) {
  const map = new Map<number, ThemeData[]>()
  for (const entry of floorPlan) {
    const difficulty = normalizeFloorDifficulty(entry.difficulty, entry.floor)
    map.set(entry.floor, getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], entry.floor))
  }
  return map
}

/** The first floor whose difficulty or pack is not allowed, as the action that repairs it; null when all are fine. */
export function floorRepairAction(floorPlan: FloorEntry[], themes: ThemeData[]): PlannerAction | null {
  const invalidEntry = floorPlan.find(entry => {
    const difficulty = normalizeFloorDifficulty(entry.difficulty, entry.floor)
    if (entry.difficulty !== difficulty) return true
    if (!entry.theme_id) return false

    const availableThemes = getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], entry.floor)
    return !availableThemes.some(theme => String(theme.id) === entry.theme_id)
  })

  if (!invalidEntry) return null

  const difficulty = normalizeFloorDifficulty(invalidEntry.difficulty, invalidEntry.floor)
  const availableThemes = getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], invalidEntry.floor)
  const hasInvalidTheme = Boolean(
    invalidEntry.theme_id && !availableThemes.some(theme => String(theme.id) === invalidEntry.theme_id)
  )

  return {
    type: 'SET_FLOOR_DIFFICULTY',
    floor: invalidEntry.floor,
    difficulty,
    clearSelection: hasInvalidTheme,
  }
}

/** Packs the picker offers for a floor: those allowed there, minus the ones another floor already uses. */
export function pickerThemesFor(activeEntry: FloorEntry | undefined, floorPlan: FloorEntry[], activeAvailableThemes: ThemeData[]) {
  if (!activeEntry) return []
  const usedThemeIds = new Set(
    floorPlan
      .filter(entry => entry.floor !== activeEntry.floor && entry.theme_id)
      .map(entry => entry.theme_id!)
  )
  return activeAvailableThemes.filter(theme => !usedThemeIds.has(String(theme.id)) || String(theme.id) === activeEntry.theme_id)
}

/** Changing a normal/hard floor's difficulty: the action, and whether the pack no longer fits (so the gift picker closes). */
export function floorDifficultyChange(entry: FloorEntry, difficulty: FloorDifficulty, themes: ThemeData[]) {
  const nextThemes = getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], entry.floor)
  const selectedStillValid = !entry.theme_id || nextThemes.some(theme => String(theme.id) === entry.theme_id)
  const action: PlannerAction = {
    type: 'SET_FLOOR_DIFFICULTY',
    floor: entry.floor,
    difficulty,
    clearSelection: !selectedStillValid,
  }
  return { action, selectedStillValid }
}

/** Everything the floor can reach: all gifts but the ones only another pack offers. */
export function reachableGiftsFor(gifts: GiftData[], themes: ThemeData[], selectedTheme: ThemeData | null) {
  const ownExclusive = new Set(selectedTheme ? themeExclusiveGiftIds(selectedTheme) : [])
  const otherExclusive = new Set(themes.flatMap(theme => themeExclusiveGiftIds(theme)).filter(id => !ownExclusive.has(id)))
  return gifts.filter(gift => !otherExclusive.has(gift.game_id))
}

/**
 * Actions for ticking or unticking a gift on a floor, in the order they are dispatched.
 * Unticking one no other floor holds also drops its final-gift keys; ticking one adds its final key when it is not already final.
 */
export function floorGiftToggleActions(
  floor: number,
  giftGameId: string,
  currentIds: string[],
  floorPlan: FloorEntry[],
  derivedFinal: Parameters<typeof finalKeyForFloorPick>[1],
): PlannerAction[] {
  if (currentIds.includes(giftGameId)) {
    const actions: PlannerAction[] = [{ type: 'SET_FLOOR_GIFTS', floor, giftIds: currentIds.filter(id => id !== giftGameId) }]
    const selectedOnAnotherFloor = floorPlan.some(entry => (
      entry.floor !== floor && entry.gift_ids.includes(giftGameId)
    ))
    if (!selectedOnAnotherFloor) {
      const gid = parseInt(giftGameId, 10)
      if (!Number.isNaN(gid)) {
        for (const giftId of getFinalGiftVariantIds(gid)) {
          actions.push({ type: 'REMOVE_GIFT', giftId })
        }
      }
    }
    return actions
  }
  const gid = parseInt(giftGameId, 10)
  if (Number.isNaN(gid)) return []
  // 층 계획은 최종 조합이 소비하는 재료도 고를 수 있다. 최종 기프트에는 넣지 않는다.
  const actions: PlannerAction[] = [{ type: 'SET_FLOOR_GIFTS', floor, giftIds: [...currentIds, giftGameId] }]
  const finalKey = finalKeyForFloorPick(gid, derivedFinal)
  if (finalKey) actions.push({ type: 'ADD_GIFT', giftId: finalKey })
  return actions
}
