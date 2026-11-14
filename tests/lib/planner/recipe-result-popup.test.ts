import { expect, it } from 'vitest'
import { recipeFromMaterials, recipeFusionMaterials, recipeIngredientsInInventory, resolveRecipeResult, settleResultPopup } from '@/lib/planner/fusion'
import { popupCandidateIds } from '@/features/assist/lib/popup-evidence'
import type { GiftData, RecipeData } from '@/lib/planner/types'

// Recipes as stored (2026-09-24 DB). Their results look like their ingredients: 회중시계 : 타입 E vs 은빛 시계 케이스 0.965,
// 탁마 vs another blade 0.911 in the icon index, so a result popup's name and icon disagree and it abstains.
const names: [number, string][] = [[9721, '은빛 시계 케이스'], [9722, '빛바랜 시계 케이스'], [9723, '에칭 시계침'], [9724, '녹슨 시계침'],
  [9728, '회중시계 : 타입 L'], [9729, '회중시계 : 타입 E'], [9730, '회중시계 : 타입 Y'], [9731, '회중시계 : 타입 P'],
  [9701, '부서진 칼날'], [9702, '낡은 칼자루'], [9784, '탁마'], [9277, '비슷한 칼'], [9001, '평범한 기프트']]
const giftMap = new Map(names.map(([game_id, name]) => [game_id, { game_id, name } as GiftData]))
const recipe = (result: string, ingredients: string[]) => ({ id: result, result_name: result, keyword: '', ingredients}) as RecipeData
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
  const ev = (named: string[], others: string[] = [], materials: string[] = []) => ({ named, others, materials })
  // Name read 타입 L, icon matched its case: only 타입 L is craftable.
  expect(resolveRecipeResult(ev(['9728'], ['9721']), inventory, recipes, giftMap, false)).toBe('9728')
  // A short 탁마 read plus a look-alike icon.
  expect(resolveRecipeResult(ev(['9784'], ['9277']), inventory, recipes, giftMap, false)).toBe('9784')
  // Only the ingredient's look-alike icon: on the fusion screen, the only craftable recipe using that held ingredient.
  expect(resolveRecipeResult(ev([], ['9721']), inventory, recipes, giftMap, true)).toBe('9728')
  expect(resolveRecipeResult(ev([], ['9721']), inventory, recipes, giftMap, false)).toBeNull()
  // A result already held, or no recipe candidate, stay unresolved.
  expect(resolveRecipeResult(ev(['9728']), [...inventory, '9728'], recipes, giftMap, true)).toBeNull()
  expect(resolveRecipeResult(ev([], ['9001', '9277']), inventory, recipes, giftMap, true)).toBeNull()
  expect(resolveRecipeResult(ev([]), inventory, recipes, giftMap, true)).toBeNull()
})

it('tells look-alike recipe results apart when every case and hand is held', () => {
  // Both cases and both hands: all four 회중시계 types are craftable.
  const all = ['9721', '9722', '9723', '9724']
  const ev = (named: string[], others: string[] = [], materials: string[] = []) => ({ named, others, materials })
  // The plate names one type exactly; a sibling's look-alike icon does not override it.
  expect(resolveRecipeResult(ev(['9728'], ['9729']), all, recipes, giftMap, true)).toBe('9728')
  // No name: the icons alone name two types, and the case alone fits two recipes.
  expect(resolveRecipeResult(ev([], ['9728', '9729']), all, recipes, giftMap, true)).toBeNull()
  expect(resolveRecipeResult(ev([], ['9721']), all, recipes, giftMap, true)).toBeNull()
  // Materials read on the dialog decide: 은빛 케이스 + 녹슨 시계침 is 타입 E; one read material still narrows the icon's pair.
  expect(resolveRecipeResult(ev([], ['9721'], ['9721', '9724']), all, recipes, giftMap, true)).toBe('9729')
  expect(resolveRecipeResult(ev([], ['9728', '9729'], ['9724']), all, recipes, giftMap, true)).toBe('9729')
  // Materials that fit several recipes equally stay unresolved.
  expect(resolveRecipeResult(ev([], ['9721'], ['9721']), all, recipes, giftMap, true)).toBeNull()
})

it('collects every gift a result popup points at, weak reads included, only under its header', () => {
  const gifts = names.map(([id, name]) => ({ id: String(id), texts: [name] }))
  const read = (text: string, confidence = 40) => ({ text, words: [{ text, confidence, left: 0, top: 0, width: 1, height: 1 }] })
  const header = 'E.G.O 기프트를 획득했습니다.'
  expect(popupCandidateIds({ header, labels: [read('탁마')], iconGiftIds: ['9277'], effectGiftIds: [], gifts })).toEqual({ named: ['9784'], others: ['9277'] })
  expect(popupCandidateIds({ header, labels: [read('회중시계:타입L')], iconGiftIds: ['9721', 'unknown'], effectGiftIds: ['9728'], gifts }))
    .toEqual({ named: ['9728'], others: ['9721'] })
  expect(popupCandidateIds({ header: '합성', labels: [read('탁마')], iconGiftIds: ['9277'], effectGiftIds: [], gifts })).toEqual({ named: [], others: [] })
})

it('settles a misread fusion result from its weak lexicon name when only that recipe is craftable', () => {
  // Sample 2026-09-25 f7af0303: plate OCR "회중시계:라임트", lexicon best 타입 E by 7.6 nats (below the 9-nat bar), no icon.
  const gifts = names.map(([id, name]) => ({ id: String(id), texts: [name] }))
  const header = 'E.G.O 기프트를 획득했습니다.'
  const labels = [{ text: '회중시계:라임트', words: [] }]
  const evidence = popupCandidateIds({ header, labels, iconGiftIds: [], effectGiftIds: [], lexiconGiftIds: ['9729'], gifts })
  expect(evidence).toEqual({ named: [], others: ['9729'] })
  // Both cases and both hands held (타입 Y was fused right after): the weak name picks 타입 E among four craftable types.
  expect(settleResultPopup(evidence, null, ['9721', '9722', '9723', '9724'], recipes, giftMap, true)).toBe('9729')
  // Not craftable from the inventory: stays unresolved.
  expect(settleResultPopup(evidence, null, ['9722', '9723'], recipes, giftMap, true)).toBeNull()
  // No header: no candidates at all.
  expect(popupCandidateIds({ header: '합성', labels, iconGiftIds: [], effectGiftIds: [], lexiconGiftIds: ['9729'], gifts }))
    .toEqual({ named: [], others: [] })
})

it('takes a fusion of exactly one recipe\'s ingredients as that recipe\'s result, its only source', () => {
  const all = ['9721', '9722', '9723', '9724', '9001']
  const ev = (named: string[], others: string[] = [], materials: string[] = []) => ({ named, others, materials })
  expect(recipeFromMaterials(['9724', '9721'], all, recipes, giftMap)).toBe('9729')
  expect(recipeFromMaterials(['9721', '9724', '9001'], all, recipes, giftMap)).toBeNull()
  expect(recipeFromMaterials(['9721'], all, recipes, giftMap)).toBeNull()
  expect(recipeFromMaterials(['9721', '9724'], ['9721'], recipes, giftMap)).toBeNull()
  // Exact recipe materials win over an unreadable popup or a look-alike sibling icon, not over an exactly read plate.
  expect(settleResultPopup(ev([], [], ['9721', '9724']), null, all, recipes, giftMap, true)).toBe('9729')
  expect(settleResultPopup(ev([], ['9728'], ['9721', '9724']), '9728', all, recipes, giftMap, true)).toBe('9729')
  expect(settleResultPopup(ev(['9728'], [], ['9721', '9724']), '9728', all, recipes, giftMap, true)).toBe('9728')
  // An ordinary gift's verdict stands.
  expect(settleResultPopup(ev(['9001']), '9001', all, recipes, giftMap, false)).toBe('9001')
  // An unnamed recipe result the inventory cannot make: another craftable candidate, or dropped off the fusion screen.
  const caseOnly = ['9721', '9723']
  expect(settleResultPopup(ev([], ['9729', '9728']), '9729', caseOnly, recipes, giftMap, true)).toBe('9728')
  expect(settleResultPopup(ev([], ['9731']), '9731', caseOnly, recipes, giftMap, false)).toBeNull()
  expect(settleResultPopup(ev([], ['9731']), '9731', caseOnly, recipes, giftMap, true)).toBe('9731')
  // A named recipe result stands even when its ingredients were never recorded.
  expect(settleResultPopup(ev(['9731']), '9731', caseOnly, recipes, giftMap, false)).toBe('9731')
})

// 2026-09-28 samples (build 87f428c): recipe fusions whose dialog closed before its icons showed.
it('completes a partly read fixed-recipe fusion from its result, and only when one recipe fits', () => {
  const map = new Map([...giftMap, ...([[9042, '연기와 철조망'], [9101, '녹슨 입마개'], [9102, '치성'], [9103, '억류된 찬송'], [9159, '밀라르카'], [9990, '피안개'], [9991, '어두운 잔영']] as [number, string][])
    .map(([game_id, name]) => [game_id, { game_id, name } as GiftData] as const)])
  const all = [...recipes, recipe('피안개', ['연기와 철조망', '녹슨 입마개', '치성']), recipe('피안개', ['연기와 철조망', '녹슨 입마개', '억류된 찬송', '밀라르카'])]
  const vestiges = new Set(['9991'])
  const inventory = ['9042', '9101', '9102', '9103', '9159', '9721', '9724']
  // d37139e6: 3/3 dialog, only 연기와 철조망 read, result 피안개.
  expect(recipeFusionMaterials(['9042'], 3, '9990', inventory, all, map, vestiges)).toEqual(['9042', '9101', '9102'])
  expect(recipeFusionMaterials(['9042'], 4, '9990', inventory, all, map, vestiges)).toEqual(['9042', '9101', '9103', '9159'])
  // b40f80dc: 2/5 dialog, 은빛 시계 케이스 read, 녹슨 시계침 too faint; result 회중시계 : 타입 E.
  expect(recipeFusionMaterials(['9721'], 2, '9729', inventory, all, map, vestiges)).toEqual(['9721', '9724'])
  // A read material outside the recipe, a missing ingredient, a random fusion's result or a wrong count: nothing added.
  expect(recipeFusionMaterials(['9103'], 3, '9990', inventory, all, map, vestiges)).toBeNull()
  expect(recipeFusionMaterials(['9042'], 3, '9990', ['9042', '9101'], all, map, vestiges)).toBeNull()
  expect(recipeFusionMaterials(['9001'], 2, '9001', inventory, all, map, vestiges)).toBeNull()
  expect(recipeFusionMaterials(['9042'], 5, '9990', inventory, all, map, vestiges)).toBeNull()
  // A vestige read on the dialog is not a recipe ingredient and does not block it.
  expect(recipeFusionMaterials(['9991', '9042'], 3, '9990', inventory, all, map, vestiges)).toEqual(['9042', '9101', '9102'])
  // With both variants held, the one containing the read materials is consumed (the first listed otherwise).
  expect(recipeIngredientsInInventory(9990, inventory, all, map, ['9159'])).toEqual(['9042', '9101', '9103', '9159'])
  expect(recipeIngredientsInInventory(9990, inventory, all, map)).toEqual(['9042', '9101', '9102'])
})
