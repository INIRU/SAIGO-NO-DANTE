import { describe, expect, it } from 'vitest'
import { maxObserved, observationCost, observationFrom } from '@/lib/planner/observation'

describe('mirror dungeon start observation', () => {
  it('reads the latest md_observation row: its gifts and stepped starlight prices', () => {
    const observation = observationFrom({ gift_ids: [9001, 9285], costs: [{ count: 1, starlight: 70 }, { count: 2, starlight: 160 }] })
    expect(observation.giftIds).toEqual([9001, 9285])
    expect([1, 2, 3].map(n => observationCost(observation, n))).toEqual([70, 160, 0])
    expect(maxObserved(observation)).toBe(2)
  })

  it('offers nothing while md_observation has no row (no bundled copy)', () => {
    const observation = observationFrom(null)
    expect(observation.giftIds).toEqual([])
    expect(maxObserved(observation)).toBe(0)
    expect(observationCost(observation, 1)).toBe(0)
  })
})
