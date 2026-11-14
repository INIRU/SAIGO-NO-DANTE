import { describe, expect, it } from 'vitest'
import { GIFT_KEYWORD_ORDER, fusionIngredientNames, toggleChecked, giftCheckKey, giftCheckMarks, moveItem, normalizeChecked, normalizeKeywordOrder } from '@/features/mirror-dungeon/lib/gift-check'
import type { EgoGift, EgoGiftTheme } from '@/features/mirror-dungeon/types'

const gift = (game_id: number, extra: Partial<EgoGift> = {}) => ({ id: `uuid-${game_id}`, game_id, name: `기프트 ${game_id}`, keyword: '공통', grade: '1', is_synthesis: false, ...extra }) as EgoGift
const theme = (id: number, lists: Partial<EgoGiftTheme>) => ({ id, name: `팩 ${id}`, ego_gift_ids: [], specific_ego_gift_ids: [], fixed_reward_gift_ids: null, image_url: null, ...lists }) as EgoGiftTheme

describe('obtained gifts are kept as a list of game ids', () => {
  it('a press records a gift and a second press takes it out', () => {
    const a = gift(9001), b = gift(9002)
    expect(giftCheckKey(a)).toBe('9001')
    const list = toggleChecked(toggleChecked([], giftCheckKey(a)), giftCheckKey(b))
    expect(list).toEqual(['9001', '9002'])
    expect(toggleChecked(list, '9001')).toEqual(['9002'])
  })

  it('obtaining a fusion gift also records every ingredient, through recipe variants and nested recipes', () => {
    const recipes = [
      { result_name: '진혼', ingredients: ['재', '먼지', '전서'] },
      { result_name: '진혼', ingredients: ['재', '먼지', '파라핀', '솥'] },
      { result_name: '전서', ingredients: ['파라핀', '솥'] },
    ]
    expect(fusionIngredientNames('진혼', recipes).sort()).toEqual(['먼지', '솥', '재', '전서', '파라핀'])
    expect(fusionIngredientNames('재', recipes)).toEqual([])
    expect(toggleChecked(['1'], '9', ['1', '2'])).toEqual(['1', '2', '9'])
    // Taking the fusion gift out again leaves its ingredients.
    expect(toggleChecked(['1', '2', '9'], '9', ['1', '2'])).toEqual(['1', '2'])
  })

  it('reads a stored list back without duplicates or foreign values', () => {
    expect(normalizeChecked(['9001', 9002, '9001', null, { id: 1 }])).toEqual(['9001', '9002'])
    expect(normalizeChecked('9001')).toEqual([])
    expect(normalizeChecked(null)).toEqual([])
  })
})

describe('fusion and pack-only marks', () => {
  it('marks fusion gifts and lists the packs a gift is only found in', () => {
    const plain = gift(1), fusion = gift(2, { is_synthesis: true }), exclusive = gift(3), reward = gift(4), sharedReward = gift(5)
    const packA = theme(1001, { ego_gift_ids: [1, 5], specific_ego_gift_ids: [3], fixed_reward_gift_ids: [4, 5] })
    const packB = theme(1002, { ego_gift_ids: [1], specific_ego_gift_ids: [3] })
    const marks = giftCheckMarks([plain, fusion, exclusive, reward, sharedReward], [packA, packB])
    expect(marks.get(plain.id)).toBeUndefined()
    expect(marks.get(fusion.id)).toEqual({ fusion: true, packs: [] })
    expect(marks.get(exclusive.id)).toEqual({ fusion: false, packs: [packA, packB] })
    // A clear reward counts only when no regular pool offers it.
    expect(marks.get(reward.id)?.packs).toEqual([packA])
    expect(marks.get(sharedReward.id)).toBeUndefined()
  })
})

describe('keyword order', () => {
  it('keeps a saved order, drops unknown keywords and appends missing ones in the default order', () => {
    expect(normalizeKeywordOrder(null)).toEqual([...GIFT_KEYWORD_ORDER])
    expect(normalizeKeywordOrder('파열')).toEqual([...GIFT_KEYWORD_ORDER])
    const saved = normalizeKeywordOrder(['파열', '없는 키워드', '공통', '파열', 7])
    expect(saved.slice(0, 2)).toEqual(['파열', '공통'])
    expect(saved.slice(2)).toEqual(GIFT_KEYWORD_ORDER.filter(key => key !== '파열' && key !== '공통'))
    expect([...saved].sort()).toEqual([...GIFT_KEYWORD_ORDER].sort())
  })

  it('moves one keyword to another place', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})
