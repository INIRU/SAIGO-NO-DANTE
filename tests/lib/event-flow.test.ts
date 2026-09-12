import { expect, it } from 'vitest'
import type { MdEventChoice } from '@/components/mirror-dungeon/types'
import { groupEventChoices, eventResultCondition } from '@/lib/utils/event-flow'
import { getRootEvents } from '@/lib/utils/event-catalog'
import { getEventOutcomes } from '@/lib/utils/event-outcomes'
it('keeps result variants under one option and distinguishes identically named options', () => {
  const rows = [
    { id: 1, option_index: 0, sort_order: 0, message: '같은 이름' },
    { id: 2, option_index: 0, sort_order: 1, message: '같은 이름' },
    { id: 3, option_index: 1, sort_order: 100, message: '같은 이름' },
  ] as MdEventChoice[]
  expect(groupEventChoices(rows).map(group => group.map(row => row.id))).toEqual([[1, 2], [3]])
})
it('uses explicit theme entries even when another outcome loops back to them', () => {
  const events = [{ id: 1, category: 'entry', variant_of: null }, { id: 2, category: 'continuation', variant_of: null }, { id: 3, category: 'continuation', variant_of: null }]
  expect(getRootEvents(events, new Map([[3, [{ next_event_id: 1 }]]]))).toEqual([events[0]])
  expect(getEventOutcomes([{ sort_order: 0, message: '다른 문구', outcome: 'failure' }])[0].kind).toBe('failure')
})
it('shows conditional alternatives and fractional probabilities without losing their thresholds', () => {
  expect(eventResultCondition('Prob_0.01', 'ko')).toBe('1%')
  expect(eventResultCondition('MpAverage_NotLessThan25', 'ko')).toBe('평균 정신력 ≥ 25')
  expect(eventResultCondition('Failed_Under3', 'en')).toBe('Failures < 3')
  expect(eventResultCondition('Prob_1', 'ko')).toBe('')
})
