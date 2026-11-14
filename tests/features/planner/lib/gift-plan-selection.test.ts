import { describe, expect, it } from 'vitest'
import type { GiftData } from '@/lib/planner/types'
import type { Observation } from '@/lib/planner/observation'
import { START_GIFT_IDS } from '@/features/planner/lib/start-gifts'
import {
  START_KEYWORD_ORDER,
  groupStartGifts,
  maxStartGiftCount,
  observableGifts,
  observeIdsFromKey,
  observeKeyOf,
  pickGiftsByIds,
  startIdsOf,
} from '@/features/planner/lib/gift-plan-selection'

// 옛 GiftPlanTab.tsx 안에 있던 계산을 그대로 옮겨 둔 기준 구현. 새 함수가 같은 입력에서 같은 결과를 내는지 비교한다.
const oldObserveKey = (inv: string[]) => inv.filter(id => id.startsWith('observe_')).join()
const oldObserveIds = (observeKey: string) =>
  new Set(observeKey ? observeKey.split(',').map(id => parseInt(id.replace('observe_', ''))) : [])
const oldStartIds = (inv: string[]) =>
  new Set(inv.filter(id => id.startsWith('start_')).map(id => parseInt(id.replace('start_', ''))))
const oldMaxStartGifts = (inv: string[]) => {
  const BLESSING_START_GIFT_IDS = [103, 109]
  let maxStartGifts = 1
  for (const entry of inv) {
    if (!entry.startsWith('blessing_')) continue
    const parts = entry.split('_')
    const baseId = parseInt(parts[1])
    if (BLESSING_START_GIFT_IDS.includes(baseId)) maxStartGifts += 1
  }
  return maxStartGifts
}
const oldObservable = (gifts: GiftData[], observation: Observation) => {
  const ids = new Set(observation.giftIds)
  return gifts.filter(g => ids.has(g.game_id))
}
const oldGiftsByIds = (ids: Set<number>, giftMap: Map<number, GiftData>) =>
  Array.from(ids).map(id => giftMap.get(id)).filter(Boolean) as GiftData[]
const oldGroupStartGifts = (gifts: GiftData[]) => {
  const startPool = gifts.filter(g => START_GIFT_IDS.has(g.game_id))
  const KEYWORD_ORDER = ['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전', '참격', '관통', '타격']
  const grouped = new Map<string, GiftData[]>()
  for (const kw of KEYWORD_ORDER) grouped.set(kw, [])
  for (const g of startPool) {
    const kw = g.keyword ?? '공통'
    if (!grouped.has(kw)) grouped.set(kw, [])
    grouped.get(kw)!.push(g)
  }
  return KEYWORD_ORDER.map(kw => ({ keyword: kw, gifts: grouped.get(kw) ?? [] })).filter(group => group.gifts.length > 0)
}

const gift = (game_id: number, keyword: string | null = null): GiftData => ({
  id: `g${game_id}`, game_id, name: `n${game_id}`, keyword, grade: null, image_url: null,
  effect_base: null, effect_plus: null, effect_plusplus: null, theme_ids: null, activation_condition: null,
})

const inventories: string[][] = [
  [],
  ['observe_9001'],
  ['observe_9001', 'start_9047', 'blessing_103_2', 'observe_9002', 'observe_9003'],
  ['start_9047', 'start_9093', 'blessing_109_1', 'blessing_103_1', 'blessing_5_1'],
  ['blessing_103', 'blessing_x_1', 'final_9100', 'observe_', 'start_'],
  ['gift_1', 'blessing_', 'observe_1', 'observe_1'],
]

describe('observe selection', () => {
  it.each(inventories)('matches the old key and ids for %j', (...inv) => {
    const inventory = inv as string[]
    expect(observeKeyOf(inventory)).toBe(oldObserveKey(inventory))
    expect(observeIdsFromKey(observeKeyOf(inventory))).toEqual(oldObserveIds(oldObserveKey(inventory)))
  })

  it('keeps the selection order of the inventory', () => {
    const ids = observeIdsFromKey(observeKeyOf(['observe_30', 'observe_10', 'observe_20']))
    expect(Array.from(ids)).toEqual([30, 10, 20])
  })

  it('is empty without observe_ entries', () => {
    expect(observeIdsFromKey('').size).toBe(0)
  })
})

describe('start selection', () => {
  it.each(inventories)('matches the old ids for %j', (...inv) => {
    const inventory = inv as string[]
    expect(startIdsOf(inventory)).toEqual(oldStartIds(inventory))
  })

  it.each(inventories)('matches the old pick limit for %j', (...inv) => {
    const inventory = inv as string[]
    expect(maxStartGiftCount(inventory)).toBe(oldMaxStartGifts(inventory))
  })

  it('adds one pick per blessing 103 and 109', () => {
    expect(maxStartGiftCount([])).toBe(1)
    expect(maxStartGiftCount(['blessing_103_2'])).toBe(2)
    expect(maxStartGiftCount(['blessing_103_2', 'blessing_109_1', 'blessing_7_1'])).toBe(3)
  })
})

describe('observableGifts and pickGiftsByIds', () => {
  const gifts = [gift(1), gift(2), gift(3), gift(4)]
  const observation: Observation = { giftIds: [4, 2, 99], costs: [] }

  it('keeps the gift list order, not the observation order', () => {
    expect(observableGifts(gifts, observation)).toEqual(oldObservable(gifts, observation))
    expect(observableGifts(gifts, observation).map(g => g.game_id)).toEqual([2, 4])
  })

  it('maps ids to gifts in set order and skips unknown ids', () => {
    const giftMap = new Map(gifts.map(g => [g.game_id, g]))
    const ids = new Set([3, 100, 1])
    expect(pickGiftsByIds(ids, giftMap)).toEqual(oldGiftsByIds(ids, giftMap))
    expect(pickGiftsByIds(ids, giftMap).map(g => g.game_id)).toEqual([3, 1])
  })
})

describe('groupStartGifts', () => {
  const startIds = Array.from(START_GIFT_IDS)
  const keywords = [...START_KEYWORD_ORDER, '공통', null, '없는키워드']
  const startGifts = startIds.map((id, index) => gift(id, keywords[index % keywords.length]))
  const others = [gift(1, '화상'), gift(2, null), gift(3, '출혈')]

  it('matches the old grouping for the full pool and for partial lists', () => {
    for (const gifts of [[], startGifts, [...others, ...startGifts], startGifts.slice(0, 5), others]) {
      expect(groupStartGifts(gifts)).toEqual(oldGroupStartGifts(gifts))
    }
  })

  it('lists keywords in the fixed order, drops empty groups, and ignores gifts outside the start pool', () => {
    const picked = [gift(startIds[0], '타격'), gift(startIds[1], '화상'), gift(startIds[2], '타격'), gift(1, '출혈')]
    const groups = groupStartGifts(picked)
    expect(groups.map(group => group.keyword)).toEqual(['화상', '타격'])
    expect(groups[1].gifts.map(g => g.game_id)).toEqual([startIds[0], startIds[2]])
  })

  it('does not show gifts whose keyword is not one of the ten', () => {
    const groups = groupStartGifts([gift(startIds[0], null), gift(startIds[1], '공통')])
    expect(groups).toEqual([])
  })
})
