import { expect, it } from 'vitest'
import { START_GIFT_IDS } from '@/lib/planner/start-gifts'

it('REQ-PLANNER-022 offers the game\'s start gifts: three for each of the ten keywords', () => {
  expect(START_GIFT_IDS.size).toBe(30)
  // Rupture: Barbed Lasso, Fluorescent Lamp, Smoking Gunpowder. The hand-written list had Thorny Rope Cuffs (9169) for the lamp.
  expect([9047, 9093, 9117].every(id => START_GIFT_IDS.has(id))).toBe(true)
  expect(START_GIFT_IDS.has(9169)).toBe(false)
})
