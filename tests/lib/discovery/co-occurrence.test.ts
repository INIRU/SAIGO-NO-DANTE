import { describe, expect, it } from 'vitest'
import { companionsOf, popularWith, type Formation } from '@/lib/discovery/co-occurrence'

const f = (id: string, identities: string[], extra: Partial<Formation> = {}): Formation =>
  ({ kind: 'deck', id, identities, votes: 0, views: 0, ...extra })

describe('companionsOf', () => {
  // 12 formations. A is in 6. B (popular) is in 10, C in 4, D in 3, E in 3.
  const formations = [
    f('1', ['A', 'B', 'C']), f('2', ['A', 'B', 'C']), f('3', ['A', 'B', 'C']),
    f('4', ['A', 'B', 'D']), f('5', ['A', 'B', 'E']), f('6', ['A', 'B', 'E']),
    f('7', ['B', 'C']), f('8', ['B', 'D']), f('9', ['B', 'D']), f('10', ['B', 'E']),
    f('11', ['X']), f('12', ['Y']),
  ]

  it('REQ-COMMUNITY-061 scores each companion by shared formations over the expected count plus one', () => {
    // A–B together 6 times, expected 6*10/12 = 5 → 6/6 = 1.0; A–C 3 times, expected 6*4/12 = 2 → 3/3 = 1.0.
    // Equal scores break by the shared count: B (6) first, then C (3).
    const rows = companionsOf(formations, 'A')
    expect(rows.map(row => row.identity_id)).toEqual(['B', 'C'])
    expect(rows[0]).toMatchObject({ identity_id: 'B', count: 6 })
    expect(rows[1]).toMatchObject({ identity_id: 'C', count: 3 })
  })

  it('REQ-COMMUNITY-061 needs at least three shared formations and more than expected', () => {
    // A–D once, A–E twice: below the minimum. C–B 4 times, expected 4*10/12 = 3.33: kept (4 > 3.33).
    expect(companionsOf(formations, 'A').map(row => row.identity_id)).not.toContain('E')
    expect(companionsOf(formations, 'X')).toEqual([])
    expect(companionsOf(formations, 'C').map(row => row.identity_id)).toEqual(['A', 'B'])
  })

  it('REQ-COMMUNITY-061 ranks a rarer, tighter companion above a popular one and keeps at most the limit', () => {
    const many = [
      ...Array.from({ length: 5 }, (_, i) => f(`r${i}`, ['A', 'R', 'P'])),
      ...Array.from({ length: 15 }, (_, i) => f(`p${i}`, ['P'])),
    ]
    // A–R 5, expected 5*5/20 = 1.25 → 2.22. A–P 5, expected 5*20/20 = 5 → 0 (not more than expected).
    expect(companionsOf(many, 'A').map(row => row.identity_id)).toEqual(['R'])
    const wide = Array.from({ length: 3 }, (_, i) => f(`w${i}`, ['A', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7']))
    expect(companionsOf([...wide, f('z', ['Z'])], 'A', { limit: 6 })).toHaveLength(6)
  })

  it('REQ-COMMUNITY-061 returns nothing for an identity no formation fields', () => {
    expect(companionsOf(formations, 'nobody')).toEqual([])
  })
})

describe('popularWith', () => {
  const formations = [
    f('d1', ['A'], { votes: 9 }),
    f('d2', ['A'], { votes: 1, views: 50 }),
    f('d3', ['A'], { votes: 1, views: 80 }),
    f('p1', ['A', 'B'], { kind: 'planner' }),
    f('d4', ['A']),
    f('d5', ['B'], { votes: 20 }),
  ]

  it('REQ-COMMUNITY-062 orders posts fielding the identity by window visitors, then votes, then views', () => {
    const visitors = new Map([['planner:p1', 12], ['deck:d2', 3]])
    expect(popularWith(formations, 'A', visitors).map(post => post.id)).toEqual(['p1', 'd2', 'd1', 'd3'])
  })

  it('REQ-COMMUNITY-062 leaves out posts with neither visitors nor votes and keeps at most four', () => {
    const ids = popularWith(formations, 'A', new Map()).map(post => post.id)
    expect(ids).toEqual(['d1', 'd3', 'd2'])
    expect(ids).not.toContain('d4')
    expect(ids).not.toContain('d5')
  })
})
