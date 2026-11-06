import { describe, expect, it } from 'vitest'
import { withLcbIdentitySlots } from '@/features/planner/lib/lcb'
import type { IdentityData, IdentitySlot } from '@/lib/planner/types'

const identity = (sinner_id: string, game_id: string): IdentityData => ({ id: sinner_id + game_id, sinner_id, name_kr: game_id, rarity: 1, keywords: [], game_id, folder_name: 'LCB Sinner' })

describe('withLcbIdentitySlots', () => {
  it('adds LCB identities only for sinners without a slot', () => {
    const identities = [identity('yi-sang', '10101'), identity('faust', '10201'), identity('faust', '10205')]
    const existing = [{ ...identity('faust', '10205'), identity_id: 'faust10205', keywords: [], slot_order: 0 } as unknown as IdentitySlot]
    const slots = withLcbIdentitySlots(identities, existing)
    expect(slots.map(slot => [slot.sinner_id, slot.game_id, slot.slot_order])).toEqual([['faust', '10205', 0], ['yi-sang', '10101', 99]])
  })
})
