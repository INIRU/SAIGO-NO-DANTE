import { expect, it } from 'vitest'
import { createInitialRunState, normalizeRunState, runReducer } from '@/features/planner/lib/run-types'
import { AUTO_ACQUIRE_EXCLUDED_GIFT_IDS } from '@/features/assist/lib/popup-evidence'

const keyOf = (state: Parameters<typeof normalizeRunState>[0]) => JSON.stringify(normalizeRunState(state))

it('stores exactly the computed next-floor state, so Undo and Redo keys match after a time-stamped action', () => {
  const before = runReducer(createInitialRunState('hard'), { type: 'START_RUN' })
  const after = runReducer(before, { type: 'NEXT_FLOOR' })
  // What the companion history records and then loads into the store.
  const stored = runReducer(before, { type: 'LOAD_RUN', state: after })
  expect(keyOf(stored)).toBe(keyOf(after))
  expect(stored.currentFloor).toBe(2)
  expect(stored.floorLogs[0].completedAt).toBe(after.floorLogs[0].completedAt)
  const undone = runReducer(stored, { type: 'LOAD_RUN', state: before })
  expect(keyOf(undone)).toBe(keyOf(before))
  expect(keyOf(runReducer(undone, { type: 'LOAD_RUN', state: after }))).toBe(keyOf(after))
})

it('skips only the five synthesis-material vestiges from automatic acquisition', () => {
  expect([...AUTO_ACQUIRE_EXCLUDED_GIFT_IDS].sort()).toEqual(['9991', '9992', '9993', '9994', '9995'])
  expect(AUTO_ACQUIRE_EXCLUDED_GIFT_IDS.has('9086')).toBe(false)
  expect(runReducer(createInitialRunState(), { type: 'ACQUIRE_GIFT', giftId: '9991' }).giftInventory).toEqual(['9991'])
})
