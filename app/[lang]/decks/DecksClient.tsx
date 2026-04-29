'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import { useSession } from 'next-auth/react'
import { type DeckSummary } from '@/components/decks/DeckCard'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { decodeCollectionAsync } from '@/lib/collection'
import type { CollectionData } from '@/lib/collection'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { STORAGE_BASE } from '@/lib/constants/game'
import { parseSearchQuery, getActiveTerm, termMatchesAny } from '@/lib/utils/search'
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import DeckListFilters from '@/components/decks/DeckListFilters'
import DeckGrid from '@/components/decks/DeckGrid'
import type { SearchSuggestion } from '@/components/decks/decks-types'
import type { DeckFilterIdentity } from '@/components/decks/DeckIdentityFilterModal'
import { useLocale } from 'next-intl'
import { useRoutePrefetch } from '@/lib/hooks/useRoutePrefetch'

const PAGE_SIZE = 12
const THEME_KEYWORD_SET = new Set<string>(THEME_KEYWORDS)
const PINNED_DECK_KEYWORDS = ['참격', '관통', '타격', '화상', '파열', '호흡', '진동', '침잠', '충전']

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
  themeKeywords: string[]
  keywordValues: string[]
  identityIds: string[]
  egoIds: string[]
  formationCount: number
}

function buildDeckDerivedIndex(deck: DeckSummary): DeckDerivedIndex {
  const freq: Record<string, number> = {}
  const allKeywords = new Set<string>()
  const keywordValues = new Set<string>()
  const identityNames: string[] = []
  const identityIds: string[] = []
  const formationSinnerIds = new Set<string>()

  for (const slot of deck.deck_identities ?? []) {
    const identity = slot?.identities
    if (identity?.name_kr) identityNames.push(identity.name_kr)
    if (identity?.id) identityIds.push(identity.id)

    for (const kw of slot?.identities?.keywords ?? []) {
      allKeywords.add(kw)
    }

    if (!identity || slot.slot_order >= 99) continue
    const isNewFormationSinner = Boolean(identity.sinner_id) && !formationSinnerIds.has(identity.sinner_id)
    if (identity.sinner_id) formationSinnerIds.add(identity.sinner_id)

    for (const rawKeyword of identity.keywords ?? []) {
      const kw = rawKeyword.trim()
      if (!kw) continue
      keywordValues.add(kw)
      const normalized = normalizeThemeKeyword(kw)
      if (THEME_KEYWORD_SET.has(normalized)) keywordValues.add(normalized)
      if (isNewFormationSinner && THEME_KEYWORD_SET.has(normalized)) {
        freq[normalized] = (freq[normalized] ?? 0) + 1
      }
    }
  }

  const formationCount = formationSinnerIds.size
  const minKeywordCount = formationCount <= 1 ? formationCount : Math.max(2, Math.ceil(formationCount * 0.4))
  const themeKeywords = Object.entries(freq)
    .filter(([, n]) => n >= minKeywordCount)
    .sort((a, b) => b[1] - a[1])
    .map(([kw]) => kw)

  return {
    searchValues: [
      deck.title,
      deck.description ?? '',
      ...deck.tags,
      ...allKeywords,
      ...identityNames,
    ],
    themeKeywords,
    keywordValues: [...keywordValues],
    identityIds,
    egoIds: (deck.deck_egos ?? []).map(e => e.ego_id),
    formationCount,
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

interface DecksClientProps {
  initialDecks?: DeckSummary[]
  initialTotal?: number
  initialSort?: SortKey
}

function normalizeSortKey(value: string): SortKey {
  return value === 'popular' ? 'popular' : 'latest'
}

export default function DecksClient({ initialDecks, initialSort = 'latest' }: DecksClientProps = {}) {
  const lang = useLocale()
  useRoutePrefetch([`/${lang}/decks/new`, `/${lang}/tier-list`])
  const { iconMap: kwIconMap, getIconUrl } = useKeywordData()
  const ALL_KEYWORDS = useMemo(() => Object.keys(kwIconMap), [kwIconMap])
  const { status: authStatus } = useSession()

  // ── Deck data state ──
  const hasServerInitialDecks = initialDecks !== undefined
  const [decks, setDecks] = useState<DeckSummary[]>(() => initialDecks ?? [])
  const [loading, setLoading] = useState(!hasServerInitialDecks)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const initialDataSort = useRef<SortKey | null>(hasServerInitialDecks ? initialSort : null)
  const deckRequestId = useRef(0)

  // ── URL-synced state ──
  const [sortQuery, setSortQuery] = useQueryState('sort', parseAsString.withDefault('latest'))
  const sort = normalizeSortKey(sortQuery)
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const latestSortRef = useRef(sort)

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
        const { data, error } = await createBrowserClient()
          .schema('limbus')
          .from('identities')
          .select('id, sinner_id, name, name_kr, name_en, name_jp, rarity, keywords, folder_name, game_id, hp, speed_min, speed_max, def_level, sinner:sinners(id, name_kr, order_num)')
          .order('sinner_id')
          .order('rarity', { ascending: false })
          .order('name_kr')
        if (error) throw error
        if (data) setAllIdentities(data as IdentityNameEntry[])
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
          ? `${STORAGE_BASE}/sinners/${id.sinner_id}/identities/${encodeURIComponent(id.folder_name)}/${id.game_id}_normal_info.webp`
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
      setSearch(inputValue || null)
      setDebouncedSearch(inputValue)
    }, 300)
    return () => clearTimeout(t)
  }, [inputValue, setSearch])

  // ── Filter state ──
  const [activeContentType, setActiveContentType] = useState('')
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [activeKeywords, setActiveKeywords] = useState<Set<string>>(new Set())
  const [formationCount, setFormationCount] = useState<number | null>(null)
  const [selectedIdentityIds, setSelectedIdentityIds] = useState<Set<string>>(new Set())
  const [keywordMode, setKeywordMode] = useState<'or' | 'and'>('or')
  const [identityMode, setIdentityMode] = useState<'or' | 'and'>('or')
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(true)
  const [showTagFilter, setShowTagFilter] = useState(true)
  const [showKeywordFilter, setShowKeywordFilter] = useState(true)
  const [showCollectionFilter, setShowCollectionFilter] = useState(true)

  // ── Collection filter state ──
  const [filterOwnedIdentity, setFilterOwnedIdentity] = useState(false)
  const [filterOwnedEgo, setFilterOwnedEgo] = useState(false)
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null)
  const [collectionLoading, setCollectionLoading] = useState(false)
  const [hasCollection, setHasCollection] = useState(false)
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)
  const collectionRequestRef = useRef<Promise<CollectionData | null> | null>(null)

  // ── Initial deck load (skip if server data present) ──
  useEffect(() => {
    if (initialDataSort.current === sort) {
      initialDataSort.current = null
      if (initialDecks && initialDecks.length < PAGE_SIZE) setHasMore(false)
      setLoading(false)
      setRefreshing(false)
      latestSortRef.current = sort
      return
    }
    latestSortRef.current = sort
    const requestId = deckRequestId.current + 1
    deckRequestId.current = requestId
    const controller = new AbortController()
    const hasExistingDecks = decks.length > 0
    setLoading(!hasExistingDecks)
    setRefreshing(hasExistingDecks)
    setHasMore(true)
    fetch(`/api/decks?sort=${sort}&limit=${PAGE_SIZE}&offset=0`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (deckRequestId.current !== requestId) return
        if (Array.isArray(data)) {
          setDecks(data.map(mapDeck))
          if (data.length < PAGE_SIZE) setHasMore(false)
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
  }, [sort]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load more ──
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const requestSort = sort
    fetch(`/api/decks?sort=${sort}&limit=${PAGE_SIZE}&offset=${decks.length}`)
      .then(r => r.json())
      .then(data => {
        if (latestSortRef.current !== requestSort) return
        if (!Array.isArray(data) || data.length === 0) { setHasMore(false); return }
        if (data.length < PAGE_SIZE) setHasMore(false)
        setDecks(prev => [...prev, ...data.map(mapDeck)])
      })
      .catch(e => console.error('덱 추가 로드 실패:', e))
      .finally(() => {
        if (latestSortRef.current === requestSort) setLoadingMore(false)
      })
  }, [sort, decks.length, loadingMore, hasMore])

  // ── Infinite scroll observer ──
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

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
    setFilterOwnedIdentity(prev => !prev)
  }, [authStatus, loadProfileCollection, ownedIds])

  const toggleFilterOwnedEgo = useCallback(async () => {
    let hasOwnedIds = ownedIds !== null
    if (!hasOwnedIds && authStatus === 'authenticated') {
      hasOwnedIds = await loadProfileCollection()
    }
    if (!hasOwnedIds) return
    setFilterOwnedEgo(prev => !prev)
  }, [authStatus, loadProfileCollection, ownedIds])

  // ── Tag / keyword toggles ──
  const toggleTag = useCallback((tag: string) => {
    setActiveTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }, [])

  const toggleKeyword = useCallback((kw: string) => {
    setActiveKeywords(prev => {
      const next = new Set(prev)
      if (next.has(kw)) next.delete(kw)
      else next.add(kw)
      return next
    })
  }, [])

  // ── Derived filter data ──
  const deckDerived = useMemo(() => {
    const byId = new Map<string, DeckDerivedIndex>()
    const tagFreq: Record<string, number> = {}
    const keywordCandidateFreq: Record<string, number> = {}
    const themeKeywordSet = new Set<string>()

    for (const d of decks) {
      const index = buildDeckDerivedIndex(d)
      byId.set(d.id, index)
      for (const kw of index.themeKeywords) themeKeywordSet.add(kw)
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
        ...THEME_KEYWORDS.filter(kw => !PINNED_DECK_KEYWORDS.includes(kw) && themeKeywordSet.has(kw)),
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
    setSelectedIdentityIds(prev => {
      const next = new Set(prev)
      const target = filterIdentities.find(identity => identity.id === identityId)

      if (next.has(identityId)) {
        next.delete(identityId)
        return next
      }

      if (target) {
        for (const identity of filterIdentities) {
          if (identity.sinner_id === target.sinner_id) next.delete(identity.id)
        }
      }

      next.add(identityId)
      return next
    })
  }, [filterIdentities])

  // ── Filter application ──
  const filtered = useMemo(() => {
    let list = decks

    if (activeContentType) {
      list = list.filter(d => d.content_type === activeContentType)
    }

    if (debouncedSearch.trim()) {
      const parsed = parseSearchQuery(debouncedSearch)
      if (parsed.terms.length > 0) {
        list = list.filter(d => {
          const searchable = deckDerived.byId.get(d.id)?.searchValues ?? []
          return parsed.mode === 'and'
            ? parsed.terms.every(term => termMatchesAny(term, searchable))
            : parsed.terms.some(term => termMatchesAny(term, searchable))
        })
      }
    }

    if (activeTags.size > 0) {
      list = list.filter(d => {
        for (const tag of activeTags) {
          if (!d.tags.includes(tag)) return false
        }
        return true
      })
    }

    if (activeKeywords.size > 0) {
      list = list.filter(d => {
        const deckKws = deckDerived.byId.get(d.id)?.keywordValues ?? []
        if (keywordMode === 'and') {
          for (const kw of activeKeywords) {
            if (!deckKws.includes(kw)) return false
          }
          return true
        } else {
          for (const kw of activeKeywords) {
            if (deckKws.includes(kw)) return true
          }
          return false
        }
      })
    }

    if (formationCount !== null) {
      list = list.filter(d => (deckDerived.byId.get(d.id)?.formationCount ?? 0) === formationCount)
    }

    if (selectedIdentityIds.size > 0) {
      list = list.filter(d => {
        const ids = deckDerived.byId.get(d.id)?.identityIds ?? []
        if (identityMode === 'and') {
          for (const id of selectedIdentityIds) {
            if (!ids.includes(id)) return false
          }
          return true
        } else {
          for (const id of selectedIdentityIds) {
            if (ids.includes(id)) return true
          }
          return false
        }
      })
    }

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
  }, [decks, deckDerived, debouncedSearch, activeContentType, activeTags, activeKeywords, keywordMode, formationCount, selectedIdentityIds, identityMode, filterOwnedIdentity, filterOwnedEgo, ownedIds])

  const hasAnyFilter = Boolean(inputValue || activeContentType || activeTags.size > 0 || activeKeywords.size > 0 || formationCount !== null || selectedIdentityIds.size > 0 || filterOwnedIdentity || filterOwnedEgo)
  const advancedFilterCount = activeTags.size + activeKeywords.size + (formationCount !== null ? 1 : 0) + selectedIdentityIds.size + (filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0)

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden px-4 pb-4 md:px-6">

      <div className="relative z-[1] mx-auto flex h-full min-h-0 w-full max-w-7xl gap-5">
        {/* ── 필터 패널 ── */}
        <DeckListFilters
          inputValue={inputValue}
          onInputChange={v => { setInputValue(v); setShowSuggestions(true) }}
          onInputFocus={() => setShowSuggestions(true)}
          onSearchClear={() => { setInputValue(''); setSearch(null); setDebouncedSearch(''); setShowSuggestions(false) }}
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
          onSortChange={s => setSortQuery(s as SortKey)}
          activeContentType={activeContentType}
          onContentTypeChange={setActiveContentType}
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(v => !v)}
          advancedFilterCount={advancedFilterCount}
          allTags={allTags}
          activeTags={activeTags}
          showTagFilter={showTagFilter}
          onToggleTagFilter={() => setShowTagFilter(v => !v)}
          onToggleTag={toggleTag}
          onClearTags={() => setActiveTags(new Set())}
          keywordCandidates={keywordCandidates}
          availableKeywords={availableKeywords}
          activeKeywords={activeKeywords}
          keywordMode={keywordMode}
          showKeywordFilter={showKeywordFilter}
          onToggleKeywordFilter={() => setShowKeywordFilter(v => !v)}
          onToggleKeyword={toggleKeyword}
          onClearKeywords={() => setActiveKeywords(new Set())}
          onToggleKeywordMode={() => setKeywordMode(m => m === 'or' ? 'and' : 'or')}
          showCollectionFilter={showCollectionFilter}
          onToggleCollectionFilter={() => setShowCollectionFilter(v => !v)}
          collectionLoading={collectionLoading}
          hasCollection={hasCollection}
          filterOwnedIdentity={filterOwnedIdentity}
          filterOwnedEgo={filterOwnedEgo}
          onToggleFilterOwnedIdentity={() => { void toggleFilterOwnedIdentity() }}
          onToggleFilterOwnedEgo={() => { void toggleFilterOwnedEgo() }}
          onClearCollection={() => { setOwnedIds(null); setHasCollection(false); setFilterOwnedIdentity(false); setFilterOwnedEgo(false); setCodeInput('') }}
          codeInput={codeInput}
          onCodeInputChange={v => { setCodeInput(v); setCodeError(false) }}
          onApplyCode={() => applyCollectionCode(codeInput)}
          codeError={codeError}
          formationCount={formationCount}
          onFormationCountChange={setFormationCount}
          identityFilterSinners={filterSinners}
          identityFilterIdentities={filterIdentities}
          selectedIdentityIds={selectedIdentityIds}
          selectedIdentities={selectedIdentities}
          identityMode={identityMode}
          onToggleSelectedIdentity={toggleSelectedIdentity}
          onToggleIdentityMode={() => setIdentityMode(m => m === 'or' ? 'and' : 'or')}
          onClearSelectedIdentities={() => setSelectedIdentityIds(new Set())}
        />

        <div className="min-h-0 flex-1 overflow-y-auto pb-16 pr-1 scrollbar-thin">
          {/* ── 결과 수 ── */}
          {!loading && (
            <p
              className="mb-4"
              aria-live="polite"
              style={{ color: '#888', fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: 1.5 }}
            >
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{filtered.length}개</span>
              {hasMore ? ' 이상의 덱' : '의 덱'}
              {hasAnyFilter && <span style={{ color: '#777' }}> (필터 적용됨)</span>}
            </p>
          )}

          {/* ── 덱 목록 ── */}
          <DeckGrid
            filtered={filtered}
            loading={loading}
            refreshing={refreshing}
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
