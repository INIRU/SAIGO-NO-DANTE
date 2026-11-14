import { describe, expect, it } from 'vitest'
import {
  findAvailableFusions, giftTier, mixedFusionKeys, mixedResultFromMaterials, randomFusionTier,
  recipeFromMaterials, recipeIngredientIds, recipeIngredientsInInventory, recipeResultId, settleResultPopup,
} from '@/lib/planner/fusion'
import { sellPriceFits, readSaleStep, EMPTY_SALE_STATE } from '@/features/assist/lib/sell-evidence'
import type { GiftData, RecipeData } from '@/lib/planner/types'

const gift = (game_id: number, name: string, grade = '1') => [game_id, { game_id, name, grade } as GiftData] as const

describe('recipes by id', () => {
  // Two gifts share a name: names cannot tell the recipe's ingredient from the other one, ids can.
  const giftMap = new Map([gift(1, '조각'), gift(2, '조각'), gift(3, '받침'), gift(4, '결과')])
  const byName = { id: 'r', result_name: '결과', keyword: '', ingredients: ['조각', '받침'] } as RecipeData
  const byId = { ...byName, ingredient_ids: [1, 3], result_id: 4 } as RecipeData

  it('reads ids when stored and names otherwise', () => {
    const idByName = new Map([['조각', 2], ['받침', 3], ['결과', 4]])
    expect(recipeIngredientIds(byName, idByName)).toEqual([2, 3])
    expect(recipeIngredientIds(byId, idByName)).toEqual([1, 3])
    expect(recipeIngredientIds({ ...byId, ingredient_ids: [1] } as RecipeData, idByName)).toEqual([2, 3]) // length mismatch: names
    expect(recipeResultId(byId, new Map())).toBe(4)
    expect(recipeResultId(byName, new Map([['결과', 9]]))).toBe(9)
  })

  it('crafts from the stored ids even when names collide', () => {
    expect(recipeIngredientsInInventory(4, ['1', '3'], [byId], giftMap)).toEqual(['1', '3'])
    expect(recipeIngredientsInInventory(4, ['2', '3'], [byId], giftMap)).toBeNull()
    expect(findAvailableFusions(['1', '3'], [byId], giftMap)[0]).toMatchObject({ canCraft: true, result: { game_id: 4 } })
    expect(recipeFromMaterials(['1', '3'], [], [byId], giftMap)).toBeNull() // 4 not held, but materials not in inventory
    expect(recipeFromMaterials(['1', '3'], ['1', '3'], [byId], giftMap)).toBe('4')
  })
})

describe('mixed fusion (달의 기억)', () => {
  const owned = ['9105', '9110', '9116', '9142', '9147', '9152']
  it('recognises 2 of group A and 3 of group B', () => {
    expect(mixedResultFromMaterials(['9105', '9116', '9142', '9147', '9152'])).toBe(9083)
    expect(mixedResultFromMaterials(['9105', '9116', '9117', '9147', '9152'])).toBeNull()
    expect(mixedResultFromMaterials(['9105', '9105', '9142', '9147', '9152'])).toBeNull()
  })
  it('picks the held materials, read ones first', () => {
    expect(mixedFusionKeys(9083, owned, ['9116'])).toEqual(['9116', '9105', '9142', '9147', '9152'])
    expect(mixedFusionKeys(9083, ['9105', '9142'])).toBeNull()
    const giftMap = new Map([gift(9083, '달의 기억', '3')])
    expect(recipeFromMaterials(['9105', '9110', '9142', '9147', '9152'], owned.concat('9147', '9152'), [], giftMap)).toBe('9083')
    expect(recipeFromMaterials(['9105', '9110', '9142', '9147', '9152'], ['9105', '9110', '9142', '9147', '9152', '9083'], [], giftMap)).toBeNull() // already held
    expect(recipeIngredientsInInventory(9083, owned, [], giftMap)).toEqual(['9105', '9110', '9142', '9147', '9152'])
  })
})

describe('random fusion tier check', () => {
  it('maps material tiers to the result tier like combineTwo / combineThree', () => {
    expect(randomFusionTier([1, 1])).toBe(1)
    expect(randomFusionTier([1, 3])).toBe(2)
    expect(randomFusionTier([3, 3])).toBe(3)
    expect(randomFusionTier([2, 3, 3])).toBe(4)
    expect(randomFusionTier([2, 2, 2])).toBe(3)
    expect(randomFusionTier([2, 2, 2], true)).toBe(3)
    expect(randomFusionTier([2, 2, 1])).toBe(2) // 15
    expect(randomFusionTier([2, 2, 1], true)).toBe(3) // 15 reaches the enhanced tier 3
    expect(randomFusionTier([1])).toBeNull()
    expect(giftTier({ grade: 'EX' })).toBe(5)
    expect(giftTier({ grade: null })).toBeNull()
  })

  it('drops a look-alike verdict of the wrong tier, keeps a named one', () => {
    const giftMap = new Map([gift(10, 'a', '1'), gift(11, 'b', '1'), gift(20, '결과1', '1'), gift(21, '결과4', '4')])
    const evidence = (named: string[]) => ({ named, others: ['21'], materials: ['10', '11'], materialCount: 2 })
    expect(settleResultPopup(evidence([]), '21', ['10', '11'], [], giftMap, true)).toBeNull()
    expect(settleResultPopup(evidence([]), '20', ['10', '11'], [], giftMap, true)).toBe('20')
    expect(settleResultPopup(evidence(['21']), '21', ['10', '11'], [], giftMap, true)).toBe('21')
    // not all materials read: no check
    expect(settleResultPopup({ ...evidence([]), materialCount: 3 }, '21', ['10', '11'], [], giftMap, true)).toBe('21')
  })
})

describe('price checks', () => {
  it('fits a sale price to the gift price, passing when unknown', () => {
    expect(sellPriceFits(50, 100)).toBe(true)
    expect(sellPriceFits(150, 300)).toBe(true)
    expect(sellPriceFits(7, 300)).toBe(false)
    expect(sellPriceFits(9999, 300)).toBe(false)
    expect(sellPriceFits(7, null)).toBe(true)
  })

  it('does not open a sale whose dialog price cannot be the gift\'s', () => {
    const read = (price: number) => readSaleStep(EMPTY_SALE_STATE, { at: 1000, text: `[어두운 잔영]을(를) 코스트 ${price}에 판매하시겠습니까?`,
      cost: ['233'], giftId: () => '9991', giftPrice: () => 100 })
    expect(read(50).state.pending).toMatchObject({ giftId: '9991', price: 50 })
    expect(read(5000).state.pending).toBeNull()
  })
})
