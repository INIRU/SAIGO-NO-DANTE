import { expect, it } from 'vitest'
import { recipeOwnedGiftIds } from '@/lib/planner/fusion'
import type { GiftData, RecipeData } from '@/lib/planner/types'

const gift = (game_id: number, name: string) => ({ game_id, name }) as GiftData
const giftMap = new Map([[1, '억류된 찬송'], [2, '밀라르카'], [3, '치성'], [4, '연기와 철조망'], [5, '녹슨 입마개'], [6, '피안개'], [7, '달의 기억'], [8, '안식처']]
  .map(([id, name]) => [id as number, gift(id as number, name as string)]))
const recipe = (result: string, ingredients: string[]) => ({ id: result, result_name: result, keyword: '출혈', ingredients, final_result: result }) as RecipeData
// Recipes as stored (2026-09-24 DB): 피안개 has a direct and an expanded variant.
const recipes = [recipe('치성', ['억류된 찬송', '밀라르카']), recipe('피안개', ['연기와 철조망', '녹슨 입마개', '치성']),
  recipe('피안개', ['연기와 철조망', '녹슨 입마개', '억류된 찬송', '밀라르카'])]

it('counts every ingredient of an owned recipe result as owned, through nested recipes', () => {
  expect([...recipeOwnedGiftIds(['6'], recipes, giftMap)].sort()).toEqual([1, 2, 3, 4, 5, 6])
  expect([...recipeOwnedGiftIds(['3_plus', '8'], recipes, giftMap)].sort()).toEqual([1, 2, 3, 8])
  // Ingredients alone, or a mixed fusion result with no fixed recipe, imply nothing more.
  expect([...recipeOwnedGiftIds(['1', '2'], recipes, giftMap)].sort()).toEqual([1, 2])
  expect([...recipeOwnedGiftIds(['7'], recipes, giftMap)]).toEqual([7])
})
