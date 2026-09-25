import { getAvailableThemes } from './fusion'
import { getLegacyPlanFloorDifficulty } from './floor-difficulty'
import type { RunAction, RunState } from './run-types'
import { DIFFICULTY_FLOOR_KEY, type ThemeData } from './types'

export interface ThemeGuidance {
  theme: ThemeData
  availableFloors: number[]
  feasible: boolean
  remainingOrder: { floor: number; theme: ThemeData }[]
  plannedHere: boolean
}

/** Replay observed swaps without changing the saved source plan. */
function effectivePlan(state: RunState): Map<number, string> {
  const plan = new Map<number, string>()
  for (const entry of state.sourcePlanSnapshot?.floorPlan ?? []) {
    if (entry.floor >= state.startFloor && entry.floor <= state.maxFloors && entry.theme_id) {
      plan.set(entry.floor, entry.theme_id)
    }
  }
  for (const log of [...state.floorLogs].sort((a, b) => a.floor - b.floor)) {
    if (log.floor === state.currentFloor || !log.themeId || log.floor < state.startFloor) continue
    const expected = plan.get(log.floor)
    if (expected && expected !== log.themeId) {
      const displacedFloor = [...plan].find(([floor, id]) => floor !== log.floor && id === log.themeId)?.[0]
      if (displacedFloor !== undefined) plan.set(displacedFloor, expected)
    } else if (!expected) {
      const consumedFloor = [...plan].find(([, id]) => id === log.themeId)?.[0]
      if (consumedFloor !== undefined) plan.delete(consumedFloor)
    }
    plan.delete(log.floor)
  }
  for (const log of state.floorLogs) {
    if (log.floor !== state.currentFloor && log.completedAt) plan.delete(log.floor)
  }
  return plan
}

/**
 * The pack the plan puts on the current floor (after replaying packs picked elsewhere), when it can be chosen there.
 * Alternative packs are not suggested: they made the selection view hard to read.
 */
export function getRunThemeGuidance(state: RunState, themes: ThemeData[]): ThemeGuidance[] {
  const current = state.currentFloor
  if (state.floorLogs[current - 1]?.themeId) return []
  const plan = effectivePlan(state)
  const plannedHere = plan.get(current)
  if (!plannedHere) return []
  const byId = new Map(themes.map(theme => [theme.id, theme]))
  const openFloors = [...plan.keys()].filter(floor =>
    floor === current || (!state.floorLogs[floor - 1]?.themeId && !state.floorLogs[floor - 1]?.completedAt)).sort((a, b) => a - b)
  const availableIds = new Map(openFloors.map(floor => {
    const difficulty = state.floorLogs[floor - 1]?.difficulty ?? getLegacyPlanFloorDifficulty(state.difficulty, floor)
    return [floor, new Set(getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], floor).map(theme => theme.id))] as const
  }))
  const eligible = (id: string, floor: number) => availableIds.get(floor)?.has(id) ?? false
  const theme = byId.get(plannedHere)
  if (!theme || !eligible(plannedHere, current)) return []
  const remainingOrder = openFloors.filter(floor => floor !== current).flatMap(floor => {
    const next = byId.get(plan.get(floor) ?? '')
    return next ? [{ floor, theme: next }] : []
  })
  return [{ theme, availableFloors: openFloors.filter(floor => eligible(plannedHere, floor)), feasible: true, remainingOrder, plannedHere: true }]
}

/**
 * Theme for a confirmed exploration banner: never an earlier floor, outside the run, off the floor's difficulty,
 * ambiguous between packs, or a pack already recorded on another floor.
 */
export function observedRunTheme(state: RunState, themes: ThemeData[], floor: number, themeIds: string[]): string | null {
  if (state.phase !== 'playing' || !Number.isInteger(floor) || floor < state.currentFloor ||
    floor < state.startFloor || floor > state.maxFloors) return null
  const difficulty = state.floorLogs[floor - 1]?.difficulty ?? getLegacyPlanFloorDifficulty(state.difficulty, floor)
  const available = new Set(getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], floor).map(theme => String(theme.id)))
  const matches = [...new Set(themeIds.map(String))].filter(id => available.has(id))
  if (matches.length !== 1) return null
  const [themeId] = matches
  if (state.floorLogs.some(log => log.floor !== floor && log.themeId === themeId)) return null
  if (floor === state.currentFloor && state.floorLogs[floor - 1]?.themeId === themeId) return null
  return themeId
}

/**
 * Each seen floor and pack is applied at most once per run, so an Undo is not overwritten while the same banner stays
 * on screen, and late or stale observations never apply.
 */
export function floorThemeObservationAction(state: RunState, themes: ThemeData[],
  observation: { floor: number; themeIds: string[]; observedAt: number; token: string }, consumed: Set<string>, now: number,
  /** Floors whose pack the user cleared: the banner still on screen must not pick it again. */
  userClearedFloors: ReadonlySet<number> = new Set(),
): Extract<RunAction, { type: 'OBSERVE_FLOOR_THEME' }> | null {
  if (state.phase !== 'playing' || consumed.has(observation.token) || now - observation.observedAt > 8000 ||
    observation.observedAt > now) return null
  consumed.add(observation.token)
  if (userClearedFloors.has(observation.floor)) return null
  const themeId = observedRunTheme(state, themes, observation.floor, observation.themeIds)
  return themeId ? { type: 'OBSERVE_FLOOR_THEME', floor: observation.floor, themeId,
    completedAt: new Date(observation.observedAt).toISOString() } : null
}

/**
 * Floor log a confirmed automatic acquisition belongs to. The gift always enters the inventory first; this only picks
 * the log. While the view shows a later pending floor (its pack chosen or entered but not recorded yet), popups
 * captured since that floor became pending belong to it; earlier captures keep the floor they were captured on.
 * Null means inventory only. The recorded current floor is never changed here.
 */
export function acquisitionAttributionFloor(state: RunState, { evidenceFloor, pendingFloor, pendingSince, pendingActive = true, capturedAt }: {
  evidenceFloor: number | null
  pendingFloor: number | null
  pendingSince: number | null
  /** False once that pending floor was resolved: it then counts only if it became the recorded current floor. */
  pendingActive?: boolean
  capturedAt: number | undefined
}): number | null {
  const pendingOpen = pendingFloor !== null && pendingFloor <= state.maxFloors && (pendingActive
    ? pendingFloor > state.currentFloor && !state.floorLogs[pendingFloor - 1]?.themeId
    : pendingFloor === state.currentFloor)
  if (pendingOpen && pendingSince !== null && capturedAt !== undefined && capturedAt >= pendingSince) return pendingFloor
  return evidenceFloor !== null && evidenceFloor >= 1 && evidenceFloor <= state.maxFloors ? evidenceFloor : null
}

/** Floors whose recorded pack was removed between two run states (a user clearing a pack selection). */
export function clearedThemeFloors(before: RunState, after: RunState): number[] {
  return after.floorLogs.filter(log => !log.themeId && before.floorLogs[log.floor - 1]?.themeId).map(log => log.floor)
}

/**
 * The game shows a later floor than the run records (its pack not yet confirmed), so automatic records would land on
 * the wrong floor until the run catches up.
 */
export function recordedFloorBehind(state: RunState, observedFloor: number | null): boolean {
  return state.phase === 'playing' && observedFloor !== null && Number.isInteger(observedFloor) &&
    observedFloor > state.currentFloor && observedFloor <= state.maxFloors
}

/**
 * Floor being chosen on a pack selection screen: the floor its header names when it is not behind the run, otherwise
 * the next floor once the current one has a pack. Null when that floor already has a pack or is past the run.
 */
export function themeSelectionTarget(state: RunState, headerFloor: number | null): number | null {
  if (state.phase !== 'playing') return null
  const fallback = state.floorLogs[state.currentFloor - 1]?.themeId ? state.currentFloor + 1 : state.currentFloor
  // A header floor behind the run or past its last floor is a misread; the next open floor is used instead.
  const floor = headerFloor !== null && Number.isInteger(headerFloor) && headerFloor >= state.currentFloor &&
    headerFloor <= state.maxFloors ? headerFloor : fallback
  return floor <= state.maxFloors && !state.floorLogs[floor - 1]?.themeId ? floor : null
}

/**
 * Floor whose pack is still being chosen. A selection screen or a stably observed later exploration floor sets it; it
 * only rises until that floor gets a pack (seen or picked), the run passes it, capture stops or the run ends. Late
 * reads of the previous floor (its selection header or exploration banner) and a missing header never lower it; Undo
 * restores the pending floor saved with the undone step. Idempotent for the same inputs, never taken from the plan.
 */
export function pendingThemeSelectionFloor(pending: number | null, { state, running, scene, header, chosenInScene, observedFloor = null }: {
  state: RunState
  running: boolean
  scene: { label: string; since: number } | null
  header: { floor: number; observedAt: number } | null
  /** Selection screen (by its `since`) on which a pack was already picked. */
  chosenInScene: number | null
  /** Exploration floor read in two separate captures; a later floor than the run records awaits its pack. */
  observedFloor?: number | null
}): number | null {
  if (!running || state.phase !== 'playing') return null
  const open = (floor: number | null) => floor !== null && Number.isInteger(floor) && floor >= state.currentFloor &&
    floor <= state.maxFloors && !state.floorLogs[floor - 1]?.themeId ? floor : null
  const candidates = [open(pending)]
  if (scene?.label === 'theme_select' && chosenInScene !== scene.since) {
    candidates.push(themeSelectionTarget(state, header && header.observedAt >= scene.since ? header.floor : null))
  }
  if (observedFloor !== null && observedFloor > state.currentFloor) candidates.push(open(observedFloor))
  const floors = candidates.filter((floor): floor is number => floor !== null)
  return floors.length ? Math.max(...floors) : null
}

/** Screens a run shows before its first pack selection: setup, the start gift choice and gift popups, loading. */
/**
 * Screens that only come after the first pack selection. The start screens themselves get mixed labels (start and
 * observation gift screens read as start_gift, their confirmation dialogs and popups as other labels), so the start is
 * ended by what follows it rather than by a list of start labels.
 */
export const AFTER_START_SCENES: ReadonlySet<string> = new Set(['theme_select', 'exploration', 'battle', 'event', 'run_end'])
/** A single confident classifier frame of the selection screen ends the start without waiting for the stable scene. */
export const THEME_SELECT_PREDICTION = 0.8

/**
 * Whether the run's first floor has left its start (start and observation gifts). Latches once a pack selection screen
 * is seen (confident frame, stable scene or its floor header), a later screen is seen, the floor has a pack or the run
 * moved on; resets only outside a playing run. Later floors are always ended, so their pack guidance is unchanged.
 */
export function runStartEnded(ended: boolean, { state, scene, header, selectionFloor, prediction = null }: {
  state: RunState
  scene: { label: string } | null
  header: { floor: number } | null
  selectionFloor: number | null
  prediction?: { label: string; confidence: number } | null
}): boolean {
  if (state.phase !== 'playing') return false
  const first = state.floorLogs[state.startFloor - 1]
  return ended || state.currentFloor !== state.startFloor || !!first?.themeId || !!first?.completedAt ||
    selectionFloor !== null || header !== null || (scene !== null && AFTER_START_SCENES.has(scene.label)) ||
    (prediction?.label === 'theme_select' && prediction.confidence >= THEME_SELECT_PREDICTION)
}

/** The plan's start and observation gifts (planner `start_` / `observe_` entries), in plan order. */
export function planStartGiftIds(state: RunState): { start: number[]; observe: number[] } {
  const ids = (prefix: string) => [...new Set((state.sourcePlanSnapshot?.giftInventory ?? [])
    .filter(id => id.startsWith(prefix)).map(id => parseInt(id.slice(prefix.length), 10)).filter(Number.isInteger))]
  return { start: ids('start_'), observe: ids('observe_') }
}
