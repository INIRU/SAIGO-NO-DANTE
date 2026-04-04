'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { PackageOpen, Search, X, Link2, User } from 'lucide-react'
import PlanCard, { type PlanSummary } from '@/components/planner/PlanCard'
import { DIFFICULTY_CONFIG, type Difficulty } from '@/lib/planner/types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { decodeCollectionAsync, type CollectionData } from '@/lib/collection'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { STORAGE_BASE } from '@/lib/constants/game'
import { parseSearchQuery, getActiveTerm, termMatchesAny } from '@/lib/utils/search'
import { THEME_KEYWORDS } from '@/lib/constants/keywords'

type SortKey = 'latest' | 'popular'
type SearchSuggestion = { label: string; type: 'identity' | 'keyword'; imageUrl?: string }
type IdentityNameEntry = { name_kr: string; sinner_id: string; folder_name: string | null; game_id: string | null }
const PAGE_SIZE = 20

const DIFFICULTY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  normal:  { bg: 'rgba(74,152,104,0.12)',  color: '#4a9868', border: 'rgba(74,152,104,0.3)' },
  hard:    { bg: 'rgba(200,144,10,0.12)',  color: '#e8b030', border: 'rgba(200,144,10,0.3)' },
  overlap: { bg: 'rgba(72,152,176,0.12)',  color: '#48b0c0', border: 'rgba(72,152,176,0.3)' },
  extreme: { bg: 'rgba(200,48,48,0.12)',   color: '#e05050', border: 'rgba(200,48,48,0.3)' },
}

// 플랜의 모든 인격 이름 (검색용) — API가 pre-compute한 값 우선 사용
function getPlanIdentityNames(plan: PlanSummary): string[] {
  return plan.identity_names ?? []
}

// 플랜 테마 키워드 — API가 서버사이드에서 pre-compute한 값 사용
function getPlanThemeKeywords(plan: PlanSummary): string[] {
  return plan.theme_keywords ?? []
}

type CommunityClientProps = {
  initialPlans?: PlanSummary[]
  initialTotal?: number
}

export default function CommunityClient({ initialPlans, initialTotal }: CommunityClientProps) {
  const { status: authStatus } = useSession()
  const { iconMap: kwIconMap, getIconUrl } = useKeywordData()
  const ALL_KEYWORDS = useMemo(() => Object.keys(kwIconMap), [kwIconMap])
  const [plans, setPlans] = useState<PlanSummary[]>(initialPlans ?? [])
  const [loading, setLoading] = useState(initialPlans === undefined)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(
    initialPlans !== undefined && initialTotal !== undefined
      ? initialPlans.length < initialTotal
      : true
  )
  const [total, setTotal] = useState(initialTotal ?? 0)
  const [sort, setSort] = useQueryState('sort', parseAsString.withDefault('latest'))
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const offsetRef = useRef(initialPlans?.length ?? 0)
  const searchRef = useRef<HTMLDivElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [acIndex, setAcIndex] = useState(-1)

  // 전체 인격 목록 (자동완성용 - 이름 + 일러스트)
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

  // 인격 + 키워드 자동완성 후보
  const suggestions = useMemo((): SearchSuggestion[] => {
    const { activeTerm } = getActiveTerm(search)
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
  }, [search, ALL_KEYWORDS, allIdentities])

  useEffect(() => { setAcIndex(suggestions.length > 0 ? 0 : -1) }, [suggestions.length])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && !showSuggestions && suggestions.length > 0) {
      e.preventDefault(); setShowSuggestions(true); return
    }
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Escape') setShowSuggestions(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setAcIndex(prev => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setAcIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (e.key === 'Tab' && acIndex >= 0) {
      e.preventDefault()
      const selected = suggestions[acIndex].label
      const { prefix } = getActiveTerm(search)
      // IME 조합 강제 종료
      e.currentTarget.blur()
      setShowSuggestions(false)
      setAcIndex(-1)
      // IME compositionend → onChange 이후 값 설정 (잔재 방지)
      setTimeout(() => {
        setSearch(prefix + selected)
        ;(e.target as HTMLInputElement).focus()
      }, 10)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false); setAcIndex(-1)
    }
  }

  // 외부 클릭 시 자동완성 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false); setAcIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 검색 debounce (필터링 성능)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // 키워드 필터
  const [activeKeywords, setActiveKeywords] = useState<Set<string>>(new Set())
  const [keywordMode, setKeywordMode] = useState<'or' | 'and'>('or')
  const [showKeywordFilter, setShowKeywordFilter] = useState(true)

  // 컬렉션 필터
  const [showCollectionFilter, setShowCollectionFilter] = useState(true)
  const [filterOwnedIdentity, setFilterOwnedIdentity] = useState(false)
  const [filterOwnedEgo, setFilterOwnedEgo] = useState(false)
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null)
  const [hasCollection, setHasCollection] = useState(false)
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)

  const fetchPlans = useCallback(async (opts: {
    sort: SortKey
    difficulty: Difficulty | null
    offset: number
    replace: boolean
  }) => {
    const { sort, difficulty, offset, replace } = opts
    if (replace) setLoading(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams({
        sort,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      if (difficulty) params.set('difficulty', difficulty)

      const res = await fetch(`/api/planner?${params}`)
      if (!res.ok) return

      const json = await res.json()
      const fetched: PlanSummary[] = json.plans ?? []

      setTotal(json.total ?? 0)
      setPlans(prev => replace ? fetched : [...prev, ...fetched])
      setHasMore(offset + fetched.length < (json.total ?? 0))
      offsetRef.current = offset + fetched.length
    } catch {
      // ignore
    } finally {
      if (replace) setLoading(false)
      else setLoadingMore(false)
    }
  }, [])

  const isInitialDefaultState = useRef(true)

  useEffect(() => {
    // Skip the very first fetch if server already provided initial data with default filters
    // (sort=latest, no difficulty). Any subsequent change (sort, difficulty) triggers a fresh fetch.
    if (isInitialDefaultState.current && initialPlans !== undefined && sort === 'latest' && difficulty === null) {
      isInitialDefaultState.current = false
      return
    }
    isInitialDefaultState.current = false
    offsetRef.current = 0
    fetchPlans({ sort: sort as SortKey, difficulty, offset: 0, replace: true })
  }, [sort, difficulty, fetchPlans, initialPlans])

  const handleLoadMore = () => {
    fetchPlans({ sort: sort as SortKey, difficulty, offset: offsetRef.current, replace: false })
  }

  // 컬렉션 마스터 데이터 로드
  useEffect(() => {
    fetch('/api/collection').then(r => r.json())
      .then((d: CollectionData) => { if (d.sinners?.length > 0) setCollectionData(d) })
      .catch(() => {})
  }, [])

  // 로그인 유저: 프로필에서 컬렉션 코드 자동 로드
  useEffect(() => {
    if (authStatus !== 'authenticated' || !collectionData) return
    fetch('/api/profile').then(r => r.json())
      .then(async (profileData: { profile?: { collection_code?: string | null } }) => {
        const code = profileData.profile?.collection_code
        if (code) {
          const decoded = await decodeCollectionAsync(code, collectionData.sinners, collectionData.identities, collectionData.egos)
          if (decoded.size > 0) {
            setOwnedIds(decoded)
            setHasCollection(true)
          }
        }
      })
      .catch(() => {})
  }, [authStatus, collectionData])

  // 보유 코드 적용
  const applyCollectionCode = useCallback(async (rawInput: string) => {
    if (!collectionData) return
    setCodeError(false)
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

  // 키워드 토글
  const toggleKeyword = useCallback((kw: string) => {
    setActiveKeywords(prev => {
      const next = new Set(prev)
      if (next.has(kw)) next.delete(kw)
      else next.add(kw)
      return next
    })
  }, [])

  // 항상 전체 테마 키워드 표시
  const availableKeywords = THEME_KEYWORDS as readonly string[]

  // 클라이언트 필터
  const filtered = useMemo(() => {
    let list = plans

    // 텍스트 검색: 인격 + 제목 + 설명 (+: OR, *: AND)
    if (debouncedSearch.trim()) {
      const parsed = parseSearchQuery(debouncedSearch)
      if (parsed.terms.length > 0) {
        list = list.filter(p => {
          const searchable = [
            p.title,
            p.description ?? '',
            ...getPlanIdentityNames(p),
          ]
          if (parsed.mode === 'and') {
            return parsed.terms.every(term => termMatchesAny(term, searchable))
          } else {
            return parsed.terms.some(term => termMatchesAny(term, searchable))
          }
        })
      }
    }

    // 키워드 필터
    if (activeKeywords.size > 0) {
      const kwArr = Array.from(activeKeywords)
      list = list.filter(p => {
        const planKws = new Set(getPlanThemeKeywords(p))
        if (keywordMode === 'and') {
          return kwArr.every(kw => planKws.has(kw))
        } else {
          return kwArr.some(kw => planKws.has(kw))
        }
      })
    }

    // 보유 인격 필터
    if (filterOwnedIdentity && ownedIds) {
      list = list.filter(p => {
        const ids = (p.deck ?? [])
          .map(s => s.identity_id)
          .filter((id): id is string => Boolean(id))
        if (ids.length === 0) return true
        return ids.every(id => ownedIds.has(id))
      })
    }

    // 보유 에고 필터
    if (filterOwnedEgo && ownedIds) {
      list = list.filter(p => {
        const egoIds = (p.egos ?? [])
          .map(e => e.ego_id)
          .filter((id): id is string => Boolean(id))
        if (egoIds.length === 0) return true
        return egoIds.every(id => ownedIds.has(id))
      })
    }

    return list
  }, [plans, debouncedSearch, activeKeywords, keywordMode, filterOwnedIdentity, filterOwnedEgo, ownedIds])

  return (
    <div className="min-h-screen pt-24 pb-16" style={{ background: '#0d0b08' }}>
      <div className="max-w-5xl mx-auto px-3 sm:px-6">

        {/* ── 헤더 ── */}
        <div className="mb-8">
          <div style={{ width: '4rem', height: '0.0625rem', background: 'linear-gradient(90deg, rgba(200,144,10,0.6), transparent)', marginBottom: '0.75rem' }} />
          <p style={{ color: '#444', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.15em', marginBottom: '0.375rem' }}>
            MIRROR DUNGEON PLANS
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-[2rem]" style={{ color: '#c8900a', fontFamily: 'var(--font-heading)' }}>
                커뮤니티 플랜
              </h1>
                <p className="mt-1" style={{ color: '#555', fontSize: '0.8125rem' }}>
                관리자들의 거울 던전 전략 공유 공간 — {filtered.length !== plans.length ? `${filtered.length}/${total}개` : `총 ${total}개`}
              </p>
            </div>
            <Link
              href="/planner"
              className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 font-medium text-sm transition-all hover:brightness-110 active:scale-95 self-start sm:self-auto"
              style={{ background: '#c8900a', color: '#0d0b08', borderRadius: '0.25rem', fontFamily: 'var(--font-heading)', flexShrink: 0 }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              새 플랜 만들기
            </Link>
          </div>
        </div>

        {/* ── 필터 패널 ── */}
        <div style={{
          background: 'rgba(10,8,5,0.5)', border: '1px solid #1a1510',
          borderRadius: '0.5rem', marginBottom: '1.5rem',
        }}>
          {/* 상단: 검색 + 정렬 */}
          <div className="flex items-center gap-3 p-3" style={{ borderBottom: '1px solid #1a1510' }}>
            {/* 검색 */}
            <div ref={searchRef} className="relative flex items-center gap-2 flex-1" style={{
              background: '#0d0b08', border: '1px solid #222', borderRadius: '0.375rem',
              padding: '0.375rem 0.625rem',
            }}>
              <Search size={14} style={{ color: '#444', flexShrink: 0 }} />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="인격, 키워드, 제목 검색... (+: OR, *: AND)"
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: '#e5e7eb', fontSize: '0.8125rem', width: '100%',
                }}
              />
              {search && (
                <button onClick={() => { setSearch(''); setShowSuggestions(false) }} style={{ color: '#555', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
                  <X size={12} />
                </button>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  className="absolute left-0 right-0 z-50 overflow-hidden"
                  style={{
                    top: '100%',
                    marginTop: 4,
                    background: '#1a1510',
                    border: '1px solid #2a2015',
                    borderRadius: '0.25rem',
                    boxShadow: '0 0.5rem 1.5rem rgba(0,0,0,0.5)',
                  }}
                >
                  <div className="px-3 py-1" style={{ background: 'rgba(255,255,255,0.03)', color: '#444', fontSize: '0.625rem', fontWeight: 600 }}>
                    인격 / 키워드 <span style={{ color: '#333', fontWeight: 400 }}>Tab으로 선택</span>
                  </div>
                  {suggestions.map((sg, i) => {
                    const kwIconUrl = sg.type === 'keyword' ? getIconUrl(sg.label) : null
                    const isFocused = acIndex === i
                    return (
                      <div
                        key={`${sg.type}-${sg.label}-${i}`}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs"
                        onClick={() => {
                          const { prefix } = getActiveTerm(search)
                          setSearch(prefix + sg.label)
                          setShowSuggestions(false)
                          setAcIndex(-1)
                        }}
                        style={{
                          cursor: 'pointer',
                          color: isFocused ? '#e8b030' : '#c8b890',
                          fontFamily: 'var(--font-heading)',
                          background: isFocused ? 'rgba(200,144,10,0.12)' : 'transparent',
                          borderLeft: isFocused ? '2px solid #c8900a' : '2px solid transparent',
                        }}
                      >
                        {sg.type === 'identity' && sg.imageUrl ? (
                          <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.1875rem', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(200,144,10,0.2)' }}>
                            <Image src={sg.imageUrl} alt="" width={40} height={40} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
                          </div>
                        ) : sg.type === 'identity' ? (
                          <User size={14} style={{ flexShrink: 0, color: '#8a9bb0' }} />
                        ) : kwIconUrl ? (
                          <Image src={kwIconUrl} alt="" width={14} height={14} style={{ flexShrink: 0 }} />
                        ) : null}
                        <span>{sg.label}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.5625rem', color: '#555', flexShrink: 0 }}>
                          {sg.type === 'identity' ? '인격' : '키워드'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 정렬 */}
            <div className="flex gap-1" style={{ flexShrink: 0 }}>
              {([
                { key: 'latest' as SortKey, label: '최신순' },
                { key: 'popular' as SortKey, label: '추천순' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSort(tab.key)}
                  style={{
                    padding: '0.375rem 0.75rem', borderRadius: '0.375rem',
                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    background: sort === tab.key ? 'rgba(200,144,10,0.15)' : 'transparent',
                    color: sort === tab.key ? '#e8b030' : '#555',
                    border: `1px solid ${sort === tab.key ? 'rgba(200,144,10,0.3)' : 'transparent'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 난이도 필터 */}
          <div className="flex items-center gap-2 p-3" style={{ borderBottom: '1px solid #1a1510' }}>
            <span style={{ fontSize: '0.6875rem', color: '#444', flexShrink: 0, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
              난이도
            </span>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setDifficulty(null)}
                style={{
                  padding: '0.1875rem 0.625rem', borderRadius: '2rem',
                  fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
                  background: !difficulty ? 'rgba(200,144,10,0.15)' : 'transparent',
                  color: !difficulty ? '#e8b030' : '#555',
                  border: `1px solid ${!difficulty ? 'rgba(200,144,10,0.3)' : '#222'}`,
                  transition: 'all 0.15s',
                }}
              >
                전체
              </button>
              {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, { label: string }][]).map(([key, cfg]) => {
                const active = difficulty === key
                const ds = DIFFICULTY_STYLE[key]
                return (
                  <button
                    key={key}
                    onClick={() => setDifficulty(active ? null : key)}
                    style={{
                      padding: '0.1875rem 0.625rem', borderRadius: '2rem',
                      fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
                      background: active ? ds.bg : 'transparent',
                      color: active ? ds.color : '#555',
                      border: `1px solid ${active ? ds.border : '#222'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 접이식 필터 섹션들 */}
          <div>
            {/* 키워드 필터 */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <button
                  onClick={() => setShowKeywordFilter(v => !v)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-xs transition-colors hover:bg-white/[0.02]"
                  style={{ color: activeKeywords.size > 0 ? '#c8900a' : '#666', fontFamily: 'var(--font-heading)', fontSize: '0.6875rem' }}
                >
                  <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{showKeywordFilter ? '▾' : '▸'}</span>
                  키워드
                  {activeKeywords.size > 0 && (
                    <span style={{ background: 'rgba(200,144,10,0.2)', color: '#c8900a', padding: '0 0.375rem', borderRadius: '0.5rem', fontSize: '0.625rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {activeKeywords.size}
                    </span>
                  )}
                  <div className="flex-1" />
                  {activeKeywords.size >= 2 && (
                    <span
                      onClick={e => { e.stopPropagation(); setKeywordMode(m => m === 'or' ? 'and' : 'or') }}
                      className="px-2 py-0.5 rounded transition-all"
                      style={{
                        background: keywordMode === 'and' ? 'rgba(200,144,10,0.15)' : 'rgba(255,255,255,0.05)',
                        color: keywordMode === 'and' ? '#c8a450' : '#9a9aaa',
                        border: `1px solid ${keywordMode === 'and' ? 'rgba(200,144,10,0.3)' : 'rgba(255,255,255,0.12)'}`,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.5625rem',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {keywordMode === 'and' ? 'AND' : 'OR'}
                    </span>
                  )}
                </button>
                {showKeywordFilter && (
                  <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
                    {availableKeywords.map(kw => {
                      const isActive = activeKeywords.has(kw)
                      const iconUrl = getIconUrl(kw)
                      return (
                        <button
                          key={kw}
                          onClick={() => toggleKeyword(kw)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all duration-150"
                          style={{
                            background: isActive ? 'rgba(136,88,40,0.25)' : 'transparent',
                            color: isActive ? '#c8a450' : '#555566',
                            border: `1px solid ${isActive ? 'rgba(136,88,40,0.5)' : '#222'}`,
                            fontFamily: 'var(--font-heading)',
                            fontSize: '0.6875rem',
                          }}
                        >
                          {iconUrl && (
                            <Image src={iconUrl} alt="" width={13} height={13} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.5 }} />
                          )}
                          {kw}
                        </button>
                      )
                    })}
                    {activeKeywords.size > 0 && (
                      <button
                        onClick={() => setActiveKeywords(new Set())}
                        className="px-2.5 py-1 rounded text-xs"
                        style={{ color: '#888', border: '1px solid #222', marginLeft: '0.25rem' }}
                      >
                        초기화
                      </button>
                    )}
                  </div>
                )}
              </div>

            {/* 컬렉션 필터 */}
            <div>
              <button
                onClick={() => setShowCollectionFilter(v => !v)}
                className="flex items-center gap-2 w-full px-4 py-2 text-xs transition-colors hover:bg-white/[0.02]"
                style={{ color: (filterOwnedIdentity || filterOwnedEgo) ? '#c8900a' : '#666', fontFamily: 'var(--font-heading)', fontSize: '0.6875rem' }}
              >
                <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{showCollectionFilter ? '▾' : '▸'}</span>
                보유 필터
                {(filterOwnedIdentity || filterOwnedEgo) && (
                  <span style={{ background: 'rgba(80,160,80,0.2)', color: '#80c880', padding: '0 0.375rem', borderRadius: '0.5rem', fontSize: '0.625rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {(filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0)}
                  </span>
                )}
              </button>
              {showCollectionFilter && (
                <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                  {hasCollection ? (
                    <>
                      <button
                        onClick={() => setFilterOwnedIdentity(prev => !prev)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all duration-150"
                        style={{
                          background: filterOwnedIdentity ? 'rgba(80,160,80,0.15)' : 'transparent',
                          color: filterOwnedIdentity ? '#80c880' : '#555566',
                          border: `1px solid ${filterOwnedIdentity ? 'rgba(80,160,80,0.4)' : '#222'}`,
                          fontFamily: 'var(--font-heading)',
                          fontSize: '0.6875rem',
                          cursor: 'pointer',
                        }}
                      >
                        <User size={12} />
                        보유 인격 플랜
                      </button>
                      <button
                        onClick={() => setFilterOwnedEgo(prev => !prev)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all duration-150"
                        style={{
                          background: filterOwnedEgo ? 'rgba(80,160,80,0.15)' : 'transparent',
                          color: filterOwnedEgo ? '#80c880' : '#555566',
                          border: `1px solid ${filterOwnedEgo ? 'rgba(80,160,80,0.4)' : '#222'}`,
                          fontFamily: 'var(--font-heading)',
                          fontSize: '0.6875rem',
                          cursor: 'pointer',
                        }}
                      >
                        <PackageOpen size={12} />
                        보유 E.G.O 플랜
                      </button>
                      <button
                        onClick={() => { setOwnedIds(null); setHasCollection(false); setFilterOwnedIdentity(false); setFilterOwnedEgo(false); setCodeInput('') }}
                        className="px-2 py-1.5 rounded text-xs transition-all duration-150"
                        style={{ color: '#888888', border: '1px solid #222', cursor: 'pointer', fontFamily: 'var(--font-heading)', fontSize: '0.6875rem' }}
                      >
                        초기화
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 w-full">
                      <Link2 size={13} style={{ color: '#888888', flexShrink: 0 }} />
                      <input
                        type="text"
                        value={codeInput}
                        onChange={e => { setCodeInput(e.target.value); setCodeError(false) }}
                        onKeyDown={e => { if (e.key === 'Enter') applyCollectionCode(codeInput) }}
                        placeholder="보유 현황 URL 또는 코드 붙여넣기..."
                        className="flex-1 px-3 py-1.5 rounded text-xs transition-all"
                        style={{
                          background: 'rgba(0,0,0,0.3)',
                          border: `1px solid ${codeError ? 'rgba(200,80,80,0.5)' : '#222'}`,
                          color: '#ccc',
                          outline: 'none',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6875rem',
                          maxWidth: '25rem',
                        }}
                      />
                      <button
                        onClick={() => applyCollectionCode(codeInput)}
                        className="px-3 py-1.5 rounded text-xs transition-all duration-150"
                        style={{
                          background: 'rgba(200,144,10,0.12)',
                          color: '#c8900a',
                          border: '1px solid rgba(200,144,10,0.3)',
                          fontFamily: 'var(--font-heading)',
                          fontSize: '0.6875rem',
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
              )}
            </div>
          </div>
        </div>

        {/* ── 플랜 목록 ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                height: '14rem', background: '#1a1510', border: '1px solid #222',
                borderRadius: '0.375rem', opacity: 0.5,
              }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: '#444' }}>
            <PackageOpen style={{ width: '2.5rem', height: '2.5rem', opacity: 0.4 }} />
            <p style={{ fontSize: '0.875rem' }}>
              {search ? `"${search}" 검색 결과가 없습니다` : '아직 등록된 플랜이 없습니다'}
            </p>
            {!search && (
              <Link href="/planner" style={{ color: '#c8900a', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                첫 플랜 만들기 →
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(plan => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>

            {hasMore && !search && activeKeywords.size === 0 && !filterOwnedIdentity && !filterOwnedEgo && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="transition-all hover:brightness-110 disabled:opacity-50"
                  style={{
                    padding: '0.625rem 2rem',
                    background: 'rgba(200,144,10,0.08)',
                    border: '1px solid rgba(200,144,10,0.25)',
                    borderRadius: '2rem',
                    color: '#e8b030',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loadingMore ? '불러오는 중...' : '더 보기'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
