import { describe, expect, it } from 'vitest'
import type { EgoGift } from '@/features/mirror-dungeon/types'
import { filterAndSortGifts } from '@/features/mirror-dungeon/lib/gift-catalog-sort'

const gift = (id: string, name: string, keyword: string, grade: string) => ({ id, name, keyword, grade, difficulty: null }) as EgoGift
const gifts = [gift('1', '가', '화상', '1'), gift('2', '나', '출혈', '2'), gift('3', '다', '화상', '3')]
const base = { keywords: new Set<string>(), grades: new Set<string>(), tiers: new Set<string>(), ranks: null, sortBy: 'default' as const, sortDesc: false, slotFilter: '전체', themeGiftNames: null, giftSlotMap: new Map(), keywordOrder: ['화상', '출혈'], keepOrder: false }
const ids = (list: EgoGift[]) => list.map(g => g.id)

describe('filterAndSortGifts with a search', () => {
  it('keeps the keyword order without one', () => {
    expect(ids(filterAndSortGifts(gifts, base))).toEqual(['1', '3', '2'])
  })

  it('lists only the found gifts, best first', () => {
    const ranks = new Map([['3', 0], ['2', 1]])
    expect(ids(filterAndSortGifts(gifts, { ...base, ranks }))).toEqual(['3', '2'])
  })

  it('still follows a sort the person picked', () => {
    const ranks = new Map([['3', 0], ['2', 1]])
    expect(ids(filterAndSortGifts(gifts, { ...base, ranks, sortBy: 'name' }))).toEqual(['2', '3'])
    expect(ids(filterAndSortGifts(gifts, { ...base, ranks, sortBy: 'name', sortDesc: true }))).toEqual(['3', '2'])
    expect(ids(filterAndSortGifts(gifts, { ...base, ranks, sortDesc: true }))).toEqual(['2', '3'])
  })

  it('still applies the other filters', () => {
    const ranks = new Map([['3', 0], ['2', 1]])
    expect(ids(filterAndSortGifts(gifts, { ...base, ranks, keywords: new Set(['출혈']) }))).toEqual(['2'])
  })

  it('keeps the given order when the host asks for it', () => {
    const ranks = new Map([['3', 0], ['1', 1]])
    expect(ids(filterAndSortGifts(gifts, { ...base, ranks, keepOrder: true }))).toEqual(['1', '3'])
  })
})
