import { describe, expect, it } from 'vitest'
import { popularWith, type Formation } from '@/features/community/lib/co-occurrence'

const f = (id: string, identities: string[], extra: Partial<Formation> = {}): Formation =>
  ({ kind: 'deck', id, identities, votes: 0, views: 0, ...extra })

describe('popularWith', () => {
  const formations = [
    f('d1', ['A'], { votes: 9 }),
    f('d2', ['A'], { votes: 1, views: 50 }),
    f('d3', ['A'], { votes: 1, views: 80 }),
    f('p1', ['A', 'B'], { kind: 'planner' }),
    f('d4', ['A']),
    f('d5', ['B'], { votes: 20 }),
  ]

  it('REQ-COMMUNITY-067 orders posts fielding the identity by window visitors, then votes, then views', () => {
    const visitors = new Map([['planner:p1', 12], ['deck:d2', 3]])
    expect(popularWith(formations, 'A', visitors).map(post => post.id)).toEqual(['p1', 'd2', 'd1', 'd3'])
  })

  it('REQ-COMMUNITY-067 leaves out posts with neither visitors nor votes and keeps at most four', () => {
    const ids = popularWith(formations, 'A', new Map()).map(post => post.id)
    expect(ids).toEqual(['d1', 'd3', 'd2'])
    expect(ids).not.toContain('d4')
    expect(ids).not.toContain('d5')
  })
})
