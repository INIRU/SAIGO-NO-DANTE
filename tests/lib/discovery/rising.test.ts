import { describe, expect, it } from 'vitest'
import { rising, risingIdentities } from '@/lib/discovery/rising'
import type { Formation } from '@/lib/discovery/co-occurrence'

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

// Identities by the formations they are fielded in, weighted by each post's visitors.
const NOW = Date.parse('2026-10-20T00:00:00Z')
const OLD = '2026-06-01T00:00:00Z'
const day = (ago: number) => new Date(NOW - ago * 86_400_000).toISOString()
const formation = (id: string, identities: string[], created_at = OLD, kind: 'deck' | 'planner' = 'deck'): Formation => ({ kind, id, identities, votes: 0, views: 0, created_at })
const seen = (entity_id: string, recent: number, base: number) => ({ entity_id, recent, base })
const idsOf = (rows: { id: string }[]) => rows.map(row => row.id)

describe('risingIdentities', () => {
  const posts = [formation('p1', ['a', 'x']), formation('p2', ['a', 'y']), formation('p3', ['a', 'z']), formation('p4', ['x', 'y'])]
  const visits = { deck: [seen('p1', 10, 10), seen('p2', 10, 10), seen('p3', 10, 10), seen('p4', 10, 90)], planner: [] }

  it('REQ-COMMUNITY-071 weights an identity by the visitors of the posts that field it, as a share of all fielded visits', () => {
    // a: 30 recent, 30 base. Recent total 4 posts × 10 × 2 = 80, base total 2 × (10 + 10 + 10 + 90) = 240: expected 30 × 80 / 240 = 10, so (30 + 3) / (10 + 3) = 2.5.
    expect(risingIdentities({ formations: posts, visits, now: NOW })).toEqual([{ id: 'a', recent: 30, rise: 2.5 }])
  })

  it('REQ-COMMUNITY-071 reads decks and plans together, each post by its own kind', () => {
    const mixed = [formation('p1', ['a', 'x'], OLD, 'deck'), formation('p1', ['a', 'y'], OLD, 'planner'), formation('p2', ['a', 'z']), formation('p4', ['x', 'y'])]
    const both = { deck: [seen('p1', 10, 10), seen('p2', 10, 10), seen('p4', 10, 90)], planner: [seen('p1', 10, 10)] }
    expect(idsOf(risingIdentities({ formations: mixed, visits: both, now: NOW }))).toEqual(['a'])
  })

  it('REQ-COMMUNITY-071 needs three posts with recent visitors', () => {
    const two = [formation('p1', ['a', 'x']), formation('p2', ['a', 'y']), formation('p3', ['a', 'z']), formation('p4', ['x', 'y'])]
    // The third post of "a" has no recent visitor: it does not count.
    expect(risingIdentities({ formations: two, visits: { deck: [seen('p1', 10, 10), seen('p2', 10, 10), seen('p3', 0, 10), seen('p4', 10, 90)], planner: [] }, now: NOW })).toEqual([])
  })

  it('REQ-COMMUNITY-071 leaves out the identities it is told to skip, such as the LCB defaults', () => {
    expect(risingIdentities({ formations: posts, visits, skip: new Set(['a']), now: NOW })).toEqual([])
  })

  it('REQ-COMMUNITY-071 ignores a post without visit counts and one that no formation fields', () => {
    expect(risingIdentities({ formations: posts.slice(0, 3), visits: { deck: [seen('p1', 10, 10), seen('p2', 10, 10), seen('ghost', 99, 0)], planner: [] }, now: NOW })).toEqual([])
  })

  it('REQ-COMMUNITY-071 lets posts made in the last 14 days break ties, without lifting a weak riser over a strong one', () => {
    // 'old' and 'fresh' share the same visits; only the posts of 'fresh' are new.
    const tie = [
      ...['o1', 'o2', 'o3'].map(id => formation(id, ['old', `${id}-partner`])),
      ...['f1', 'f2', 'f3'].map(id => formation(id, ['fresh', `${id}-partner`], day(5))),
      ...['b1', 'b2', 'b3'].map(id => formation(id, ['big', `${id}-partner`])),
      formation('quiet', ['q1', 'q2']),
    ]
    // Nothing had a base visitor but the quiet post, which gives the board a base to compare with.
    const tieVisits = { deck: [...['o1', 'o2', 'o3', 'f1', 'f2', 'f3'].map(id => seen(id, 10, 0)), ...['b1', 'b2', 'b3'].map(id => seen(id, 40, 0)), seen('quiet', 0, 100)], planner: [] }
    expect(idsOf(risingIdentities({ formations: tie, visits: tieVisits, now: NOW }))).toEqual(['big', 'fresh', 'old'])
  })

  // Nothing has a base visitor but the quiet post, which gives the board a base to compare with.
  const quiet = formation('quiet', ['q1', 'q2'])
  const solo = (name: string) => ['1', '2', '3'].map(n => formation(`${name}${n}`, [name, `${name}${n}-partner`]))
  const soloVisits = (name: string, recent: number) => ['1', '2', '3'].map(n => seen(`${name}${n}`, recent, 0))

  it('REQ-COMMUNITY-072 shows at most two identities of one team that rose on the same three posts, and lets others in', () => {
    const team = ['team1', 'team2', 'team3', 'team4', 'team5']
    const crowd = [...['t1', 't2', 't3'].map(id => formation(id, team)), ...solo('o1'), ...solo('o2'), quiet]
    const crowdVisits = { deck: [...['t1', 't2', 't3'].map(id => seen(id, 40, 0)), ...soloVisits('o1', 10), ...soloVisits('o2', 10), seen('quiet', 0, 100)], planner: [] }
    const result = idsOf(risingIdentities({ formations: crowd, visits: crowdVisits, now: NOW }))
    // The second teammate still outranks the quiet ones (×0.3 of a top score), but the third is cut by the cap.
    expect(result).toEqual(['team1', 'team2', 'o1', 'o2'])
  })

  it('REQ-COMMUNITY-072 pulls an identity down by how much its posts overlap the ones already chosen', () => {
    // x1 and x2 rise on the same posts; x3 on its own with about a third of their score: 0.35 beats x2's 1.0 × (1 − 0.7).
    const shared = [...['s1', 's2', 's3'].map(id => formation(id, ['x1', 'x2'])), ...solo('x3'), quiet]
    const sharedVisits = { deck: [...['s1', 's2', 's3'].map(id => seen(id, 40, 0)), ...soloVisits('x3', 20), seen('quiet', 0, 100)], planner: [] }
    expect(idsOf(risingIdentities({ formations: shared, visits: sharedVisits, now: NOW }))).toEqual(['x1', 'x3', 'x2'])
  })

  it('REQ-COMMUNITY-071 gives nothing when there is no traffic to compare with', () => {
    expect(risingIdentities({ formations: posts, visits: { deck: [], planner: [] }, now: NOW })).toEqual([])
    expect(risingIdentities({ formations: posts, visits: { deck: posts.slice(0, 3).map(post => seen(post.id, 10, 0)), planner: [] }, now: NOW })).toEqual([])
  })
})
