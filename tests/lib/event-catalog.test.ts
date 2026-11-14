import { expect, it } from 'vitest'
import { eventTitle, getRootEvents, recognizableEvents } from '@/lib/utils/event-catalog'

it('counts the same visible roots in the tab and gallery, excluding variants and result nodes', () => {
  const events = [901001, 90100101, 902001, 777, 778].map(id => ({ id, variant_of: id === 902001 ? 901001 : null }))
  expect(getRootEvents(events, new Map([[901001, [{ next_event_id: 777 }]]])).map(e => e.id)).toEqual([901001, 778])
})
it('does not hide an eight-digit event when its supposed parent is absent', () => {
  expect(getRootEvents([{ id: 90100101, variant_of: null }], new Map())).toHaveLength(1)
})
it('shows one of several identical entry events, and Assist recognizes only that one', () => {
  const events = [971070, 971071, 971072].map(id => ({ id, category: 'entry', variant_of: id === 971070 ? null : 971070 }))
  expect(getRootEvents(events, new Map()).map(event => event.id)).toEqual([971070])
  const choices = [971070, 971071, 971072].map(id => ({ id: id * 10, event_id: id }))
  expect(recognizableEvents(events, choices)).toEqual({ events: [events[0]], choices: [choices[0]] })
})

it('titles the entry events the game leaves unnamed with the first line of their text, in every language', () => {
  // 901001 has no name in the game text in any language; its body opens with this line.
  const unnamed = { id: 901001, name: '', name_en: null, name_jp: null,
    desc_text: '<color=#ebcaa2>아롱거리며</color> 떠다니는 주홍빛 동그라미들이 보인다.\n그 너머로…', desc_text_en: '\nShimmering scarlet circles drift about.', desc_text_jp: null }
  expect(eventTitle(unnamed, 'ko')).toBe('아롱거리며 떠다니는 주홍빛 동그라미들이 보인다.')
  expect(eventTitle(unnamed, 'en')).toBe('Shimmering scarlet circles drift about.')
  expect(eventTitle(unnamed, 'ja')).toBe('아롱거리며 떠다니는 주홍빛 동그라미들이 보인다.')
  expect(eventTitle(unnamed, 'ko', 10)).toBe('아롱거리며 떠다니는…')
  expect(eventTitle({ id: 1, name: '녹슨 철문', name_en: 'Rusty Door', desc_text: '본문' }, 'en')).toBe('Rusty Door')
  expect(eventTitle({ id: 1, name: '녹슨 철문', name_en: null, desc_text: '본문' }, 'en')).toBe('녹슨 철문')
  expect(eventTitle({ id: 1, name: null, desc_text: '  ' }, 'ko')).toBeNull()
})

it('uses the shared title where Assist lists events and in the PiP event panel', async () => {
  const { readFileSync } = await import('node:fs')
  expect(readFileSync('features/planner/components/EventSection.tsx', 'utf8')).toContain('eventTitle(event, lang) ?? `#${event.id}`')
  expect(readFileSync('features/planner/components/CompanionEventChoices.tsx', 'utf8')).toContain("const eventName = eventTitle(event, lang) ?? ''")
})
