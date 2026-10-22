import { expect, it } from 'vitest'
import { giftCount, pairCount, planGiftStats } from '../../../lib/meta/plan-gift-stats'

it('REQ-ASSIST-080 records which plans hold each gift, each once, and counts gifts and pairs from it', () => {
  const plans = [
    { inventory: ['final_1', 'start_2', 'final_1_plus', 'blessing_100_3'], floorPlan: [{ floor: 1, gift_ids: ['3', '1'] }] },
    { inventory: ['final_1', 'final_2'], floorPlan: null },
    { inventory: ['observe_1', 'final_2'], floorPlan: [{ floor: 2, gift_ids: ['3'] }] },
    { inventory: 'broken', floorPlan: [{ floor: 1, gift_ids: ['1', 'x'] }] },
    ...Array.from({ length: 6 }, () => ({ inventory: ['final_9'], floorPlan: null })),
  ]
  const stats = planGiftStats(plans)
  expect(stats.plans).toBe(10)
  expect(Object.keys(stats.holders).sort()).toEqual(['1', '2', '3', '9'])
  expect([1, 2, 3, 9, 7].map(id => giftCount(stats, id))).toEqual([4, 3, 2, 6, 0])
  expect(pairCount(stats, 1, 2)).toBe(3)
  expect(pairCount(stats, 2, 1)).toBe(3)
  expect(pairCount(stats, 3, 9)).toBe(0)
  expect(pairCount(stats, 1, 7)).toBe(0)
  // A plain object: it crosses the server–client boundary as JSON.
  expect(JSON.parse(JSON.stringify(stats))).toEqual(stats)
})
