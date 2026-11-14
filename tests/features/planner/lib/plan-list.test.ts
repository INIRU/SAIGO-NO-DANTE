import { describe, expect, it } from 'vitest'
import type { PlanSummary } from '@/lib/planner/strip-plan-for-list'
import {
  PLAN_FILTER_KEYWORDS, buildPlanFilterIndexes, buildPlanPageParams, buildPlanServerQueryKey, filterPlanIndexes,
  getPlanFilterKeywords, getPlanIdentityNames, groupIdentitiesBySinner, type PlanClientFilter,
} from '@/features/planner/lib/plan-list'

const plan = (id: string, over: Partial<PlanSummary> = {}): PlanSummary => ({
  id, title: id, description: null, difficulty: 'normal', deck: null, egos: null, tags: null, vote_count: 0, view_count: 0, comment_count: 0,
  created_at: '2026-01-01', profiles: null, ...over,
})
const none: PlanClientFilter = {
  search: '', keywords: [], keywordMode: 'or', identityIds: [], identityMode: 'or', filterOwnedIdentity: false, filterOwnedEgo: false,
  effectiveOwned: null, facets: { affiliation: [], ego: [], gift: [], theme: [] },
}
const run = (plans: PlanSummary[], filter: Partial<PlanClientFilter> = {}, aff?: Record<string, string[]>) =>
  filterPlanIndexes(buildPlanFilterIndexes(plans, aff), { ...none, ...filter }).map(p => p.id)

describe('plan keywords and names', () => {
  it('reads the precomputed values and falls back to empty', () => {
    expect(getPlanIdentityNames(plan('a'))).toEqual([])
    expect(getPlanIdentityNames(plan('a', { identity_names: ['x'] }))).toEqual(['x'])
  })

  it('uses filter keywords, else theme keywords, plus the selected ones, normalized and unique', () => {
    expect(getPlanFilterKeywords(plan('a', { filter_keywords: ['화상', 'slash'], theme_keywords: ['침잠'], selected_keywords: ['참격', '화상'] }))).toEqual(['화상', '참격'])
    expect(getPlanFilterKeywords(plan('a', { theme_keywords: ['침잠'] }))).toEqual(['침잠'])
    expect(getPlanFilterKeywords(plan('a'))).toEqual([])
  })

  it('lists the combat keywords first and every theme keyword once', () => {
    expect(PLAN_FILTER_KEYWORDS.slice(0, 3)).toEqual(['참격', '관통', '타격'])
    expect(new Set(PLAN_FILTER_KEYWORDS).size).toBe(PLAN_FILTER_KEYWORDS.length)
    expect(PLAN_FILTER_KEYWORDS).toContain('출혈')
  })
})

describe('plan server query', () => {
  const base = { sort: 'latest' as const, difficulty: null, keywords: [], keywordMode: 'or' as const, identityIds: [], identityMode: 'or' as const, formationCount: null }

  it('is only the sort without filters, and drops modes whose list is empty', () => {
    expect(buildPlanServerQueryKey(base)).toBe('sort=latest')
    expect(buildPlanServerQueryKey({ ...base, keywordMode: 'and', identityMode: 'and' })).toBe('sort=latest')
  })

  it('writes every filter, sorted by name', () => {
    const key = buildPlanServerQueryKey({ sort: 'popular', difficulty: 'hard', keywords: ['화상', '침잠'], keywordMode: 'and', identityIds: ['a', 'b'], identityMode: 'and', formationCount: 5 })
    expect(key).toBe('difficulty=hard&formation_count=5&identity_ids=a%2Cb&identity_mode=and&keyword_tag_mode=and&keyword_tags=%ED%99%94%EC%83%81%2C%EC%B9%A8%EC%9E%A0&sort=popular')
  })

  it('adds a page of 24', () => {
    expect(buildPlanPageParams('sort=latest', 48).toString()).toBe('sort=latest&limit=24&offset=48')
  })
})

describe('buildPlanFilterIndexes', () => {
  it('collects searchable text, ids and the affiliations of formed identities only', () => {
    const p = plan('a', {
      title: 'T', description: 'D', identity_names: ['N'], gift_ids: [1, 2], theme_ids: [7],
      deck: [{ identity_id: 'i1', slot_order: 0 }, { identity_id: 'i2', slot_order: 99 }, { identity_id: 'i3' }, {}],
      egos: [{ ego_id: 'e1' }, {}],
    })
    const [index] = buildPlanFilterIndexes([p], { i1: ['A'], i2: ['B'], i3: ['C'] })
    expect(index.searchableFields).toEqual(['T', 'D', 'N'])
    expect(index.identityIds).toEqual(['i1', 'i2', 'i3'])
    expect(index.egoIds).toEqual(['e1'])
    expect([...index.affiliations]).toEqual(['A'])
    expect([...index.giftIds]).toEqual(['1', '2'])
    expect([...index.themeIds]).toEqual(['7'])
  })

  it('has no affiliations before the facet data arrives', () => {
    const [index] = buildPlanFilterIndexes([plan('a', { deck: [{ identity_id: 'i1', slot_order: 0 }] })], undefined)
    expect(index.affiliations.size).toBe(0)
  })
})

describe('filterPlanIndexes', () => {
  const plans = [
    plan('a', { title: '양 편성', filter_keywords: ['화상'], deck: [{ identity_id: 'i1', slot_order: 0 }, { identity_id: 'i9', slot_order: 99 }], egos: [{ ego_id: 'e1' }], gift_ids: [1], theme_ids: [5] }),
    plan('b', { title: '파랑', description: '양 이야기', filter_keywords: ['침잠', '화상'], deck: [{ identity_id: 'i2', slot_order: 0 }], egos: [{ ego_id: 'e2' }], gift_ids: [1, 2] }),
    plan('c', { title: '빈', identity_names: ['돈키호테'] }),
  ]

  it('returns every plan when nothing filters', () => {
    expect(run(plans)).toEqual(['a', 'b', 'c'])
  })

  it('searches title, description and identity names with + (or) and * (and)', () => {
    expect(run(plans, { search: '양' })).toEqual(['a', 'b'])
    expect(run(plans, { search: '돈키호테' })).toEqual(['c'])
    expect(run(plans, { search: '양 + 돈키호테' })).toEqual(['a', 'b', 'c'])
    expect(run(plans, { search: '양 * 이야기' })).toEqual(['b'])
    expect(run(plans, { search: '   ' })).toEqual(['a', 'b', 'c'])
  })

  it('filters by keyword in or and and mode', () => {
    expect(run(plans, { keywords: ['화상', '침잠'], keywordMode: 'or' })).toEqual(['a', 'b'])
    expect(run(plans, { keywords: ['화상', '침잠'], keywordMode: 'and' })).toEqual(['b'])
  })

  it('filters by picked identity in or and and mode', () => {
    expect(run(plans, { identityIds: ['i1', 'i2'], identityMode: 'or' })).toEqual(['a', 'b'])
    expect(run(plans, { identityIds: ['i1', 'i9'], identityMode: 'and' })).toEqual(['a'])
    expect(run(plans, { identityIds: ['i1', 'i2'], identityMode: 'and' })).toEqual([])
  })

  it('applies the owned filters only when an owned set exists', () => {
    expect(run(plans, { filterOwnedIdentity: true, filterOwnedEgo: true })).toEqual(['a', 'b', 'c'])
    expect(run(plans, { filterOwnedIdentity: true, effectiveOwned: new Set(['i1']) })).toEqual(['a', 'c'])
    expect(run(plans, { filterOwnedEgo: true, effectiveOwned: new Set(['e2']) })).toEqual(['b', 'c'])
  })

  it('narrows by every facet', () => {
    const aff = { i1: ['W'], i2: ['W', 'X'] }
    expect(run(plans, { facets: { ...none.facets, affiliation: ['W'] } }, aff)).toEqual(['a', 'b'])
    expect(run(plans, { facets: { ...none.facets, affiliation: ['W', 'X'] } }, aff)).toEqual(['b'])
    expect(run(plans, { facets: { ...none.facets, ego: ['e1'] } })).toEqual(['a'])
    expect(run(plans, { facets: { ...none.facets, gift: ['1', '2'] } })).toEqual(['b'])
    expect(run(plans, { facets: { ...none.facets, theme: ['5'] } })).toEqual(['a'])
  })

  it('combines filters', () => {
    expect(run(plans, { search: '양', keywords: ['침잠'] })).toEqual(['b'])
  })
})

describe('groupIdentitiesBySinner', () => {
  it('groups in pick order', () => {
    const out = groupIdentitiesBySinner([{ sinner_id: 's2', id: 'a' }, { sinner_id: 's1', id: 'b' }, { sinner_id: 's2', id: 'c' }])
    expect([...out.keys()]).toEqual(['s2', 's1'])
    expect(out.get('s2')!.map(i => i.id)).toEqual(['a', 'c'])
  })
})
