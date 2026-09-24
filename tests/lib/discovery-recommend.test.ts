import { describe, expect, it } from 'vitest'
import { interestProfile, keywordTrend, postFeatures, recommend } from '@/lib/discovery/recommend'

const deck = (id: string, identity: string, sinner: string, keywords: string[]) => ({
  id,
  main_keywords: keywords,
  deck_identities: [
    { slot_order: 0, identities: { id: identity, sinner_id: sinner } },
    { slot_order: 99, identities: { id: 'benched', sinner_id: 'outis' } },
  ],
})
const plan = (id: string, identity: string, sinner: string, keywords: string[]) => ({
  id,
  selected_keywords: keywords,
  deck: [{ identity_id: identity, sinner_id: sinner, slot_order: 1 }],
})

describe('discovery recommendations', () => {
  it('reads decks and plans the same way and ignores unassigned slots', () => {
    expect(postFeatures(deck('d', 'index-yisang', 'yi-sang', ['파열']))).toEqual({
      identities: ['index-yisang'], sinners: ['yi-sang'], keywords: ['파열'],
    })
    expect(postFeatures(plan('p', 'index-yisang', 'yi-sang', ['파열']))).toEqual({
      identities: ['index-yisang'], sinners: ['yi-sang'], keywords: ['파열'],
    })
  })

  it('ranks unseen posts by shared identities, keywords and sinners, then fills with popular', () => {
    const profile = interestProfile([
      { identities: ['index-yisang'], sinners: ['yi-sang'], keywords: [] },
      postFeatures(plan('seen', 'index-yisang', 'yi-sang', ['파열'])),
    ])
    const candidates = [
      deck('seen', 'index-yisang', 'yi-sang', ['파열']),
      deck('keyword-only', 'x', 'faust', ['파열']),
      deck('same-identity', 'index-yisang', 'yi-sang', []),
      deck('unrelated', 'y', 'gregor', ['화상']),
      deck('popular', 'z', 'rodion', ['침잠']),
    ]
    const ids = recommend(candidates, profile, new Set(['seen']), ['seen', 'popular', 'missing'], 3).map(p => p.id)
    expect(ids).toEqual(['same-identity', 'keyword-only', 'popular'])
  })

  it('returns only popular posts for an empty profile', () => {
    const posts = [deck('a', 'x', 'faust', []), deck('b', 'y', 'faust', [])]
    expect(recommend(posts, new Map(), new Set(), ['b']).map(p => p.id)).toEqual(['b'])
  })

  it('picks the keyword with the most visitors across popular posts', () => {
    const posts = [deck('a', 'x', 'faust', ['파열', '호흡']), deck('b', 'y', 'faust', ['화상']), deck('c', 'z', 'faust', ['호흡'])]
    expect(keywordTrend(posts, new Map([['a', 10], ['b', 12], ['c', 5]]))).toBe('호흡')
    expect(keywordTrend(posts, new Map())).toBeNull()
  })
})
