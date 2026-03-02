'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import DeckCard, { DeckSummary } from '@/components/decks/DeckCard'
import { getKeywordIconUrl, KEYWORD_ICON_MAP } from '@/lib/data/sinners'
import { decodeCollectionAsync } from '@/lib/collection'
import type { CollectionData } from '@/lib/collection'
import { User, PackageOpen, Link2 } from 'lucide-react'

// 전체 키워드 목록 (자동완성용)
const ALL_KEYWORDS = Object.keys(KEYWORD_ICON_MAP)

const PAGE_SIZE = 12

type SortKey = 'latest' | 'popular'

// DeckCard와 동일한 테마 키워드 상수
const THEME_KEYWORDS = ['침잠', '출혈', '파열', '화상', '진동', '충전', '호흡']
const KEYWORD_THRESHOLD = 5

// 덱에서 테마 키워드 추출 (DeckCard와 동일 로직)
function getDeckThemeKeywords(deck: DeckSummary): string[] {
  const freq: Record<string, number> = {}
  for (const slot of deck.deck_identities ?? []) {
    for (const kw of slot?.identities?.keywords ?? []) {
      if (THEME_KEYWORDS.includes(kw)) {
        freq[kw] = (freq[kw] ?? 0) + 1
      }
    }
  }
  return Object.entries(freq)
    .filter(([, n]) => n >= KEYWORD_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([kw]) => kw)
}

// 덱의 모든 키워드 (검색용, 임계값 없음)
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

export default function DecksPage() {
  const { status: authStatus } = useSession()
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
    // 시작 일치 우선, 짧은 것 우선
    matches.sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1
      const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
      return a.length - b.length
    })
    return matches.slice(0, 8)
  }, [search])

  // 검색어 변경 시 자동완성 첫 항목 선택
  useEffect(() => { setAcIndex(suggestions.length > 0 ? 0 : -1) }, [suggestions.length])

  // 자동완성 키보드 핸들러
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // ArrowDown으로 드롭다운 열기
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
      // IME 조합 중이면 강제 종료
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

  // 멀티 선택 필터
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [activeKeywords, setActiveKeywords] = useState<Set<string>>(new Set())
  const [keywordMode, setKeywordMode] = useState<'or' | 'and'>('or')

  // 컬렉션 필터
  const [filterOwnedIdentity, setFilterOwnedIdentity] = useState(false)
  const [filterOwnedEgo, setFilterOwnedEgo] = useState(false)
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null)
  const [collectionLoading, setCollectionLoading] = useState(false)
  const [hasCollection, setHasCollection] = useState(false)
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)

  // 덱 목록 로드 (초기)
  useEffect(() => {
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
      .finally(() => setLoading(false))
  }, [sort])

  // 추가 로드
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetch(`/api/decks?sort=${sort}&limit=${PAGE_SIZE}&offset=${decks.length}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          setHasMore(false)
          return
        }
        if (data.length < PAGE_SIZE) setHasMore(false)
        setDecks(prev => [...prev, ...data.map(mapDeck)])
      })
      .finally(() => setLoadingMore(false))
  }, [sort, decks.length, loadingMore, hasMore])

  // IntersectionObserver로 무한 스크롤
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

  // 컬렉션 마스터 데이터 로드 (전체 유저)
  useEffect(() => {
    fetch('/api/collection').then(r => r.json())
      .then((d: CollectionData) => { if (d.sinners?.length > 0) setCollectionData(d) })
      .catch(() => {})
  }, [])

  // 로그인 유저: 프로필에서 컬렉션 코드 자동 로드
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

  // 보유 코드 붙여넣기 디코딩
  const applyCollectionCode = useCallback(async (rawInput: string) => {
    if (!collectionData) return
    setCodeError(false)
    // URL에서 code 파라미터 추출 또는 코드 자체 사용
    let code = rawInput.trim()
    try {
      const url = new URL(code)
      code = url.searchParams.get('code') ?? code
    } catch {
      // URL이 아닌 경우 그대로 사용
    }
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

  // 태그 토글
  const toggleTag = useCallback((tag: string) => {
    setActiveTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }, [])

  // 키워드 토글
  const toggleKeyword = useCallback((kw: string) => {
    setActiveKeywords(prev => {
      const next = new Set(prev)
      if (next.has(kw)) next.delete(kw)
      else next.add(kw)
      return next
    })
  }, [])

  // 전체 태그 목록 (빈도순)
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

  // 덱에서 사용되는 테마 키워드 목록
  const availableKeywords = useMemo(() => {
    const found = new Set<string>()
    for (const d of decks) {
      for (const kw of getDeckThemeKeywords(d)) {
        found.add(kw)
      }
    }
    // THEME_KEYWORDS 원래 순서 유지
    return THEME_KEYWORDS.filter(kw => found.has(kw))
  }, [decks])

  // 필터 적용
  const filtered = useMemo(() => {
    let list = decks

    // 텍스트 검색: 제목 + 설명 + 태그 + 키워드
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(d =>
        d.title.toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q)) ||
        getDeckAllKeywords(d).some(kw => kw.toLowerCase().includes(q))
      )
    }

    // 태그 멀티 필터: 선택된 모든 태그를 포함하는 덱
    if (activeTags.size > 0) {
      list = list.filter(d => {
        for (const tag of activeTags) {
          if (!d.tags.includes(tag)) return false
        }
        return true
      })
    }

    // 키워드 멀티 필터: AND(모두 포함) 또는 OR(하나 이상)
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

    // 보유 인격 필터
    if (filterOwnedIdentity && ownedIds) {
      list = list.filter(d => {
        const ids = (d.deck_identities ?? [])
          .map(s => s.identities?.id)
          .filter((id): id is string => Boolean(id))
        if (ids.length === 0) return true
        return ids.every(id => ownedIds.has(id))
      })
    }

    // 보유 에고 필터
    if (filterOwnedEgo && ownedIds) {
      list = list.filter(d => {
        const egoIds = (d.deck_egos ?? []).map(e => e.ego_id)
        if (egoIds.length === 0) return true
        return egoIds.every(id => ownedIds.has(id))
      })
    }

    return list
  }, [decks, search, activeTags, activeKeywords, keywordMode, filterOwnedIdentity, filterOwnedEgo, ownedIds])

  const hasAnyFilter = search || activeTags.size > 0 || activeKeywords.size > 0 || filterOwnedIdentity || filterOwnedEgo

  return (
    <div className="min-h-screen pt-24 pb-20 px-6 max-w-7xl mx-auto">

      {/* ── 헤더 ── */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <p style={{ color: '#3a3050', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.15em', marginBottom: '6px' }}>
            DECK ARCHIVE
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold" style={{ color: 'var(--gold)' }}>
            덱 게시판
          </h1>
          <p className="mt-2" style={{ color: '#666688', fontSize: '13px' }}>
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

      {/* ── 검색 + 정렬 ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* 검색 + 자동완성 (화살표 + Tab) */}
        <div className="relative flex-1" ref={searchRef}>
          <svg
            width="14" height="14" viewBox="0 0 16 16" fill="none"
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#3a3050', pointerEvents: 'none', zIndex: 1 }}
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
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#3a3050', cursor: 'pointer', zIndex: 1 }}
            >
              ✕
            </button>
          )}
          {/* 키워드 자동완성 드롭다운 (화살표 + Tab) */}
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
              <div className="px-3 py-1" style={{ background: 'rgba(255,255,255,0.03)', color: '#444', fontSize: '10px', fontWeight: 600 }}>
                키워드 <span style={{ color: '#333', fontWeight: 400 }}>Tab으로 선택</span>
              </div>
              {suggestions.map((kw, i) => {
                const iconUrl = getKeywordIconUrl(kw)
                const isFocused = acIndex === i
                return (
                  <div
                    key={kw}
                    className="flex items-center gap-2 px-3 py-2 text-xs"
                    style={{
                      color: isFocused ? '#e8b030' : '#c8b890',
                      fontFamily: 'var(--font-heading)',
                      background: isFocused ? 'rgba(200,144,10,0.12)' : 'transparent',
                      borderLeft: isFocused ? '2px solid var(--gold)' : '2px solid transparent',
                    }}
                  >
                    {iconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={iconUrl} alt="" width={14} height={14} style={{ flexShrink: 0 }} />
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
                color: sort === s ? 'var(--bg-deep)' : '#888899',
                border: `1px solid ${sort === s ? 'var(--gold)' : 'var(--border)'}`,
                fontFamily: 'var(--font-heading)',
                fontSize: '12px',
              }}
            >
              {s === 'latest' ? '최신순' : '인기순'}
            </button>
          ))}
        </div>
      </div>

      {/* ── 태그 필터 (멀티 선택) ── */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {activeTags.size > 0 && (
            <button
              onClick={() => setActiveTags(new Set())}
              className="px-3 py-1 rounded-full text-xs transition-all duration-150"
              style={{
                background: 'transparent',
                color: '#555566',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-body)',
              }}
            >
              태그 초기화
            </button>
          )}
          {allTags.map(tag => {
            const isActive = activeTags.has(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className="px-3 py-1 rounded-full text-xs transition-all duration-150"
                style={{
                  background: isActive ? 'rgba(200,144,10,0.2)' : 'transparent',
                  color: isActive ? 'var(--gold)' : '#555566',
                  border: `1px solid ${isActive ? 'var(--gold-dim)' : 'var(--border)'}`,
                  fontFamily: 'var(--font-body)',
                }}
              >
                #{tag}
              </button>
            )
          })}
        </div>
      )}

      {/* ── 키워드 필터 (멀티 선택) ── */}
      {availableKeywords.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {activeKeywords.size > 0 && (
            <button
              onClick={() => setActiveKeywords(new Set())}
              className="px-3 py-1 rounded text-xs transition-all duration-150"
              style={{
                background: 'transparent',
                color: '#555566',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-body)',
              }}
            >
              키워드 초기화
            </button>
          )}
          {availableKeywords.map(kw => {
            const isActive = activeKeywords.has(kw)
            const iconUrl = getKeywordIconUrl(kw)
            return (
              <button
                key={kw}
                onClick={() => toggleKeyword(kw)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all duration-150"
                style={{
                  background: isActive ? 'rgba(136,88,40,0.25)' : 'transparent',
                  color: isActive ? '#c8a450' : '#555566',
                  border: `1px solid ${isActive ? 'rgba(136,88,40,0.5)' : 'var(--border)'}`,
                  fontFamily: 'var(--font-heading)',
                  fontSize: '11px',
                }}
              >
                {iconUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={iconUrl}
                    alt=""
                    width={13}
                    height={13}
                    style={{ flexShrink: 0, opacity: isActive ? 1 : 0.5 }}
                  />
                )}
                {kw}
              </button>
            )
          })}
          {activeKeywords.size >= 2 && (
            <>
              <div className="flex-1" />
              <button
                onClick={() => setKeywordMode(m => m === 'or' ? 'and' : 'or')}
                className="px-2.5 py-1 rounded text-xs transition-all duration-150"
                style={{
                  background: keywordMode === 'and' ? 'rgba(200,144,10,0.15)' : 'rgba(255,255,255,0.05)',
                  color: keywordMode === 'and' ? '#c8a450' : '#9a9aaa',
                  border: `1px solid ${keywordMode === 'and' ? 'rgba(200,144,10,0.3)' : 'rgba(255,255,255,0.12)'}`,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.05em',
                }}
              >
                {keywordMode === 'and' ? 'AND' : 'OR'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── 컬렉션 필터 ── */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {collectionLoading ? (
          <span className="text-xs" style={{ color: '#3a3050', fontFamily: 'var(--font-mono)' }}>
            컬렉션 로딩 중...
          </span>
        ) : hasCollection ? (
          <>
            <button
              onClick={() => setFilterOwnedIdentity(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all duration-150"
              style={{
                background: filterOwnedIdentity ? 'rgba(80,160,80,0.15)' : 'transparent',
                color: filterOwnedIdentity ? '#80c880' : '#555566',
                border: `1px solid ${filterOwnedIdentity ? 'rgba(80,160,80,0.4)' : 'var(--border)'}`,
                fontFamily: 'var(--font-heading)',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <User size={12} />
              보유 인격 덱
            </button>
            <button
              onClick={() => setFilterOwnedEgo(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all duration-150"
              style={{
                background: filterOwnedEgo ? 'rgba(80,160,80,0.15)' : 'transparent',
                color: filterOwnedEgo ? '#80c880' : '#555566',
                border: `1px solid ${filterOwnedEgo ? 'rgba(80,160,80,0.4)' : 'var(--border)'}`,
                fontFamily: 'var(--font-heading)',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <PackageOpen size={12} />
              보유 에고 덱
            </button>
            <button
              onClick={() => { setOwnedIds(null); setHasCollection(false); setFilterOwnedIdentity(false); setFilterOwnedEgo(false); setCodeInput('') }}
              className="px-2 py-1.5 rounded text-xs transition-all duration-150"
              style={{ color: '#555566', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-heading)', fontSize: '11px' }}
            >
              초기화
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <Link2 size={13} style={{ color: '#555566', flexShrink: 0 }} />
            <input
              type="text"
              value={codeInput}
              onChange={e => { setCodeInput(e.target.value); setCodeError(false) }}
              onKeyDown={e => { if (e.key === 'Enter') applyCollectionCode(codeInput) }}
              placeholder="보유 현황 URL 또는 코드 붙여넣기..."
              className="flex-1 px-3 py-1.5 rounded text-xs transition-all"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: `1px solid ${codeError ? 'rgba(200,80,80,0.5)' : 'var(--border)'}`,
                color: '#ccc',
                outline: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                maxWidth: '400px',
              }}
            />
            <button
              onClick={() => applyCollectionCode(codeInput)}
              className="px-3 py-1.5 rounded text-xs transition-all duration-150"
              style={{
                background: 'rgba(200,144,10,0.12)',
                color: 'var(--gold)',
                border: '1px solid rgba(200,144,10,0.3)',
                fontFamily: 'var(--font-heading)',
                fontSize: '11px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              적용
            </button>
            {codeError && (
              <span className="text-xs" style={{ color: '#c85050', fontFamily: 'var(--font-mono)' }}>
                잘못된 코드
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── 결과 수 ── */}
      {!loading && (
        <p className="mb-5 text-xs" style={{ color: '#333344', fontFamily: 'var(--font-mono)' }}>
          {filtered.length}개의 덱{hasMore && '+'}
          {hasAnyFilter && ' (필터 적용됨)'}
        </p>
      )}

      {/* ── 덱 목록 ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded" style={{ background: '#1a1510', border: '1px solid var(--border)', height: '160px', opacity: 0.4 + i * 0.05 }}>
              <div style={{ padding: '20px' }}>
                <div style={{ width: '60%', height: '14px', background: '#2a2015', borderRadius: 2, marginBottom: 10 }} />
                <div style={{ width: '90%', height: '10px', background: '#2a2015', borderRadius: 2, marginBottom: 6 }} />
                <div style={{ width: '70%', height: '10px', background: '#2a2015', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div style={{ color: '#2a2035', fontSize: '48px' }}>⊘</div>
          <p className="font-serif text-base italic" style={{ color: '#333344' }}>
            {hasAnyFilter ? '검색 결과가 없습니다.' : '아직 등록된 덱이 없습니다.'}
          </p>
          {!hasAnyFilter && (
            <Link
              href="/decks/new"
              style={{ color: 'var(--gold-dim)', fontSize: '13px' }}
              className="hover:text-yellow-300 transition-colors underline underline-offset-2"
            >
              첫 번째 덱을 만들어보세요 →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(deck => (
            <DeckCard key={deck.id} deck={deck} onTagClick={toggleTag} />
          ))}
        </div>
      )}

      {/* 무한 스크롤 센티널 */}
      {!loading && hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {loadingMore && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#555566' }}>
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
