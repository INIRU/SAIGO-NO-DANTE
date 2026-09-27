import { describe, expect, it } from 'vitest'
import { getGiftsFromThemes } from '@/lib/planner/fusion'
import type { GiftData } from '@/lib/planner/types'

describe('floor gift list', () => {
  it('includes a pack\'s boss reward even when its general pool leaves it out (boss rush packs 1511–1520)', () => {
    const gift = (game_id: number) => ({ game_id, name: String(game_id) }) as GiftData
    const giftMap = new Map([9001, 9002, 9903].map(id => [id, gift(id)]))
    const theme = { id: '1511', ego_gift_ids: [9001], specific_ego_gift_ids: [9002], fixed_reward_gift_ids: [9903] }
    expect(getGiftsFromThemes([theme.id], [theme], giftMap).map(g => g.game_id).sort()).toEqual([9001, 9002, 9903])
  })
})
