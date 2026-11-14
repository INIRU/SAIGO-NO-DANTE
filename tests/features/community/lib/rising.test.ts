import { describe, expect, it } from 'vitest'
import { byRise, rising, risingIdentities } from '@/features/community/lib/rising'
import type { Formation } from '@/features/community/lib/co-occurrence'

// A board with 500 recent and 2,000 base visitors (the windows' lengths do not matter: shares are per window).
const row = (entity_id: string, recent: number, base: number, totals = { recent_total: 500, base_total: 2000 }) => ({ entity_id, recent, base, ...totals })

describe('rising', () => {
  it('compares shares of the board, smoothed toward 1.0 with three visitors', () => {
    // Base 40 of 2,000 = 2%; the same share of 500 recent visitors is 10. Recent 30: (30 + 3) / (10 + 3) = 2.54 → ×2.5.
    expect(rising([row('a', 30, 40)])).toEqual([{ id: 'a', recent: 30, rise: 2.5 }])
  })

  it('does not read a busier or quieter week of the whole board as a rise', () => {
    // Both entities' counts doubled with the board's traffic: no rise. Only the second one outgrew the board.
    expect(rising([row('same', 20, 20, { recent_total: 1000, base_total: 1000 })])).toEqual([])
    expect(rising([row('same', 20, 20, { recent_total: 1000, base_total: 1000 }), row('grew', 20, 5, { recent_total: 1000, base_total: 1000 })]).map(item => item.id)).toEqual(['grew'])
  })

  it('takes anything that rose by ×1.1, strictest evidence first: 8 recent visitors, then 5, then 3', () => {
    // 'strong': 12 against 2.5 expected (base 10): 15 / 5.5 = 2.7. 'weak': 6 against 5 expected: 9 / 8 = 1.1. 'tiny': 3 against 0: 6 / 3 = 2.0. 'few': 2 recent.
    const rows = [row('few', 2, 0), row('tiny', 3, 0), row('weak', 6, 20), row('strong', 12, 10)]
    expect(rising(rows).map(item => item.id)).toEqual(['strong', 'weak', 'tiny'])
    // With room for two only the stricter ones come in, though 'tiny' has the bigger multiplier than 'weak'.
    expect(rising(rows, 2).map(item => item.id)).toEqual(['strong', 'weak'])
    expect(rising([row('flat', 20, 20, { recent_total: 500, base_total: 500 })])).toEqual([])
  })

  it('shows the biggest multiplier first, then the most evidence', () => {
    const items = [{ id: 'b', recent: 10, rise: 2.5 }, { id: 'a', recent: 10, rise: 2.5 }, { id: 'c', recent: 40, rise: 2.5 }, { id: 'd', recent: 5, rise: 4.1 }]
    expect(items.sort(byRise).map(item => item.id)).toEqual(['d', 'c', 'a', 'b'])
  })

  it('ranks by (rise − 1) × √recent, so evidence outweighs a bare ratio', () => {
    // 'big': 80 recent vs 20 expected: 83 / 23 = 3.6, score 2.6 × 8.9 = 23. 'tiny': 8 recent vs 0 expected: 11 / 3 = 3.7, score 2.7 × 2.8 = 7.6.
    expect(rising([row('tiny', 8, 0), row('big', 80, 80)]).map(item => item.id)).toEqual(['big', 'tiny'])
  })

  it('breaks ties by recent visitors, then id, and keeps at most the limit and ×99', () => {
    expect(rising([row('b', 10, 0), row('a', 10, 0)]).map(item => item.id)).toEqual(['a', 'b'])
    expect(rising(Array.from({ length: 8 }, (_, i) => row(`x${i}`, 10 + i, 0)), 3)).toHaveLength(3)
    expect(rising([row('huge', 5000, 0)])[0].rise).toBe(99)
  })

  it('gives nothing when a window has no traffic to compare with', () => {
    expect(rising([row('a', 30, 40, { recent_total: 500, base_total: 0 })])).toEqual([])
    expect(rising([row('a', 30, 40, { recent_total: 0, base_total: 2000 })])).toEqual([])
  })
})

// Identities by how many recent posts of one board field them.
const NOW = Date.parse('2026-10-20T00:00:00Z')
const day = (ago: number) => NOW - ago * 86_400_000
const post = (id: string, deployed: string[], dates: { createdAt?: number; editedAt?: number } = { createdAt: day(3) }, kind: 'deck' | 'planner' = 'deck'): Formation =>
  ({ kind, id, identities: deployed, deployed, votes: 0, views: 0, ...dates })
const count = (formations: Formation[], options: { kind?: 'deck' | 'planner'; skip?: Set<string>; limit?: number } = {}) =>
  risingIdentities({ formations, kind: options.kind ?? 'deck', skip: options.skip, now: NOW }, options.limit)

describe('risingIdentities', () => {
  it('counts the recent posts that field an identity, most first', () => {
    expect(count([post('p1', ['a', 'b']), post('p2', ['a', 'b']), post('p3', ['a', 'c']), post('p4', ['c'])]))
      .toEqual([{ id: 'a', count: 3 }, { id: 'b', count: 2 }, { id: 'c', count: 2 }])
  })

  it('takes a post written or edited in the last 14 days, and no older one', () => {
    const posts = [
      post('written', ['a'], { createdAt: day(13) }), post('edited', ['a'], { createdAt: day(200), editedAt: day(2) }),
      post('old', ['a'], { createdAt: day(15) }), post('old-edit', ['a'], { createdAt: day(200), editedAt: day(15) }),
    ]
    expect(count(posts)).toEqual([{ id: 'a', count: 2 }])
  })

  it('counts only the identities that fight (the first seven), not the backup', () => {
    const benched = ['p1', 'p2'].map(id => ({ ...post(id, ['a']), identities: ['a', 'bench'] }))
    expect(count(benched)).toEqual([{ id: 'a', count: 2 }])
  })

  it('keeps the boards apart', () => {
    const posts = [post('d1', ['deck']), post('d2', ['deck']), post('p1', ['plan'], undefined, 'planner'), post('p2', ['plan'], undefined, 'planner')]
    expect(count(posts, { kind: 'deck' })).toEqual([{ id: 'deck', count: 2 }])
    expect(count(posts, { kind: 'planner' })).toEqual([{ id: 'plan', count: 2 }])
  })

  it('leaves out an identity seen on one post and those it is told to skip, such as the LCB defaults', () => {
    expect(count([post('p1', ['a', 'b']), post('p2', ['a'])], { skip: new Set(['a']) })).toEqual([])
  })

  it('breaks ties by id and keeps at most the limit', () => {
    const posts = ['p1', 'p2'].map(id => post(id, ['c', 'a', 'b']))
    expect(count(posts, { limit: 2 }).map(row => row.id)).toEqual(['a', 'b'])
  })
})
