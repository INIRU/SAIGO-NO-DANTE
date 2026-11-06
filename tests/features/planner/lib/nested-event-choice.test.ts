import { expect, it } from 'vitest'
import { createInitialRunState, runReducer } from '@/features/planner/lib/run-types'

it('records a follow-up event choice under its own event ID without granting a gift', () => {
  const state = createInitialRunState('hard')
  const selected = runReducer(state, {
    type: 'SELECT_EVENT_OPTION',
    eventId: 90100201,
    optionIndex: 0,
    rewardGiftIds: [],
  })

  expect(selected.floorLogs[0].selectedEventOptions).toEqual([
    { eventId: 90100201, optionIndex: 0, rewardGiftIds: [] },
  ])
  expect(selected.giftInventory).toEqual([])
  expect(runReducer(selected, {
    type: 'SELECT_EVENT_OPTION',
    eventId: 90100201,
    optionIndex: 0,
    rewardGiftIds: [],
  }).floorLogs[0].selectedEventOptions).toEqual([])
})
