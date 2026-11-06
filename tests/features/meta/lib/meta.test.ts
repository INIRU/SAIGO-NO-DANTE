import { describe, expect, it } from 'vitest'
import { aggregateDungeon, aggregateMeta } from '@/features/meta/lib/aggregate'
import { planGiftIds, planThemeIds } from '@/lib/meta/posts'
import { readAllMetaRows } from '@/lib/meta/pagination'
import { isBaseEgo, parseMetaFilters, type MetaFilters, type MetaIdentity, type MetaPost } from '@/lib/meta/types'

const now = Date.parse('2026-09-10T12:00:00Z')
const identity = (id: string, sinner_id: string): MetaIdentity => ({ id, sinner_id, name_kr: id, keywords: ['화상'], rarity: 3, folder_name: null, game_id: null })
const identities = [identity('a', '1'), identity('a2', '1'), identity('b', '2'), identity('c', '3')]
const post = (id: string, source: MetaPost['source'] = 'decks', age = 1): MetaPost => ({
  id, source, created_at: new Date(now - age * 86_400_000).toISOString(),
  identities: [{ identity_id: 'a', slot_order: 0 }, { identity_id: 'b', slot_order: 1 }, { identity_id: 'c', slot_order: 99 }],
  egos: [{ ego_id: 'e1' }, { ego_id: 'e1' }, { ego_id: 'e3' }, { ego_id: 'unknown' }],
})
const aggregate = (posts: MetaPost[], source: 'all' | 'decks' | 'planner' = 'all', period: 'all' | 'week' | 'month' = 'month') => aggregateMeta({
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

  it('applies source and update-week period boundaries, rejecting future dates', () => {
    // now is Thursday 2026-09-10 21:00 KST: this update week began 12:00 KST that day, the last four on 2026-08-20.
    const posts = [post('day21', 'decks', 21), post('day22', 'decks', 22), post('plan', 'planner', 2), post('today', 'planner', 0), post('future', 'decks', -1)]
    expect(aggregate(posts, 'decks').sampleCount).toBe(1)
    expect(aggregate(posts, 'planner').sampleCount).toBe(2)
    expect(aggregate(posts, 'all', 'week').sampleCount).toBe(1)
    expect(aggregate(posts, 'all', 'all').sampleCount).toBe(4)
  })

  it('counts a post edited within the period by its edit time, but never an edit from the future', () => {
    const edited = { ...post('edited', 'decks', 40), edited_at: new Date(now - 3_600_000).toISOString() }
    const later = { ...post('later', 'planner', 40), edited_at: new Date(now + 86_400_000).toISOString() }
    const stale = { ...post('stale', 'decks', 40), edited_at: new Date(now - 30 * 86_400_000).toISOString() }
    expect(aggregate([edited, later, stale], 'all', 'week').sampleCount).toBe(1)
    expect(aggregate([edited, later, stale], 'all', 'month').sampleCount).toBe(1)
    expect(aggregate([edited, later, stale], 'all', 'all').sampleCount).toBe(3)
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
  // Equally received posts of one day are listed by id, bench posts among the rest (REQ-META-012).
  expect(k0.posts.map(p => [p.id, p.support ?? false])).toEqual([['both', false], ['burn', true], ['reserve', false]])
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
  expect(aggregate(posts, 'all', 'all').identityInsights.b.companions).toEqual([{ identity_id: 'a', count: 2 }, { identity_id: 'a2', count: 1 }, { identity_id: 'c', count: 1 }])
  expect(aggregate([solo]).identityInsights.b.companions).toEqual([])
})
it('tallies plan difficulty, final gifts and theme packs overall and for each fielded identity', () => {
  expect(planGiftIds(['final_9765', 'start_9029', 'observe_9191', 'blessing_100_3', 'final_9765', 'final_'])).toEqual(['9765', '9029', '9191'])
  expect(planThemeIds([{ theme_id: '1010' }, { theme_id: null }, { theme_id: 1010 }, { theme_id: 1114 }])).toEqual(['1010', '1114'])
  const plan = (id: string, difficulty: string, gifts: string[], themes: string[], identities: unknown) => ({ ...post(id, 'planner'), difficulty, gifts, themes, identities })
  const data = aggregate([
    plan('p1', 'extreme', ['1', '2'], ['t1'], [{ identity_id: 'a', slot_order: 0 }, { identity_id: 'b', slot_order: 99 }]),
    plan('p2', 'hard', ['1'], ['t1', 't2'], [{ identity_id: 'a', slot_order: 1 }, { identity_id: 'b', slot_order: 2 }]),
    post('deck'),
  ])
  expect(data.planStats).toEqual({ count: 2, difficulty: [{ key: 'extreme', count: 1 }, { key: 'hard', count: 1 }], gifts: [{ key: '1', count: 2 }, { key: '2', count: 1 }], themes: [{ key: 't1', count: 2 }, { key: 't2', count: 1 }] })
  expect(data.identityInsights.a.plan?.count).toBe(2)
  expect(data.identityInsights.b.plan).toMatchObject({ count: 1, gifts: [{ key: '1', count: 1 }] })
})

it('REQ-META-003 tallies each fielded identity skill exchange, most used first, counting a slot without counts as 3-2-1', () => {
  const withSkills = (id: string, s: [number, number, number] | null, supportSkills: [number, number, number] = [0, 0, 6]): MetaPost => ({ ...post(id), identities: [
    { identity_id: 'a', slot_order: 0, ...(s ? { s1_count: s[0], s2_count: s[1], s3_count: s[2] } : {}) },
    { identity_id: 'b', slot_order: 1, s1_count: 1, s2_count: 0, s3_count: 5 },
    { identity_id: 'c', slot_order: 99, s1_count: supportSkills[0], s2_count: supportSkills[1], s3_count: supportSkills[2] },
  ] })
  const data = aggregate([withSkills('p1', [0, 1, 5]), withSkills('p2', [0, 1, 5]), withSkills('p3', null), withSkills('p4', [3, 2, 1])])
  expect(data.identityInsights.a.skills).toEqual([{ key: '3-2-1', count: 2 }, { key: '0-1-5', count: 2 }].sort((x, y) => y.count - x.count || x.key.localeCompare(y.key)))
  expect(data.identityInsights.b.skills).toEqual([{ key: '1-0-5', count: 4 }])
  expect(data.identityInsights.c).toBeUndefined()
})

it('REQ-META-003 ranks the skill exchange of every fielded slot', () => {
  const data = aggregate([{ ...post('p1'), identities: [
    { identity_id: 'a', slot_order: 0, s1_count: 0, s2_count: 1, s3_count: 5 },
    { identity_id: 'b', slot_order: 1 },
    { identity_id: 'c', slot_order: 99, s1_count: 0, s2_count: 0, s3_count: 6 },
  ] }, { ...post('p2'), identities: [{ identity_id: 'a', slot_order: 0, s1_count: 0, s2_count: 1, s3_count: 5 }] }])
  expect(data.skillSplits).toEqual([{ key: '0-1-5', count: 2 }, { key: '3-2-1', count: 1 }])
})

it('REQ-META-004 counts each plan once per floor pack, gift, inventory entry and floor 11–15 card', () => {
  const floorPlan = [
    { floor: 1, theme_id: '1007', gift_ids: ['9414'], constraints: [] },
    { floor: 1, theme_id: '9999', gift_ids: ['1'] },
    { floor: 2, theme_id: 1101, gift_ids: ['9414', 'x'] },
    { floor: 11, theme_id: '', gift_ids: [], constraints: [995011, 995012] },
    { floor: 12, theme_id: '1110', constraints: [995011] },
    { floor: 16, theme_id: '1' },
  ]
  const inventory = ['start_9005', 'observe_9191', 'final_9035_plusplus', 'final_9035_plusplus', 'final_9010_plus', 'final_9414', 'blessing_100_3']
  const dungeon = aggregateDungeon([{ floorPlan, inventory }, { floorPlan: [{ floor: 1, theme_id: '1007', gift_ids: ['9414'] }], inventory: ['start_9005', 'final_9035_plus'] }, { floorPlan: null, inventory: null }])
  expect(dungeon.plans).toBe(3)
  expect(dungeon.floors).toEqual([
    { floor: 1, plans: 2, themes: [{ key: '1007', count: 2 }] },
    { floor: 2, plans: 1, themes: [{ key: '1101', count: 1 }] },
    { floor: 12, plans: 1, themes: [{ key: '1110', count: 1 }] },
  ])
  expect(dungeon.routes).toEqual([{ key: '9414', count: 2, floors: [{ key: '1', count: 2 }, { key: '2', count: 1 }] }])
  expect(dungeon.start).toEqual([{ key: '9005', count: 2 }])
  expect(dungeon.observe).toEqual([{ key: '9191', count: 1 }])
  expect(dungeon.enhanced).toEqual([{ key: '9035', plus: 1, plusplus: 1 }, { key: '9010', plus: 1, plusplus: 0 }])
  expect(dungeon.constraints).toEqual([
    { floor: 11, plans: 1, cards: [{ key: '995011', count: 1 }, { key: '995012', count: 1 }] },
    { floor: 12, plans: 1, cards: [{ key: '995011', count: 1 }] },
  ])
})

describe('sample filters', () => {
  const SINNERS = ['1', '2', '3', '4', '5']
  const keyed = (prefix: string, keywords: string[], rarity = 3): MetaIdentity[] => SINNERS.map(sinner_id => ({ ...identity(prefix + sinner_id, sinner_id), keywords, skill_keyword_list: keywords, rarity }))
  // Five deployed identities sharing a status keyword make a keyword deck.
  const formation = (prefix: string) => SINNERS.map((sinner_id, slot_order) => ({ identity_id: prefix + sinner_id, slot_order }))
  const sample = (id: string, prefix: string, extra: Partial<MetaPost>): MetaPost => ({ id, source: 'decks', created_at: new Date(now - 86_400_000).toISOString(), identities: formation(prefix), egos: [], ...extra })
  const posts = [
    sample('burn-railway', 'burn', { content_type: '거굴철' }),
    sample('burn-dungeon', 'burn', { content_type: '거던15층' }),
    sample('tremor-dungeon', 'tremor', { content_type: '거던15층' }),
    sample('tremor-hard', 'tremor', { source: 'planner', difficulty: 'hard' }),
    sample('burn-normal', 'burn', { source: 'planner', difficulty: 'normal' }),
    sample('dual-dungeon', 'dual', { content_type: '거던15층' }),
    // Sinners 1 to 3 only: too few for a keyword deck.
    sample('trio-story', 'burn', { content_type: '스토리', identities: formation('burn').slice(0, 3) }),
  ]
  const catalog = [...keyed('burn', ['화상']), ...keyed('tremor', ['진동'], 2), ...keyed('dual', ['화상', '진동'])]
  const filtered = (filters: MetaFilters = {}) => aggregateMeta({ posts, identities: catalog, egos: [], keywordSinMap: {}, source: 'all', period: 'all', now, filters })
  const count = (filters: object) => filtered(filters as MetaFilters).sampleCount

  it('REQ-META-009 counts only the formations every filter matches', () => {
    expect(count({})).toBe(7)
    const railway = filtered({ usage: ['refractionRailway'] })
    expect(railway).toMatchObject({ sampleCount: 1, filters: { usage: ['refractionRailway'] }, sourceCounts: { decks: 1, planner: 0 } })
    expect(railway.battleIdentityStats.map(row => row.identity_id)).toEqual(['burn1', 'burn2', 'burn3', 'burn4', 'burn5'])
    // Several values of one filter keep a formation that has any of them.
    expect(count({ usage: ['refractionRailway', 'story'] })).toBe(2)
    // A difficulty is a plan's: decks never match one.
    expect(filtered({ difficulty: ['hard'] })).toMatchObject({ sampleCount: 1, sourceCounts: { decks: 0, planner: 1 } })
    expect(count({ difficulty: ['hard', 'normal'] })).toBe(2)
    expect(count({ usage: ['mirrorDungeon'], keyword: ['화상'] })).toBe(3)
    expect(count({ usage: ['refractionRailway'], keyword: ['진동'] })).toBe(0)
  })

  it('REQ-META-009 keeps the decks of every chosen keyword (a dual deck), or of any one on request', () => {
    expect(count({ keyword: ['진동'] })).toBe(3)
    expect(count({ keyword: ['화상', '진동'] })).toBe(1)
    expect(count({ keyword: ['화상', '진동'], keywordMode: 'or' })).toBe(6)
  })

  it('REQ-META-009 keeps the formations that field an identity of the chosen sinners and rarity', () => {
    // The trio fields sinners 1 to 3 only.
    expect(count({ sinner: ['4'] })).toBe(6)
    expect(count({ sinner: ['1', '4'] })).toBe(6)
    expect(count({ sinner: ['1', '4'], sinnerMode: 'or' })).toBe(7)
    expect(count({ rarity: ['2'] })).toBe(2)
    expect(count({ rarity: ['2', '3'] })).toBe(7)
    // Both at once: that sinner's identity of that rarity.
    expect(count({ sinner: ['1'], rarity: ['2'] })).toBe(2)
  })

  it('REQ-META-009 ties a sinner to a rarity: that sinner\'s identity of that rarity, on the field', () => {
    // Sinner 1 fields a rarity-2 identity and sinner 4 a rarity-3 one; sinner 5 sits on the bench.
    const mixed = sample('mixed', 'burn', { identities: [{ identity_id: 'tremor1', slot_order: 0 }, { identity_id: 'burn4', slot_order: 1 }, { identity_id: 'burn5', slot_order: 99 }] })
    const run = (filters: object) => aggregateMeta({ posts: [mixed], identities: catalog, egos: [], keywordSinMap: {}, source: 'all', period: 'all', now, filters: filters as MetaFilters }).sampleCount
    expect(run({ sinner: ['1'], rarity: ['2'] })).toBe(1)
    expect(run({ sinner: ['4'], rarity: ['2'] })).toBe(0)
    expect(run({ sinner: ['1', '4'], rarity: ['3'] })).toBe(0)
    expect(run({ sinner: ['1', '4'], rarity: ['3'], sinnerMode: 'or' })).toBe(1)
    expect(run({ sinner: ['5'] })).toBe(0)
  })

  it('REQ-META-009 does not apply a difficulty to the deck board, which has none', () => {
    const decksOnly = aggregateMeta({ posts, identities: catalog, egos: [], keywordSinMap: {}, source: 'decks', period: 'all', now, filters: { difficulty: ['hard'], usage: ['mirrorDungeon'] } })
    expect(decksOnly.sampleCount).toBe(3)
    expect(JSON.stringify(decksOnly.filters)).toBe('{"usage":["mirrorDungeon"]}')
  })

  it('REQ-META-009 counts each filter option over the formations the other filters keep', () => {
    expect(filtered().facets).toEqual({
      usage: { mirrorDungeon: 5, refractionRailway: 1, story: 1 },
      keyword: { '화상': 4, '진동': 3 },
      difficulty: { hard: 1, normal: 1 },
    })
    // The chosen filter does not narrow its own options, so another one can be picked.
    expect(filtered({ usage: ['refractionRailway'] }).facets).toEqual({
      usage: { mirrorDungeon: 5, refractionRailway: 1, story: 1 },
      keyword: { '화상': 1 },
      difficulty: {},
    })
    // A keyword's count is what choosing it too would keep: one dual deck has tremor beside burn.
    expect(filtered({ keyword: ['화상'] }).facets).toEqual({
      usage: { mirrorDungeon: 3, refractionRailway: 1 },
      keyword: { '화상': 4, '진동': 1 },
      difficulty: { normal: 1 },
    })
    expect(filtered({ keyword: ['화상', '진동'], keywordMode: 'or' }).facets.keyword).toEqual({ '화상': 4, '진동': 3 })
    expect(filtered({ rarity: ['2'] }).facets).toEqual({ usage: { mirrorDungeon: 2 }, keyword: { '진동': 2 }, difficulty: { hard: 1 } })
  })

  it('REQ-META-010 reads known filter values in one order and flags the rest', () => {
    const read = (params: Record<string, string>) => parseMetaFilters(key => params[key] ?? null)
    expect(read({ usage: 'story,mirrorDungeon', keyword: '진동,화상', difficulty: 'hard', sinner: 'faust,yi-sang', rarity: '3' })).toEqual({
      filters: { usage: ['mirrorDungeon', 'story'], keyword: ['화상', '진동'], difficulty: ['hard'], sinner: ['yi-sang', 'faust'], rarity: ['3'] }, invalid: false,
    })
    // The page hands over the lists it read from the address.
    expect(parseMetaFilters(key => key === 'usage' ? ['story', 'story'] : null)).toEqual({ filters: { usage: ['story'] }, invalid: false })
    expect(read({})).toEqual({ filters: {}, invalid: false })
    expect(read({ usage: '' })).toEqual({ filters: {}, invalid: false })
    // Any-of only means something from two values on.
    expect(read({ keyword: '화상,진동', keywordMode: 'or' }).filters).toEqual({ keyword: ['화상', '진동'], keywordMode: 'or' })
    expect(read({ keyword: '화상', keywordMode: 'or', sinnerMode: 'and' })).toEqual({ filters: { keyword: ['화상'] }, invalid: false })
    expect(read({ usage: 'raid' })).toEqual({ filters: {}, invalid: true })
    expect(read({ keyword: '참격' })).toEqual({ filters: {}, invalid: true })
    expect(read({ usage: 'story,raid' })).toEqual({ filters: { usage: ['story'] }, invalid: true })
    expect(read({ keywordMode: 'xor' })).toEqual({ filters: {}, invalid: true })
  })
})

describe('popular posts', () => {
  const rated = (id: string, source: MetaPost['source'], votes: number, views: number, age = 1): MetaPost => ({ ...post(id, source, age), votes, views })

  it('REQ-META-012 carries votes, views and comments and lists an identity\'s posts most recommended first, then most viewed, newest and by id', () => {
    const posts = aggregate([
      rated('z-old', 'decks', 1, 5, 9),
      rated('viewed', 'decks', 1, 9, 9),
      rated('b-new', 'planner', 1, 5, 2),
      rated('a-new', 'decks', 1, 5, 2),
      { ...rated('top', 'planner', 7, 0), comments: 3 },
      post('unrated'),
      { ...rated('bench', 'decks', 5, 0), identities: [{ identity_id: 'b', slot_order: 0 }, { identity_id: 'a', slot_order: 99 }] },
    ]).identityInsights.a.posts
    expect(posts.map(row => row.id)).toEqual(['top', 'bench', 'viewed', 'a-new', 'b-new', 'z-old', 'unrated'])
    expect(posts[0]).toMatchObject({ votes: 7, views: 0, comments: 3 })
    expect(posts[1]).toMatchObject({ support: true, votes: 5 })
    expect(posts.at(-1)).toMatchObject({ votes: 0, views: 0, comments: 0 })
  })

  it('REQ-META-013 returns the six most popular decks and plans that the source, period and filters keep', () => {
    const posts = [
      ...Array.from({ length: 8 }, (_, i) => rated('d' + i, 'decks', i, 0)),
      ...Array.from({ length: 3 }, (_, i) => rated('p' + i, 'planner', 0, i)),
      { ...rated('story', 'decks', 50, 4), content_type: '스토리', comments: 2 },
      // Outside the period, and without a formation: neither is a sample.
      rated('old', 'decks', 99, 0, 60),
      { ...rated('empty', 'planner', 99, 0), identities: [] },
    ]
    const top = aggregate(posts).topPosts
    expect(top.decks.map(row => row.id)).toEqual(['story', 'd7', 'd6', 'd5', 'd4', 'd3'])
    expect(top.planner.map(row => row.id)).toEqual(['p2', 'p1', 'p0'])
    // A row carries what it shows and nothing else.
    expect(top.decks[0]).toEqual({ id: 'story', source: 'decks', title: 'story', usage: 'story', combo: [], votes: 50, views: 4, comments: 2 })
    expect(aggregate(posts, 'planner').topPosts).toMatchObject({ decks: [], planner: [{ id: 'p2' }, { id: 'p1' }, { id: 'p0' }] })
    const stories = aggregateMeta({ posts, identities, egos: [], keywordSinMap: {}, source: 'all', period: 'month', now, filters: { usage: ['story'] } }).topPosts
    expect(stories).toMatchObject({ decks: [{ id: 'story' }], planner: [] })
    expect(stories.decks).toHaveLength(1)
    expect(aggregate([]).topPosts).toEqual({ decks: [], planner: [] })
  })
})

it('REQ-META-004 feeds only plans in scope into the Mirror Dungeon breakdown', () => {
  const plan = { ...post('p1', 'planner'), identities: [{ identity_id: 'a', slot_order: 0 }], floorPlan: [{ floor: 1, theme_id: '1007' }], inventory: ['start_9005'] }
  expect(aggregate([plan, post('deck')]).dungeon).toMatchObject({ plans: 1, start: [{ key: '9005', count: 1 }] })
  expect(aggregate([plan], 'decks').dungeon.plans).toBe(0)
})
