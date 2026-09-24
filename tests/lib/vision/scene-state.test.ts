import { expect, it } from 'vitest'
import { eventExitAt, nextEventView } from '../../../lib/vision/scene-state'

const view = { eventId: 901007, observedAt: 1_000, floor: 1 }
const step = (current: typeof view | null, input: Partial<Parameters<typeof nextEventView>[1]>) =>
  nextEventView(current, { running: true, floor: 1, evidence: null, scene: { label: 'event', since: 500 }, now: 2_000, ...input })

it('keeps a confirmed event through OCR misses, expired evidence and its result page while the event scene lasts', () => {
  expect(step(null, { evidence: view })).toEqual(view)
  expect(step(view, { evidence: null, now: 60_000 })).toBe(view)
  expect(step(view, { evidence: view, now: 90_000 })).toBe(view)
  expect(step(view, { scene: { label: 'reward_choice', since: 5_000 }, now: 10_000 })).toBe(view)
})

it('follows newer evidence for another event and ignores older evidence', () => {
  const branch = { eventId: 90100701, observedAt: 3_000, floor: 1 }
  expect(step(view, { evidence: branch })).toEqual(branch)
  expect(step(branch, { evidence: view })).toBe(branch)
})

it('ends on a stable exit scene, floor change, stop or a long other scene, then reopens only from later evidence', () => {
  const exploration = { label: 'exploration', since: 4_000 }
  expect(step(view, { scene: exploration, now: 5_000 })).toBeNull()
  expect(step(null, { scene: exploration, evidence: view, now: 5_000 })).toBeNull()
  expect(step(null, { scene: exploration, evidence: { eventId: 901002, observedAt: 6_000, floor: 1 }, now: 6_500 }))
    .toEqual({ eventId: 901002, observedAt: 6_000, floor: 1 })
  expect(step(view, { floor: 2 })).toBeNull()
  expect(step(view, { running: false })).toBeNull()
  expect(step(view, { scene: { label: 'loading', since: 2_000 }, now: 20_000 })).toBeNull()
  expect(eventExitAt({ label: 'loading', since: 2_000 }, 10_000)).toBeNull()
  expect(eventExitAt({ label: 'theme_select', since: 2_000 }, 2_100)).toBe(2_000)
})
