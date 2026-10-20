import { describe, expect, it } from 'vitest'
import { rising } from '@/lib/discovery/rising'

// A board with 500 recent and 2,000 base visitors (the windows' lengths do not matter: shares are per window).
const row = (entity_id: string, recent: number, base: number, totals = { recent_total: 500, base_total: 2000 }) => ({ entity_id, recent, base, ...totals })

describe('rising', () => {
  it('REQ-COMMUNITY-068 compares shares of the board, smoothed toward 1.0 with three visitors', () => {
    // Base 40 of 2,000 = 2%; the same share of 500 recent visitors is 10. Recent 30: (30 + 3) / (10 + 3) = 2.54 → ×2.5.
    expect(rising([row('a', 30, 40)])).toEqual([{ id: 'a', recent: 30, rise: 2.5 }])
  })

  it('REQ-COMMUNITY-068 does not read a busier or quieter week of the whole board as a rise', () => {
    // Both entities' counts doubled with the board's traffic: no rise. Only the second one outgrew the board.
    expect(rising([row('same', 20, 20, { recent_total: 1000, base_total: 1000 })])).toEqual([])
    expect(rising([row('same', 20, 20, { recent_total: 1000, base_total: 1000 }), row('grew', 20, 5, { recent_total: 1000, base_total: 1000 })]).map(item => item.id)).toEqual(['grew'])
  })

  it('REQ-COMMUNITY-068 needs at least five recent visitors and a smoothed rise of ×1.5', () => {
    expect(rising([row('few', 4, 0)])).toEqual([])
    // 6 recent against an expected 5: (6 + 3) / (5 + 3) = 1.1, below ×1.5.
    expect(rising([row('weak', 6, 20)])).toEqual([])
    // 12 against 2.5 expected (base 10): 15 / 5.5 = 2.7.
    expect(rising([row('clear', 12, 10)]).map(item => item.rise)).toEqual([2.7])
  })

  it('REQ-COMMUNITY-068 ranks by (rise − 1) × √recent, so evidence outweighs a bare ratio', () => {
    // 'big': 80 recent vs 20 expected: 83 / 23 = 3.6, score 2.6 × 8.9 = 23. 'tiny': 5 recent vs 0 expected: 8 / 3 = 2.7, score 1.7 × 2.2 = 3.8.
    expect(rising([row('tiny', 5, 0), row('big', 80, 80)]).map(item => item.id)).toEqual(['big', 'tiny'])
  })

  it('REQ-COMMUNITY-068 breaks ties by recent visitors, then id, and keeps at most the limit and ×99', () => {
    expect(rising([row('b', 10, 0), row('a', 10, 0)]).map(item => item.id)).toEqual(['a', 'b'])
    expect(rising(Array.from({ length: 8 }, (_, i) => row(`x${i}`, 10 + i, 0)), 3)).toHaveLength(3)
    expect(rising([row('huge', 5000, 0)])[0].rise).toBe(99)
  })

  it('REQ-COMMUNITY-068 gives nothing when a window has no traffic to compare with', () => {
    expect(rising([row('a', 30, 40, { recent_total: 500, base_total: 0 })])).toEqual([])
    expect(rising([row('a', 30, 40, { recent_total: 0, base_total: 2000 })])).toEqual([])
  })
})
