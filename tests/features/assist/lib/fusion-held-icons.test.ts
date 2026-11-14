import { expect, it } from 'vitest'
import { heldSlotRead } from '@/features/assist/lib/icon-match'

it('measures a material slot against held gifts when the best catalog icon is held', () => {
  // Replay 9/21 #6: 9072 read at 0.65 with a lookalike 0.15 behind; the lookalike is not held.
  const all = [{ id: '9072', score: 0.65 }, { id: '9300', score: 0.5 }, { id: '9001', score: 0.3 }]
  const held = [{ id: '9072', score: 0.65 }, { id: '9001', score: 0.3 }]
  expect(heldSlotRead(all, held)).toMatchObject({ id: '9072', score: 0.65 })
  expect(heldSlotRead(all, held)!.margin).toBeCloseTo(0.35)
  // Only one held gift near: its margin is against nothing.
  expect(heldSlotRead(all, [{ id: '9072', score: 0.65 }])).toEqual({ id: '9072', score: 0.65, margin: 1.65 })
})

it('keeps the catalog read when an unheld icon is best or nothing is held', () => {
  const all = [{ id: '9300', score: 0.9 }, { id: '9072', score: 0.6 }]
  expect(heldSlotRead(all, [{ id: '9072', score: 0.6 }])).toEqual({ id: '9300', score: 0.9, margin: 0.30000000000000004 })
  // Even a held lookalike just behind an unheld best does not take the slot (the inventory may miss the real material).
  expect(heldSlotRead([{ id: '9300', score: 0.67 }, { id: '9072', score: 0.66 }], [{ id: '9072', score: 0.66 }])?.id).toBe('9300')
  expect(heldSlotRead(all, [])).toEqual({ id: '9300', score: 0.9, margin: 0.30000000000000004 })
  expect(heldSlotRead([], [])).toBeNull()
})
