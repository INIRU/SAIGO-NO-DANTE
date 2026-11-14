import { missingFormationCount } from '@/lib/collection'
import { THEME_KEYWORDS } from '@/lib/constants/keywords'
import { normalizePlannerListKeywords, type PlanSummary } from '@/lib/planner/strip-plan-for-list'
import { parseSearchQuery, termMatchesAny } from '@/lib/utils/search'

// A multiple of 6, so every page fills whole rows of the one-, two- and three-column grids.
export const PLAN_LIST_PAGE_SIZE = 24

const COMBAT_KEYWORDS = ['참격', '관통', '타격'] as const

/** 항상 전투 속성 키워드를 먼저 보여주고, 전체 테마 키워드를 중복 없이 이어붙인다. */
export const PLAN_FILTER_KEYWORDS = [...new Set([...COMBAT_KEYWORDS, ...THEME_KEYWORDS])]

export type PlanFilterIndex = {
  plan: PlanSummary
  searchableFields: string[]
  filterKeywordSet: Set<string>
  identityIds: string[]
  egoIds: string[]
  affiliations: Set<string>
  giftIds: Set<string>
  themeIds: Set<string>
}

// 플랜의 모든 인격 이름 (검색용) — API가 pre-compute한 값 우선 사용
export function getPlanIdentityNames(plan: PlanSummary): string[] {
  return plan.identity_names ?? []
}

// 플랜 테마 키워드 — API가 서버사이드에서 pre-compute한 값 사용
export function getPlanThemeKeywords(plan: PlanSummary): string[] {
  return plan.theme_keywords ?? []
}

export function getPlanFilterKeywords(plan: PlanSummary): string[] {
  return normalizePlannerListKeywords([
    ...(plan.filter_keywords ?? getPlanThemeKeywords(plan)),
    ...(plan.selected_keywords ?? []),
  ])
}

export type PlanServerQuery = {
  sort: 'latest' | 'popular'
  difficulty: string | null
  keywords: readonly string[]
  keywordMode: 'or' | 'and'
  identityIds: readonly string[]
  identityMode: 'or' | 'and'
  formationCount: number | null
}

/** The sorted query string the plan API is asked with; the list starts over when it changes. */
export function buildPlanServerQueryKey(query: PlanServerQuery) {
  const params = new URLSearchParams()
  params.set('sort', query.sort)
  if (query.difficulty) params.set('difficulty', query.difficulty)
  if (query.keywords.length > 0) {
    params.set('keyword_tags', query.keywords.join(','))
    params.set('keyword_tag_mode', query.keywordMode)
  }
  if (query.identityIds.length > 0) {
    params.set('identity_ids', query.identityIds.join(','))
    params.set('identity_mode', query.identityMode)
  }
  if (query.formationCount !== null) params.set('formation_count', String(query.formationCount))
  params.sort()
  return params.toString()
}

/** One page request of the plan API. */
export function buildPlanPageParams(serverQueryKey: string, offset: number) {
  const params = new URLSearchParams(serverQueryKey)
  params.set('limit', String(PLAN_LIST_PAGE_SIZE))
  params.set('offset', String(offset))
  return params
}

/** What each plan is matched against in the browser: text, keywords, identities, E.G.O, affiliations, gifts and theme packs. */
export function buildPlanFilterIndexes(plans: PlanSummary[], identityAffiliations: Record<string, string[]> | undefined): PlanFilterIndex[] {
  return plans.map(plan => ({
    plan,
    searchableFields: [
      plan.title,
      plan.description ?? '',
      ...getPlanIdentityNames(plan),
    ],
    filterKeywordSet: new Set(getPlanFilterKeywords(plan)),
    identityIds: (plan.deck ?? [])
      .map(s => s.identity_id)
      .filter((id): id is string => Boolean(id)),
    egoIds: (plan.egos ?? [])
      .map(e => e.ego_id)
      .filter((id): id is string => Boolean(id)),
    affiliations: new Set((plan.deck ?? []).filter(slot => (slot.slot_order ?? 99) < 99)
      .flatMap(slot => (slot.identity_id && identityAffiliations?.[slot.identity_id]) || [])),
    giftIds: new Set((plan.gift_ids ?? []).map(String)),
    themeIds: new Set((plan.theme_ids ?? []).map(String)),
  }))
}

export type PlanClientFilter = {
  search: string
  keywords: readonly string[]
  keywordMode: 'or' | 'and'
  identityIds: readonly string[]
  identityMode: 'or' | 'and'
  filterOwnedIdentity: boolean
  filterOwnedEgo: boolean
  effectiveOwned: ReadonlySet<string> | null | undefined
  facets: { affiliation: readonly string[]; ego: readonly string[]; gift: readonly string[]; theme: readonly string[] }
}

const hasAll = (selected: readonly string[], values: ReadonlySet<string>) => selected.every(value => values.has(value))

/** The filters the browser applies on the loaded plans (the server narrows by keyword, identity and formation count too). */
export function filterPlanIndexes(indexes: PlanFilterIndex[], filter: PlanClientFilter): PlanSummary[] {
  const { search, keywords, keywordMode, identityIds, identityMode, filterOwnedIdentity, filterOwnedEgo, effectiveOwned } = filter
  let list = indexes

  // 텍스트 검색: 인격 + 제목 + 설명 (+: OR, *: AND)
  if (search.trim()) {
    const parsed = parseSearchQuery(search)
    if (parsed.terms.length > 0) {
      list = list.filter(({ searchableFields }) => {
        if (parsed.mode === 'and') {
          return parsed.terms.every(term => termMatchesAny(term, searchableFields))
        } else {
          return parsed.terms.some(term => termMatchesAny(term, searchableFields))
        }
      })
    }
  }

  // 키워드 필터
  if (keywords.length > 0) {
    list = list.filter(({ filterKeywordSet }) => {
      if (keywordMode === 'and') {
        return keywords.every(kw => filterKeywordSet.has(kw))
      } else {
        return keywords.some(kw => filterKeywordSet.has(kw))
      }
    })
  }

  // 선택 인격 필터: 서버 결과에 대한 안전한 fallback
  if (identityIds.length > 0) {
    list = list.filter(({ identityIds: planIdentityIds }) => {
      if (identityMode === 'and') {
        return identityIds.every(id => planIdentityIds.includes(id))
      }
      return identityIds.some(id => planIdentityIds.includes(id))
    })
  }

  // 보유 인격 필터
  if (filterOwnedIdentity && effectiveOwned) {
    // 카드 뱃지와 같은 기준: 편성 순서가 있는 인격만(대기 인격은 없어도 된다)
    list = list.filter(({ plan }) => missingFormationCount((plan.deck ?? []).map(slot => ({ id: slot.identity_id, slot_order: slot.slot_order })), effectiveOwned) === 0)
  }

  // 보유 에고 필터
  if (filterOwnedEgo && effectiveOwned) {
    list = list.filter(({ egoIds }) => {
      if (egoIds.length === 0) return true
      return egoIds.every(id => effectiveOwned.has(id))
    })
  }

  const { affiliation, ego, gift, theme } = filter.facets
  if (affiliation.length) list = list.filter(({ affiliations }) => hasAll(affiliation, affiliations))
  if (ego.length) list = list.filter(({ egoIds }) => hasAll(ego, new Set(egoIds)))
  if (gift.length) list = list.filter(({ giftIds }) => hasAll(gift, giftIds))
  if (theme.length) list = list.filter(({ themeIds }) => hasAll(theme, themeIds))

  return list.map(({ plan }) => plan)
}

/** The picked identities grouped by their sinner, in pick order. */
export function groupIdentitiesBySinner<T extends { sinner_id: string }>(identities: readonly T[]) {
  const grouped = new Map<string, T[]>()
  for (const identity of identities) {
    const group = grouped.get(identity.sinner_id) ?? []
    group.push(identity)
    grouped.set(identity.sinner_id, group)
  }
  return grouped
}
