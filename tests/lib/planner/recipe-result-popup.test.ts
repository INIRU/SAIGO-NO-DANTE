import { expect, it } from 'vitest'
import { recipeIngredientsInInventory, resolveRecipeResult } from '@/lib/planner/fusion'
import { popupCandidateIds } from '@/lib/vision/popup-evidence'
import type { GiftData, RecipeData } from '@/lib/planner/types'

// Recipes as stored (2026-09-24 DB). Their results look like their ingredients: 회중시계 : 타입 E vs 은빛 시계 케이스 0.965,
// 탁마 vs another blade 0.911 in the icon index, so a result popup's name and icon disagree and it abstains.
const names: [number, string][] = [[9721, '은빛 시계 케이스'], [9722, '빛바랜 시계 케이스'], [9723, '에칭 시계침'], [9724, '녹슨 시계침'],
  [9728, '회중시계 : 타입 L'], [9729, '회중시계 : 타입 E'], [9730, '회중시계 : 타입 Y'], [9731, '회중시계 : 타입 P'],
  [9701, '부서진 칼날'], [9702, '낡은 칼자루'], [9784, '탁마'], [9277, '비슷한 칼'], [9001, '평범한 기프트']]
const giftMap = new Map(names.map(([game_id, name]) => [game_id, { game_id, name } as GiftData]))
const recipe = (result: string, ingredients: string[]) => ({ id: result, result_name: result, keyword: '', ingredients, final_result: result }) as RecipeData
const recipes = [recipe('회중시계 : 타입 L', ['은빛 시계 케이스', '에칭 시계침']), recipe('회중시계 : 타입 E', ['은빛 시계 케이스', '녹슨 시계침']),
  recipe('회중시계 : 타입 Y', ['빛바랜 시계 케이스', '에칭 시계침']), recipe('회중시계 : 타입 P', ['빛바랜 시계 케이스', '녹슨 시계침']),
  recipe('탁마', ['부서진 칼날', '낡은 칼자루'])]

it('finds the held ingredients a fixed-recipe result consumes', () => {
  expect(recipeIngredientsInInventory(9728, ['9001', '9723_plus', '9721'], recipes, giftMap)).toEqual(['9721', '9723_plus'])
  expect(recipeIngredientsInInventory(9729, ['9721', '9723'], recipes, giftMap)).toBeNull()
  expect(recipeIngredientsInInventory(9001, ['9721', '9723'], recipes, giftMap)).toBeNull()
})

it('settles a conflicting result popup to the only recipe result the inventory can make', () => {
  const inventory = ['9721', '9723', '9701', '9702']
  // Name read 타입 L, icon matched its case: only 타입 L is craftable.
  expect(resolveRecipeResult(['9728', '9721'], inventory, recipes, giftMap, false)).toBe('9728')
  // A short 탁마 read plus a look-alike icon.
  expect(resolveRecipeResult(['9784', '9277'], inventory, recipes, giftMap, false)).toBe('9784')
  // Only the ingredient's look-alike icon: on the fusion screen, the only craftable recipe using that held ingredient.
  expect(resolveRecipeResult(['9721'], inventory, recipes, giftMap, true)).toBe('9728')
  expect(resolveRecipeResult(['9721'], inventory, recipes, giftMap, false)).toBeNull()
  // Two craftable results, a result already held, or no recipe candidate stay unresolved.
  expect(resolveRecipeResult(['9721'], [...inventory, '9724'], recipes, giftMap, true)).toBeNull()
  expect(resolveRecipeResult(['9728', '9729'], [...inventory, '9724'], recipes, giftMap, false)).toBeNull()
  expect(resolveRecipeResult(['9728'], [...inventory, '9728'], recipes, giftMap, true)).toBeNull()
  expect(resolveRecipeResult(['9001', '9277'], inventory, recipes, giftMap, true)).toBeNull()
  expect(resolveRecipeResult([], inventory, recipes, giftMap, true)).toBeNull()
})

it('collects every gift a result popup points at, weak reads included, only under its header', () => {
  const gifts = names.map(([id, name]) => ({ id: String(id), texts: [name] }))
  const read = (text: string, confidence = 40) => ({ text, words: [{ text, confidence, left: 0, top: 0, width: 1, height: 1 }] })
  const header = 'E.G.O 기프트를 획득했습니다.'
  expect(popupCandidateIds({ header, labels: [read('탁마')], iconGiftIds: ['9277'], effectGiftIds: [], gifts }).sort()).toEqual(['9277', '9784'])
  expect(popupCandidateIds({ header, labels: [read('회중시계:타입L')], iconGiftIds: ['9721', 'unknown'], effectGiftIds: ['9728'], gifts }).sort())
    .toEqual(['9721', '9728'])
  expect(popupCandidateIds({ header: '합성', labels: [read('탁마')], iconGiftIds: ['9277'], effectGiftIds: [], gifts })).toEqual([])
})
