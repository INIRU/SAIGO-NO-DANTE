import { expect, it } from 'vitest'
import { committedKeywords, formationRow, fusionGuide } from '../../../lib/planner/assist-gift-guide'
import type { GiftData, IdentitySlot, RecipeData } from '../../../lib/planner/types'

const gift = (game_id: number, keyword = '공통', grade = '2', name = `g${game_id}`) => ({ game_id, name, keyword, grade }) as GiftData
const giftMap = new Map([
  gift(1, '화상', '1'), gift(2, '화상', '2'), gift(3, '화상', '3'), gift(4, '출혈', '2'), gift(5, '출혈', '3'),
  gift(10, '화상', '4'), gift(11, '출혈', '4'), gift(12, '화상', '4'), gift(13, '공통', '4'), gift(14, '출혈', '4'), gift(20, '공통', '2'),
].map(item => [item.game_id, item]))
const recipe = (id: string, result: number, ingredients: number[]) => ({ id, result_name: `g${result}`, keyword: '', ingredients: ingredients.map(n => `g${n}`)}) as RecipeData
const recipes = [
  recipe('a', 10, [1, 2]),
  recipe('b', 12, [10, 3]),
  recipe('c', 13, [4, 20]),
  recipe('d', 11, [4, 5]),
  recipe('e', 14, [3, 5, 20]),
]
const slot = (sinner_id: string, slot_order: number, keywords: string[] = []) => ({ identity_id: `${sinner_id}-id`, sinner_id, name_kr: sinner_id, rarity: 3, keywords, slot_order }) as IdentitySlot

it('REQ-ASSIST-077 lays the run formation out in sinner order with 1-based formation numbers', () => {
  const sinners = [{ id: 'b', order_num: 2 }, { id: 'a', order_num: 1 }, { id: 'c', order_num: 3 }, { id: 'd', order_num: 4 }]
  const row = formationRow([slot('c', 0), slot('a', 8), slot('d', 99)], sinners)
  expect(row.map(cell => [cell.sinnerId, cell.slot?.identity_id ?? null, cell.position, cell.deployed])).toEqual([
    ['a', 'a-id', 9, false], ['b', null, null, false], ['c', 'c-id', 1, true], ['d', 'd-id', null, false],
  ])
})

it('REQ-ASSIST-078 commits to keywords counted from deployed identities and held gifts', () => {
  const slots = [slot('a', 0, ['화상']), slot('b', 1, ['화상', '출혈']), slot('c', 9, ['화상'])]
  expect(committedKeywords(slots, ['1'], giftMap)).toEqual(['화상'])
  expect(committedKeywords(slots, ['1', '4', '5'], giftMap)).toEqual(['화상', '출혈'])
  expect(committedKeywords([], ['20', '20', '20'], giftMap)).toEqual([])
})

it('REQ-ASSIST-078 orders craftable fusions by final, final material, keyword, then grade, and lists finals one material short', () => {
  const guide = fusionGuide({ inventory: ['1', '2', '3', '4', '5', '20'], targets: ['10', 'final_14'], recipes, giftMap, committed: ['출혈'] })
  expect(guide.ready.map(item => [item.fusion.result?.game_id, item.reason])).toEqual([
    [10, 'final'], [14, 'final'], [11, 'keyword'], [13, 'other'],
  ])
  const short = fusionGuide({ inventory: ['3', '5', '1'], targets: ['14', '10'], recipes, giftMap, committed: [] })
  expect(short.ready).toEqual([])
  expect(short.nearly.map(item => [item.fusion.result?.game_id, item.missing.map(gift => gift.game_id)])).toEqual([[14, [20]], [10, [2]]])
})

it('REQ-ASSIST-078 marks a fusion whose result is a material of a final recipe and skips results already held', () => {
  const guide = fusionGuide({ inventory: ['1', '2', '4', '20', '13'], targets: ['12'], recipes, giftMap, committed: [] })
  expect(guide.ready.map(item => [item.fusion.result?.game_id, item.reason])).toEqual([[10, 'material']])
})
