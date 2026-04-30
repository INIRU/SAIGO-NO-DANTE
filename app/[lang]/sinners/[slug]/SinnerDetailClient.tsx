'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'motion/react'
import { Link } from '@/lib/i18n/navigation'
import StaggerReveal, { staggerItem } from '@/components/ui/StaggerReveal'
import { useRouter, usePathname } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { Search, X } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import { Sinner, Identity, EGO, getSinnerProfileUrl, getSinnerLogoUrl, STORAGE_BASE, SIN_COLORS, type SinType, GRADE_COLORS, BLUR_PLACEHOLDER } from '@/lib/data/sinners'
import { getBlurDataURL } from '@/lib/utils/thumbhash'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { decodeCollectionAsync } from '@/lib/collection'
import type { CollectionData } from '@/lib/collection'
import IdentityCard from '@/components/sinners/IdentityCard'
import { useTranslations, useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { translations } from '@/lib/i18n/translations'
import { useRoutePrefetch } from '@/lib/hooks/useRoutePrefetch'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'

interface Props {
  sinner: Sinner
  identities: Identity[]
  egos: EGO[]
}

type Tab = 'identities' | 'ego'
type OwnershipFilter = 'all' | 'owned' | 'unowned'
type IdentityWithRepresentativeKeywords = Identity & {
  skill_keyword_list?: string[] | null
  keywords?: string[] | null
}

const LOCAL_STORAGE_KEY = 'limbus-collection'

function getRepresentativeKeywords(identity: IdentityWithRepresentativeKeywords) {
  return identity.skill_keyword_list && identity.skill_keyword_list.length > 0
    ? identity.skill_keyword_list
    : (identity.keywords ?? [])
}

const getEgoReleaseTime = (ego: EGO) => {
  if (!ego.release_date) return null
  const time = Date.parse(ego.release_date)
  return Number.isNaN(time) ? null : time
}

const compareEgoFallback = (a: EGO, b: EGO) => {
  const aGameId = parseInt(a.game_id ?? '', 10)
  const bGameId = parseInt(b.game_id ?? '', 10)
  if (!Number.isNaN(aGameId) && !Number.isNaN(bGameId) && aGameId !== bGameId) {
    return aGameId - bGameId
  }
  return a.id.localeCompare(b.id)
}

const compareEgosByReleaseDate = (a: EGO, b: EGO, sortOrder: 'newest' | 'oldest') => {
  const aTime = getEgoReleaseTime(a)
  const bTime = getEgoReleaseTime(b)

  if (aTime !== null && bTime !== null && aTime !== bTime) {
    return sortOrder === 'newest' ? bTime - aTime : aTime - bTime
  }
  if (aTime !== null && bTime === null) return -1
  if (aTime === null && bTime !== null) return 1
  const fallbackOrder = compareEgoFallback(a, b)
  return sortOrder === 'newest' ? -fallbackOrder : fallbackOrder
}

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
      const keywords = getRepresentativeKeywords(i)
      if (keywords.length === 0) continue
      for (const kw of keywords) {
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
        getRepresentativeKeywords(i).some(kw => kw.toLowerCase().startsWith(q))
      )
    }
    if (selectedKeywords.size > 0) {
      result = result.filter(i =>
        [...selectedKeywords].every(kw => getRepresentativeKeywords(i).includes(kw))
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
    result = [...result].sort((a, b) => compareEgosByReleaseDate(a, b, sortOrder))
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
    <div className="min-h-[100dvh] pt-[4.75rem] sm:pt-24 pb-16 relative">
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
        <div className="mb-2 sm:mb-8 flex items-center gap-2 text-xs sm:text-sm" style={{ color: '#888888' }}>
          <Link href="/sinners" className="hover:text-yellow-300 transition-colors">
            {t('sinners.title')}
          </Link>
          <span style={{ color: '#333344' }}>&rsaquo;</span>
          <span style={{ color: 'var(--gold)' }}>{getName(sinner.name_kr, sinner.name_en, sinner.name_jp)}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)] gap-3 sm:gap-8">
          {/* 좌측: 캐릭터 정보 (sticky) */}
          <motion.div
            className="lg:sticky lg:top-24 lg:self-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
          >
            <div className="p-3 sm:p-6" style={{
              background: 'linear-gradient(180deg, rgba(20,18,14,0.96) 0%, rgba(15,13,10,0.9) 100%)',
              borderTop: '0.0625rem solid rgba(200,144,10,0.22)',
              borderBottom: '0.0625rem solid rgba(200,144,10,0.12)',
              borderRadius: '0.375rem',
              boxShadow: '0 0.75rem 2rem rgba(0,0,0,0.28)',
            }}>
              <div className="flex gap-3 sm:block">
              {/* 프로필 이미지 */}
              <div
                className="relative w-16 sm:w-full rounded-md sm:rounded-lg mb-0 sm:mb-6 overflow-hidden flex-shrink-0"
                style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)' }}
              >
                {getSinnerProfileUrl(sinner.id) ? (
                  <Image
                    src={getSinnerProfileUrl(sinner.id)}
                    alt={getName(sinner.name_kr, sinner.name_en, sinner.name_jp)}
                    fill
                    sizes="(max-width: 640px) 4rem, 20rem"
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
              <div className="flex items-center gap-2 sm:gap-3 mb-1 min-w-0">
                <Image
                  src={getSinnerLogoUrl(sinner.id)}
                  alt=""
                  width={40}
                  height={40}
                 
                  className="w-6 h-6 sm:w-10 sm:h-10"
                  style={{
                    width: 'auto',
                    height: 'auto',
                    filter: 'drop-shadow(0 0 4px rgba(200,144,10,0.3))',
                    opacity: 0.9,
                  }}
                />
                <div className="flex-1 min-w-0" style={{ containerType: 'inline-size' }}>
                  <h1
                    className="font-serif text-lg sm:text-[clamp(1.5rem,22cqw,1.875rem)] font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{
                      color: 'var(--gold)',
                      fontFamily: 'var(--font-heading)',
                    }}
                  >
                    {getName(sinner.name_kr, sinner.name_en, sinner.name_jp)}
                  </h1>
                  <p className="text-[0.625rem] sm:text-sm" style={{ color: '#666688' }}>
                    {sinner.name} · #{String(sinner.order_num).padStart(2, '0')}
                  </p>
                </div>
              </div>

              {/* 설명 */}
              <p
                className="text-[0.6875rem] sm:text-sm leading-snug sm:leading-relaxed mb-1.5 sm:mb-4"
                style={{
                  color: '#9e9e9e',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
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
                className="text-[0.5625rem] sm:text-xs italic px-2 sm:px-3 py-1 sm:py-2"
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
            className="min-w-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.33, 1, 0.68, 1] }}
          >
            {/* 탭 */}
            <div
              className="flex gap-0 mb-2 sm:mb-4 overflow-hidden"
              style={{
                border: '0.0625rem solid var(--border)',
                borderRadius: '0.375rem',
              }}
            >
              {(['identities', 'ego'] as Tab[]).map(tabKey => (
                <button
                  key={tabKey}
                  onClick={() => changeTab(tabKey)}
                  className="flex-1 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-all duration-200 relative"
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
            <div className="mb-2 sm:mb-3" ref={autocompleteRef}>
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
                  className="w-full pl-9 pr-8 py-2.5 rounded text-xs transition-all"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border)',
                    color: '#ccc',
                    outline: 'none',
                    minHeight: '2.375rem',
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
                <div
                  className="mb-3 sm:mb-4 lg:mb-3 p-2 sm:p-2.5 lg:px-2.5 lg:py-1.5 rounded-md"
                  style={{
                    background: 'rgba(10,8,6,0.38)',
                    border: '1px solid rgba(200,144,10,0.12)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
                  }}
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-2">
                  {/* 등급 필터 */}
                  <div
                    className="grid grid-cols-4 rounded overflow-hidden lg:flex-none"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'rgba(0,0,0,0.22)',
                    }}
                    aria-label="rarity filter"
                  >
                    {[
                      { value: null, label: t('sinnerDetail.allFilter'), icon: null },
                      { value: '1성', label: '1성', icon: `${STORAGE_BASE}/icons/Rarity/1star.webp` },
                      { value: '2성', label: '2성', icon: `${STORAGE_BASE}/icons/Rarity/2star.webp` },
                      { value: '3성', label: '3성', icon: `${STORAGE_BASE}/icons/Rarity/3star.webp` },
                    ].map(({ value, label, icon }, index, items) => {
                      const isActive = rarityFilter === value
                      const borderColor = value === '3성' ? '#c8900a' : value === '2성' ? '#5588bb' : value === '1성' ? '#556677' : 'var(--border)'
                      return (
                        <button
                          type="button"
                          key={label}
                          onClick={() => setRarityFilter(value)}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 lg:px-2 lg:py-1 text-xs font-medium transition-all duration-200 min-h-[2.25rem] lg:min-h-[2rem] min-w-[3.25rem] lg:min-w-[3rem]"
                          style={{
                            background: isActive ? `${borderColor}20` : 'transparent',
                            borderRight: index === items.length - 1 ? '0' : '1px solid var(--border)',
                            color: isActive ? (value === null ? 'var(--gold)' : borderColor) : '#555',
                            opacity: isActive ? 1 : 0.6,
                            boxShadow: isActive ? `inset 0 -0.125rem 0 ${value === null ? 'var(--gold)' : borderColor}` : 'none',
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

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:min-w-0 lg:flex-none lg:flex-nowrap lg:gap-1.5">
                    {/* 보유 필터 드롭다운 */}
                    {ownedIds !== null && (
                      <div className="min-w-0 sm:min-w-[7rem] lg:w-[7rem] lg:min-w-[7rem] [&>div]:w-full [&>div>button]:w-full [&>div>button]:min-h-[2.25rem] lg:[&>div>button]:min-h-[2rem] [&>div>button]:justify-between lg:[&>div>button]:px-2">
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
                      </div>
                    )}

                    {/* 정렬 토글 */}
                    <button
                      type="button"
                      onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
                      className="flex min-w-0 items-center justify-center gap-1.5 px-2.5 py-1.5 lg:px-2 lg:py-1 rounded text-xs font-medium transition-all duration-200 min-h-[2.25rem] lg:min-h-[2rem] sm:min-w-[6.5rem] lg:w-[6rem] lg:min-w-[6rem] whitespace-nowrap"
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
                    type="button"
                    onClick={() => setGacksung(!gacksung)}
                    className="flex min-w-0 items-center justify-center gap-2 px-3 py-1.5 lg:px-2 lg:py-1 rounded text-xs font-medium transition-all duration-200 min-h-[2.25rem] lg:min-h-[2rem] sm:min-w-[6.5rem] lg:w-[6rem] lg:min-w-[6rem] whitespace-nowrap"
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
                </div>

                {filteredIdentities.length === 0 ? (
                  <div
                    className="text-center py-16"
                    style={{ color: '#888888' }}
                  >
                    {hasActiveFilters ? t('sinnerDetail.noResults') : t('sinnerDetail.noIdentities')}
                  </div>
                ) : (
                  <StaggerReveal key={filteredIdentities.map(i => i.id).join()} className="grid grid-cols-[repeat(3,minmax(0,1fr))] sm:grid-cols-[repeat(4,minmax(0,1fr))] md:grid-cols-[repeat(5,minmax(0,1fr))] xl:grid-cols-[repeat(6,minmax(0,1fr))] gap-x-1.5 gap-y-4 sm:gap-x-3 sm:gap-y-5" staggerDelay={0.05}>
                    {filteredIdentities.map((identity) => (
                      <motion.div
                        key={identity.id}
                        variants={staggerItem}
                        className="w-full"
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
                  <StaggerReveal key={filteredEgos.map(e => e.id).join()} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-8 sm:gap-x-4 sm:gap-y-9" staggerDelay={0.05}>
                    {filteredEgos.map((ego) => {
                      const egoName = getName(ego.name_kr, ego.name_en, ego.name_jp) || ego.name

                      return (
                        <motion.div
                          key={ego.id}
                          variants={staggerItem}
                          whileHover={{ scale: 1.035 }}
                        >
                          <EgoDisplayCard
                            ego={ego}
                            lang={lang}
                            name={egoName}
                            onClick={() => router.push(`/sinners/${sinner.id}/ego/${ego.id}`)}
                            sinnerId={sinner.id}
                          />
                        </motion.div>
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
