'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { Search, X } from 'lucide-react'
import { Sinner, Identity, EGO, getSinnerProfileUrl, getSinnerLogoUrl, STORAGE_BASE, SIN_COLORS, SinType, GRADE_COLORS, KEYWORD_SIN_MAP, KEYWORD_ICON_MAP } from '@/lib/data/sinners'
import IdentityCard from '@/components/sinners/IdentityCard'

interface Props {
  sinner: Sinner
  identities: Identity[]
  egos: EGO[]
}

type Tab = 'identities' | 'ego'

export default function SinnerDetailClient({ sinner, identities, egos }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = useState<Tab>('identities')
  const [gacksung, setGacksung] = useState(false)
  const [rarityFilter, setRarityFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set())
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 초기 해시 읽기 + 브라우저 뒤로가기/앞으로가기 동기화
  useEffect(() => {
    const readHash = () => setTab(window.location.hash === '#ego' ? 'ego' : 'identities')
    readHash()
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [])

  const changeTab = (t: Tab) => {
    router.push(`${pathname}#${t}`, { scroll: false })
    setTab(t)
  }

  // 인격 키워드 빈도 계산 + 정렬
  const keywordStats = useMemo(() => {
    const freq = new Map<string, number>()
    for (const i of identities) {
      if (!i.keywords) continue
      for (const kw of i.keywords) {
        freq.set(kw, (freq.get(kw) ?? 0) + 1)
      }
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kw, count]) => ({ kw, count }))
  }, [identities])

  // EGO 키워드 빈도 계산
  const egoKeywordStats = useMemo(() => {
    const freq = new Map<string, number>()
    for (const e of egos) {
      if (!e.keywords) continue
      for (const kw of e.keywords) {
        freq.set(kw, (freq.get(kw) ?? 0) + 1)
      }
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kw, count]) => ({ kw, count }))
  }, [egos])

  const toggleKeyword = (kw: string) => {
    setSelectedKeywords(prev => {
      const next = new Set(prev)
      if (next.has(kw)) next.delete(kw)
      else next.add(kw)
      return next
    })
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedKeywords(new Set())
    setRarityFilter(null)
  }

  const hasActiveFilters = searchQuery || selectedKeywords.size > 0 || rarityFilter

  // 인격 필터링: 등급 → 검색어 → 키워드
  const filteredIdentities = useMemo(() => {
    let result = identities
    if (rarityFilter) result = result.filter(i => i.rarity === rarityFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(i =>
        i.name_kr.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        (i.affiliation && i.affiliation.toLowerCase().includes(q)) ||
        (i.keywords && i.keywords.some(kw => kw.toLowerCase().includes(q)))
      )
    }
    if (selectedKeywords.size > 0) {
      result = result.filter(i =>
        i.keywords && [...selectedKeywords].every(kw => i.keywords.includes(kw))
      )
    }
    result = [...result].sort((a, b) => {
      const aId = parseInt(a.game_id ?? '0')
      const bId = parseInt(b.game_id ?? '0')
      return sortOrder === 'newest' ? bId - aId : aId - bId
    })
    return result
  }, [identities, rarityFilter, searchQuery, selectedKeywords, sortOrder])

  // EGO 필터링: 검색어 → 키워드
  const filteredEgos = useMemo(() => {
    let result = egos
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(e =>
        (e.name_kr && e.name_kr.toLowerCase().includes(q)) ||
        e.name.toLowerCase().includes(q) ||
        (e.keywords && e.keywords.some(kw => kw.toLowerCase().includes(q)))
      )
    }
    if (selectedKeywords.size > 0) {
      result = result.filter(e =>
        e.keywords && [...selectedKeywords].every(kw => e.keywords!.includes(kw))
      )
    }
    result = [...result].sort((a, b) => {
      const aId = parseInt(a.game_id ?? '0')
      const bId = parseInt(b.game_id ?? '0')
      return sortOrder === 'newest' ? bId - aId : aId - bId
    })
    return result
  }, [egos, searchQuery, selectedKeywords, sortOrder])

  // 자동완성 드롭다운
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [acIndex, setAcIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)
  const autocompleteResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return { keywords: [] as { kw: string; count: number }[], identities: [] as Identity[], egos: [] as EGO[] }

    const currentStats = tab === 'ego' ? egoKeywordStats : keywordStats
    const matchedKw = currentStats
      .filter(({ kw }) => kw.toLowerCase().includes(q))
      .sort((a, b) => {
        const aS = a.kw.toLowerCase().startsWith(q) ? 0 : 1
        const bS = b.kw.toLowerCase().startsWith(q) ? 0 : 1
        if (aS !== bS) return aS - bS
        return a.kw.length - b.kw.length
      })
      .slice(0, 5)
    const matchedIdent = identities
      .filter(i => i.name_kr.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aS = a.name_kr.toLowerCase().startsWith(q) ? 0 : 1
        const bS = b.name_kr.toLowerCase().startsWith(q) ? 0 : 1
        if (aS !== bS) return aS - bS
        return a.name_kr.length - b.name_kr.length
      })
      .slice(0, 5)
    const matchedEgo = egos
      .filter(e => (e.name_kr && e.name_kr.toLowerCase().includes(q)) || e.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aName = a.name_kr || a.name
        const bName = b.name_kr || b.name
        const aS = aName.toLowerCase().startsWith(q) ? 0 : 1
        const bS = bName.toLowerCase().startsWith(q) ? 0 : 1
        if (aS !== bS) return aS - bS
        return aName.length - bName.length
      })
      .slice(0, 5)

    return { keywords: matchedKw, identities: matchedIdent, egos: matchedEgo }
  }, [searchQuery, keywordStats, egoKeywordStats, identities, egos, tab])

  // 자동완성 항목을 평탄화 (키보드 탐색용)
  type AcItem =
    | { type: 'keyword'; kw: string; count: number }
    | { type: 'identity'; data: Identity }
    | { type: 'ego'; data: EGO }
  const acItems = useMemo<AcItem[]>(() => [
    ...autocompleteResults.keywords.map(k => ({ type: 'keyword' as const, kw: k.kw, count: k.count })),
    ...autocompleteResults.identities.map(i => ({ type: 'identity' as const, data: i })),
    ...autocompleteResults.egos.map(e => ({ type: 'ego' as const, data: e })),
  ], [autocompleteResults])

  const hasAutocompleteResults = acItems.length > 0

  // 검색어 변경 시 첫 항목 자동 선택
  useEffect(() => { setAcIndex(acItems.length > 0 ? 0 : -1) }, [searchQuery, acItems.length])

  // 자동완성 항목 선택 실행
  const executeAcItem = (item: AcItem) => {
    if (item.type === 'keyword') {
      toggleKeyword(item.kw)
      setSearchQuery('')
    } else if (item.type === 'identity') {
      router.push(`/sinners/${sinner.id}/identities/${item.data.id}`)
    } else {
      router.push(`/sinners/${sinner.id}/ego/${item.data.id}`)
    }
    setShowAutocomplete(false)
    setAcIndex(-1)
  }

  // 키보드 핸들러
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // ArrowDown으로 드롭다운 열기
    if (e.key === 'ArrowDown' && !showAutocomplete && hasAutocompleteResults) {
      e.preventDefault()
      setShowAutocomplete(true)
      return
    }
    if (!showAutocomplete || !hasAutocompleteResults) {
      if (e.key === 'Escape') setShowAutocomplete(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAcIndex(prev => (prev + 1) % acItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAcIndex(prev => (prev <= 0 ? acItems.length - 1 : prev - 1))
    } else if (e.key === 'Tab' && acIndex >= 0) {
      e.preventDefault()
      e.currentTarget.blur()
      executeAcItem(acItems[acIndex])
      setTimeout(() => (e.target as HTMLInputElement).focus(), 0)
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false)
      setAcIndex(-1)
    }
  }

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false)
        setAcIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-6">
        {/* 브레드크럼 */}
        <div className="mb-8 flex items-center gap-2 text-sm" style={{ color: '#555566' }}>
          <Link href="/sinners" className="hover:text-yellow-300 transition-colors">
            수감자 목록
          </Link>
          <span>›</span>
          <span style={{ color: 'var(--gold)' }}>{sinner.name_kr}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 좌측: 캐릭터 정보 (sticky) */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="card p-6">
              {/* 프로필 이미지 */}
              <div
                className="relative w-full rounded-lg mb-6 overflow-hidden"
                style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)' }}
              >
                {getSinnerProfileUrl(sinner.id) ? (
                  <Image
                    src={getSinnerProfileUrl(sinner.id)}
                    alt={sinner.name_kr}
                    fill
                    unoptimized
                    className="object-cover object-top"
                    style={{ objectPosition: '50% 15%' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span
                      className="font-serif text-8xl font-bold"
                      style={{ color: 'rgba(200,164,90,0.2)' }}
                    >
                      {sinner.name[0]}
                    </span>
                  </div>
                )}
              </div>

              {/* 이름 + 로고 */}
              <div className="flex items-center gap-3 mb-1">
                <Image
                  src={getSinnerLogoUrl(sinner.id)}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  style={{
                    filter: 'drop-shadow(0 0 4px rgba(200,144,10,0.3))',
                    opacity: 0.9,
                  }}
                />
                <div>
                  <h1
                    className="font-serif text-3xl font-bold"
                    style={{ color: 'var(--gold)' }}
                  >
                    {sinner.name}
                  </h1>
                  <p className="text-sm" style={{ color: '#666688' }}>
                    {sinner.name_kr} · #{String(sinner.order_num).padStart(2, '0')}
                  </p>
                </div>
              </div>

              {/* 설명 */}
              <p
                className="text-sm leading-relaxed mb-4"
                style={{ color: '#9e9e9e' }}
              >
                {sinner.description}
              </p>

              {/* 문학 출처 */}
              <div
                className="text-xs italic px-3 py-2 rounded"
                style={{
                  background: 'rgba(200,164,90,0.08)',
                  borderLeft: '2px solid var(--gold)',
                  color: 'rgba(200,164,90,0.7)',
                }}
              >
                {sinner.literary_source}
              </div>
            </div>
          </div>

          {/* 우측: 탭 콘텐츠 */}
          <div className="lg:col-span-2">
            {/* 탭 */}
            <div
              className="flex gap-0 mb-4 rounded overflow-hidden"
              style={{ border: '1px solid var(--border)' }}
            >
              {(['identities', 'ego'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => changeTab(t)}
                  className="flex-1 py-3 text-sm font-medium transition-all duration-200"
                  style={{
                    background: tab === t ? 'var(--gold)' : 'transparent',
                    color: tab === t ? 'var(--bg-deep)' : '#666688',
                  }}
                >
                  {t === 'identities' ? '인격' : 'EGO'}
                </button>
              ))}
            </div>

            {/* 검색 바 + 자동완성 (공통) */}
            <div className="mb-3" ref={autocompleteRef}>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#555' }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setShowAutocomplete(true) }}
                  placeholder={tab === 'identities' ? '인격 이름, 소속, 키워드 검색...' : 'EGO 이름, 키워드 검색...'}
                  className="w-full pl-9 pr-8 py-2 rounded text-xs transition-all"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border)',
                    color: '#ccc',
                    outline: 'none',
                  }}
                  onFocus={() => { if (searchQuery.trim()) setShowAutocomplete(true) }}
                  onKeyDown={handleSearchKeyDown}
                />
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:opacity-80 transition-opacity"
                    style={{ color: '#666' }}
                    title="필터 초기화"
                  >
                    <X size={14} />
                  </button>
                )}

                {/* 자동완성 드롭다운 (화살표 키 + Tab 선택) */}
                {showAutocomplete && hasAutocompleteResults && (() => {
                  const kwStart = 0
                  const identStart = autocompleteResults.keywords.length
                  const egoStart = identStart + autocompleteResults.identities.length
                  return (
                    <div
                      className="absolute z-50 left-0 right-0 mt-1 rounded overflow-hidden"
                      style={{
                        background: '#1a1510',
                        border: '1px solid var(--border)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                        maxHeight: '280px',
                        overflowY: 'auto',
                      }}
                    >
                      {/* 키워드 매칭 */}
                      {autocompleteResults.keywords.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', color: '#555', fontSize: '10px', fontWeight: 600 }}>
                            키워드 <span style={{ color: '#444', fontWeight: 400 }}>Tab으로 선택</span>
                          </div>
                          {autocompleteResults.keywords.map(({ kw, count }, i) => {
                            const idx = kwStart + i
                            const isFocused = acIndex === idx
                            const sinType = KEYWORD_SIN_MAP[kw] as SinType | undefined
                            const chipColor = sinType ? SIN_COLORS[sinType] : '#888'
                            const iconSlug = KEYWORD_ICON_MAP[kw]
                            const isSelected = selectedKeywords.has(kw)
                            return (
                              <div
                                key={kw}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs"
                                style={{
                                  background: isFocused ? 'rgba(200,144,10,0.12)' : 'transparent',
                                  color: isFocused ? chipColor : isSelected ? chipColor : '#aaa',
                                  borderLeft: isFocused ? '2px solid var(--gold)' : '2px solid transparent',
                                }}
                              >
                                {iconSlug && (
                                  <img
                                    src={`${STORAGE_BASE}/icons/keywords/${iconSlug}.webp`}
                                    alt="" style={{ width: '14px', height: '14px' }}
                                  />
                                )}
                                <span>{kw}</span>
                                <span style={{ color: '#444', fontSize: '10px', marginLeft: 'auto' }}>{count}개</span>
                                {isSelected && <span style={{ color: chipColor, fontSize: '10px' }}>ON</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* 인격 매칭 */}
                      {autocompleteResults.identities.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', color: '#555', fontSize: '10px', fontWeight: 600 }}>
                            인격
                          </div>
                          {autocompleteResults.identities.map((ident, i) => {
                            const idx = identStart + i
                            const isFocused = acIndex === idx
                            return (
                              <div
                                key={ident.id}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs"
                                style={{
                                  background: isFocused ? 'rgba(200,144,10,0.12)' : 'transparent',
                                  color: isFocused ? '#e8b030' : '#ccc',
                                  borderLeft: isFocused ? '2px solid var(--gold)' : '2px solid transparent',
                                }}
                              >
                                <span
                                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: ident.rarity === '3성' ? '#c8900a' : ident.rarity === '2성' ? '#5588bb' : '#556677' }}
                                />
                                <span>{ident.name_kr}</span>
                                <span style={{ color: '#444', fontSize: '10px', marginLeft: 'auto' }}>{ident.rarity}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* EGO 매칭 */}
                      {autocompleteResults.egos.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', color: '#555', fontSize: '10px', fontWeight: 600 }}>
                            EGO
                          </div>
                          {autocompleteResults.egos.map((ego, i) => {
                            const idx = egoStart + i
                            const isFocused = acIndex === idx
                            const gradeColor = GRADE_COLORS[ego.grade] ?? '#667788'
                            return (
                              <div
                                key={ego.id}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs"
                                style={{
                                  background: isFocused ? 'rgba(200,144,10,0.12)' : 'transparent',
                                  color: isFocused ? '#e8b030' : '#ccc',
                                  borderLeft: isFocused ? '2px solid var(--gold)' : '2px solid transparent',
                                }}
                              >
                                <span
                                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: gradeColor }}
                                />
                                <span>{ego.name_kr || ego.name}</span>
                                <span style={{ color: gradeColor, fontSize: '10px', marginLeft: 'auto' }}>{ego.grade}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* 인격 탭 */}
            {tab === 'identities' && (
              <div>
                {/* 필터 바 */}
                <div className="flex items-center justify-between mb-3">
                  {/* 등급 필터 */}
                  <div className="flex items-center gap-1.5">
                    {[
                      { value: null, label: '전체', icon: null },
                      { value: '1성', label: '1성', icon: `${STORAGE_BASE}/icons/Rarity/1star.webp` },
                      { value: '2성', label: '2성', icon: `${STORAGE_BASE}/icons/Rarity/2star.webp` },
                      { value: '3성', label: '3성', icon: `${STORAGE_BASE}/icons/Rarity/3star.webp` },
                    ].map(({ value, label, icon }) => {
                      const isActive = rarityFilter === value
                      const borderColor = value === '3성' ? '#c8900a' : value === '2성' ? '#5588bb' : value === '1성' ? '#556677' : 'var(--border)'
                      return (
                        <button
                          key={label}
                          onClick={() => setRarityFilter(value)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all duration-200"
                          style={{
                            background: isActive ? `${borderColor}20` : 'transparent',
                            border: `1px solid ${isActive ? borderColor : 'var(--border)'}`,
                            color: isActive ? (value === null ? 'var(--gold)' : borderColor) : '#555',
                            opacity: isActive ? 1 : 0.6,
                          }}
                        >
                          {icon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={icon}
                              alt={label}
                              style={{
                                height: '14px',
                                width: 'auto',
                                filter: isActive ? 'none' : 'grayscale(0.8) brightness(0.6)',
                              }}
                            />
                          ) : (
                            label
                          )}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 정렬 토글 */}
                    <button
                      onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all duration-200"
                      style={{
                        background: 'rgba(200,164,90,0.08)',
                        border: '1px solid var(--border)',
                        color: '#999',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {sortOrder === 'newest' ? (
                          <><path d="M12 5v14"/><path d="M5 12l7 7 7-7"/></>
                        ) : (
                          <><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></>
                        )}
                      </svg>
                      {sortOrder === 'newest' ? '최신순' : '오래된순'}
                    </button>

                  {/* 일반/각성 토글 */}
                  <button
                    onClick={() => setGacksung(!gacksung)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200"
                    style={{
                      background: gacksung ? 'rgba(255,107,107,0.15)' : 'rgba(200,164,90,0.1)',
                      border: `1px solid ${gacksung ? 'rgba(255,107,107,0.4)' : 'var(--border)'}`,
                      color: gacksung ? '#ff6b6b' : '#888',
                    }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full transition-colors"
                      style={{ background: gacksung ? '#ff6b6b' : '#555' }}
                    />
                    {gacksung ? '3동기화' : '일반'}
                  </button>
                  </div>
                </div>

                {filteredIdentities.length === 0 ? (
                  <div
                    className="text-center py-16"
                    style={{ color: '#555566' }}
                  >
                    {hasActiveFilters ? '검색 결과가 없습니다.' : '등록된 인격이 없습니다.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8">
                    {filteredIdentities.map(identity => (
                      <IdentityCard
                        key={identity.id}
                        identity={identity}
                        gacksung={gacksung}
                        compact
                        onClick={() =>
                          router.push(`/sinners/${sinner.id}/identities/${identity.id}`)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* EGO 탭 */}
            {tab === 'ego' && (
              <div>
                {/* 정렬 */}
                <div className="flex items-center justify-end mb-3">
                  <button
                    onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all duration-200"
                    style={{
                      background: 'rgba(200,164,90,0.08)',
                      border: '1px solid var(--border)',
                      color: '#999',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {sortOrder === 'newest' ? (
                        <><path d="M12 5v14"/><path d="M5 12l7 7 7-7"/></>
                      ) : (
                        <><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></>
                      )}
                    </svg>
                    {sortOrder === 'newest' ? '최신순' : '오래된순'}
                  </button>
                </div>

                {filteredEgos.length === 0 ? (
                  <div className="card p-8 text-center" style={{ color: '#555566' }}>
                    <p className="font-serif text-lg italic">
                      {hasActiveFilters ? '검색 결과가 없습니다.' : '등록된 EGO가 없습니다.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
                    {filteredEgos.map(ego => {
                      const gradeColor = GRADE_COLORS[ego.grade] ?? '#667788'
                      const sinColor = SIN_COLORS[ego.sin_affinity as SinType] ?? gradeColor

                      return (
                        <button
                          key={ego.id}
                          onClick={() => router.push(`/sinners/${sinner.id}/ego/${ego.id}`)}
                          className="group flex flex-col items-center gap-2"
                          style={{ cursor: 'pointer', transition: 'transform 200ms ease' }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)' }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                        >
                          {/* 원형 CG - 메인 포커스 */}
                          <div style={{
                            position: 'relative',
                            width: '110px', height: '110px',
                            borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                            border: `2px solid ${sinColor}`,
                            boxShadow: `0 0 18px ${sinColor}60, 0 0 36px ${sinColor}25`,
                            background: '#0d0a06',
                          }}>
                            {ego.image_url ? (
                              <Image src={ego.image_url} alt="" fill unoptimized
                                className="object-cover" style={{ objectPosition: '50% 10%' }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span style={{ fontFamily: 'monospace', color: gradeColor, fontSize: '14px' }}>{ego.grade?.[0]}</span>
                              </div>
                            )}
                          </div>

                          {/* 등급 + 이름 */}
                          <div className="flex items-center justify-center gap-1.5">
                            {ego.grade !== 'ALEPH' ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={`${STORAGE_BASE}/icons/grade/${ego.grade}.webp`} alt={ego.grade}
                                style={{ height: '13px', width: 'auto', opacity: 0.8, flexShrink: 0 }} />
                            ) : (
                              <span style={{ fontFamily: 'monospace', fontSize: '8px', color: gradeColor, letterSpacing: '0.1em', flexShrink: 0 }}>ALEPH</span>
                            )}
                            <p className="font-serif font-bold text-center leading-snug"
                              style={{ color: '#c8a450', fontSize: '13px', lineHeight: '1.35' }}>
                              {ego.name_kr || ego.name}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
