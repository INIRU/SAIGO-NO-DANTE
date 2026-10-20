import { describe, expect, it } from 'vitest'
import { jaccard, rankOf, rbo, summarize } from '@/scripts/recommender/metrics'
import type { EvalFormation, Snapshot } from '@/scripts/recommender/load-snapshot'
import { egoQueries, giftQueries, identityQueries, stabilityQueries, themeQueries } from '@/scripts/recommender/queries'

describe('evaluation metrics', () => {
  it('REQ-META-030 counts hit@k, MRR and NDCG from the rank of the hidden item, and a missing item as a miss', () => {
    const ranks = [1, 2, 4, 9, rankOf(['a'], 'zzz')]
    const summary = summarize(ranks, [true, true, true, true, false])
    expect(summary.n).toBe(5)
    expect(summary.hit1).toBeCloseTo(1 / 5)
    expect(summary.hit3).toBeCloseTo(2 / 5)
    expect(summary.hit6).toBeCloseTo(3 / 5)
    expect(summary.mrr).toBeCloseTo((1 + 1 / 2 + 1 / 4 + 1 / 9) / 5)
    expect(summary.ndcg6).toBeCloseTo((1 + 1 / Math.log2(3) + 1 / Math.log2(5)) / 5)
    expect(summary.coverage).toBeCloseTo(4 / 5)
  })

  it('REQ-META-030 scores list stability by Jaccard and rank-biased overlap, a swap at the top costing more than one at the bottom', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f']
    expect(jaccard(list, list)).toBe(1)
    expect(jaccard(list, ['x', 'y'])).toBe(0)
    expect(jaccard(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3)
    expect(rbo(list, list)).toBeCloseTo(1)
    expect(rbo(list, ['g', 'h', 'i', 'j', 'k', 'l'])).toBeCloseTo(0)
    const topSwap = rbo(list, ['b', 'a', 'c', 'd', 'e', 'f'])
    const bottomSwap = rbo(list, ['a', 'b', 'c', 'd', 'f', 'e'])
    expect(topSwap).toBeLessThan(bottomSwap)
    expect(bottomSwap).toBeLessThan(1)
  })
})

const identity = (id: string, sinner: string, release: string | null = '2023-01-01') => ({
  id, sinner_id: sinner, name_kr: id, rarity: 2, release_date: release, keywords: [], skill_keyword_list: [], association_list: [], affiliation: null,
})
const ego = (id: string, sinner: string, grade: string) => ({ id, sinner_id: sinner, grade, sin_affinity: null, keywords: [], release_date: '2023-01-01', cost: null })
const formation = (key: string, author: string, identities: string[], extra: Partial<EvalFormation> = {}): EvalFormation => ({
  key, kind: 'deck', id: key, votes: 0, views: 0, createdAt: Date.parse('2026-10-01'), author, identities, distribution: {}, egos: [], mainKeywords: [], floors: [], ...extra,
})
const theme = (id: number, floors: number[]) => ({ id, difficulty: 'hard', ego_gift_ids: [9001, 9002, 9003], specific_ego_gift_ids: [], floor_info: { 하드: floors } })

const snapshot: Snapshot = {
  catalog: {
    identities: [identity('a1', 'a'), identity('a2', 'a'), identity('a3', 'a', '2026-12-01'), identity('b1', 'b'), identity('b2', 'b'), identity('c1', 'c'), identity('c2', 'c')],
    egos: [ego('e-z', 'a', 'ZAYIN'), ego('e-t', 'a', 'TETH'), ego('e-h', 'a', 'HE'), ego('e-h2', 'a', 'HE')],
    skills: [], passives: [], gifts: [], themes: [theme(10, [1, 2]), theme(11, [1, 2]), theme(12, [1]), theme(13, [3])],
  },
  formations: [
    formation('f1', 'u1', ['a1', 'b1', 'c1'], {
      egos: [{ ego_id: 'e-z', sinner_id: 'a', grade: 'ZAYIN' }, { ego_id: 'e-t', sinner_id: 'a', grade: 'TETH' }, { ego_id: 'e-h', sinner_id: 'a', grade: 'HE' }],
      floors: [{ floor: 1, theme: '10', gifts: ['9001', '9002'], difficulty: 'hard' }, { floor: 2, theme: '11', gifts: ['9003'], difficulty: 'hard' }],
    }),
    formation('f2', 'u1', ['a2', 'b1', 'c1']),
    formation('f3', 'u2', ['a1', 'b2']),
  ],
  exportedAt: 'test',
}

describe('leave-one-out queries', () => {
  it('REQ-META-031 hides one identity per query, ranks only that sinner\'s identities released by then, and trains without the formation', () => {
    const queries = identityQueries(snapshot, 'formation', 'full')
    const query = queries.find(q => q.f.key === 'f1' && q.held === 'a1')!
    expect(query.context).toEqual(['b1', 'c1'])
    // a3 is released after the formation was made, so it cannot have been picked.
    expect(query.candidates.sort()).toEqual(['a1', 'a2'])
    expect(query.train.map(f => f.key)).toEqual(['f2', 'f3'])
    expect(queries).toHaveLength(3 + 3 + 2)
  })

  it('REQ-META-031 can leave out every formation of the author, so a user\'s own near-copies do not help', () => {
    const query = identityQueries(snapshot, 'author', 'full').find(q => q.f.key === 'f1' && q.held === 'a1')!
    expect(query.train.map(f => f.key)).toEqual(['f3'])
  })

  const wide: Snapshot = {
    ...snapshot,
    catalog: { ...snapshot.catalog, identities: [...snapshot.catalog.identities, identity('d1', 'd'), identity('d2', 'd')] },
    formations: [formation('w', 'u1', ['a1', 'b1', 'c1', 'd1'])],
  }

  it('REQ-META-031 shrinks the known context for the half, first-picks and empty-board regimes', () => {
    const sizes = (regime: 'full' | 'half' | 'three' | 'one' | 'zero') => [...new Set(identityQueries(wide, 'formation', regime).map(q => q.context.length))]
    expect(sizes('full')).toEqual([3])
    expect(sizes('half')).toEqual([2])
    expect(sizes('three')).toEqual([3])
    expect(sizes('one')).toEqual([1])
    // An empty board: every member of a one-person post is still a query.
    expect(sizes('zero')).toEqual([0])
    expect(identityQueries({ ...wide, formations: [formation('solo', 'u1', ['a1'])] }, 'formation', 'zero')).toHaveLength(1)
    expect(identityQueries({ ...wide, formations: [formation('solo', 'u1', ['a1'])] }, 'formation', 'one')).toHaveLength(0)
  })

  it('REQ-META-031 grows the context one identity at a time for the stability sequences', () => {
    const sequences = stabilityQueries(wide, 'formation')
    expect(sequences).toHaveLength(4)
    expect(sequences[0].map(q => q.context.length)).toEqual([2, 3])
  })

  it('REQ-META-031 hides a non-ZAYIN E.G.O and offers the sinner\'s E.G.O whose grade slot is open', () => {
    const queries = egoQueries(snapshot, 'formation')
    expect(queries.map(q => q.held).sort()).toEqual(['e-h', 'e-t'])
    const hidden = queries.find(q => q.held === 'e-h')!
    // TETH is filled by e-t, so only the HE choices are left.
    expect(hidden.candidates.sort()).toEqual(['e-h', 'e-h2'])
    expect(hidden.identity).toBe('a1')
  })

  it('REQ-META-031 offers a floor\'s pack among the packs that floor can show and the plan has not used elsewhere', () => {
    const queries = themeQueries(snapshot, 'formation')
    const first = queries.find(q => q.floor === 1)!
    expect(first.held).toBe('10')
    // 11 is the plan's floor-2 pack; 13 only appears on floor 3.
    expect(first.candidates.sort()).toEqual(['10', '12'])
    const gifts = giftQueries(snapshot, 'formation').filter(q => q.floor === 1)
    expect(gifts.map(q => q.held).sort()).toEqual(['9001', '9002'])
    // 9003 was taken on floor 2 and 9002 stays on this floor.
    expect(gifts.find(q => q.held === '9001')!.candidates.sort()).toEqual(['9001'])
  })
})
