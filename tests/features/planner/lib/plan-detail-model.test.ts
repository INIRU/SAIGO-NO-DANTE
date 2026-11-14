import { describe, expect, it } from 'vitest'
import type { GiftData, RecipeData } from '@/lib/planner/types'
import type { MdEventChoice } from '@/features/mirror-dungeon'
import {
  buildConditionSlots, buildEgoGiftLookup, buildGiftByName, buildRecipeMap, buildSlotGiftMap, groupChoicesByEventId, parseFormationSlots,
  pickFinalGifts, pickInventoryGifts,
} from '@/features/planner/lib/plan-detail-model'

const gift = (game_id: number, over: Partial<GiftData> = {}) => ({ game_id, name: `g${game_id}`, image_url: `img${game_id}`, keyword: 'k', grade: '2', effect_base: 'base', ...over }) as unknown as GiftData
const gifts = [gift(1), gift(2), gift(3), gift(4, { keyword: '' }), gift(5, { name: '' })]
const giftMap = new Map(gifts.map(g => [g.game_id, g]))

describe('parseFormationSlots', () => {
  it('reads the numbers of the formation-only label, nothing without one', () => {
    expect(parseFormationSlots(null)).toEqual([])
    expect(parseFormationSlots('')).toEqual([])
    expect(parseFormationSlots('일반 효과')).toEqual([])
    expect(parseFormationSlots('[편성 1, 2번 전용 효과] 공격력 증가')).toEqual([1, 2])
    expect(parseFormationSlots('[3번 편성 전용 효과]')).toEqual([3])
    expect(parseFormationSlots('<color=#ff0>[편성 4번 전용 효과]</color>')).toEqual([4])
  })
})

describe('recipes and lookups', () => {
  it('finds gifts by name; the last one with a name wins', () => {
    const byName = buildGiftByName([gift(1, { name: 'x' }), gift(2, { name: 'x' })])
    expect(byName.get('x')?.game_id).toBe(2)
  })

  it('maps a recipe\'s result to its known materials and skips an unknown result', () => {
    const recipes = [
      { id: 'r1', result_name: 'g3', keyword: 'k', ingredients: ['g1', 'nope', 'g2'] },
      { id: 'r2', result_name: 'missing', keyword: 'k', ingredients: ['g1'] },
    ] as unknown as RecipeData[]
    const out = buildRecipeMap(recipes, buildGiftByName(gifts))
    expect([...out.keys()]).toEqual([3])
    expect(out.get(3)?.materials.map(g => g.game_id)).toEqual([1, 2])
    expect(out.get(3)?.result.game_id).toBe(3)
  })

  it('lists the gifts with a name and a keyword for notes', () => {
    const out = buildEgoGiftLookup([...gifts, gift(6, { grade: null as unknown as string })])
    expect(Object.keys(out)).toEqual(['g1', 'g2', 'g3', 'g6'])
    expect(out.g1).toEqual({ name: 'g1', keyword: 'k', grade: '2', image_url: 'img1', effect_base: 'base' })
    expect(out.g6.grade).toBe('1')
  })

  it('groups the event choices by event, keeping their order', () => {
    const c = (id: number, event_id: number) => ({ id, event_id }) as unknown as MdEventChoice
    const out = groupChoicesByEventId([c(1, 10), c(2, 20), c(3, 10)])
    expect(out.get(10)?.map(x => x.id)).toEqual([1, 3])
    expect(out.get(20)?.map(x => x.id)).toEqual([2])
    expect(groupChoicesByEventId([]).size).toBe(0)
  })
})

describe('inventory', () => {
  const inventory = ['observe_1', 'start_2', 'observe_99', 'final_3', 'final_1_plus', 'final_2_plusplus', 'final_77', 'other_1', 'start_x']

  it('picks the observe and start gifts in inventory order, dropping unknown ids', () => {
    expect(pickInventoryGifts(inventory, 'observe_', giftMap).map(g => g.game_id)).toEqual([1])
    expect(pickInventoryGifts(inventory, 'start_', giftMap).map(g => g.game_id)).toEqual([2])
    expect(pickInventoryGifts([], 'start_', giftMap)).toEqual([])
  })

  it('reads the enhance level of the final gifts from the suffix', () => {
    expect(pickFinalGifts(inventory, giftMap).map(f => [f.gift.game_id, f.enhance])).toEqual([[3, 0], [1, 1], [2, 2]])
  })

  it('maps formation slots to the images of the final gifts that read the enhanced text', () => {
    const a = gift(1, { effect_base: '[편성 1, 2번 전용 효과]', effect_plus: '일반', effect_plusplus: '[편성 2번 전용 효과]', image_url: 'A' })
    const b = gift(2, { effect_base: '[편성 2번 전용 효과]', image_url: null as unknown as string })
    const c = gift(3, { effect_base: '[편성 5번 전용 효과]', image_url: 'C' })
    const out = buildSlotGiftMap([{ gift: a, enhance: 0 }, { gift: a, enhance: 1 }, { gift: a, enhance: 2 }, { gift: b, enhance: 0 }, { gift: c, enhance: 0 }])
    expect([...out.entries()]).toEqual([[1, ['A']], [2, ['A', 'A']], [5, ['C']]])
    expect(buildSlotGiftMap([]).size).toBe(0)
  })
})

describe('buildConditionSlots', () => {
  it('keeps slots with an identity and a sinner and fills the defaults', () => {
    const out = buildConditionSlots([
      { identity_id: 'a', sinner_id: 's1', name_kr: '가', rarity: 3, keywords: ['화상'], skill_keyword_list: ['화상'], game_id: '1', folder_name: 'f', slot_order: 2 },
      { identity_id: 'b', sinner_id: 's2' },
      { identity_id: 'c' },
      { sinner_id: 's3' },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ identity_id: 'a', sinner_id: 's1', name_kr: '가', rarity: 3, keywords: ['화상'], skill_keyword_list: ['화상'], game_id: '1', folder_name: 'f', slot_order: 2 })
    expect(out[1]).toEqual({ identity_id: 'b', sinner_id: 's2', name_kr: '', rarity: 1, keywords: [], skill_keyword_list: undefined, game_id: null, folder_name: null, slot_order: 99 })
  })
})
