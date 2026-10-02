import type { RunState } from './run-types'

export interface FloorRow {
  floor: number
  /** done: something was recorded there or it was completed. current: the floor being played. ahead: nothing yet. */
  state: 'done' | 'current' | 'ahead'
  themeId: string | null
  /** Gifts taken on that floor, each once, in the order they were recorded. */
  giftIds: string[]
  /** Event choices recorded on that floor. */
  events: number
  /** Everything recorded on that floor: gifts taken and removed, deck changes, event choices. */
  records: number
}

/** The floor log of the Assist run page: one row per floor of the run. */
export function floorRows(state: RunState): FloorRow[] {
  return state.floorLogs.map(log => {
    const records = log.acquiredGifts.length + log.removedGifts.length + log.deckChanges.length + log.selectedEventOptions.length
    return {
      floor: log.floor,
      state: log.floor === state.currentFloor ? 'current' : log.completedAt || log.themeId || records > 0 ? 'done' : 'ahead',
      themeId: log.themeId,
      giftIds: [...new Set(log.acquiredGifts)],
      events: log.selectedEventOptions.length,
      records,
    }
  })
}
