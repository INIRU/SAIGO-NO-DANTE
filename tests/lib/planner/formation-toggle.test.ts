import { describe, expect, it } from 'vitest'
import { toggleFormationSlot } from '@/lib/planner/formation-toggle'
import type { IdentitySlot } from '@/lib/planner/types'

const slot = (sinner_id: string, slot_order: number) => ({ identity_id: 'i' + sinner_id, sinner_id, name_kr: sinner_id, rarity: 3, keywords: [], game_id: null, folder_name: null, slot_order }) as IdentitySlot
const orders = (slots: IdentitySlot[]) => Object.fromEntries(slots.map(item => [item.sinner_id, item.slot_order]))

describe('REQ-PLANNER-052 toggleFormationSlot', () => {
  it('REQ-PLANNER-052 pulls the later formation numbers up when a slot goes to the bench', () => {
    const slots = [slot('a', 0), slot('b', 1), slot('c', 2), slot('d', 99)]
    expect(orders(toggleFormationSlot(slots, 'a'))).toEqual({ a: 99, b: 0, c: 1, d: 99 })
    expect(orders(toggleFormationSlot(slots, 'b'))).toEqual({ a: 0, b: 99, c: 1, d: 99 })
  })

  it('REQ-PLANNER-052 puts a benched slot at the end of the formation', () => {
    const slots = [slot('a', 0), slot('b', 1), slot('d', 99)]
    expect(orders(toggleFormationSlot(slots, 'd'))).toEqual({ a: 0, b: 1, d: 2 })
  })

  it('REQ-PLANNER-052 leaves the slots alone for an unknown sinner and does not mutate the input', () => {
    const slots = [slot('a', 0), slot('b', 1)]
    expect(toggleFormationSlot(slots, 'x')).toBe(slots)
    toggleFormationSlot(slots, 'a')
    expect(orders(slots)).toEqual({ a: 0, b: 1 })
  })
})

describe('run deck log', () => {
  it('REQ-PLANNER-052 a formation number change of the same identity is not logged as a swap', async () => {
    const { createInitialRunState, runReducer } = await import('@/features/planner/lib/run-types')
    const slot = { sinner_id: 's1', identity_id: 'i1', name_kr: '가', slot_order: 0 } as never
    const start = { ...createInitialRunState(), identitySlots: [slot] }
    const moved = runReducer(start, { type: 'SWAP_IDENTITY', sinnerId: 's1', newSlot: { ...(slot as object), slot_order: 99 } as never })
    expect(moved.identitySlots[0].slot_order).toBe(99)
    expect(moved.floorLogs.flatMap(log => log.deckChanges)).toEqual([])
    const swapped = runReducer(start, { type: 'SWAP_IDENTITY', sinnerId: 's1', newSlot: { ...(slot as object), identity_id: 'i2', name_kr: '나' } as never })
    expect(swapped.floorLogs.flatMap(log => log.deckChanges)).toHaveLength(1)
  })
})
