import { describe, expect, it } from 'vitest'
import { aggregateMeta } from '@/lib/meta/aggregate'
import { readAllMetaRows } from '@/lib/meta/pagination'
import { isBaseEgo, type MetaIdentity, type MetaPost } from '@/lib/meta/types'

const now = Date.parse('2026-09-10T12:00:00Z')
const identity = (id: string, sinner_id: string): MetaIdentity => ({ id, sinner_id, name_kr: id, keywords: ['화상'], rarity: 3, folder_name: null, game_id: null })
const identities = [identity('a', '1'), identity('a2', '1'), identity('b', '2'), identity('c', '3')]
const post = (id: string, source: MetaPost['source'] = 'decks', age = 1): MetaPost => ({
  id, source, created_at: new Date(now - age * 86_400_000).toISOString(),
  identities: [{ identity_id: 'a', slot_order: 0 }, { identity_id: 'b', slot_order: 1 }, { identity_id: 'c', slot_order: 99 }],
  egos: [{ ego_id: 'e1' }, { ego_id: 'e1' }, { ego_id: 'e3' }, { ego_id: 'unknown' }],
})
const aggregate = (posts: MetaPost[], source: 'all' | 'decks' | 'planner' = 'all', period: 'all' | '30' | '90' = '30') => aggregateMeta({
  posts, identities, source, period, now, keywordSinMap: { '화상': '분노' },
  egos: ['1', '3'].map(sinner_id => ({ id: `e${sinner_id}`, sinner_id, name_kr: 'EGO', grade: 'HE', sin_affinity: '분노', image_url: null })),
})

describe('published formation meta', () => {
  it('resolves restored planner UUIDs through stable game IDs and unique EGO metadata', () => {
    const data = aggregateMeta({
      posts: [{ ...post('legacy', 'planner', 69), identities: [
        { identity_id: 'old-a', game_id: '10101', sinner_id: '1', slot_order: 0 },
        { identity_id: 'old-b', game_id: '10201', sinner_id: '2', slot_order: 99 },
      ], egos: [{ ego_id: 'old-e', sinner_id: '1', name_kr: '원본 EGO', grade: 'ZAYIN' }] }],
      identities: [ { ...identity('a', '1'), game_id: '10101' }, { ...identity('b', '2'), game_id: '10201' } ],
      egos: [{ id: 'e', sinner_id: '1', name_kr: '원본 EGO', grade: 'ZAYIN', sin_affinity: 'wrath', image_url: null }],
      source: 'all', period: 'all', now, keywordSinMap: {},
    })
    expect(data.sampleCount).toBe(1)
    expect(data.battleIdentityStats[0].identity_id).toBe('a')
    expect(data.supportIdentityStats[0].identity_id).toBe('b')
    expect(data.egoStats[0].ego_id).toBe('e')
  })

  it('does not guess restored identities from a name or a different sinner', () => {
    const data = aggregateMeta({ posts: [{ ...post('legacy', 'planner'), identities: [
      { identity_id: 'old', name_kr: 'a', sinner_id: '1', slot_order: 0 },
      { identity_id: 'old', game_id: '10101', sinner_id: 'wrong', slot_order: 1 },
    ] }], identities: [{ ...identity('a', '1'), game_id: '10101' }], egos: [],
      source: 'all', period: 'all', now, keywordSinMap: {} })
    expect(data.sampleCount).toBe(0)
  })

  it('excludes ambiguous legacy EGO names instead of choosing a catalog entry', () => {
    const ego = { sinner_id: '1', name_kr: '동일 이름', grade: 'HE', sin_affinity: 'wrath', image_url: null }
    const data = aggregateMeta({ posts: [{ ...post('legacy', 'planner'), egos: [{ ...ego, ego_id: 'old' }] }],
      identities, egos: [{ ...ego, id: 'first' }, { ...ego, id: 'second' }],
      source: 'all', period: 'all', now, keywordSinMap: {} })
    expect(data.sampleCount).toBe(1)
    expect(data.egoStats).toEqual([])
  })
  it('combines boards without colliding IDs and counts each formation once', () => {
    const data = aggregate([post('same'), post('same'), post('same', 'planner')])
    expect(data.sampleCount).toBe(2)
    expect(data.sourceCounts).toEqual({ decks: 1, planner: 1 })
    expect(data.battleIdentityStats.map(row => row.count)).toEqual([2, 2])
    expect(data.supportIdentityStats.map(row => row.identity_id)).toEqual(['c'])
    expect(data.keywordUsage).toEqual([{ keyword: '화상', count: 2 }])
    expect(data.usageBySin).toEqual({ wrath: 2 })
    expect(data.synergies).toHaveLength(1)
    expect(data.synergies[0]).toMatchObject({ a_id: 'a', b_id: 'b', count: 2 })
    expect(data.egoStats).toHaveLength(1)
    expect(data.egoStats[0]).toMatchObject({ ego_id: 'e1', count: 2, sin_affinity: 'wrath' })
  })

  it('applies source and inclusive rolling period boundaries, rejecting future dates', () => {
    const posts = [post('day30', 'decks', 30), post('day31', 'decks', 31), post('plan', 'planner', 2), post('future', 'decks', -1)]
    expect(aggregate(posts, 'decks').sampleCount).toBe(1)
    expect(aggregate(posts, 'planner').sampleCount).toBe(1)
    expect(aggregate(posts, 'all', '90').sampleCount).toBe(3)
    expect(aggregate(posts, 'all', 'all').sampleCount).toBe(3)
  })

  it('excludes malformed, deleted and support-only formations from the denominator', () => {
    const invalid = [null, {}, [null, 'a', { identity_id: 'deleted', slot_order: 0 }], [{ identity_id: 'a', slot_order: 99 }]]
    const data = aggregate([...invalid.map((slots, i) => ({ ...post(String(i)), identities: slots })), post('valid')])
    expect(data.sampleCount).toBe(1)
    expect(data.excludedSamples).toBe(4)
    expect(data.battleIdentityStats[0].count / data.sampleCount).toBe(1)
  })

  it('deduplicates identities and sinner slots, preferring battle over support', () => {
    const data = aggregate([{ ...post('duplicate'), identities: [
      { identity_id: 'a', slot_order: 99 }, { identity_id: 'a2', slot_order: 0 },
      { identity_id: 'a2', slot_order: 1 }, { identity_id: 'b', slot_order: 2 },
      { identity_id: 'c', slot_order: -1 },
    ] }])
    expect(data.battleIdentityStats.map(row => row.identity_id)).toEqual(['a2', 'b'])
    expect(data.usageBySinner).toEqual({ '1': 1, '2': 1 })
    expect(data.synergies).toHaveLength(1)
    expect(data.supportIdentityStats.map(row => row.identity_id)).toEqual(['c'])
  })

  it('returns a complete empty model instead of invented percentages', () => {
    const data = aggregate([])
    expect(data.sampleCount).toBe(0)
    expect(data.battleIdentityStats).toEqual([])
    expect(data.synergies).toEqual([])
    expect(data.generatedAt).toBe('2026-09-10T12:00:00.000Z')
  })
})

describe('meta pagination', () => {
  it('reads beyond the old 5000-row limit even when the provider caps pages', async () => {
    const all = Array.from({ length: 5003 }, (_, i) => i)
    const result = await readAllMetaRows(async (from, to) => ({ data: all.slice(from, Math.min(to + 1, from + 127)), error: null }))
    expect(result).toEqual(all)
  })

  it('fails closed on errors rather than publishing a partial denominator', async () => {
    await expect(readAllMetaRows(async from => from === 0 ? { data: [1], error: null } : { data: null, error: { message: 'offline' } }))
      .rejects.toThrow('Meta query failed')
    await expect(readAllMetaRows(async () => ({ data: null, error: null }))).rejects.toThrow('no result')
  })
})


it('attributes battle order, deck purpose and deduplicated equipped EGO to each identity', () => {
  const data = aggregate([
    { ...post('one'), title: '화상 덱', content_type: '거굴철' },
    { ...post('two'), identities: [{ identity_id: 'a', slot_order: 4 }] },
  ])
  const insight = data.identityInsights.a
  expect(insight.count).toBe(2)
  expect(insight.orders).toEqual({ '1': 1, '5': 1 })
  expect(insight.egos).toHaveLength(1)
  expect(insight.egos[0]).toMatchObject({ ego_id: 'e1', count: 2 })
  expect(insight.posts[0]).toMatchObject({ title: '화상 덱', usage: 'refractionRailway', combo: [] })
  expect(insight.posts[1]).toMatchObject({ usage: 'none' })
  expect(data.identityInsights.c).toBeUndefined()
})

it('counts a keyword deck only from five deployed identities and keeps combos separate', () => {
  const cast = Array.from({ length: 7 }, (_, i) => ({ ...identity('k' + i, 's' + i), skill_keyword_list: i < 5 ? ['화상', '진동'] : ['화상'] }))
  const slots = (ids: string[], order = 0) => ids.map((identity_id, i) => ({ identity_id, slot_order: order + i }))
  const both = { ...post('both', 'planner'), identities: slots(['k0', 'k1', 'k2', 'k3', 'k4']) }
  const burnOnly = { ...post('burn'), content_type: '스토리', identities: [...slots(['k1', 'k2', 'k3', 'k5', 'k6']), { identity_id: 'k0', slot_order: 99 }] }
  const reserve = { ...post('reserve'), content_type: '거던15층', identities: [...slots(['k0', 'k1', 'k2', 'k3']), ...slots(['k4'], 7)] }
  const data = aggregateMeta({ posts: [both, burnOnly, reserve], identities: cast, egos: [], keywordSinMap: {}, source: 'all', period: 'all', now })
  expect(data.comboStats).toEqual([{ key: '', count: 1 }, { key: '화상', count: 1 }, { key: '화상+진동', count: 1 }])
  expect(data.usageStats).toEqual([{ key: 'mirrorDungeon', count: 2 }, { key: 'story', count: 1 }])
  const k0 = data.identityInsights.k0
  expect(k0.count).toBe(2)
  expect(k0.posts.map(p => [p.id, p.support ?? false])).toEqual([['both', false], ['reserve', false], ['burn', true]])
  expect(data.battleIdentityStats.find(row => row.identity_id === 'k0')).not.toHaveProperty('skill_keyword_list')
})
it('recognizes only the twelve base EGOs, without excluding other ZAYIN equipment', () => {
  for (let sinner = 201; sinner <= 212; sinner++) expect(isBaseEgo(`${sinner}01`)).toBe(true)
  for (const id of ['20102', '21301', '20001', '', null, undefined]) expect(isBaseEgo(id)).toBe(false)
})

it('counts each companion identity separately with the selected identity denominator', () => {
  const shared = { ...post('shared'), identities: [
    { identity_id: 'b', slot_order: 0 }, { identity_id: 'a', slot_order: 1 },
    { identity_id: 'a2', slot_order: 2 }, { identity_id: 'a', slot_order: 99 },
    { identity_id: 'c', slot_order: 99 },
  ] }
  const variant = { ...post('variant', 'planner'), identities: [
    { identity_id: 'b', slot_order: 0 }, { identity_id: 'a2', slot_order: 1 },
    { identity_id: 'c', slot_order: 2 },
  ] }
  const solo = { ...post('solo'), identities: [{ identity_id: 'b', slot_order: 0 }] }
  const posts = [shared, shared, variant, solo, post('old', 'decks', 60)]
  const insight = aggregate(posts).identityInsights.b
  expect(insight.count).toBe(3)
  expect(insight.companions).toEqual([{ identity_id: 'a', count: 1 }, { identity_id: 'a2', count: 1 }, { identity_id: 'c', count: 1 }])
  expect(insight.companions[0].count / insight.count).toBeCloseTo(1 / 3)
  expect(aggregate(posts, 'decks').identityInsights.b.companions).toEqual([{ identity_id: 'a', count: 1 }])
  expect(aggregate(posts, 'all', '90').identityInsights.b.companions).toEqual([{ identity_id: 'a', count: 2 }, { identity_id: 'a2', count: 1 }, { identity_id: 'c', count: 1 }])
  expect(aggregate([solo]).identityInsights.b.companions).toEqual([])
})
