import { expect, it } from 'vitest'
import { MAX_OBSERVED_GIFTS, OBSERVATION_GIFT_IDS, observationCost } from '@/lib/planner/observation'

it('offers only the game\'s observation gifts at its stepped starlight prices', () => {
  expect([1, 2, 3].map(observationCost)).toEqual([70, 160, 270])
  expect(MAX_OBSERVED_GIFTS).toBe(3)
  expect(OBSERVATION_GIFT_IDS.size).toBeGreaterThan(300)
  // A tier II pool gift is observable; the afterimage and an extreme pack reward are not.
  expect(OBSERVATION_GIFT_IDS.has(9001)).toBe(true)
  expect(OBSERVATION_GIFT_IDS.has(9991)).toBe(false)
  expect(OBSERVATION_GIFT_IDS.has(9250)).toBe(false)
})
