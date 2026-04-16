'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Link } from '@/lib/i18n/navigation'
import StaggerReveal, { staggerItem } from '@/components/ui/StaggerReveal'
import { useRouter, usePathname } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { Search, X } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import { Sinner, Identity, EGO, getSinnerProfileUrl, getSinnerLogoUrl, STORAGE_BASE, SIN_COLORS, SinType, GRADE_COLORS, BLUR_PLACEHOLDER } from '@/lib/data/sinners'
import { getBlurDataURL } from '@/lib/utils/thumbhash'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { decodeCollectionAsync } from '@/lib/collection'
import type { CollectionData } from '@/lib/collection'
import IdentityCard from '@/components/sinners/IdentityCard'
import { useTranslations, useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { translations } from '@/lib/i18n/translations'
import { useRoutePrefetch } from '@/lib/hooks/useRoutePrefetch'

interface Props {
  sinner: Sinner
  identities: Identity[]
  egos: EGO[]
}

type Tab = 'identities' | 'ego'
type OwnershipFilter = 'all' | 'owned' | 'unowned'

const LOCAL_STORAGE_KEY = 'limbus-collection'

export default function SinnerDetailClient({ sinner, identities, egos }: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const lang = locale as SupportedLang
  useRoutePrefetch([`/${lang}/sinners/identities`, `/${lang}/sinners/ego`])
  const { sinMap: kwSinMap, iconMap: kwIconMap } = useKeywordData()

  const getName = (kr?: string | null, en?: string | null, jp?: string | null) => {
    if (lang === 'en') return en ?? kr ?? ''
    if (lang === 'ja') return jp ?? kr ?? ''
    return kr ?? ''
  }

  const literarySource = (() => {
    const key = `sinner.source.${sinner.id}` as keyof typeof translations
    const entry = translations[key]
    if (!entry) return sinner.literary_source
    return entry[lang] ?? entry['ko'] ?? sinner.literary_source
  })()
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = useState<Tab>('identities')
  const [gacksung, setGacksung] = useState(false)
  const [rarityFilter, setRarityFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set())
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('all')
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 보유 데이터 로드 (localStorage → 없으면 DB에서 동기화)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/collection')
        if (!res.ok) return
        const data: CollectionData = await res.json()
        if (!data.sinners?.length) return

        let code = localStorage.getItem(LOCAL_STORAGE_KEY)
        if (!code) {
          try {
            const profileRes = await fetch('/api/profile')
            if (profileRes.ok) {
              const profile = await profileRes.json()
              code = profile?.profile?.collection_code ?? null
              if (code) localStorage.setItem(LOCAL_STORAGE_KEY, code)
            }
          } catch { /* 비로그인 */ }
        }
        if (code) {
          const decoded = await decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
          setOwnedIds(decoded)
        } else {
          setOwnedIds(new Set())
        }
      } catch { /* 실패 시 필터 비활성 */ }
    })()
  }, [])


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
    setOwnershipFilter('all')
  }

  const hasActiveFilters = searchQuery || selectedKeywords.size > 0 || rarityFilter || ownershipFilter !== 'all'

  // 인격 필터링: 등급 → 검색어 → 키워드 → 보유
  const filteredIdentities = useMemo(() => {
    let result = identities
    if (rarityFilter) result = result.filter(i => `${i.rarity}성` === rarityFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(i =>
        i.name_kr.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        (i.affiliation && i.affiliation.toLowerCase().includes(q)) ||
        (i.keywords && i.keywords.some(kw => kw.toLowerCase().startsWith(q)))
      )
    }
    if (selectedKeywords.size > 0) {
      result = result.filter(i =>
        i.keywords && [...selectedKeywords].every(kw => i.keywords.includes(kw))
      )
    }
    if (ownershipFilter !== 'all' && ownedIds) {
      result = result.filter(i =>
        ownershipFilter === 'owned' ? ownedIds.has(i.id) : !ownedIds.has(i.id)
      )
    }
    result = [...result].sort((a, b) => {
      const aId = parseInt(a.game_id ?? '0')
      const bId = parseInt(b.game_id ?? '0')
      return sortOrder === 'newest' ? bId - aId : aId - bId
    })
    return result
  }, [identities, rarityFilter, searchQuery, selectedKeywords, sortOrder, ownershipFilter, ownedIds])

  // EGO 필터링: 검색어 → 키워드 → 보유
  const filteredEgos = useMemo(() => {
    let result = egos
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(e =>
        (e.name_kr && e.name_kr.toLowerCase().includes(q)) ||
        e.name.toLowerCase().includes(q) ||
        (e.keywords && e.keywords.some(kw => kw.toLowerCase().startsWith(q)))
      )
    }
    if (selectedKeywords.size > 0) {
      result = result.filter(e =>
        e.keywords && [...selectedKeywords].every(kw => e.keywords!.includes(kw))
      )
    }
    if (ownershipFilter !== 'all' && ownedIds) {
      result = result.filter(e =>
        ownershipFilter === 'owned' ? ownedIds.has(e.id) : !ownedIds.has(e.id)
      )
    }
    result = [...result].sort((a, b) => {
      const aId = parseInt(a.game_id ?? '0')
      const bId = parseInt(b.game_id ?? '0')
      return sortOrder === 'newest' ? bId - aId : aId - bId
    })
    return result
  }, [egos, searchQuery, selectedKeywords, sortOrder, ownershipFilter, ownedIds])


  // 자동완성 드롭다운
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [acIndex, setAcIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)
  const autocompleteResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return { keywords: [] as { kw: string; count: number }[], identities: [] as Identity[], egos: [] as EGO[] }

    const currentStats = tab === 'ego' ? egoKeywordStats : keywordStats
    const matchedKw = currentStats
      .filter(({ kw }) => kw.toLowerCase().startsWith(q))
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
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 relative">
      {/* 배경 글로우 */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{
          position: 'absolute',
          top: '5%',
          right: '10%',
          width: '35rem',
          height: '35rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,144,10,0.03) 0%, transparent 60%)',
        }} />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative" style={{ zIndex: 1 }}>
        {/* 브레드크럼 */}
        <div className="mb-4 sm:mb-8 flex items-center gap-2 text-sm" style={{ color: '#888888' }}>
          <Link href="/sinners" className="hover:text-yellow-300 transition-colors">
            {t('sinners.title')}
          </Link>
          <span style={{ color: '#333344' }}>&rsaquo;</span>
          <span style={{ color: 'var(--gold)' }}>{getName(sinner.name_kr, sinner.name_en, sinner.name_jp)}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* 좌측: 캐릭터 정보 (sticky) */}
          <motion.div
            className="lg:sticky lg:top-24 lg:self-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
          >
            <div className="card p-4 sm:p-6" style={{
              background: 'linear-gradient(180deg, #14120e 0%, #0f0d0a 100%)',
              border: '0.0625rem solid rgba(200,144,10,0.12)',
              borderRadius: '0.5rem',
              boxShadow: '0 1rem 3rem rgba(0,0,0,0.4)',
            }}>
              <div className="flex gap-4 sm:block">
              {/* 프로필 이미지 */}
              <div
                className="relative w-24 sm:w-full rounded-lg mb-0 sm:mb-6 overflow-hidden flex-shrink-0"
                style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)' }}
              >
                {getSinnerProfileUrl(sinner.id) ? (
                  <Image
                    src={getSinnerProfileUrl(sinner.id)}
                    alt={getName(sinner.name_kr, sinner.name_en, sinner.name_jp)}
                    fill
                    sizes="(max-width: 640px) 6rem, 20rem"
                    quality={90}
                    placeholder="blur"
                    blurDataURL={getBlurDataURL(getSinnerProfileUrl(sinner.id)) ?? BLUR_PLACEHOLDER}
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

              <div className="flex-1 min-w-0">
              {/* 이름 + 로고 */}
              <div className="flex items-center gap-2 sm:gap-3 mb-1">
                <Image
                  src={getSinnerLogoUrl(sinner.id)}
                  alt=""
                  width={40}
                  height={40}
                 
                  className="w-7 h-7 sm:w-10 sm:h-10"
                  style={{
                    width: 'auto',
                    height: 'auto',
                    filter: 'drop-shadow(0 0 4px rgba(200,144,10,0.3))',
                    opacity: 0.9,
                  }}
                />
                <div>
                  <h1
                    className="font-serif text-xl sm:text-3xl font-bold"
                    style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)' }}
                  >
                    {getName(sinner.name_kr, sinner.name_en, sinner.name_jp)}
                  </h1>
                  <p className="text-xs sm:text-sm" style={{ color: '#666688' }}>
                    {sinner.name} · #{String(sinner.order_num).padStart(2, '0')}
                  </p>
                </div>
              </div>

              {/* 설명 */}
              <p
                className="text-xs sm:text-sm leading-relaxed mb-2 sm:mb-4"
                style={{ color: '#9e9e9e' }}
              >
                {(() => {
                  const descKey = `sinnerDetail.desc.${sinner.id}` as keyof typeof translations
                  const entry = translations[descKey]
                  if (!entry) return sinner.description
                  return entry[lang] ?? entry['ko'] ?? sinner.description
                })()}
              </p>

              {/* 문학 출처 */}
              <div
                className="text-[0.625rem] sm:text-xs italic px-2 sm:px-3 py-1.5 sm:py-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(200,144,10,0.08) 0%, rgba(200,144,10,0.03) 100%)',
                  borderLeft: '0.125rem solid var(--gold)',
                  borderRadius: '0 0.25rem 0.25rem 0',
                  color: 'rgba(200,164,90,0.7)',
                }}
              >
                {literarySource}
              </div>
              </div>
              </div>
            </div>
          </motion.div>

          {/* 우측: 탭 콘텐츠 */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.33, 1, 0.68, 1] }}
          >
            {/* 탭 */}
            <div
              className="flex gap-0 mb-4 overflow-hidden"
              style={{
                border: '0.0625rem solid var(--border)',
                borderRadius: '0.375rem',
              }}
            >
              {(['identities', 'ego'] as Tab[]).map(tabKey => (
                <button
                  key={tabKey}
                  onClick={() => changeTab(tabKey)}
                  className="flex-1 py-3 text-sm font-medium transition-all duration-200 relative"
                  style={{
                    background: tab === tabKey
                      ? 'linear-gradient(180deg, rgba(200,144,10,0.2) 0%, rgba(200,144,10,0.08) 100%)'
                      : 'transparent',
                    color: tab === tabKey ? 'var(--gold-light)' : '#555566',
                    borderBottom: tab === tabKey ? '0.125rem solid var(--gold)' : '0.125rem solid transparent',
                    letterSpacing: '0.1em',
                  }}
                >
                  {tabKey === 'identities' ? t('sinners.identities') : 'EGO'}
                  {tab === tabKey && (
                    <span style={{
                      marginLeft: '0.375rem',
                      fontSize: '0.625rem',
                      color: 'var(--gold-dim)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {tabKey === 'identities' ? filteredIdentities.length : filteredEgos.length}
                    </span>
                  )}
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
                  placeholder={tab === 'identities' ? t('sinnerDetail.searchIdentity') : t('sinnerDetail.searchEgo')}
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
                    title={t('sinnerDetail.resetFilter')}
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
                        maxHeight: '17.5rem',
                        overflowY: 'auto',
                      }}
                    >
                      {/* 키워드 매칭 */}
                      {autocompleteResults.keywords.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', color: '#555', fontSize: '0.625rem', fontWeight: 600 }}>
                            {t('sinnerDetail.keyword')} <span style={{ color: '#444', fontWeight: 400 }}>{t('sinnerDetail.tabSelect')}</span>
                          </div>
                          {autocompleteResults.keywords.map(({ kw, count }, i) => {
                            const idx = kwStart + i
                            const isFocused = acIndex === idx
                            const sinType = kwSinMap[kw] as SinType | undefined
                            const chipColor = sinType ? SIN_COLORS[sinType] : '#888'
                            const iconSlug = kwIconMap[kw]
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
                                  <Image
                                    src={`${STORAGE_BASE}/icons/keywords/${iconSlug}.webp`}
                                    alt="" width={14} height={14} unoptimized
                                    style={{ width: '0.875rem', height: '0.875rem' }}
                                  />
                                )}
                                <span>{kw}</span>
                                <span style={{ color: '#444', fontSize: '0.625rem', marginLeft: 'auto' }}>{count}{t('sinnerDetail.count')}</span>
                                {isSelected && <span style={{ color: chipColor, fontSize: '0.625rem' }}>ON</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* 인격 매칭 */}
                      {autocompleteResults.identities.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', color: '#555', fontSize: '0.625rem', fontWeight: 600 }}>
                            {t('sinnerDetail.identity')}
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
                                  style={{ background: ident.rarity === 3 ? '#c8900a' : ident.rarity === 2 ? '#5588bb' : '#556677' }}
                                />
                                <span>{getName(ident.name_kr, ident.name_en, ident.name_jp)}</span>
                                <span style={{ color: '#444', fontSize: '0.625rem', marginLeft: 'auto' }}>{ident.rarity}성</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* EGO 매칭 */}
                      {autocompleteResults.egos.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', color: '#555', fontSize: '0.625rem', fontWeight: 600 }}>
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
                                <span>{getName(ego.name_kr, ego.name_en, ego.name_jp) || ego.name}</span>
                                <span style={{ color: gradeColor, fontSize: '0.625rem', marginLeft: 'auto' }}>{ego.grade}</span>
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
                <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* 등급 필터 */}
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {[
                      { value: null, label: t('sinnerDetail.allFilter'), icon: null },
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
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all duration-200 min-h-[2.75rem] sm:min-h-0"
                          style={{
                            background: isActive ? `${borderColor}20` : 'transparent',
                            border: `1px solid ${isActive ? borderColor : 'var(--border)'}`,
                            color: isActive ? (value === null ? 'var(--gold)' : borderColor) : '#555',
                            opacity: isActive ? 1 : 0.6,
                          }}
                        >
                          {icon ? (
                            <Image
                              src={icon}
                              alt={label}
                              width={28}
                              height={14}
                              unoptimized
                              style={{
                                height: '0.875rem',
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
                    {/* 보유 필터 드롭다운 */}
                    {ownedIds !== null && (
                      <Dropdown
                        value={ownershipFilter}
                        defaultValue="all"
                        options={[
                          { value: 'all', label: t('sinnerDetail.viewAll') },
                          { value: 'owned', label: t('sinnerDetail.ownedIdentity') },
                          { value: 'unowned', label: t('sinnerDetail.unownedIdentity') },
                        ]}
                        onChange={v => setOwnershipFilter(v as OwnershipFilter)}
                        minWidth={110}
                      />
                    )}

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
                      {sortOrder === 'newest' ? t('sinnerDetail.newest') : t('sinnerDetail.oldest')}
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
                    {gacksung ? t('sinnerDetail.uptie3') : t('sinnerDetail.normal')}
                  </button>
                  </div>
                </div>

                {filteredIdentities.length === 0 ? (
                  <div
                    className="text-center py-16"
                    style={{ color: '#888888' }}
                  >
                    {hasActiveFilters ? t('sinnerDetail.noResults') : t('sinnerDetail.noIdentities')}
                  </div>
                ) : (
                  <StaggerReveal key={filteredIdentities.map(i => i.id).join()} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8" staggerDelay={0.05}>
                    {filteredIdentities.map((identity) => (
                      <motion.div
                        key={identity.id}
                        variants={staggerItem}
                      >
                        <IdentityCard
                          identity={identity}
                          gacksung={gacksung}
                          compact
                          onClick={() =>
                            router.push(`/sinners/${sinner.id}/identities/${identity.id}`)
                          }
                        />
                      </motion.div>
                    ))}
                  </StaggerReveal>
                )}
              </div>
            )}

            {/* EGO 탭 */}
            {tab === 'ego' && (
              <div>
                {/* 정렬 + 보유 필터 */}
                <div className="flex items-center justify-end gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
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
                    {sortOrder === 'newest' ? t('sinnerDetail.newest') : t('sinnerDetail.oldest')}
                  </button>

                  {/* 보유 필터 드롭다운 */}
                  {ownedIds !== null && (
                    <Dropdown
                      value={ownershipFilter}
                      defaultValue="all"
                      options={[
                        { value: 'all', label: t('sinnerDetail.viewAll') },
                        { value: 'owned', label: t('sinnerDetail.ownedEgo') },
                        { value: 'unowned', label: t('sinnerDetail.unownedEgo') },
                      ]}
                      onChange={v => setOwnershipFilter(v as OwnershipFilter)}
                      minWidth={110}
                    />
                  )}
                </div>

                {filteredEgos.length === 0 ? (
                  <div className="card p-8 text-center" style={{ color: '#888888' }}>
                    <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem' }}>
                      {hasActiveFilters ? t('sinnerDetail.noResults') : t('sinnerDetail.noEgo')}
                    </p>
                  </div>
                ) : (
                  <StaggerReveal key={filteredEgos.map(e => e.id).join()} className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6" staggerDelay={0.05}>
                    {filteredEgos.map((ego) => {
                      const gradeColor = GRADE_COLORS[ego.grade] ?? '#667788'
                      const sinColor = SIN_COLORS[ego.sin_affinity as SinType] ?? gradeColor

                      return (
                        <motion.button
                          key={ego.id}
                          onClick={() => router.push(`/sinners/${sinner.id}/ego/${ego.id}`)}
                          className="group flex flex-col items-center gap-2"
                          variants={staggerItem}
                          whileHover={{ scale: 1.05 }}
                          style={{ cursor: 'pointer' }}
                        >
                          {/* 원형 CG - 메인 포커스 */}
                          <div style={{
                            position: 'relative',
                            width: '6.875rem', height: '6.875rem',
                            borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                            border: `2px solid ${sinColor}`,
                            boxShadow: `0 0 18px ${sinColor}60, 0 0 36px ${sinColor}25`,
                            background: '#0d0a06',
                          }}>
                            {ego.image_url ? (
                              <Image src={ego.image_url} alt="" fill
                                className="object-cover" style={{ objectPosition: '50% 10%' }} sizes="80px" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span style={{ fontFamily: 'monospace', color: gradeColor, fontSize: '0.875rem' }}>{ego.grade?.[0]}</span>
                              </div>
                            )}
                          </div>

                          {/* 등급 + 이름 */}
                          <div className="flex items-center justify-center gap-1.5">
                            {ego.grade !== 'ALEPH' ? (
                              <Image src={`${STORAGE_BASE}/icons/grade/${ego.grade}.webp`} alt={ego.grade}
                                width={33} height={13} unoptimized
                                style={{ height: '0.8125rem', width: 'auto', opacity: 0.8, flexShrink: 0 }} />
                            ) : (
                              <span style={{ fontFamily: 'monospace', fontSize: '0.5rem', color: gradeColor, letterSpacing: '0.1em', flexShrink: 0 }}>ALEPH</span>
                            )}
                            <p className="font-serif font-light text-center leading-snug"
                              style={{ color: '#c8a450', fontSize: '0.8125rem', lineHeight: '1.35' }}>
                              {getName(ego.name_kr, ego.name_en, ego.name_jp)}
                            </p>
                          </div>
                        </motion.button>
                      )
                    })}
                  </StaggerReveal>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
