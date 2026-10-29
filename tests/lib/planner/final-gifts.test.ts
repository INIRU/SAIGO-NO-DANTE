import { expect, it } from 'vitest'
import { deriveFinalGifts, finalEnhanceEdit, finalKeyForFloorPick, nextEnhanceLevel } from '@/lib/planner/final-gifts'
import { deriveBlockedFinalFusionMaterialIds } from '@/lib/planner/fusion'
import type { GiftData, RecipeData } from '@/lib/planner/types'

const names = ['억류된 찬송', '밀라르카', '치성', '연기와 철조망', '녹슨 입마개', '피안개', '달의 기억', '잘려나간 기억', '구멍난 기억', '안식처']
const giftMap = new Map(names.map((name, index) => [index + 1, { game_id: index + 1, name } as GiftData]))
const recipe = (result: string, ingredients: string[]) => ({ id: result, result_name: result, keyword: '', ingredients}) as RecipeData
// 피안개 has a direct and an expanded variant, as stored.
const recipes = [recipe('치성', ['억류된 찬송', '밀라르카']), recipe('피안개', ['연기와 철조망', '녹슨 입마개', '치성']),
  recipe('피안개', ['연기와 철조망', '녹슨 입마개', '억류된 찬송', '밀라르카']),
  recipe('달의 기억', ['잘려나간 기억', '구멍난 기억', '조각 중 택 2종'])]
const derive = (inventory: string[]) => deriveFinalGifts(inventory, recipes, giftMap).gifts

it('includes start and observed gifts once, with picks keeping their enhancement', () => {
  expect(derive(['start_10', 'observe_2', 'final_10_plus', 'final_4', 'observe_10'])).toEqual([
    { id: 10, level: 1, source: 'start' }, { id: 2, level: 0, source: 'observe' }, { id: 4, level: 0, source: 'final' }])
})

it('drops every ingredient a recipe result in the set consumes, auto-included ones too, through all variants', () => {
  expect(derive(['start_1', 'observe_2', 'final_3', 'final_4', 'final_10']).map(gift => gift.id)).toEqual([3, 4, 10])
  expect(derive(['start_1', 'final_4', 'final_5', 'final_6_plus']).map(gift => gift.id)).toEqual([6])
  expect(deriveBlockedFinalFusionMaterialIds({ selectedFinalGiftIds: [6], recipes: recipes.slice(1).reverse(), giftMap })).toEqual(new Set([1, 2, 3, 4, 5]))
})

it('keeps the fragments of 달의 기억', () => {
  expect(derive(['observe_8', 'final_9', 'final_7']).map(gift => gift.id)).toEqual([8, 9, 7])
})

it('REQ-PLANNER-018 lets a floor plan a material the final fusion result consumes, without making it a final gift', () => {
  const final = deriveFinalGifts(['final_6', 'final_10'], recipes, giftMap)
  // 억류된 찬송(1) and 녹슨 입마개(5) feed 피안개(6): planned on a floor, never a final gift.
  expect(finalKeyForFloorPick(1, final)).toBeNull()
  expect(finalKeyForFloorPick(5, final)).toBeNull()
  expect(finalKeyForFloorPick(10, final)).toBeNull()
  expect(finalKeyForFloorPick(7, final)).toBe('final_7')
})

it('edits the stored final_ key for enhancement, adding one only for auto-included gifts', () => {
  expect(finalEnhanceEdit(['final_4'], { id: 4, level: 0, source: 'final' }, 2)).toEqual({ oldId: 'final_4', newId: 'final_4_plusplus' })
  expect(finalEnhanceEdit(['start_10'], { id: 10, level: 0, source: 'start' }, 1)).toEqual({ oldId: undefined, newId: 'final_10_plus' })
  expect(finalEnhanceEdit(['start_10', 'final_10_plus'], { id: 10, level: 1, source: 'start' }, 0)).toEqual({ oldId: 'final_10_plus', newId: undefined })
  expect(nextEnhanceLevel({ effect_plus: 'a', effect_plusplus: 'b' }, 2)).toBe(0)
  expect(nextEnhanceLevel({ effect_plus: 'a', effect_plusplus: null }, 1)).toBe(0)
  expect(nextEnhanceLevel({ effect_plus: null, effect_plusplus: null }, 0)).toBe(0)
})
