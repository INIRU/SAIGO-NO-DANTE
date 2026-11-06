'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { Link } from '@/lib/i18n/navigation'
import StaggerReveal, { staggerItem } from '@/components/ui/StaggerReveal'
import { useRouter, usePathname } from '@/lib/i18n/navigation'
import Image from 'next/image'
import KeywordIcon from '@/components/ui/KeywordIcon'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
import { Search, X, ArrowLeft, ArrowDown, ArrowUp } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'

const DROPDOWN_BUTTON_STYLE = { minHeight: '2.5rem', background: '#120e09', borderColor: '#2e2417', fontFamily: 'var(--font-body)', fontSize: '0.8125rem' }
import { Sinner, Identity, EGO, getSinnerProfileUrl, getSinnerLogoUrl, STORAGE_BASE, SIN_COLORS, type SinType, GRADE_COLORS, BLUR_PLACEHOLDER } from '@/lib/data/sinners'
import { getBlurDataURL } from '@/lib/utils/thumbhash'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { decodeCollectionAsync } from '@/lib/collection'
import type { CollectionData } from '@/lib/collection'
import IdentityCard from '@/components/sinners/IdentityCard'
import { useTranslations, useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { translations } from '@/lib/i18n/translations'
import { getLocalizedAffiliations } from '@/lib/i18n/localize'
import { useRoutePrefetch } from '@/lib/hooks/useRoutePrefetch'
import styles from '@/styles/components/SinnerDetail.module.css'
import SinnerHero from '@/components/sinners/SinnerHero'
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
  const shouldReduceMotion = useReducedMotion()
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
      result = result.filter(i => {
        const rawAffiliations = [
          i.affiliation,
          ...(i.association_list ?? []),
        ].filter((affiliation): affiliation is string => Boolean(affiliation))
        const affiliationTerms = [
          ...rawAffiliations,
          ...getLocalizedAffiliations(rawAffiliations, lang),
        ]

        return i.name_kr.toLowerCase().includes(q) ||
          affiliationTerms.some(affiliation => affiliation.toLowerCase().includes(q)) ||
          getRepresentativeKeywords(i).some(kw => kw.toLowerCase().startsWith(q))
      })
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
      .filter(i => i.name_kr.toLowerCase().includes(q))
      .sort((a, b) => {
        const aS = a.name_kr.toLowerCase().startsWith(q) ? 0 : 1
        const bS = b.name_kr.toLowerCase().startsWith(q) ? 0 : 1
        if (aS !== bS) return aS - bS
        return a.name_kr.length - b.name_kr.length
      })
      .slice(0, 5)
    const matchedEgo = egos
      .filter(e => e.name_kr.toLowerCase().includes(q))
      .sort((a, b) => {
        const aName = a.name_kr
        const bName = b.name_kr
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
    <div className={`${styles.page} min-h-[100dvh] pb-16 relative`}>
      <SinnerHero
        sinner={sinner}
        name={getName(sinner.name_kr, sinner.name_en, sinner.name_jp)}
        description={(() => {
          const entry = translations[`sinnerDetail.desc.${sinner.id}` as keyof typeof translations]
          return entry ? entry[lang] ?? entry['ko'] ?? sinner.description : sinner.description
        })()}
        source={literarySource}
      />
      {/* the tabs and cards rise from below under the hero */}
      <div className={`${styles.content} max-w-[90rem] mx-auto mt-6 px-5 sm:mt-8 sm:px-8 relative`} style={{ zIndex: 1 }}>
          {/* 우측: 탭 콘텐츠 */}
          <m.div
            className="min-w-0"
            initial={shouldReduceMotion ? false : { y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.32, delay: shouldReduceMotion ? 0 : 0.04, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* 탭 */}
            <div className={styles.tabs} role="tablist">
              {(['identities', 'ego'] as Tab[]).map(tabKey => (
                <button
                  key={tabKey}
                  type="button"
                  role="tab"
                  aria-selected={tab === tabKey}
                  onClick={() => changeTab(tabKey)}
                >
                  {tabKey === 'identities' ? t('sinners.identities') : 'E.G.O'}
                  <span className={styles.tabCount}>
                    {tabKey === 'identities' ? filteredIdentities.length : filteredEgos.length}
                  </span>
                </button>
              ))}
            </div>

            {/* 검색 바 + 자동완성 (공통) */}
            <div className={styles.searchWrap} ref={autocompleteRef}>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                  aria-hidden
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setShowAutocomplete(true) }}
                  placeholder={tab === 'identities' ? t('sinnerDetail.searchIdentity') : t('sinnerDetail.searchEgo')}
                  aria-label={tab === 'identities' ? t('sinnerDetail.searchIdentity') : t('sinnerDetail.searchEgo')}
                  className={styles.search}
                  onFocus={() => { if (searchQuery.trim()) setShowAutocomplete(true) }}
                  onKeyDown={handleSearchKeyDown}
                />
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="absolute right-1 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded hover:text-[var(--text-primary)]"
                    style={{ color: 'var(--text-muted)' }}
                    title={t('sinnerDetail.resetFilter')}
                    aria-label={t('sinnerDetail.resetFilter')}
                  >
                    <X size={16} />
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
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                        maxHeight: '17.5rem',
                        overflowY: 'auto',
                      }}
                    >
                      {/* 키워드 매칭 */}
                      {autocompleteResults.keywords.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', fontSize: '0.625rem', fontWeight: 600 }}>
                            {t('sinnerDetail.keyword')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('sinnerDetail.tabSelect')}</span>
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
                                  <KeywordIcon
                                    src={getKeywordIconUrl(kw, iconSlug)!}
                                    alt="" width={14} height={14} unoptimized
                                    style={{ width: '0.875rem', height: '0.875rem' }}
                                  />
                                )}
                                <span>{kw}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem', marginLeft: 'auto' }}>{count}{t('sinnerDetail.count')}</span>
                                {isSelected && <span style={{ color: chipColor, fontSize: '0.625rem' }}>ON</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* 인격 매칭 */}
                      {autocompleteResults.identities.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', fontSize: '0.625rem', fontWeight: 600 }}>
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
                                  color: isFocused ? 'var(--gold-light)' : '#ccc',
                                  borderLeft: isFocused ? '2px solid var(--gold)' : '2px solid transparent',
                                }}
                              >
                                <span
                                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: ident.rarity === 3 ? 'var(--gold)' : ident.rarity === 2 ? '#5588bb' : '#556677' }}
                                />
                                <span>{getName(ident.name_kr, ident.name_en, ident.name_jp)}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem', marginLeft: 'auto' }}>{t('browser.rarityStar', { n: ident.rarity })}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* EGO 매칭 */}
                      {autocompleteResults.egos.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', fontSize: '0.625rem', fontWeight: 600 }}>
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
                                  color: isFocused ? 'var(--gold-light)' : '#ccc',
                                  borderLeft: isFocused ? '2px solid var(--gold)' : '2px solid transparent',
                                }}
                              >
                                <span
                                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: gradeColor }}
                                />
                                <span>{getName(ego.name_kr, ego.name_en, ego.name_jp)}</span>
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
            <AnimatePresence mode="wait" initial={false}>
            {tab === 'identities' && (
              <m.div
                key="identities"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.33, 1, 0.68, 1] }}
              >
                {/* 필터 바 */}
                <div className={styles.filters}>
                  {/* 등급 필터 */}
                  <div className={styles.segment} role="group" aria-label={t('sinnerDetail.rarityFilter')}>
                    {[
                      { value: null, label: t('sinnerDetail.allFilter'), icon: null },
                      { value: '1성', label: '1성', icon: `${STORAGE_BASE}/icons/Rarity/1star.webp` },
                      { value: '2성', label: '2성', icon: `${STORAGE_BASE}/icons/Rarity/2star.webp` },
                      { value: '3성', label: '3성', icon: `${STORAGE_BASE}/icons/Rarity/3star.webp` },
                    ].map(({ value, label, icon }, index) => (
                      <button
                        type="button"
                        key={label}
                        onClick={() => setRarityFilter(value)}
                        aria-pressed={rarityFilter === value}
                      >
                        {icon ? (
                          <Image src={icon} alt={(t.raw('identity.rarity') as string[])[index] ?? label} width={index * 24} height={24} unoptimized />
                        ) : (
                          label
                        )}
                      </button>
                    ))}
                  </div>

                  <div className={styles.controls}>
                    {/* 보유 필터 드롭다운: 보유 정보가 늦게 와도 줄이 밀리지 않게 처음부터 둔다(고른 값은 도착하면 적용) */}
                    {(
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
                        buttonStyle={DROPDOWN_BUTTON_STYLE}
                      />
                    )}

                    {/* 정렬 토글 */}
                    <button type="button" className={styles.control} onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}>
                      {sortOrder === 'newest' ? <ArrowDown size={14} aria-hidden /> : <ArrowUp size={14} aria-hidden />}
                      {sortOrder === 'newest' ? t('sinnerDetail.newest') : t('sinnerDetail.oldest')}
                    </button>

                  {/* 일반/각성 토글 */}
                    <div className={styles.segment} role="group" aria-label={t('sinnerDetail.artFilter')}>
                      <button type="button" aria-pressed={!gacksung} onClick={() => setGacksung(false)}>{t('sinnerDetail.normal')}</button>
                      <button type="button" aria-pressed={gacksung} onClick={() => setGacksung(true)}>{t('sinnerDetail.uptie3')}</button>
                    </div>
                  </div>
                </div>

                {filteredIdentities.length === 0 ? (
                  <div
                    className="text-center py-16"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {hasActiveFilters ? t('sinnerDetail.noResults') : t('sinnerDetail.noIdentities')}
                  </div>
                ) : (
                  <StaggerReveal className={styles.identityGrid} staggerDelay={0.03}>
                    {filteredIdentities.map((identity) => (
                      <m.div
                        key={identity.id}
                        variants={staggerItem}
                        className="w-full"
                      >
                        {/* A real link (crawlers and new-tab clicks follow it); the card keeps its own hover and size. */}
                        <Link
                          href={`/sinners/${sinner.id}/identities/${identity.id}`}
                          aria-label={getName(identity.name_kr, identity.name_en, identity.name_jp)}
                        >
                          <IdentityCard identity={identity} gacksung={gacksung} compact />
                        </Link>
                      </m.div>
                    ))}
                  </StaggerReveal>
                )}
              </m.div>
            )}

            {/* EGO 탭 */}
            {tab === 'ego' && (
              <m.div
                key="ego"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.33, 1, 0.68, 1] }}
              >
                {/* 정렬 + 보유 필터 */}
                <div className={styles.filters}>
                  <div className={styles.controls}>
                  <button type="button" className={styles.control} onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}>
                    {sortOrder === 'newest' ? <ArrowDown size={14} aria-hidden /> : <ArrowUp size={14} aria-hidden />}
                    {sortOrder === 'newest' ? t('sinnerDetail.newest') : t('sinnerDetail.oldest')}
                  </button>

                  {/* 보유 필터 드롭다운 */}
                  {(
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
                        buttonStyle={DROPDOWN_BUTTON_STYLE}
                    />
                  )}
                  </div>
                </div>

                {filteredEgos.length === 0 ? (
                  <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                    {hasActiveFilters ? t('sinnerDetail.noResults') : t('sinnerDetail.noEgo')}
                  </div>
                ) : (
                  <StaggerReveal className={styles.egoGrid} staggerDelay={0.03}>
                    {filteredEgos.map((ego) => {
                      const egoName = getName(ego.name_kr, ego.name_en, ego.name_jp)

                      return (
                        <m.div
                          key={ego.id}
                          variants={staggerItem}
                          whileHover={shouldReduceMotion ? undefined : { scale: 1.035 }}
                        >
                          <EgoDisplayCard
                            ego={ego}
                            lang={lang}
                            name={egoName}
                            href={`/sinners/${sinner.id}/ego/${ego.id}`}
                            // A link is as wide as its cell where the button it replaced was as wide as the card.
                            className="w-fit"
                            sinnerId={sinner.id}
                          />
                        </m.div>
                      )
                    })}
                  </StaggerReveal>
                )}
              </m.div>
            )}
            </AnimatePresence>
          </m.div>
      </div>
    </div>
  )
}
