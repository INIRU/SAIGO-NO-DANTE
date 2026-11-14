'use client'

import { useLoadMoreSentinel } from '@/hooks/useLoadMoreSentinel'

import DiscoveryShelf, { type InitialShelf } from '@/features/community/components/DiscoveryShelf'
import BoardBrowseLock from '@/features/community/components/BoardBrowseLock'

import { getIdentityPortraitUrl } from '@/lib/utils/images'
import { useState, useEffect, useMemo, useCallback, useRef, useTransition } from 'react'
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryState, useQueryStates } from 'nuqs'
import { useSession } from 'next-auth/react'
import { Link } from '@/lib/i18n/navigation'
import { type DeckSummary } from '@/features/decks/components/DeckCard'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { decodeCollectionAsync, missingFormationCount, withBaseIdentities } from '@/lib/collection'
import { useOwnedIdentities } from '@/features/catalog/hooks/useOwnedIdentities'
import { FacetPickerModal, FacetSections, type FacetKind } from '@/features/community/components/FacetPicker'
import { hasAll, useBoardFacets } from '@/features/community/hooks/useBoardFacets'
import type { CollectionData } from '@/lib/collection'
import { getActiveTerm } from '@/lib/utils/search'
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import { DECK_MAIN_KEYWORDS } from '@/lib/decks/keyword-rules'
import DeckListFilters from '@/features/decks/components/DeckListFilters'
import { BoardResults, BrowseBar } from '@/features/community/components/Browse'
import type { RowPost } from '@/features/community/components/BoardParts'
import {
  type SearchSuggestion,
} from '@/features/decks'
import type { DeckFilterIdentity } from '@/features/decks/components/DeckIdentityFilterModal'
import { useLocale, useTranslations } from 'next-intl'
import { showError } from '@/lib/toast'
import { useRoutePrefetch } from '@/lib/hooks/useRoutePrefetch'
import { useAutocompleteKeys } from '@/hooks/useAutocompleteKeys'

const PAGE_SIZE = 12
const THEME_KEYWORD_SET = new Set<string>(THEME_KEYWORDS)
const PINNED_DECK_KEYWORDS = [...DECK_MAIN_KEYWORDS]
const QUERY_OPTIONS = { history: 'replace', shallow: true, scroll: false } as const
const IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS = 'id, sinner_id, name_kr, name_en, name_jp, rarity, release_date, keywords, skill_keyword_list, folder_name, game_id, hp, speed_min, speed_max, def_level, sinner:sinners(id, name_kr, order_num)'
const IDENTITY_FILTER_SELECT_LEGACY = 'id, sinner_id, name_kr, name_en, name_jp, rarity, release_date, keywords, folder_name, game_id, hp, speed_min, speed_max, def_level, sinner:sinners(id, name_kr, order_num)'

type SortKey = 'latest' | 'popular'
type IdentityNameEntry = {
  id: string
  name: string
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
  sinner_id: string
  folder_name: string | null
  game_id: string | null
  rarity: number
  release_date?: string | null
  keywords: string[] | null
  skill_keyword_list?: string[] | null
  hp: number | null
  speed_min: number | null
  speed_max: number | null
  def_level: number | null
  sinner?: {
    id: string
    name_kr: string
    order_num: number
  } | { id: string; name_kr: string; order_num: number }[] | null
}

type DeckDerivedIndex = {
  egoIds: string[]
  /** Identities in the formation order (the board's affiliation facet reads these). */
  formedIdentityIds: string[]
}

function buildDeckDerivedIndex(deck: DeckSummary): DeckDerivedIndex {
  return {
    egoIds: (deck.deck_egos ?? []).map(e => e.ego_id),
    formedIdentityIds: (deck.deck_identities ?? []).filter(slot => slot.slot_order < 99 && slot.identities?.id).map(slot => slot.identities!.id),
  }
}

function toDeckFilterIdentity(identity: IdentityNameEntry): DeckFilterIdentity {
  const sinner = Array.isArray(identity.sinner) ? identity.sinner[0] : identity.sinner
  return {
    id: identity.id,
    sinner_id: identity.sinner_id,
    name: identity.name_kr,
    name_kr: identity.name_kr,
    name_en: identity.name_en,
    name_jp: identity.name_jp,
    rarity: identity.rarity,
    release_date: identity.release_date ?? undefined,
    keywords: identity.keywords ?? [],
    skill_keyword_list: identity.skill_keyword_list ?? [],
    folder_name: identity.folder_name,
    game_id: identity.game_id,
    hp: identity.hp ?? 0,
    speed_min: identity.speed_min ?? 0,
    speed_max: identity.speed_max ?? 0,
    def_level: identity.def_level ?? 0,
    tier: 0,
    sinner: sinner ?? null,
  }
}

function mapDeck(d: { profiles?: { username?: string; avatar_url?: string | null; public_profile?: boolean } | null } & DeckSummary): DeckSummary {
  return { ...d, username: d.profiles?.username ?? undefined, avatar_url: d.profiles?.avatar_url ?? null, profile_public: d.profiles?.public_profile }
}

function mergeDeckRows(existing: DeckSummary[], incoming: DeckSummary[]) {
  const byId = new Map<string, DeckSummary>()
  const orderedIds: string[] = []

  for (const deck of [...existing, ...incoming]) {
    if (!byId.has(deck.id)) orderedIds.push(deck.id)
    byId.set(deck.id, deck)
  }

  return orderedIds.map(id => byId.get(id)!)
}

interface DecksClientProps {
  initialDecks?: DeckSummary[]
  initialTotal?: number
  initialSort?: SortKey
  initialShelf?: InitialShelf
}

function normalizeSortKey(value: string): SortKey {
  return value === 'popular' ? 'popular' : 'latest'
}

function parseCsvParam(value: string) {
  if (!value) return []
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function serializeCsvParam(values: Iterable<string>) {
  const serialized = [...values].filter(Boolean).join(',')
  return serialized || null
}

function normalizeFormationCountParam(value: number | null) {
  return Number.isInteger(value) && value !== null && value >= 1 && value <= 12 ? value : null
}

function normalizeInfoScoreParam(value: number | null) {
  return Number.isInteger(value) && value !== null && value >= 1 && value <= 3 ? value : null
}

function appendCsvParam(params: URLSearchParams, name: string, values: Iterable<string>) {
  const serialized = [...values].filter(Boolean).join(',')
  if (serialized) params.set(name, serialized)
}

export default function DecksClient({
  initialDecks,
  initialSort = 'latest',
  initialShelf,
}: DecksClientProps = {}) {
  const locale = useLocale()
  const t = useTranslations('decks')
  useRoutePrefetch([`/${locale}/decks/new`])
  const { iconMap: kwIconMap, getIconUrl } = useKeywordData()
  const ALL_KEYWORDS = useMemo(() => Object.keys(kwIconMap), [kwIconMap])
  const { status: authStatus } = useSession()

  // ── Deck data state ──
  const hasServerInitialDecks = initialDecks !== undefined
  const [decks, setDecks] = useState<DeckSummary[]>(() => mergeDeckRows([], initialDecks ?? []))
  const [loading, setLoading] = useState(!hasServerInitialDecks)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const scrollRootRef = useRef<HTMLDivElement>(null)
  const initialDataKey = useRef<string | null>(hasServerInitialDecks ? initialSort : null)
  const deckRequestId = useRef(0)
  const [filterSignal, setFilterSignal] = useState(0)
  const loadMoreRequestId = useRef(0)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  const loadMoreFailedRef = useRef(false)
  const [, startTransition] = useTransition()

  // ── URL-synced state ──
  const [browse, setBrowse] = useQueryState('browse', parseAsString.withDefault(''))
  const [sortQuery, setSortQuery] = useQueryState('sort', parseAsString.withDefault('latest'))
  const sort = normalizeSortKey(sortQuery)
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const latestSortRef = useRef(sort)
  const latestServerQueryRef = useRef('')

  // ── Search UI state ──
  const [inputValue, setInputValue] = useState(search)
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [acIndex, setAcIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)

  // ── Identity autocomplete data ──
  const [allIdentities, setAllIdentities] = useState<IdentityNameEntry[]>([])
  useEffect(() => {
    async function loadIdentities() {
      try {
        const { createClient: createBrowserClient } = await import('@/lib/supabase/client')
        const supabase = createBrowserClient()
        const buildQuery = (select: string) => supabase
            .schema('limbus')
            .from('identities')
            .select(select)
            .order('sinner_id')
            .order('rarity', { ascending: false })
            .order('name_kr')

        let { data, error } = await buildQuery(IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS)
        if (error && error.message.includes('skill_keyword_list')) {
          const legacyResult = await buildQuery(IDENTITY_FILTER_SELECT_LEGACY)
          data = legacyResult.data
          error = legacyResult.error
        }

        if (error) throw error
        if (data) setAllIdentities(data as unknown as IdentityNameEntry[])
      } catch (error) {
        console.error('인격 필터 데이터 로드 실패:', error)
      }
    }

    loadIdentities()
  }, [])

  // ── Search suggestions ──
  const suggestions = useMemo((): SearchSuggestion[] => {
    const { activeTerm } = getActiveTerm(inputValue)
    if (activeTerm.length === 0) return []
    const q = activeTerm.toLowerCase()

    const sortByRelevance = (a: string, b: string) => {
      const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1
      const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
      return a.length - b.length
    }

    const idMatches: SearchSuggestion[] = allIdentities
      .filter(id => id.name_kr.toLowerCase().includes(q))
      .sort((a, b) => sortByRelevance(a.name_kr, b.name_kr))
      .slice(0, 5)
      .map(id => ({
        label: id.name_kr,
        type: 'identity',
        imageUrl: id.game_id && id.folder_name && id.sinner_id
          ? getIdentityPortraitUrl(id.sinner_id, id.folder_name, id.game_id, false)
          : undefined,
      }))

    const kwMatches: SearchSuggestion[] = ALL_KEYWORDS
      .filter(kw => kw.toLowerCase().includes(q))
      .sort(sortByRelevance)
      .slice(0, 5)
      .map(label => ({ label, type: 'keyword' }))

    return [...idMatches, ...kwMatches].slice(0, 8)
  }, [inputValue, ALL_KEYWORDS, allIdentities])

  useEffect(() => { setAcIndex(suggestions.length > 0 ? 0 : -1) }, [suggestions.length])

  // ── Keyboard handler for autocomplete ──
  const handleSearchKeyDown = useAutocompleteKeys({
    open: showSuggestions, count: suggestions.length, index: acIndex, setOpen: setShowSuggestions, setIndex: setAcIndex,
    onPick: e => {
      const selected = suggestions[acIndex].label
      const { prefix } = getActiveTerm(inputValue)
      e.currentTarget.blur()
      setShowSuggestions(false)
      setAcIndex(-1)
      setTimeout(() => {
        setInputValue(prefix + selected);
        (e.target as HTMLInputElement).focus()
      }, 10)
    },
  })

  // ── Outside click closes suggestions ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        setAcIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Search debounce ──
  useEffect(() => {
    const t = setTimeout(() => {
      const nextSearch = inputValue.trim()
      if (nextSearch === search.trim()) {
        setDebouncedSearch(inputValue)
        return
      }
      startTransition(() => {
        void setSearch(nextSearch || null, QUERY_OPTIONS)
      })
      setDebouncedSearch(inputValue)
    }, 300)
    return () => clearTimeout(t)
  }, [inputValue, search, setSearch, startTransition])

  // ── URL-synced filter state ──
  // 소속·E.G.O: 고른 것을 모두 담은 덱만 남긴다(플랜 게시판과 같은 선택 창)
  const [affiliationQuery, setAffiliationQuery] = useQueryState('af', parseAsString.withDefault(''))
  const [egoFacetQuery, setEgoFacetQuery] = useQueryState('eg', parseAsString.withDefault(''))
  const csv = (value: string) => value ? value.split(',').map(item => item.trim()).filter(Boolean) : []
  const facetSelections: Record<FacetKind, string[]> = { affiliation: csv(affiliationQuery), ego: csv(egoFacetQuery), gift: [], theme: [] }
  const toggleFacet = (kind: FacetKind, id: string) => {
    const next = new Set(facetSelections[kind])
    if (next.has(id)) next.delete(id)
    else next.add(id)
    const value = [...next].join(',') || null
    void (kind === 'affiliation' ? setAffiliationQuery(value, QUERY_OPTIONS) : setEgoFacetQuery(value, QUERY_OPTIONS))
  }
  const [facetModal, setFacetModal] = useState<FacetKind | null>(null)
  const facetData = useBoardFacets('deck').data
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
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(true)
  const [showTagFilter, setShowTagFilter] = useState(true)
  const [showKeywordFilter, setShowKeywordFilter] = useState(true)
  const [showCollectionFilter, setShowCollectionFilter] = useState(true)
  const serverQueryKey = useMemo(() => {
    const params = new URLSearchParams()
    params.set('sort', sort)
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim())
    if (activeContentType) params.set('content_type', activeContentType)
    appendCsvParam(params, 'tags', activeTags)
    appendCsvParam(params, 'main_keywords', activeMainKeywords)
    if (activeMainKeywords.size > 0) params.set('main_keyword_mode', mainKeywordMode)
    appendCsvParam(params, 'keyword_tags', activeKeywordTags)
    if (activeKeywordTags.size > 0) params.set('keyword_tag_mode', keywordTagMode)
    if (formationCount !== null) params.set('formation_count', String(formationCount))
    if (minInfoScore !== null) params.set('min_info_score', String(minInfoScore))
    appendCsvParam(params, 'identity_ids', selectedIdentityIds)
    if (selectedIdentityIds.size > 0) params.set('identity_mode', identityMode)
    params.sort()
    return params.toString()
  }, [
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
  const hasServerBackedFilters = useMemo(() => {
    const params = new URLSearchParams(serverQueryKey)
    params.delete('sort')
    params.delete('lang')
    return params.toString().length > 0
  }, [serverQueryKey])
  const buildDeckSearchParams = useCallback((offset: number) => {
    const params = new URLSearchParams(serverQueryKey)
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(offset))
    return params
  }, [serverQueryKey])

  // ── Collection filter state ──
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null)
  const [collectionLoading, setCollectionLoading] = useState(false)
  const [hasCollection, setHasCollection] = useState(false)
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)
  const collectionRequestRef = useRef<Promise<CollectionData | null> | null>(null)

  const hasAnyFilter = Boolean(inputValue || activeContentType || activeTags.size > 0 || activeKeywordTags.size > 0 || activeMainKeywords.size > 0 || formationCount !== null || minInfoScore !== null || selectedIdentityIds.size > 0 || filterOwnedIdentity || filterOwnedEgo || affiliationQuery || egoFacetQuery)
  // Only browsing all or filtering shows the list; the default view is the discovery shelf, so nothing is loaded for it.
  const listVisible = browse === 'all' || hasAnyFilter

  // ── Initial deck load (skip if server data present) ──
  useEffect(() => {
    if (!listVisible) return
    if (!hasServerBackedFilters && initialDataKey.current === sort) {
      initialDataKey.current = null
      if (initialDecks && mergeDeckRows([], initialDecks).length < PAGE_SIZE) setHasMore(false)
      setLoading(false)
      setRefreshing(false)
      latestSortRef.current = sort
      latestServerQueryRef.current = serverQueryKey
      return
    }
    latestSortRef.current = sort
    latestServerQueryRef.current = serverQueryKey
    const requestId = deckRequestId.current + 1
    deckRequestId.current = requestId
    const controller = new AbortController()
    const hasExistingDecks = decks.length > 0
    setLoading(!hasExistingDecks)
    setRefreshing(hasExistingDecks)
    setLoadingMore(false)
    setHasMore(true)
    loadMoreFailedRef.current = false
    const params = buildDeckSearchParams(0)
    fetch(`/api/decks?${params.toString()}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => {
        if (deckRequestId.current !== requestId) return
        if (Array.isArray(data)) {
          const nextDecks = mergeDeckRows([], data.map(mapDeck))
          setDecks(nextDecks)
          if (data.length < PAGE_SIZE || nextDecks.length < PAGE_SIZE) setHasMore(false)
        }
      })
      .catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        console.error('덱 목록 로드 실패:', e)
        if (deckRequestId.current === requestId) showError(t('result.loadFailed'))
      })
      .finally(() => {
        if (deckRequestId.current !== requestId) return
        setLoading(false)
        setRefreshing(false)
      })
    return () => controller.abort()
  }, [listVisible, sort, serverQueryKey, hasServerBackedFilters, buildDeckSearchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load more ──
  const loadMore = useCallback(() => {
    // A failed page is not retried on its own (the sentinel would re-fire it at once); a new filter or sort clears this.
    if (loading || refreshing || loadingMore || !hasMore || loadMoreFailedRef.current) return
    setLoadingMore(true)
    loadMoreAbortRef.current?.abort()
    const requestId = loadMoreRequestId.current + 1
    loadMoreRequestId.current = requestId
    const controller = new AbortController()
    loadMoreAbortRef.current = controller
    const requestSort = sort
    const requestQueryKey = serverQueryKey
    const params = buildDeckSearchParams(decks.length)
    fetch(`/api/decks?${params.toString()}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => {
        if (loadMoreRequestId.current !== requestId || latestSortRef.current !== requestSort || latestServerQueryRef.current !== requestQueryKey) return
        if (!Array.isArray(data) || data.length === 0) { setHasMore(false); return }
        if (data.length < PAGE_SIZE) setHasMore(false)
        setDecks(prev => mergeDeckRows(prev, data.map(mapDeck)))
      })
      .catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        console.error('덱 추가 로드 실패:', e)
        if (loadMoreRequestId.current === requestId) {
          loadMoreFailedRef.current = true
          showError(t('result.loadFailed'))
        }
      })
      .finally(() => {
        if (loadMoreRequestId.current === requestId) {
          loadMoreAbortRef.current = null
        }
        if (loadMoreRequestId.current === requestId && latestSortRef.current === requestSort && latestServerQueryRef.current === requestQueryKey) setLoadingMore(false)
      })
  }, [sort, serverQueryKey, buildDeckSearchParams, decks.length, loading, refreshing, loadingMore, hasMore])

  useEffect(() => {
    loadMoreAbortRef.current?.abort()
    loadMoreRequestId.current += 1
    setLoadingMore(false)
  }, [serverQueryKey])

  // ── Infinite scroll observer ──
  const sentinelRef = useLoadMoreSentinel(loadMore, scrollRootRef, serverQueryKey)

  const ensureCollectionData = useCallback(async () => {
    if (collectionData) return collectionData
    if (!collectionRequestRef.current) {
      setCollectionLoading(true)
      collectionRequestRef.current = fetch('/api/collection')
        .then(r => r.json())
        .then((d: CollectionData) => {
          if (!d.sinners?.length) return null
          setCollectionData(d)
          return d
        })
        .catch(() => null)
        .finally(() => {
          collectionRequestRef.current = null
          setCollectionLoading(false)
        })
    }
    return collectionRequestRef.current
  }, [collectionData])

  const loadProfileCollection = useCallback(async () => {
    if (authStatus !== 'authenticated') return false
    setCollectionLoading(true)
    try {
      const data = await ensureCollectionData()
      if (!data) return false
      const profileData = await fetch('/api/profile').then(r => r.json()) as { profile?: { collection_code?: string | null } }
      const code = profileData.profile?.collection_code
      if (!code) return false
      const ticked = await decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
      // An empty code is invalid; LCB identities are added only after that check.
      const decoded = ticked.size ? withBaseIdentities(ticked, data.identities) : ticked
      setOwnedIds(decoded)
      setHasCollection(true)
      return true
    } catch {
      return false
    } finally {
      setCollectionLoading(false)
    }
  }, [authStatus, ensureCollectionData])

  // ── Auto-load collection for logged-in user ──
  useEffect(() => {
    void loadProfileCollection()
  }, [loadProfileCollection])

  const applyCollectionCode = useCallback(async (rawInput: string) => {
    setCodeError(false)
    let code = rawInput.trim()
    try {
      const url = new URL(code)
      code = url.searchParams.get('code') ?? code
    } catch { /* not a URL, use as-is */ }
    if (!code) return
    try {
      const data = await ensureCollectionData()
      if (!data) { setCodeError(true); return }
      const ticked = await decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
      // An empty code is invalid; LCB identities are added only after that check.
      const decoded = ticked.size ? withBaseIdentities(ticked, data.identities) : ticked
      if (decoded.size === 0) { setCodeError(true); return }
      setOwnedIds(decoded)
      setHasCollection(true)
    } catch {
      setCodeError(true)
    }
  }, [ensureCollectionData])

  const toggleFilterOwnedIdentity = useCallback(async () => {
    let hasOwnedIds = ownedIds !== null
    if (!hasOwnedIds && authStatus === 'authenticated') {
      hasOwnedIds = await loadProfileCollection()
    }
    if (!hasOwnedIds) return
    void setFilterQuery({ ownedIdentity: !filterOwnedIdentity })
  }, [authStatus, filterOwnedIdentity, loadProfileCollection, ownedIds, setFilterQuery])

  const toggleFilterOwnedEgo = useCallback(async () => {
    let hasOwnedIds = ownedIds !== null
    if (!hasOwnedIds && authStatus === 'authenticated') {
      hasOwnedIds = await loadProfileCollection()
    }
    if (!hasOwnedIds) return
    void setFilterQuery({ ownedEgo: !filterOwnedEgo })
  }, [authStatus, filterOwnedEgo, loadProfileCollection, ownedIds, setFilterQuery])

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

  // ── Derived filter data ──
  const deckDerived = useMemo(() => {
    const byId = new Map<string, DeckDerivedIndex>()
    const tagFreq: Record<string, number> = {}
    const keywordCandidateFreq: Record<string, number> = {}

    for (const d of decks) {
      const index = buildDeckDerivedIndex(d)
      byId.set(d.id, index)
      for (const slot of d.deck_identities ?? []) {
        const identity = slot?.identities
        if (!identity || slot.slot_order >= 99) continue
        for (const rawKeyword of identity.keywords ?? []) {
          const kw = rawKeyword.trim()
          if (!kw) continue
          keywordCandidateFreq[kw] = (keywordCandidateFreq[kw] ?? 0) + 1
          const normalized = normalizeThemeKeyword(kw)
          if (normalized !== kw && THEME_KEYWORD_SET.has(normalized)) {
            keywordCandidateFreq[normalized] = (keywordCandidateFreq[normalized] ?? 0) + 1
          }
        }
      }
      for (const t of d.tags ?? []) {
        tagFreq[t] = (tagFreq[t] ?? 0) + 1
      }
    }

    return {
      byId,
      allTags: Object.entries(tagFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([tag]) => tag),
      availableKeywords: [
        ...PINNED_DECK_KEYWORDS,
      ],
      keywordCandidates: Object.entries(keywordCandidateFreq)
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1]
          return a[0].localeCompare(b[0], 'ko')
        })
        .map(([kw]) => kw),
    }
  }, [decks])

  const allTags = deckDerived.allTags
  const availableKeywords = deckDerived.availableKeywords
  const keywordCandidates = deckDerived.keywordCandidates
  const filterIdentities = useMemo(
    () => allIdentities.map(toDeckFilterIdentity),
    [allIdentities],
  )
  const filterSinners = useMemo(() => {
    const byId = new Map<string, { id: string; name_kr: string; order_num: number }>()
    for (const identity of filterIdentities) {
      if (!identity.sinner) continue
      byId.set(identity.sinner.id, identity.sinner)
    }
    return [...byId.values()].sort((a, b) => a.order_num - b.order_num)
  }, [filterIdentities])
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

  // 붙여 넣은 보유 코드가 없으면 카드 뱃지와 같은 저장된 보유 현황을 쓴다(링크로 oi=1이 먼저 켜져도 바로 걸린다)
  const profileOwned = useOwnedIdentities()
  const effectiveOwned = ownedIds ?? profileOwned
  // ── Filter application ──
  const filtered = useMemo(() => {
    let list = decks

    if (filterOwnedIdentity && effectiveOwned) {
      // 카드 뱃지와 같은 기준: 편성 순서가 있는 인격만(대기 인격은 없어도 된다)
      list = list.filter(d => missingFormationCount((d.deck_identities ?? []).map(slot => ({ id: slot.identities?.id, slot_order: slot.slot_order })), effectiveOwned) === 0)
    }

    if (filterOwnedEgo && effectiveOwned) {
      list = list.filter(d => {
        const egoIds = deckDerived.byId.get(d.id)?.egoIds ?? []
        return egoIds.length === 0 || egoIds.every(id => effectiveOwned.has(id))
      })
    }

    const { affiliation, ego } = facetSelections
    if (affiliation.length) list = list.filter(d => hasAll(affiliation, new Set((deckDerived.byId.get(d.id)?.formedIdentityIds ?? [])
      .flatMap(id => facetData?.identityAffiliations[id] ?? []))))
    if (ego.length) list = list.filter(d => hasAll(ego, new Set(deckDerived.byId.get(d.id)?.egoIds ?? [])))

    return list
  }, [decks, deckDerived, filterOwnedIdentity, filterOwnedEgo, effectiveOwned, affiliationQuery, egoFacetQuery, facetData]) // eslint-disable-line react-hooks/exhaustive-deps

  const advancedFilterCount = activeTags.size + activeKeywordTags.size + activeMainKeywords.size + (formationCount !== null ? 1 : 0) + (minInfoScore !== null ? 1 : 0) + selectedIdentityIds.size + (filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0) + facetSelections.affiliation.length + facetSelections.ego.length

  if (!listVisible) return <DiscoveryShelf kind="deck" initialData={initialShelf} onBrowse={() => setBrowse('all', { history: 'push' })} />

  return (
    <div data-board-browse className="relative min-h-0 flex-1 px-4 pb-4 md:px-6 lg:overflow-hidden">
      <BoardBrowseLock />

      <div className="relative z-[1] mx-auto flex h-full min-h-0 w-full max-w-7xl gap-5">
        {/* ── 필터 패널 ── */}
        <DeckListFilters
          openSignal={filterSignal}
          inputValue={inputValue}
          onInputChange={v => { setInputValue(v); setShowSuggestions(true) }}
          onInputFocus={() => setShowSuggestions(true)}
          onSearchClear={() => { setInputValue(''); void setSearch(null, QUERY_OPTIONS); setDebouncedSearch(''); setShowSuggestions(false) }}
          onSearchKeyDown={handleSearchKeyDown}
          searchRef={searchRef}
          showSuggestions={showSuggestions}
          suggestions={suggestions}
          acIndex={acIndex}
          onSuggestionClick={label => {
            const { prefix } = getActiveTerm(inputValue)
            setInputValue(prefix + label)
            setShowSuggestions(false)
            setAcIndex(-1)
          }}
          getIconUrl={getIconUrl}
          sort={sort}
          onSortChange={s => { void setSortQuery(s as SortKey, QUERY_OPTIONS) }}
          activeContentType={activeContentType}
          onContentTypeChange={value => { void setFilterQuery({ contentType: value || null }) }}
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(v => !v)}
          advancedFilterCount={advancedFilterCount}
          allTags={allTags}
          activeTags={activeTags}
          showTagFilter={showTagFilter}
          onToggleTagFilter={() => setShowTagFilter(v => !v)}
          onToggleTag={toggleTag}
          onClearTags={() => { void setFilterQuery({ tags: null }) }}
          keywordCandidates={keywordCandidates}
          availableKeywords={availableKeywords}
          activeKeywordTags={activeKeywordTags}
          keywordTagMode={keywordTagMode}
          showKeywordFilter={showKeywordFilter}
          onToggleKeywordFilter={() => setShowKeywordFilter(v => !v)}
          onToggleKeywordTag={toggleKeywordTag}
          onClearKeywordTags={() => { void setFilterQuery({ keywordTags: null }) }}
          onToggleKeywordTagMode={() => { void setFilterQuery({ keywordTagMode: keywordTagMode === 'or' ? 'and' : 'or' }) }}
          activeMainKeywords={activeMainKeywords}
          mainKeywordMode={mainKeywordMode}
          onToggleMainKeyword={toggleMainKeyword}
          onClearMainKeywords={() => { void setFilterQuery({ mainKeywords: null }) }}
          onToggleMainKeywordMode={() => { void setFilterQuery({ mainKeywordMode: mainKeywordMode === 'or' ? 'and' : 'or' }) }}
          showCollectionFilter={showCollectionFilter}
          onToggleCollectionFilter={() => setShowCollectionFilter(v => !v)}
          collectionLoading={collectionLoading}
          hasCollection={hasCollection}
          filterOwnedIdentity={filterOwnedIdentity}
          filterOwnedEgo={filterOwnedEgo}
          onToggleFilterOwnedIdentity={() => { void toggleFilterOwnedIdentity() }}
          onToggleFilterOwnedEgo={() => { void toggleFilterOwnedEgo() }}
          onClearCollection={() => { setOwnedIds(null); setHasCollection(false); void setFilterQuery({ ownedIdentity: null, ownedEgo: null }); setCodeInput('') }}
          codeInput={codeInput}
          onCodeInputChange={v => { setCodeInput(v); setCodeError(false) }}
          onApplyCode={() => applyCollectionCode(codeInput)}
          codeError={codeError}
          formationCount={formationCount}
          onFormationCountChange={value => { void setFilterQuery({ formationCount: value }) }}
          minInfoScore={minInfoScore}
          onMinInfoScoreChange={value => { void setFilterQuery({ minInfoScore: value }) }}
          identityFilterSinners={filterSinners}
          identityFilterIdentities={filterIdentities}
          selectedIdentityIds={selectedIdentityIds}
          selectedIdentities={selectedIdentities}
          identityMode={identityMode}
          onToggleSelectedIdentity={toggleSelectedIdentity}
          onToggleIdentityMode={() => { void setFilterQuery({ identityMode: identityMode === 'or' ? 'and' : 'or' }) }}
          onClearSelectedIdentities={() => { void setFilterQuery({ identityIds: null }) }}
          facetSections={<FacetSections kinds={['affiliation', 'ego']} facets={facetData} selections={facetSelections} onRemove={toggleFacet} onOpen={setFacetModal} />}
        />
        <FacetPickerModal kind={facetModal} facets={facetData} selected={facetModal ? facetSelections[facetModal] : []}
          onToggle={id => { if (facetModal) toggleFacet(facetModal, id) }} onClose={() => setFacetModal(null)} />

        <div ref={scrollRootRef} className="min-h-0 flex-1 pb-16 lg:overflow-y-auto lg:pr-1">
          <BrowseBar
            search={{ value: inputValue, onChange: v => { setInputValue(v); setShowSuggestions(false) }, onClear: () => { setInputValue(''); void setSearch(null, QUERY_OPTIONS); setDebouncedSearch('') }, placeholder: t('search.placeholder'), label: t('search.label') }}
            sort={{ value: sort, options: (['latest', 'popular'] as const).map(key => ({ key, label: t(`sort.${key}`) })), onChange: key => { void setSortQuery(key as SortKey, QUERY_OPTIONS) } }}
            filterCount={advancedFilterCount + (inputValue.trim() ? 1 : 0)}
            onOpenFilters={() => setFilterSignal(value => value + 1)}
            summary={loading ? '' : `${hasMore ? t('result.countMore', { count: filtered.length }) : t('result.countExact', { count: filtered.length })}${refreshing ? t('result.refreshing') : ''}`}
          />

          {/* ── 덱 목록 ── */}
          <BoardResults kind="deck" posts={filtered as unknown as RowPost[]} loading={loading} hasMore={hasMore} loadingMore={loadingMore} sentinelRef={sentinelRef}
            empty={(
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-[1rem] text-[var(--text-secondary)]">{hasAnyFilter ? t('grid.noResults') : t('grid.empty')}</p>
                {!hasAnyFilter && <Link href="/decks/new" className="min-h-11 content-center text-[0.9375rem] font-semibold text-[var(--gold-light)] underline-offset-4 hover:underline">{t('grid.createFirst')}</Link>}
              </div>
            )} />
        </div>
      </div>
    </div>
  )
}
