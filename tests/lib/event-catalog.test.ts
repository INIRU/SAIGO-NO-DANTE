import { expect, it } from 'vitest'
import { getRootEvents, recognizableEvents } from '@/lib/utils/event-catalog'

it('counts the same visible roots in the tab and gallery, excluding variants and result nodes', () => {
  const events = [901001, 90100101, 902001, 777, 778].map(id => ({ id, variant_of: id === 902001 ? 901001 : null }))
  expect(getRootEvents(events, new Map([[901001, [{ next_event_id: 777 }]]])).map(e => e.id)).toEqual([901001, 778])
})
it('does not hide an eight-digit event when its supposed parent is absent', () => {
  expect(getRootEvents([{ id: 90100101, variant_of: null }], new Map())).toHaveLength(1)
})
it('REQ-MIRROR-DUNGEON-008 shows one of several identical entry events, and Assist recognizes only that one', () => {
  const events = [971070, 971071, 971072].map(id => ({ id, category: 'entry', variant_of: id === 971070 ? null : 971070 }))
  expect(getRootEvents(events, new Map()).map(event => event.id)).toEqual([971070])
  const choices = [971070, 971071, 971072].map(id => ({ id: id * 10, event_id: id }))
  expect(recognizableEvents(events, choices)).toEqual({ events: [events[0]], choices: [choices[0]] })
})
