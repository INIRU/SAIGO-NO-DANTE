import type { GiftData } from '@/lib/planner/types'
import type { Observation } from '@/lib/planner/observation'
import { START_GIFT_IDS } from './start-gifts'

/** 기프트 탭의 시작 기프트 격자에 나오는 키워드 순서(이 순서대로 열이 놓인다). */
export const START_KEYWORD_ORDER = ['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전', '참격', '관통', '타격']

/** 가호에서 시작 기프트를 한 개 더 고르게 하는 baseId: 103(쏟아지는 유성우), 109(완전한 가능성). */
const BLESSING_START_GIFT_IDS = [103, 109]

/** 관찰 목록의 키. observe_ 항목이 바뀔 때만 달라져서, 최종 기프트를 눌러도 관찰 격자를 다시 그리지 않게 한다. */
export function observeKeyOf(giftInventory: string[]): string {
  return giftInventory.filter(id => id.startsWith('observe_')).join()
}

export function observeIdsFromKey(observeKey: string): Set<number> {
  return new Set(observeKey ? observeKey.split(',').map(id => parseInt(id.replace('observe_', ''))) : [])
}

export function startIdsOf(giftInventory: string[]): Set<number> {
  return new Set(
    giftInventory
      .filter(id => id.startsWith('start_'))
      .map(id => parseInt(id.replace('start_', '')))
  )
}

/** 시작 기프트를 고를 수 있는 수: 기본 1개, 가호 103·109마다 +1. */
export function maxStartGiftCount(giftInventory: string[]): number {
  let max = 1
  for (const entry of giftInventory) {
    if (!entry.startsWith('blessing_')) continue
    const baseId = parseInt(entry.split('_')[1])
    if (BLESSING_START_GIFT_IDS.includes(baseId)) max += 1
  }
  return max
}

/** 시작 관찰이 실제로 내놓을 수 있는 기프트만(게임의 관찰 목록 기준). */
export function observableGifts(gifts: GiftData[], observation: Observation): GiftData[] {
  const ids = new Set(observation.giftIds)
  return gifts.filter(g => ids.has(g.game_id))
}

export function pickGiftsByIds(ids: Set<number>, giftMap: Map<number, GiftData>): GiftData[] {
  return Array.from(ids)
    .map(id => giftMap.get(id))
    .filter(Boolean) as GiftData[]
}

/** 시작 기프트 풀을 키워드별로 묶는다. 정해진 순서대로, 비어 있는 키워드는 뺀다. 열 개 밖의 키워드(공통 등)는 나오지 않는다. */
export function groupStartGifts(gifts: GiftData[]): { keyword: string; gifts: GiftData[] }[] {
  const grouped = new Map<string, GiftData[]>()
  for (const kw of START_KEYWORD_ORDER) grouped.set(kw, [])
  for (const g of gifts) {
    if (!START_GIFT_IDS.has(g.game_id)) continue
    const kw = g.keyword ?? '공통'
    if (!grouped.has(kw)) grouped.set(kw, [])
    grouped.get(kw)!.push(g)
  }
  return START_KEYWORD_ORDER
    .map(keyword => ({ keyword, gifts: grouped.get(keyword) ?? [] }))
    .filter(group => group.gifts.length > 0)
}
