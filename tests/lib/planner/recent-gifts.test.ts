import { describe, expect, it } from 'vitest'
import { parseRecentGifts, pushRecentGift } from '@/lib/planner/recent-gifts'

describe('recent gifts', () => {
  it('puts the newest first without duplicates and caps the list', () => {
    expect(pushRecentGift(['1', '2', '3'], '2', 3)).toEqual(['2', '1', '3'])
    expect(pushRecentGift(['1', '2', '3'], '4', 3)).toEqual(['4', '1', '2'])
  })
  it('reads garbage as empty', () => {
    expect(parseRecentGifts(null)).toEqual([])
    expect(parseRecentGifts('{')).toEqual([])
    expect(parseRecentGifts('{"a":1}')).toEqual([])
    expect(parseRecentGifts('["1",2,"3"]')).toEqual(['1', '3'])
  })
})
