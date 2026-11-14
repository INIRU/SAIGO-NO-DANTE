'use client'

import { useCallback, useMemo } from 'react'
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { parseCsvParam, QUERY_OPTIONS, serializeCsvParam, toDeckFilterIdentity } from '../lib/filter-params'
import {
  buildDeckPageParams, buildDeckServerQueryKey, collectFilterSinners, hasServerBackedFilterParams,
  normalizeFormationCountParam, normalizeInfoScoreParam, type DeckSortKey,
} from '../lib/deck-list'
import { useIdentityFilterOptions } from './useIdentityFilterOptions'

// What the deck board page reads of the list's rules (not exported by the entry file: that adds to every route's first JS).
export { DECK_LIST_PAGE_SIZE, deriveDeckListData, filterDeckList, mapDeck, mergeDeckRows, normalizeSortKey } from '../lib/deck-list'
export type { DeckSortKey } from '../lib/deck-list'

/**
 * The deck list's filters held in the address (the query parameters), what the server is asked for from them, and the
 * identity picker's data. `debouncedSearch` is the search text the list currently loads for.
 */
export function useDeckListFilters({ sort, debouncedSearch, inputValue }: { sort: DeckSortKey; debouncedSearch: string; inputValue: string }) {
  const { identities: allIdentities } = useIdentityFilterOptions()

  const [filterQuery, setFilterQuery] = useQueryStates({
    contentType: parseAsString.withDefault(''),
    tags: parseAsString.withDefault(''),
    mainKeywords: parseAsString.withDefault(''),
    keywordTags: parseAsString.withDefault(''),
    formationCount: parseAsInteger,
    minInfoScore: parseAsInteger,
    identityIds: parseAsString.withDefault(''),
    mainKeywordMode: parseAsString.withDefault('or'),
    keywordTagMode: parseAsString.withDefault('or'),
    identityMode: parseAsString.withDefault('or'),
    ownedIdentity: parseAsBoolean.withDefault(false),
    ownedEgo: parseAsBoolean.withDefault(false),
  }, {
    urlKeys: {
      contentType: 'ct',
      tags: 'tags',
      mainKeywords: 'kw',
      keywordTags: 'kt',
      formationCount: 'fc',
      minInfoScore: 'score',
      identityIds: 'ids',
      mainKeywordMode: 'km',
      keywordTagMode: 'ktm',
      identityMode: 'im',
      ownedIdentity: 'oi',
      ownedEgo: 'oe',
    },
    ...QUERY_OPTIONS,
  })
  const activeContentType = filterQuery.contentType
  const activeTags = useMemo(() => new Set(parseCsvParam(filterQuery.tags)), [filterQuery.tags])
  const activeMainKeywords = useMemo(() => new Set(parseCsvParam(filterQuery.mainKeywords)), [filterQuery.mainKeywords])
  const activeKeywordTags = useMemo(() => new Set(parseCsvParam(filterQuery.keywordTags)), [filterQuery.keywordTags])
  const formationCount = normalizeFormationCountParam(filterQuery.formationCount)
  const minInfoScore = normalizeInfoScoreParam(filterQuery.minInfoScore)
  const selectedIdentityIds = useMemo(() => new Set(parseCsvParam(filterQuery.identityIds)), [filterQuery.identityIds])
  const mainKeywordMode: 'or' | 'and' = filterQuery.mainKeywordMode === 'and' ? 'and' : 'or'
  const keywordTagMode: 'or' | 'and' = filterQuery.keywordTagMode === 'and' ? 'and' : 'or'
  const identityMode: 'or' | 'and' = filterQuery.identityMode === 'and' ? 'and' : 'or'
  const filterOwnedIdentity = filterQuery.ownedIdentity
  const filterOwnedEgo = filterQuery.ownedEgo
  const serverQueryKey = useMemo(() => buildDeckServerQueryKey({
    sort,
    search: debouncedSearch,
    contentType: activeContentType,
    tags: activeTags,
    mainKeywords: activeMainKeywords,
    mainKeywordMode,
    keywordTags: activeKeywordTags,
    keywordTagMode,
    formationCount,
    minInfoScore,
    identityIds: selectedIdentityIds,
    identityMode,
  }), [
    sort,
    debouncedSearch,
    activeContentType,
    activeTags,
    activeMainKeywords,
    mainKeywordMode,
    activeKeywordTags,
    keywordTagMode,
    formationCount,
    minInfoScore,
    selectedIdentityIds,
    identityMode,
  ])
  const hasServerBackedFilters = useMemo(() => hasServerBackedFilterParams(serverQueryKey), [serverQueryKey])
  const buildDeckSearchParams = useCallback((offset: number) => buildDeckPageParams(serverQueryKey, offset), [serverQueryKey])

  // The board's affiliation and E.G.O facets are not counted here; the list screen adds them.
  const hasAnyFilter = Boolean(inputValue || activeContentType || activeTags.size > 0 || activeKeywordTags.size > 0 || activeMainKeywords.size > 0 || formationCount !== null || minInfoScore !== null || selectedIdentityIds.size > 0 || filterOwnedIdentity || filterOwnedEgo)

  // ── Tag / keyword toggles ──
  const toggleTag = useCallback((tag: string) => {
    const next = new Set(activeTags)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    void setFilterQuery({ tags: serializeCsvParam(next) })
  }, [activeTags, setFilterQuery])

  const toggleMainKeyword = useCallback((kw: string) => {
    const next = new Set(activeMainKeywords)
    if (next.has(kw)) next.delete(kw)
    else next.add(kw)
    void setFilterQuery({ mainKeywords: serializeCsvParam(next) })
  }, [activeMainKeywords, setFilterQuery])

  const toggleKeywordTag = useCallback((kw: string) => {
    const next = new Set(activeKeywordTags)
    if (next.has(kw)) next.delete(kw)
    else next.add(kw)
    void setFilterQuery({ keywordTags: serializeCsvParam(next) })
  }, [activeKeywordTags, setFilterQuery])

  // ── Identity picker ──
  const filterIdentities = useMemo(
    () => allIdentities.map(identity => toDeckFilterIdentity(identity)),
    [allIdentities],
  )
  const filterSinners = useMemo(() => collectFilterSinners(filterIdentities), [filterIdentities])
  const selectedIdentities = useMemo(
    () => filterIdentities.filter(identity => selectedIdentityIds.has(identity.id)),
    [filterIdentities, selectedIdentityIds],
  )
  const toggleSelectedIdentity = useCallback((identityId: string) => {
    const next = new Set(selectedIdentityIds)
    const target = filterIdentities.find(identity => identity.id === identityId)

    if (next.has(identityId)) {
      next.delete(identityId)
      void setFilterQuery({ identityIds: serializeCsvParam(next) })
      return
    }

    if (target) {
      for (const identity of filterIdentities) {
        if (identity.sinner_id === target.sinner_id) next.delete(identity.id)
      }
    }

    next.add(identityId)
    void setFilterQuery({ identityIds: serializeCsvParam(next) })
  }, [filterIdentities, selectedIdentityIds, setFilterQuery])

  const advancedFilterCount = activeTags.size + activeKeywordTags.size + activeMainKeywords.size + (formationCount !== null ? 1 : 0) + (minInfoScore !== null ? 1 : 0) + selectedIdentityIds.size + (filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0)

  return {
    allIdentities, setFilterQuery,
    activeContentType, activeTags, activeMainKeywords, activeKeywordTags, formationCount, minInfoScore, selectedIdentityIds,
    mainKeywordMode, keywordTagMode, identityMode, filterOwnedIdentity, filterOwnedEgo,
    serverQueryKey, hasServerBackedFilters, buildDeckSearchParams, hasAnyFilter, advancedFilterCount,
    toggleTag, toggleMainKeyword, toggleKeywordTag,
    filterIdentities, filterSinners, selectedIdentities, toggleSelectedIdentity,
  }
}
