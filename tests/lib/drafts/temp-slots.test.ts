import { expect, it } from 'vitest'
import { parseTempSlots, TEMP_SLOT_COUNT } from '@/lib/drafts/temp-slots'
import { nextNavStack } from '@/lib/navigation/nav-stack'

const isState = (value: unknown): value is { n: number } => !!value && typeof (value as { n?: unknown }).n === 'number'
const draft = (n: number) => ({ id: String(n), label: 'plan ' + n, savedAt: '2026-09-24T00:00:00Z', state: { n } })

it('reads the older three-slot storage as five slots and drops broken entries', () => {
  const slots = parseTempSlots(JSON.stringify({ version: 1, slots: [draft(1), null, { id: 'x' }] }), isState)
  expect(TEMP_SLOT_COUNT).toBe(5)
  expect(slots.map(slot => slot.slotNumber)).toEqual([1, 2, 3, 4, 5])
  expect(slots.map(slot => slot.draft?.state.n ?? null)).toEqual([1, null, null, null, null])
  expect(parseTempSlots('not json', isState).every(slot => slot.draft === null)).toBe(true)
  expect(parseTempSlots(JSON.stringify([null, draft(2)]), isState)[1].draft?.label).toBe('plan 2')
})

it('keeps a per-tab stack of in-app pages for the back link', () => {
  let stack: string[] = []
  for (const path of ['/ko/planner/community', '/ko/planner/community/1', '/ko/planner/run']) stack = nextNavStack(stack, path)
  expect(stack).toHaveLength(3)
  // Going back pops, a re-render of the same page does nothing, a new page pushes.
  expect(nextNavStack(stack, '/ko/planner/community/1')).toEqual(['/ko/planner/community', '/ko/planner/community/1'])
  expect(nextNavStack(stack, '/ko/planner/run')).toEqual(stack)
  expect(nextNavStack(['/ko'], '/ko/decks')).toEqual(['/ko', '/ko/decks'])
})
