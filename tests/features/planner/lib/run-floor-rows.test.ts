import { describe, expect, it } from 'vitest'
import { floorRows } from '@/features/planner/lib/run-floor-rows'
import { createInitialRunState, runReducer, type RunState } from '@/features/planner/lib/run-types'

function run(): RunState {
  let state = runReducer(createInitialRunState('hard'), { type: 'START_RUN' })
  state = runReducer(state, { type: 'SET_FLOOR_THEME', themeId: 'A' })
  for (const giftId of ['10', '20', '10']) state = runReducer(state, { type: 'ACQUIRE_GIFT', giftId })
  state = runReducer(state, { type: 'REMOVE_GIFT', giftId: '20' })
  return runReducer(state, { type: 'NEXT_FLOOR' })
}

describe('the floor log has one row per floor', () => {
  it('a finished floor keeps its pack, the gifts taken there once each, and how much was recorded', () => {
    const rows = floorRows(run())
    expect(rows).toHaveLength(5)
    expect(rows[0]).toMatchObject({ floor: 1, state: 'done', themeId: 'A', giftIds: ['10', '20'] })
    // Every entry counts: three acquisitions (one gift twice) and one removal.
    expect(rows[0].records).toBe(4)
  })

  it('the floor being played is current, and floors with nothing recorded are still ahead', () => {
    const rows = floorRows(run())
    expect(rows[1]).toMatchObject({ floor: 2, state: 'current', themeId: null, giftIds: [], events: 0, records: 0 })
    expect(rows.slice(2).map(row => row.state)).toEqual(['ahead', 'ahead', 'ahead'])
  })

  it('going back to an earlier floor makes it current and keeps a later visited floor as done', () => {
    const later = runReducer(runReducer(run(), { type: 'SET_FLOOR_THEME', themeId: 'B' }), { type: 'GO_TO_FLOOR', floor: 1 })
    expect(floorRows(later).map(row => row.state)).toEqual(['current', 'done', 'ahead', 'ahead', 'ahead'])
  })
})
