import { expect, it } from 'vitest'
import type { MdEvent, MdEventChoice } from '@/components/mirror-dungeon/types'
import { eventCheckSins, groupEventChoices, eventResultCondition } from '@/lib/utils/event-flow'
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

it('REQ-MIRROR-DUNGEON-024 reads each option\'s favoured sins from the check event it leads to, by option number', () => {
  const rows = [
    { id: 1, option_index: 0, sort_order: 0, next_event_id: 10 },
    { id: 2, option_index: 1, sort_order: 100, next_event_id: 20 },
    { id: 3, option_index: 1, sort_order: 101, next_event_id: 21 },
    { id: 4, option_index: 2, sort_order: 200, next_event_id: null },
  ] as MdEventChoice[]
  const check = (...codes: string[]) => ({ judgement: { upDownType: 1, inclusiveValue: 14, exclusiveValue: 28, judgementDataList: codes.map(attributeType => ({ attributeType })) } })
  const events = new Map([
    [10, { id: 10, judgment: check('AZURE', 'AMBER') }],
    [20, { id: 20, judgment: check('CRIMSON', 'SCARLET', 'INDIGO') }],
    [21, { id: 21, judgment: check('SCARLET', 'VIOLET') }],
  ] as [number, MdEvent][])
  // Option 2 leads to two checks: their sins once each, in the order they appear. Option 3 has no check.
  expect(eventCheckSins(rows, events)).toEqual([
    { option: 1, sins: ['gloom', 'sloth'] },
    { option: 2, sins: ['wrath', 'lust', 'pride', 'envy'] },
  ])
})
