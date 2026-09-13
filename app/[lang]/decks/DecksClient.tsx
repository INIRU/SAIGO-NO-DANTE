'use client'

import { notePlainText } from '@/lib/notes/blocks'

import DiscoveryShelf from '@/components/discovery/DiscoveryShelf'

import { getIdentityPortraitUrl } from '@/lib/utils/images'
import { useState, useEffect, useMemo, useCallback, useRef, useTransition } from 'react'
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryState, useQueryStates } from 'nuqs'
import { useSession } from 'next-auth/react'
import { type DeckSummary } from '@/components/decks/DeckCard'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { decodeCollectionAsync } from '@/lib/collection'
import type { CollectionData } from '@/lib/collection'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { getActiveTerm } from '@/lib/utils/search'
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import { DECK_MAIN_KEYWORDS, computeDeckMainKeywordsFromSlots, normalizeDeckMainKeyword } from '@/lib/decks/keyword-rules'
import DeckListFilters from '@/components/decks/DeckListFilters'
import DeckGrid from '@/components/decks/DeckGrid'
import {
  normalizeDeckLanguageFilter,
  resolveDeckLanguageParam,
  type DeckLanguageFilter,
  type SearchSuggestion,
} from '@/components/decks/decks-types'
import type { DeckFilterIdentity } from '@/components/decks/DeckIdentityFilterModal'
import { useLocale, useTranslations } from 'next-intl'
import { useRoutePrefetch } from '@/lib/hooks/useRoutePrefetch'

const PAGE_SIZE = 12
const THEME_KEYWORD_SET = new Set<string>(THEME_KEYWORDS)
const PINNED_DECK_KEYWORDS = [...DECK_MAIN_KEYWORDS]
const QUERY_OPTIONS = { history: 'replace', shallow: true, scroll: false } as const
const IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS = 'id, sinner_id, name, name_kr, name_en, name_jp, rarity, keywords, skill_keyword_list, folder_name, game_id, hp, speed_min, speed_max, def_level, sinner:sinners(id, name_kr, order_num)'
const IDENTITY_FILTER_SELECT_LEGACY = 'id, sinner_id, name, name_kr, name_en, name_jp, rarity, keywords, folder_name, game_id, hp, speed_min, speed_max, def_level, sinner:sinners(id, name_kr, order_num)'

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
  searchValues: string[]
  mainKeywords: string[]
  keywordTagValues: string[]
  identityIds: string[]
  egoIds: string[]
  formationCount: number
  hasFormationOrder: boolean
  hasNonDefaultEgo: boolean
  hasDescription: boolean
  infoScore: number
}

function buildDeckDerivedIndex(deck: DeckSummary): DeckDerivedIndex {
  const allKeywords = new Set<string>()
  const keywordTagValues = new Set<string>()
  const identityNames: string[] = []
  const identityIds: string[] = []
  const formationSinnerIds = new Set<string>()
  let hasFormationOrder = false

  for (const slot of deck.deck_identities ?? []) {
    const identity = slot?.identities
    if (identity?.name_kr) identityNames.push(identity.name_kr)
    if (identity?.id) identityIds.push(identity.id)

    for (const kw of slot?.identities?.keywords ?? []) {
      allKeywords.add(kw)
    }

    if (slot.slot_order < 99) hasFormationOrder = true
    if (!identity || slot.slot_order >= 99) continue
    if (identity.sinner_id) formationSinnerIds.add(identity.sinner_id)

    for (const rawKeyword of identity.keywords ?? []) {
      const kw = rawKeyword.trim()
      if (!kw) continue
      keywordTagValues.add(kw)
      const normalized = normalizeThemeKeyword(kw)
      if (THEME_KEYWORD_SET.has(normalized)) keywordTagValues.add(normalized)
    }

  }

  const formationCount = formationSinnerIds.size
  const hasNonDefaultEgo = (deck.deck_egos ?? []).some(ego => {
    const grade = typeof ego.grade === 'string' ? ego.grade.trim().toUpperCase() : ''
    return grade !== '' && grade !== 'ZAYIN'
  })
  const hasDescription = notePlainText(deck.description ?? '').length >= 20
  const infoScore = Number(hasFormationOrder) + Number(hasNonDefaultEgo) + Number(hasDescription)
  const persistedMainKeywords = (deck.main_keywords ?? [])
    .map(normalizeDeckMainKeyword)
    .filter((keyword): keyword is string => Boolean(keyword))
  const mainKeywords = persistedMainKeywords.length > 0
    ? persistedMainKeywords
    : computeDeckMainKeywordsFromSlots(deck.deck_identities ?? [])

  return {
    searchValues: [
      deck.title,
      deck.description ?? '',
      ...deck.tags,
      ...allKeywords,
      ...identityNames,
    ],
    mainKeywords,
    keywordTagValues: [...keywordTagValues],
    identityIds,
    egoIds: (deck.deck_egos ?? []).map(e => e.ego_id),
    formationCount,
    hasFormationOrder,
    hasNonDefaultEgo,
    hasDescription,
    infoScore,
  }
}

function toDeckFilterIdentity(identity: IdentityNameEntry): DeckFilterIdentity {
  const sinner = Array.isArray(identity.sinner) ? identity.sinner[0] : identity.sinner
  return {
    id: identity.id,
    sinner_id: identity.sinner_id,
    name: identity.name ?? identity.name_kr,
    name_kr: identity.name_kr,
    name_en: identity.name_en,
    name_jp: identity.name_jp,
    rarity: identity.rarity,
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

function mapDeck(d: { profiles?: { username?: string } } & DeckSummary): DeckSummary {
  return { ...d, username: d.profiles?.username ?? undefined }
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
  initialLanguageFilter?: DeckLanguageFilter
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
  initialLanguageFilter = 'mine',
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
  const sentinelRef = useRef<HTMLDivElement>(null)
  const initialDataKey = useRef<string | null>(hasServerInitialDecks ? `${initialSort}:${initialLanguageFilter}` : null)
  const deckRequestId = useRef(0)
  const loadMoreRequestId = useRef(0)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  const [, startTransition] = useTransition()

  // ── URL-synced state ──
  const [browse, setBrowse] = useQueryState('browse', parseAsString.withDefault(''))
  const [sortQuery, setSortQuery] = useQueryState('sort', parseAsString.withDefault('latest'))
  const sort = normalizeSortKey(sortQuery)
  const [languageQuery, setLanguageQuery] = useQueryState('lang', parseAsString.withDefault(initialLanguageFilter))
  const languageFilter = normalizeDeckLanguageFilter(languageQuery)
  const deckLanguageParam = resolveDeckLanguageParam(languageFilter, locale)
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const latestSortRef = useRef(sort)
  const latestDeckLanguageRef = useRef(deckLanguageParam)
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
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && !showSuggestions && suggestions.length > 0) {
      e.preventDefault()
      setShowSuggestions(true)
      return
    }
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Escape') setShowSuggestions(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAcIndex(prev => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAcIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (e.key === 'Tab' && acIndex >= 0) {
      e.preventDefault()
      const selected = suggestions[acIndex].label
      const { prefix } = getActiveTerm(inputValue)
      e.currentTarget.blur()
      setShowSuggestions(false)
      setAcIndex(-1)
      setTimeout(() => {
        setInputValue(prefix + selected);
        (e.target as HTMLInputElement).focus()
      }, 10)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setAcIndex(-1)
    }
  }, [showSuggestions, suggestions, acIndex, inputValue])

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
    params.set('lang', deckLanguageParam)
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
    deckLanguageParam,
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

  // ── Initial deck load (skip if server data present) ──
  useEffect(() => {
    if (!hasServerBackedFilters && initialDataKey.current === `${sort}:${languageFilter}`) {
      initialDataKey.current = null
      if (initialDecks && mergeDeckRows([], initialDecks).length < PAGE_SIZE) setHasMore(false)
      setLoading(false)
      setRefreshing(false)
      latestSortRef.current = sort
      latestDeckLanguageRef.current = deckLanguageParam
      latestServerQueryRef.current = serverQueryKey
      return
    }
    latestSortRef.current = sort
    latestDeckLanguageRef.current = deckLanguageParam
    latestServerQueryRef.current = serverQueryKey
    const requestId = deckRequestId.current + 1
    deckRequestId.current = requestId
    const controller = new AbortController()
    const hasExistingDecks = decks.length > 0
    setLoading(!hasExistingDecks)
    setRefreshing(hasExistingDecks)
    setLoadingMore(false)
    setHasMore(true)
    const params = buildDeckSearchParams(0)
    fetch(`/api/decks?${params.toString()}`, { signal: controller.signal })
      .then(r => r.json())
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
      })
      .finally(() => {
        if (deckRequestId.current !== requestId) return
        setLoading(false)
        setRefreshing(false)
      })
    return () => controller.abort()
  }, [sort, languageFilter, deckLanguageParam, serverQueryKey, hasServerBackedFilters, buildDeckSearchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load more ──
  const loadMore = useCallback(() => {
    if (loading || refreshing || loadingMore || !hasMore) return
    setLoadingMore(true)
    loadMoreAbortRef.current?.abort()
    const requestId = loadMoreRequestId.current + 1
    loadMoreRequestId.current = requestId
    const controller = new AbortController()
    loadMoreAbortRef.current = controller
    const requestSort = sort
    const requestDeckLanguage = deckLanguageParam
    const requestQueryKey = serverQueryKey
    const params = buildDeckSearchParams(decks.length)
    fetch(`/api/decks?${params.toString()}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (loadMoreRequestId.current !== requestId || latestSortRef.current !== requestSort || latestDeckLanguageRef.current !== requestDeckLanguage || latestServerQueryRef.current !== requestQueryKey) return
        if (!Array.isArray(data) || data.length === 0) { setHasMore(false); return }
        if (data.length < PAGE_SIZE) setHasMore(false)
        setDecks(prev => mergeDeckRows(prev, data.map(mapDeck)))
      })
      .catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        console.error('덱 추가 로드 실패:', e)
      })
      .finally(() => {
        if (loadMoreRequestId.current === requestId) {
          loadMoreAbortRef.current = null
        }
        if (loadMoreRequestId.current === requestId && latestSortRef.current === requestSort && latestDeckLanguageRef.current === requestDeckLanguage && latestServerQueryRef.current === requestQueryKey) setLoadingMore(false)
      })
  }, [sort, deckLanguageParam, serverQueryKey, buildDeckSearchParams, decks.length, loading, refreshing, loadingMore, hasMore])

  useEffect(() => {
    loadMoreAbortRef.current?.abort()
    loadMoreRequestId.current += 1
    setLoadingMore(false)
  }, [serverQueryKey])

  // ── Infinite scroll observer ──
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) loadMore() },
      { root: scrollRootRef.current, rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, serverQueryKey])

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
      const decoded = await decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
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
      const decoded = await decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
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

  // ── Filter application ──
  const filtered = useMemo(() => {
    let list = decks

    if (filterOwnedIdentity && ownedIds) {
      list = list.filter(d => {
        const ids = deckDerived.byId.get(d.id)?.identityIds ?? []
        return ids.length === 0 || ids.every(id => ownedIds.has(id))
      })
    }

    if (filterOwnedEgo && ownedIds) {
      list = list.filter(d => {
        const egoIds = deckDerived.byId.get(d.id)?.egoIds ?? []
        return egoIds.length === 0 || egoIds.every(id => ownedIds.has(id))
      })
    }

    return list
  }, [decks, deckDerived, filterOwnedIdentity, filterOwnedEgo, ownedIds])

  const languageFilterCount = languageFilter === 'mine' ? 0 : 1
  const hasAnyFilter = Boolean(inputValue || activeContentType || activeTags.size > 0 || activeKeywordTags.size > 0 || activeMainKeywords.size > 0 || formationCount !== null || minInfoScore !== null || selectedIdentityIds.size > 0 || filterOwnedIdentity || filterOwnedEgo || languageFilterCount)
  const advancedFilterCount = activeTags.size + activeKeywordTags.size + activeMainKeywords.size + (formationCount !== null ? 1 : 0) + (minInfoScore !== null ? 1 : 0) + selectedIdentityIds.size + (filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0) + languageFilterCount

  if (browse !== 'all' && !(hasAnyFilter)) return <DiscoveryShelf kind="deck" onBrowse={() => setBrowse('all', { history: 'push' })} />

  return (
    <div data-board-browse className="relative min-h-0 flex-1 overflow-hidden px-4 pb-4 md:px-6">

      <div className="relative z-[1] mx-auto flex h-full min-h-0 w-full max-w-7xl gap-5">
        {/* ── 필터 패널 ── */}
        <DeckListFilters
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
          languageFilter={languageFilter}
          onLanguageFilterChange={value => { void setLanguageQuery(value === 'mine' ? null : value, QUERY_OPTIONS) }}
        />

        <div ref={scrollRootRef} className="min-h-0 flex-1 overflow-y-auto pb-16 pr-1 scrollbar-thin">
          {/* ── 결과 수 ── */}
          {!loading && (
            <div
              className="mb-4 flex min-h-11 items-center gap-2 rounded-sm"
              role="status"
              aria-live="polite"
              style={{
                padding: '0.35rem 0',
                color: '#888',
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                lineHeight: 1.45,
              }}
            >
              {refreshing && (
                <span
                  className="shrink-0 rounded-full animate-spin"
                  style={{ width: '0.875rem', height: '0.875rem', border: '1px solid rgba(200,144,10,0.28)', borderTopColor: 'var(--gold)' }}
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0">
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {hasMore ? t('result.countMore', { count: filtered.length }) : t('result.countExact', { count: filtered.length })}
                </span>
                {refreshing ? t('result.refreshing') : ''}
                {hasAnyFilter && <span style={{ color: '#777' }}>{t('result.filtered')}</span>}
              </span>
            </div>
          )}

          {/* ── 덱 목록 ── */}
          <DeckGrid
            filtered={filtered}
            loading={loading}
            hasMore={hasMore}
            loadingMore={loadingMore}
            hasAnyFilter={hasAnyFilter}
            sentinelRef={sentinelRef}
            onTagClick={toggleTag}
          />
        </div>
      </div>
    </div>
  )
}
