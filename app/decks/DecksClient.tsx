'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import DeckCard, { type DeckSummary } from '@/components/decks/DeckCard'
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

const PAGE_SIZE = 12

type SortKey = 'latest' | 'popular'
type IdentityNameEntry = {
  name_kr: string
  sinner_id: string
  folder_name: string | null
  game_id: string | null
}

const KEYWORD_THRESHOLD = 5

function getDeckThemeKeywords(deck: DeckSummary): string[] {
  const freq: Record<string, number> = {}
  for (const slot of deck.deck_identities ?? []) {
    for (const kw of slot?.identities?.keywords ?? []) {
      const normalized = normalizeThemeKeyword(kw)
      if ((THEME_KEYWORDS as readonly string[]).includes(normalized)) {
        freq[normalized] = (freq[normalized] ?? 0) + 1
      }
    }
  }
  return Object.entries(freq)
    .filter(([, n]) => n >= KEYWORD_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([kw]) => kw)
}

function getDeckAllKeywords(deck: DeckSummary): string[] {
  const kws = new Set<string>()
  for (const slot of deck.deck_identities ?? []) {
    for (const kw of slot?.identities?.keywords ?? []) {
      kws.add(kw)
    }
  }
  return [...kws]
}

function getDeckIdentityNames(deck: DeckSummary): string[] {
  return (deck.deck_identities ?? [])
    .map(s => s.identities?.name_kr)
    .filter((n): n is string => Boolean(n))
}

function mapDeck(d: { profiles?: { username?: string } } & DeckSummary): DeckSummary {
  return { ...d, username: d.profiles?.username ?? undefined }
}

interface DecksClientProps {
  initialDecks?: DeckSummary[]
  initialTotal?: number
}

export default function DecksClient({ initialDecks }: DecksClientProps = {}) {
  const { iconMap: kwIconMap, getIconUrl } = useKeywordData()
  const ALL_KEYWORDS = useMemo(() => Object.keys(kwIconMap), [kwIconMap])
  const { status: authStatus } = useSession()

  // ── Deck data state ──
  const [decks, setDecks] = useState<DeckSummary[]>(() => initialDecks ?? [])
  const [loading, setLoading] = useState(!initialDecks || initialDecks.length === 0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const initialDataUsed = useRef(Boolean(initialDecks && initialDecks.length > 0))

  // ── URL-synced state ──
  const [sort, setSort] = useQueryState('sort', parseAsString.withDefault('latest'))
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))

  // ── Search UI state ──
  const [inputValue, setInputValue] = useState(search)
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [acIndex, setAcIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)

  // ── Identity autocomplete data ──
  const [allIdentities, setAllIdentities] = useState<IdentityNameEntry[]>([])
  useEffect(() => {
    createBrowserClient()
      .schema('limbus')
      .from('identities')
      .select('name_kr, sinner_id, folder_name, game_id')
      .then(({ data }) => {
        if (data) {
          const seen = new Set<string>()
          const deduped = (data as IdentityNameEntry[])
            .filter(d => { if (seen.has(d.name_kr)) return false; seen.add(d.name_kr); return true })
            .sort((a, b) => a.name_kr.localeCompare(b.name_kr))
          setAllIdentities(deduped)
        }
      })
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
  const [keywordMode, setKeywordMode] = useState<'or' | 'and'>('or')
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

  // ── Entry animation ──
  useEffect(() => {
    const { animate } = require('framer-motion')
    const c1 = animate('.decks-header-line', { scaleX: [0, 1] }, { duration: 0.8, ease: [0.33, 1, 0.68, 1] })
    const c2 = animate('.decks-header-tag', { opacity: [0, 1], y: [10, 0] }, { duration: 0.5, delay: 0.2, ease: 'easeOut' })
    const c3 = animate('.decks-header-title', { opacity: [0, 1], y: [-20, 0] }, { duration: 0.7, delay: 0.3, ease: [0.33, 1, 0.68, 1] })
    const c4 = animate('.decks-filters', { opacity: [0, 1], y: [10, 0] }, { duration: 0.5, delay: 0.5, ease: 'easeOut' })
    const c5 = animate('.decks-divider-bottom', { scaleX: [0, 1] }, { duration: 0.6, delay: 0.7, ease: [0.33, 1, 0.68, 1] })
    return () => { c1.stop(); c2.stop(); c3.stop(); c4.stop(); c5.stop() }
  }, [])

  // ── Initial deck load (skip if server data present) ──
  useEffect(() => {
    if (initialDataUsed.current && sort === 'latest') {
      initialDataUsed.current = false
      if (initialDecks && initialDecks.length < PAGE_SIZE) setHasMore(false)
      setLoading(false)
      return
    }
    setLoading(true)
    setDecks([])
    setHasMore(true)
    fetch(`/api/decks?sort=${sort}&limit=${PAGE_SIZE}&offset=0`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDecks(data.map(mapDeck))
          if (data.length < PAGE_SIZE) setHasMore(false)
        }
      })
      .catch(e => console.error('덱 목록 로드 실패:', e))
      .finally(() => setLoading(false))
  }, [sort]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load more ──
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetch(`/api/decks?sort=${sort}&limit=${PAGE_SIZE}&offset=${decks.length}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) { setHasMore(false); return }
        if (data.length < PAGE_SIZE) setHasMore(false)
        setDecks(prev => [...prev, ...data.map(mapDeck)])
      })
      .catch(e => console.error('덱 추가 로드 실패:', e))
      .finally(() => setLoadingMore(false))
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

  // ── Collection master data ──
  useEffect(() => {
    fetch('/api/collection').then(r => r.json())
      .then((d: CollectionData) => { if (d.sinners?.length > 0) setCollectionData(d) })
      .catch(() => {})
  }, [])

  // ── Auto-load collection for logged-in user ──
  useEffect(() => {
    if (authStatus !== 'authenticated' || !collectionData) return
    setCollectionLoading(true)
    fetch('/api/profile').then(r => r.json())
      .then(async (profileData: { profile?: { collection_code?: string | null } }) => {
        const code = profileData.profile?.collection_code
        if (code) {
          const decoded = await decodeCollectionAsync(code, collectionData.sinners, collectionData.identities, collectionData.egos)
          setOwnedIds(decoded)
          setHasCollection(true)
        }
      })
      .catch(() => {})
      .finally(() => setCollectionLoading(false))
  }, [authStatus, collectionData])

  const applyCollectionCode = useCallback(async (rawInput: string) => {
    if (!collectionData) return
    setCodeError(false)
    let code = rawInput.trim()
    try {
      const url = new URL(code)
      code = url.searchParams.get('code') ?? code
    } catch { /* not a URL, use as-is */ }
    if (!code) return
    try {
      const decoded = await decodeCollectionAsync(code, collectionData.sinners, collectionData.identities, collectionData.egos)
      if (decoded.size === 0) { setCodeError(true); return }
      setOwnedIds(decoded)
      setHasCollection(true)
    } catch {
      setCodeError(true)
    }
  }, [collectionData])

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
  const allTags = useMemo(() => {
    const freq: Record<string, number> = {}
    for (const d of decks) {
      for (const t of d.tags ?? []) {
        freq[t] = (freq[t] ?? 0) + 1
      }
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag]) => tag)
  }, [decks])

  const availableKeywords = useMemo(() => {
    const found = new Set<string>()
    for (const d of decks) {
      for (const kw of getDeckThemeKeywords(d)) found.add(kw)
    }
    return THEME_KEYWORDS.filter(kw => found.has(kw))
  }, [decks])

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
          const searchable = [
            d.title,
            d.description ?? '',
            ...d.tags,
            ...getDeckAllKeywords(d),
            ...getDeckIdentityNames(d),
          ]
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
        const deckKws = getDeckThemeKeywords(d)
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

    if (filterOwnedIdentity && ownedIds) {
      list = list.filter(d => {
        const ids = (d.deck_identities ?? [])
          .map(s => s.identities?.id)
          .filter((id): id is string => Boolean(id))
        return ids.length === 0 || ids.every(id => ownedIds.has(id))
      })
    }

    if (filterOwnedEgo && ownedIds) {
      list = list.filter(d => {
        const egoIds = (d.deck_egos ?? []).map(e => e.ego_id)
        return egoIds.length === 0 || egoIds.every(id => ownedIds.has(id))
      })
    }

    return list
  }, [decks, debouncedSearch, activeContentType, activeTags, activeKeywords, keywordMode, filterOwnedIdentity, filterOwnedEgo, ownedIds])

  const hasAnyFilter = Boolean(inputValue || activeContentType || activeTags.size > 0 || activeKeywords.size > 0 || filterOwnedIdentity || filterOwnedEgo)
  const advancedFilterCount = activeTags.size + activeKeywords.size + (filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0)

  return (
    <div className="min-h-screen pt-24 pb-20 px-6 max-w-7xl mx-auto relative">

      {/* Background atmospheric glow */}
      <div style={{
        position: 'fixed',
        top: '-10rem',
        right: '-5rem',
        width: '35rem',
        height: '35rem',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,144,10,0.04) 0%, rgba(200,144,10,0.015) 40%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{
          position: 'absolute',
          top: '8%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '50rem',
          height: '50rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,144,10,0.04) 0%, transparent 60%)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '15%',
          right: '20%',
          width: '30rem',
          height: '30rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,144,10,0.02) 0%, transparent 60%)',
        }} />
      </div>

      {/* ── 헤더 ── */}
      <div className="decks-header flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 relative" style={{ zIndex: 1 }}>
        <div>
          <div className="decks-header-line" style={{
            width: '4rem',
            height: '0.0625rem',
            background: 'linear-gradient(90deg, rgba(200,144,10,0.6), transparent)',
            marginBottom: '1rem',
            transformOrigin: 'left',
            transform: 'scaleX(0)',
          }} />
          <p className="decks-header-tag" style={{ opacity: 0, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.15em', marginBottom: '0.375rem' }}>
            DECK ARCHIVE
          </p>
          <h1 className="decks-header-title font-serif text-3xl sm:text-4xl md:text-5xl font-bold" style={{ color: 'var(--gold)', opacity: 0, textShadow: '0 0 3rem rgba(200,144,10,0.15)' }}>
            덱 게시판
          </h1>
          <p className="mt-2" style={{ color: '#666688', fontSize: '0.8125rem' }}>
            관리자들의 편성을 공유하는 공간
          </p>
        </div>
        <Link
          href="/decks/new"
          className="flex items-center gap-2 px-5 py-2.5 font-medium text-sm transition-all duration-200 hover:brightness-110 active:scale-95"
          style={{ background: 'var(--gold)', color: 'var(--bg-deep)', borderRadius: '4px', fontFamily: 'var(--font-heading)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          새 덱 만들기
        </Link>
      </div>

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
        onSortChange={s => setSort(s as SortKey)}
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
        onToggleFilterOwnedIdentity={() => setFilterOwnedIdentity(prev => !prev)}
        onToggleFilterOwnedEgo={() => setFilterOwnedEgo(prev => !prev)}
        onClearCollection={() => { setOwnedIds(null); setHasCollection(false); setFilterOwnedIdentity(false); setFilterOwnedEgo(false); setCodeInput('') }}
        codeInput={codeInput}
        onCodeInputChange={v => { setCodeInput(v); setCodeError(false) }}
        onApplyCode={() => applyCollectionCode(codeInput)}
        codeError={codeError}
      />

      {/* 하단 장식 디바이더 */}
      <div className="decks-divider-bottom mx-auto" style={{
        width: '100%',
        maxWidth: '16rem',
        height: '0.0625rem',
        background: 'linear-gradient(90deg, transparent, rgba(200,144,10,0.3), var(--gold-dim), rgba(200,144,10,0.3), transparent)',
        marginBottom: '1.5rem',
        transformOrigin: 'center',
        transform: 'scaleX(0)',
      }} />

      {/* ── 결과 수 ── */}
      {!loading && (
        <p className="mb-5 text-xs" style={{ color: '#555570', fontFamily: 'var(--font-mono)' }}>
          {filtered.length}개의 덱{hasMore && '+'}
          {hasAnyFilter && ' (필터 적용됨)'}
        </p>
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
  )
}
