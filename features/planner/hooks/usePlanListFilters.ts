'use client'

import { useCallback, useMemo, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs'
import { collectFilterSinners, normalizeFormationCountParam, parseCsvParam, QUERY_OPTIONS, serializeCsvParam, toDeckFilterIdentity } from '@/features/decks'
import { useIdentityFilterOptions } from '@/features/decks/hooks/useIdentityFilterOptions'
import { normalizePlannerListKeywords } from '@/lib/planner/strip-plan-for-list'
import type { Difficulty } from '@/lib/planner/types'
import { buildPlanPageParams, buildPlanServerQueryKey, groupIdentitiesBySinner } from '../lib/plan-list'

/**
 * The community plan board's filters held in the address (sort, keywords, identities, formation count) and the
 * difficulty, what the server is asked for from them, and the identity picker's data (read only when asked for).
 */
export function usePlanListFilters() {
  const [sort, setSort] = useQueryState('sort', parseAsString.withDefault('latest'))
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [keywordQuery, setKeywordQuery] = useQueryState('kt', parseAsString.withDefault(''))
  const [keywordModeQuery, setKeywordModeQuery] = useQueryState('ktm', parseAsString.withDefault('or'))
  const [identityIdsQuery, setIdentityIdsQuery] = useQueryState('ids', parseAsString.withDefault(''))
  const [identityModeQuery, setIdentityModeQuery] = useQueryState('im', parseAsString.withDefault('or'))
  const [formationCountQuery, setFormationCountQuery] = useQueryState('fc', parseAsInteger)
  const formationCount = normalizeFormationCountParam(formationCountQuery)
  const activeKeywordList = useMemo(() => normalizePlannerListKeywords(parseCsvParam(keywordQuery)), [keywordQuery])
  const activeKeywords = useMemo(() => new Set(activeKeywordList), [activeKeywordList])
  const keywordMode: 'or' | 'and' = keywordModeQuery === 'and' ? 'and' : 'or'
  const selectedIdentityIdList = useMemo(() => parseCsvParam(identityIdsQuery), [identityIdsQuery])
  const selectedIdentityIds = useMemo(() => new Set(selectedIdentityIdList), [selectedIdentityIdList])
  const identityMode: 'or' | 'and' = identityModeQuery === 'and' ? 'and' : 'or'

  // 전체 인격 목록 (자동완성용 - 이름 + 일러스트)
  const { identities: allIdentities, ensureLoaded: ensureIdentities } = useIdentityFilterOptions({ lazy: true })

  const normalizedSort: 'latest' | 'popular' = sort === 'popular' ? 'popular' : 'latest'
  const serverQueryKey = useMemo(() => buildPlanServerQueryKey({
    sort: normalizedSort, difficulty, keywords: activeKeywordList, keywordMode, identityIds: selectedIdentityIdList, identityMode, formationCount,
  }), [normalizedSort, difficulty, activeKeywordList, keywordMode, selectedIdentityIdList, identityMode, formationCount])

  const buildPlannerSearchParams = useCallback((offset: number) => buildPlanPageParams(serverQueryKey, offset), [serverQueryKey])

  // 키워드 토글
  const toggleKeyword = useCallback((kw: string) => {
    const next = new Set(activeKeywords)
    if (next.has(kw)) next.delete(kw)
    else next.add(kw)
    void setKeywordQuery(serializeCsvParam(next), QUERY_OPTIONS)
  }, [activeKeywords, setKeywordQuery])

  const toggleKeywordMode = useCallback(() => {
    void setKeywordModeQuery(keywordMode === 'or' ? 'and' : 'or', QUERY_OPTIONS)
  }, [keywordMode, setKeywordModeQuery])

  const filterIdentities = useMemo(
    () => allIdentities.map(identity => toDeckFilterIdentity(identity, { fallbackToKeywords: true })),
    [allIdentities],
  )
  const identityFilterSinners = useMemo(() => collectFilterSinners(filterIdentities), [filterIdentities])
  const selectedIdentities = useMemo(
    () => filterIdentities.filter(identity => selectedIdentityIds.has(identity.id)),
    [filterIdentities, selectedIdentityIds],
  )
  const selectedIdentitiesBySinner = useMemo(() => groupIdentitiesBySinner(selectedIdentities), [selectedIdentities])
  const toggleSelectedIdentity = useCallback((identityId: string) => {
    const next = new Set(selectedIdentityIds)
    const target = filterIdentities.find(identity => identity.id === identityId)

    if (next.has(identityId)) {
      next.delete(identityId)
      void setIdentityIdsQuery(serializeCsvParam(next), QUERY_OPTIONS)
      return
    }

    if (target) {
      for (const identity of filterIdentities) {
        if (identity.sinner_id === target.sinner_id) next.delete(identity.id)
      }
    }

    next.add(identityId)
    void setIdentityIdsQuery(serializeCsvParam(next), QUERY_OPTIONS)
  }, [filterIdentities, selectedIdentityIds, setIdentityIdsQuery])
  const toggleIdentityMode = useCallback(() => {
    void setIdentityModeQuery(identityMode === 'or' ? 'and' : 'or', QUERY_OPTIONS)
  }, [identityMode, setIdentityModeQuery])

  return {
    setSort, difficulty, setDifficulty, keywordQuery, setKeywordQuery, identityIdsQuery, setIdentityIdsQuery, setFormationCountQuery, formationCount,
    activeKeywordList, activeKeywords, keywordMode, selectedIdentityIdList, selectedIdentityIds, identityMode,
    allIdentities, ensureIdentities, normalizedSort, serverQueryKey, buildPlannerSearchParams,
    toggleKeyword, toggleKeywordMode, filterIdentities, identityFilterSinners, selectedIdentitiesBySinner, toggleSelectedIdentity, toggleIdentityMode,
  }
}
