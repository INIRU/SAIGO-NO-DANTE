'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Image from 'next/image'
import DeckCard, { DeckSummary } from '@/components/decks/DeckCard'
import { useKeywordData } from '@/components/providers/KeywordProvider'
const PAGE_SIZE = 12

type SortKey = 'latest' | 'popular'

function getDeckAllKeywords(deck: DeckSummary): string[] {
  const kws = new Set<string>()
  for (const slot of deck.deck_identities ?? []) {
    for (const kw of slot?.identities?.keywords ?? []) {
      kws.add(kw)
    }
  }
  return [...kws]
}

function mapDeck(d: { profiles?: { username?: string } } & DeckSummary): DeckSummary {
  return { ...d, username: d.profiles?.username ?? undefined }
}

interface Props {
  identityId: string
}

export default function IdentityDecksTab({ identityId }: Props) {
  const { iconMap: kwIconMap, getIconUrl } = useKeywordData()
  const ALL_KEYWORDS = useMemo(() => Object.keys(kwIconMap), [kwIconMap])
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [sort, setSort] = useState<SortKey>('latest')
  const [search, setSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [acIndex, setAcIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // 키워드 자동완성 후보
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length === 0) return []
    const matches = ALL_KEYWORDS.filter(kw => kw.toLowerCase().includes(q))
    matches.sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1
      const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
      return a.length - b.length
    })
    return matches.slice(0, 8)
  }, [search, ALL_KEYWORDS])

  useEffect(() => { setAcIndex(suggestions.length > 0 ? 0 : -1) }, [suggestions.length])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      e.currentTarget.blur()
      setSearch(suggestions[acIndex])
      setShowSuggestions(false)
      setAcIndex(-1)
      setTimeout(() => (e.target as HTMLInputElement).focus(), 0)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setAcIndex(-1)
    }
  }

  // 외부 클릭 시 자동완성 닫기
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

  // 덱 목록 로드 (초기)
  useEffect(() => {
    setLoading(true)
    setDecks([])
    setHasMore(true)
    fetch(`/api/decks?identity_id=${identityId}&sort=${sort}&limit=${PAGE_SIZE}&offset=0`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDecks(data.map(mapDeck))
          if (data.length < PAGE_SIZE) setHasMore(false)
        }
      })
      .catch((e) => console.error('덱 목록 로드 실패:', e))
      .finally(() => setLoading(false))
  }, [identityId, sort])

  // 추가 로드
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetch(`/api/decks?identity_id=${identityId}&sort=${sort}&limit=${PAGE_SIZE}&offset=${decks.length}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          setHasMore(false)
          return
        }
        if (data.length < PAGE_SIZE) setHasMore(false)
        setDecks(prev => [...prev, ...data.map(mapDeck)])
      })
      .catch((e) => console.error('덱 추가 로드 실패:', e))
      .finally(() => setLoadingMore(false))
  }, [identityId, sort, decks.length, loadingMore, hasMore])

  // IntersectionObserver 무한 스크롤
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

  // 태그 클릭 → 검색어 반영
  const handleTagClick = useCallback((tag: string) => {
    setSearch(tag)
  }, [])

  // 필터 적용
  const filtered = useMemo(() => {
    if (!search.trim()) return decks
    const q = search.trim().toLowerCase()
    return decks.filter(d =>
      d.title.toLowerCase().includes(q) ||
      (d.description ?? '').toLowerCase().includes(q) ||
      d.tags.some(t => t.toLowerCase().includes(q)) ||
      getDeckAllKeywords(d).some(kw => kw.toLowerCase().includes(q))
    )
  }, [decks, search])

  return (
    <div className="space-y-4">
      {/* 검색 + 정렬 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 검색 + 자동완성 */}
        <div className="relative flex-1" ref={searchRef}>
          <svg
            width="14" height="14" viewBox="0 0 16 16" fill="none"
            style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none', zIndex: 1 }}
          >
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="제목, 설명, 태그, 키워드 검색..."
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-10 pr-4 py-2.5 text-sm outline-none transition-all"
            style={{
              background: '#120e09',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: '#e8dcc8',
              fontFamily: 'var(--font-body)',
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setShowSuggestions(false) }}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', cursor: 'pointer', zIndex: 1 }}
            >
              ✕
            </button>
          )}
          {/* 키워드 자동완성 드롭다운 */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 z-50 overflow-hidden"
              style={{
                top: '100%',
                marginTop: 4,
                background: '#1a1510',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}
            >
              <div className="px-3 py-1" style={{ background: 'rgba(255,255,255,0.03)', color: '#999', fontSize: '0.75rem', fontWeight: 600 }}>
                키워드 <span style={{ color: '#999', fontWeight: 400 }}>Tab으로 선택</span>
              </div>
              {suggestions.map((kw, i) => {
                const iconUrl = getIconUrl(kw)
                const isFocused = acIndex === i
                return (
                  <div
                    key={kw}
                    className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer"
                    style={{
                      color: isFocused ? '#e8b030' : '#c8b890',
                      fontFamily: 'var(--font-heading)',
                      background: isFocused ? 'rgba(200,144,10,0.12)' : 'transparent',
                      borderLeft: isFocused ? '2px solid var(--gold)' : '2px solid transparent',
                    }}
                    onClick={() => {
                      setSearch(kw)
                      setShowSuggestions(false)
                      setAcIndex(-1)
                    }}
                  >
                    {iconUrl && (
                      <Image src={iconUrl} alt="" width={14} height={14} style={{ flexShrink: 0 }} />
                    )}
                    <span>{kw}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 정렬 */}
        <div className="flex gap-1.5">
          {(['latest', 'popular'] as SortKey[]).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="px-4 py-2.5 rounded text-sm font-medium transition-all duration-200"
              style={{
                background: sort === s ? 'var(--gold)' : 'transparent',
                color: sort === s ? 'var(--bg-deep)' : '#aaaabb',
                border: `1px solid ${sort === s ? 'var(--gold)' : 'var(--border)'}`,
                fontFamily: 'var(--font-heading)',
                fontSize: '0.75rem',
              }}
            >
              {s === 'latest' ? '최신순' : '인기순'}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 수 */}
      {!loading && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          {filtered.length}개의 덱{hasMore && '+'}
          {search.trim() && ' (필터 적용됨)'}
        </p>
      )}

      {/* 덱 목록 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded" style={{ background: '#1a1510', border: '1px solid var(--border)', height: '10rem', opacity: 0.4 + i * 0.1 }}>
              <div style={{ padding: '1.25rem' }}>
                <div style={{ width: '60%', height: '0.875rem', background: '#2a2015', borderRadius: '0.125rem', marginBottom: '0.625rem' }} />
                <div style={{ width: '90%', height: '0.625rem', background: '#2a2015', borderRadius: '0.125rem', marginBottom: '0.375rem' }} />
                <div style={{ width: '70%', height: '0.625rem', background: '#2a2015', borderRadius: '0.125rem' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div style={{ color: '#8a8095', fontSize: '3rem' }}>⊘</div>
          <p className="font-serif text-base italic" style={{ color: 'var(--text-tertiary)' }}>
            {search.trim() ? '검색 결과가 없습니다.' : '이 인격이 사용된 덱이 아직 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(deck => (
            <DeckCard key={deck.id} deck={deck} onTagClick={handleTagClick} />
          ))}
        </div>
      )}

      {/* 무한 스크롤 센티널 */}
      {!loading && hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {loadingMore && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#999' }}>
              <div
                className="w-4 h-4 rounded-full animate-spin"
                style={{ border: '2px solid var(--border)', borderTopColor: 'var(--gold)' }}
              />
              불러오는 중...
            </div>
          )}
        </div>
      )}
    </div>
  )
}
