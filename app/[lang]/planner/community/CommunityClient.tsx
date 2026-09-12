'use client'

import BoardSkeleton from '@/components/discovery/BoardSkeleton'
import DiscoveryShelf from '@/components/discovery/DiscoveryShelf'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { ChevronDown, ChevronRight, Link2, PackageOpen, Search, SlidersHorizontal, User, X } from 'lucide-react'
import PlanCard, { type PlanSummary } from '@/components/planner/PlanCard'
import { DIFFICULTY_CONFIG, type Difficulty } from '@/lib/planner/types'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import DeckIdentityFilterModal, { type DeckFilterIdentity, type DeckFilterSinner } from '@/components/decks/DeckIdentityFilterModal'
import { decodeCollectionAsync, type CollectionData } from '@/lib/collection'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { parseSearchQuery, getActiveTerm, termMatchesAny } from '@/lib/utils/search'
import { THEME_KEYWORDS } from '@/lib/constants/keywords'
import { normalizePlannerListKeywords } from '@/lib/planner/stripPlanForList'
import { useLocale, useTranslations } from 'next-intl'
import {
  DECK_LANGUAGE_FILTERS,
  localizeDeckKeyword,
  normalizeDeckLanguageFilter,
  resolveDeckLanguageParam,
  type DeckLanguageFilter,
} from '@/components/decks/decks-types'
import { getIdentityPortraitUrl, getIdentityInfoUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import type { SupportedLang } from '@/lib/i18n'

type SortKey = 'latest' | 'popular'
type SearchSuggestion = { label: string; type: 'identity' | 'keyword'; imageUrl?: string }
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
type PlanFilterIndex = {
  plan: PlanSummary
  searchableFields: string[]
  filterKeywordSet: Set<string>
  identityIds: string[]
  egoIds: string[]
}
const PAGE_SIZE = 20
const QUERY_OPTIONS = { history: 'replace', shallow: true, scroll: false } as const
const COMBAT_KEYWORDS = ['참격', '관통', '타격'] as const
const IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS = 'id, sinner_id, name, name_kr, name_en, name_jp, rarity, keywords, skill_keyword_list, folder_name, game_id, hp, speed_min, speed_max, def_level, sinner:sinners(id, name_kr, order_num)'
const IDENTITY_FILTER_SELECT_LEGACY = 'id, sinner_id, name, name_kr, name_en, name_jp, rarity, keywords, folder_name, game_id, hp, speed_min, speed_max, def_level, sinner:sinners(id, name_kr, order_num)'

const DIFFICULTY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  normal:  { bg: 'rgba(74,152,104,0.12)',  color: '#4a9868', border: 'rgba(74,152,104,0.3)' },
  hard:    { bg: 'rgba(200,144,10,0.12)',  color: '#e8b030', border: 'rgba(200,144,10,0.3)' },
  overlap: { bg: 'rgba(72,152,176,0.12)',  color: '#48b0c0', border: 'rgba(72,152,176,0.3)' },
  extreme: { bg: 'rgba(200,48,48,0.12)',   color: '#e05050', border: 'rgba(200,48,48,0.3)' },
}


function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2"
      style={{
        color: 'var(--deck-filter-text-dim)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--deck-filter-label-text)',
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  )
}

function SectionToggle({
  label,
  open,
  active,
  count,
  onClick,
}: {
  label: string
  open: boolean
  active: boolean
  count?: number
  onClick: () => void
}) {
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 text-left transition-colors hover:bg-white/[0.025]"
      style={{
        minHeight: 'var(--deck-filter-control-min)',
        color: active ? 'var(--gold)' : '#666',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--deck-filter-label-text)',
      }}
      aria-expanded={open}
    >
      <Icon size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!!count && (
        <span
          style={{
            background: 'rgba(200,144,10,0.18)',
            color: 'var(--gold)',
            minWidth: '1.375rem',
            padding: '0.0625rem 0.4375rem',
            borderRadius: '999rem',
            fontSize: 'var(--deck-filter-control-text)',
            fontWeight: 400,
            fontFamily: 'var(--font-body)',
            lineHeight: 1.2,
            textAlign: 'center',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function FilterButton({
  active,
  label,
  iconUrl,
  onClick,
}: {
  active: boolean
  label: string
  iconUrl?: string | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className="flex flex-col items-center justify-center rounded transition-all duration-200"
      style={{
        minHeight: 'var(--deck-filter-touch-min)',
        padding: '0.25rem 0.1875rem',
        cursor: 'pointer',
        border: '1px solid transparent',
        background: active ? 'var(--deck-filter-surface-active)' : 'var(--deck-filter-surface-muted)',
        opacity: active ? 1 : 0.58,
        filter: active ? 'none' : 'grayscale(0.35)',
      }}
    >
      {iconUrl && (
        <Image
          src={iconUrl}
          alt=""
          width={18}
          height={18}
          style={{ width: '1.125rem', height: '1.125rem', objectFit: 'contain' }}
        />
      )}
      <span
        className={`${iconUrl ? 'mt-1' : ''} max-w-full truncate text-center leading-tight`}
        style={{
          color: active ? 'var(--gold)' : 'var(--deck-filter-text-muted)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--deck-filter-control-text)',
          fontWeight: 600,
          width: '100%',
        }}
      >
        {label}
      </span>
    </button>
  )
}

function LanguageFilter({
  value,
  onChange,
}: {
  value: DeckLanguageFilter
  onChange: (value: DeckLanguageFilter) => void
}) {
  const t = useTranslations('planner.communityBoard')
  return (
    <section>
      <SectionLabel>{t('languageFilter.label')}</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        {DECK_LANGUAGE_FILTERS.map(option => {
          const active = value === option
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={active}
              className="rounded transition-all duration-200"
              style={{
                minHeight: 'var(--deck-filter-control-min)',
                border: '1px solid transparent',
                background: active ? 'var(--deck-filter-surface-active)' : 'var(--deck-filter-surface-muted)',
                color: active ? 'var(--gold)' : 'var(--deck-filter-text-muted)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--deck-filter-control-text)',
                fontWeight: 600,
              }}
            >
              {t(`languageFilter.${option === 'mine' ? 'current' : option}`)}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function parseCsvParam(value: string) {
  if (!value) return []
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function serializeCsvParam(values: Set<string>) {
  return [...values].join(',')
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
    skill_keyword_list: identity.skill_keyword_list ?? identity.keywords ?? [],
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

function mergePlanRows(existing: PlanSummary[], incoming: PlanSummary[]) {
  const byId = new Map<string, PlanSummary>()
  const orderedIds: string[] = []

  for (const plan of [...existing, ...incoming]) {
    if (!byId.has(plan.id)) orderedIds.push(plan.id)
    byId.set(plan.id, plan)
  }

  return orderedIds.map(id => byId.get(id)!)
}

// 플랜의 모든 인격 이름 (검색용) — API가 pre-compute한 값 우선 사용
function getPlanIdentityNames(plan: PlanSummary): string[] {
  return plan.identity_names ?? []
}

// 플랜 테마 키워드 — API가 서버사이드에서 pre-compute한 값 사용
function getPlanThemeKeywords(plan: PlanSummary): string[] {
  return plan.theme_keywords ?? []
}

function getPlanFilterKeywords(plan: PlanSummary): string[] {
  return normalizePlannerListKeywords([
    ...(plan.filter_keywords ?? getPlanThemeKeywords(plan)),
    ...(plan.selected_keywords ?? []),
  ])
}

type CommunityClientProps = {
  initialPlans?: PlanSummary[]
  initialTotal?: number
}

export default function CommunityClient({ initialPlans, initialTotal }: CommunityClientProps) {
  const locale = useLocale() as SupportedLang
  const t = useTranslations('planner.communityBoard')
  const rootT = useTranslations()
  const { status: authStatus } = useSession()
  const { iconMap: kwIconMap, getIconUrl } = useKeywordData()
  const keywords = useKeywords()
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
  const [browse, setBrowse] = useQueryState('browse', parseAsString.withDefault(''))
  const [sort, setSort] = useQueryState('sort', parseAsString.withDefault('latest'))
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const [languageQuery, setLanguageQuery] = useQueryState('lang', parseAsString.withDefault('mine'))
  const languageFilter = normalizeDeckLanguageFilter(languageQuery)
  const plannerLanguageParam = resolveDeckLanguageParam(languageFilter, locale)
  const [keywordQuery, setKeywordQuery] = useQueryState('kt', parseAsString.withDefault(''))
  const [keywordModeQuery, setKeywordModeQuery] = useQueryState('ktm', parseAsString.withDefault('or'))
  const [identityIdsQuery, setIdentityIdsQuery] = useQueryState('ids', parseAsString.withDefault(''))
  const [identityModeQuery, setIdentityModeQuery] = useQueryState('im', parseAsString.withDefault('or'))
  const activeKeywordList = useMemo(() => normalizePlannerListKeywords(parseCsvParam(keywordQuery)), [keywordQuery])
  const activeKeywords = useMemo(() => new Set(activeKeywordList), [activeKeywordList])
  const keywordMode: 'or' | 'and' = keywordModeQuery === 'and' ? 'and' : 'or'
  const selectedIdentityIdList = useMemo(() => parseCsvParam(identityIdsQuery), [identityIdsQuery])
  const selectedIdentityIds = useMemo(() => new Set(selectedIdentityIdList), [selectedIdentityIdList])
  const identityMode: 'or' | 'and' = identityModeQuery === 'and' ? 'and' : 'or'
  // inputValue: local state for immediate input display (avoids IME composition breaks)
  const [inputValue, setInputValue] = useState(search)
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const offsetRef = useRef(initialPlans?.length ?? 0)
  const scrollRootRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const initialDataKey = useRef<string | null>(initialPlans !== undefined ? (() => {
    const params = new URLSearchParams()
    params.set('sort', 'latest')
    params.set('lang', resolveDeckLanguageParam('mine', locale))
    params.sort()
    return params.toString()
  })() : null)
  const planRequestId = useRef(0)
  const loadMoreRequestId = useRef(0)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  const latestRequestKeyRef = useRef('')
  const searchRef = useRef<HTMLDivElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [acIndex, setAcIndex] = useState(-1)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const mobilePanelRef = useRef<HTMLDivElement>(null)

  // 전체 인격 목록 (자동완성용 - 이름 + 일러스트)
  const [allIdentities, setAllIdentities] = useState<IdentityNameEntry[]>([])
  const identitiesRequestRef = useRef<Promise<void> | null>(null)
  const ensureIdentities = useCallback(() => {
    if (allIdentities.length > 0) return Promise.resolve()
    if (identitiesRequestRef.current) return identitiesRequestRef.current

    identitiesRequestRef.current = (async () => {
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
        if (data) {
          setAllIdentities(data as unknown as IdentityNameEntry[])
        }
      } finally {
        identitiesRequestRef.current = null
      }
    })()

    return identitiesRequestRef.current
  }, [allIdentities.length])

  const activeInputTermLength = useMemo(() => getActiveTerm(inputValue).activeTerm.length, [inputValue])
  useEffect(() => {
    if (showSuggestions && activeInputTermLength > 0) {
      void ensureIdentities()
    }
  }, [showSuggestions, activeInputTermLength, ensureIdentities])

  useEffect(() => {
    void ensureIdentities()
  }, [ensureIdentities])

  // 인격 + 키워드 자동완성 후보
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
      const { prefix } = getActiveTerm(inputValue)
      // IME 조합 강제 종료
      e.currentTarget.blur()
      setShowSuggestions(false)
      setAcIndex(-1)
      // IME compositionend → onChange 이후 값 설정 (잔재 방지)
      setTimeout(() => {
        setInputValue(prefix + selected)
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

  // 검색 debounce: inputValue → URL(search) + debouncedSearch
  useEffect(() => {
    const t = setTimeout(() => {
      void setSearch(inputValue || null, QUERY_OPTIONS)
      setDebouncedSearch(inputValue)
    }, 300)
    return () => clearTimeout(t)
  }, [inputValue, setSearch])

  // 키워드 필터
  const [showKeywordFilter, setShowKeywordFilter] = useState(true)
  const [showIdentityFilter, setShowIdentityFilter] = useState(true)
  const [identityModalSinnerId, setIdentityModalSinnerId] = useState<string | null>(null)

  // 컬렉션 필터
  const [showCollectionFilter, setShowCollectionFilter] = useState(true)
  const [filterOwnedIdentity, setFilterOwnedIdentity] = useState(false)
  const [filterOwnedEgo, setFilterOwnedEgo] = useState(false)
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null)
  const [hasCollection, setHasCollection] = useState(false)
  const [collectionLoading, setCollectionLoading] = useState(false)
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)
  const collectionDataRef = useRef<CollectionData | null>(null)
  const collectionRequestRef = useRef<Promise<CollectionData | null> | null>(null)
  const localKeyword = useCallback((keyword: string) => localizeDeckKeyword(keyword, keywords[keyword], locale), [keywords, locale])

  const normalizedSort: SortKey = sort === 'popular' ? 'popular' : 'latest'
  const serverQueryKey = useMemo(() => {
    const params = new URLSearchParams()
    params.set('sort', normalizedSort)
    params.set('lang', plannerLanguageParam)
    if (difficulty) params.set('difficulty', difficulty)
    if (activeKeywordList.length > 0) {
      params.set('keyword_tags', activeKeywordList.join(','))
      params.set('keyword_tag_mode', keywordMode)
    }
    if (selectedIdentityIdList.length > 0) {
      params.set('identity_ids', selectedIdentityIdList.join(','))
      params.set('identity_mode', identityMode)
    }
    params.sort()
    return params.toString()
  }, [normalizedSort, plannerLanguageParam, difficulty, activeKeywordList, keywordMode, selectedIdentityIdList, identityMode])

  const buildPlannerSearchParams = useCallback((offset: number) => {
    const params = new URLSearchParams(serverQueryKey)
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(offset))
    return params
  }, [serverQueryKey])

  useEffect(() => {
    latestRequestKeyRef.current = serverQueryKey
    if (initialDataKey.current === serverQueryKey && initialPlans !== undefined) {
      initialDataKey.current = null
      setLoading(false)
      setLoadingMore(false)
      setHasMore(initialTotal === undefined ? initialPlans.length >= PAGE_SIZE : initialPlans.length < initialTotal)
      offsetRef.current = initialPlans.length
      return
    }

    loadMoreAbortRef.current?.abort()
    loadMoreRequestId.current += 1
    const requestId = planRequestId.current + 1
    planRequestId.current = requestId
    const controller = new AbortController()
    const hasExistingPlans = plans.length > 0
    setLoading(!hasExistingPlans)
    setLoadingMore(false)
    setHasMore(true)

    fetch(`/api/planner?${buildPlannerSearchParams(0).toString()}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('planner fetch failed')))
      .then(json => {
        if (planRequestId.current !== requestId || latestRequestKeyRef.current !== serverQueryKey) return
        const fetched: PlanSummary[] = json.plans ?? []
        const nextTotal = json.total ?? 0
        setTotal(nextTotal)
        setPlans(fetched)
        setHasMore(fetched.length < nextTotal)
        offsetRef.current = fetched.length
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
      })
      .finally(() => {
        if (planRequestId.current !== requestId || latestRequestKeyRef.current !== serverQueryKey) return
        setLoading(false)
      })

    return () => controller.abort()
  }, [serverQueryKey, buildPlannerSearchParams, initialPlans, initialTotal]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    loadMoreAbortRef.current?.abort()
    const requestId = loadMoreRequestId.current + 1
    loadMoreRequestId.current = requestId
    const requestQueryKey = serverQueryKey
    const controller = new AbortController()
    loadMoreAbortRef.current = controller

    fetch(`/api/planner?${buildPlannerSearchParams(offsetRef.current).toString()}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('planner fetch failed')))
      .then(json => {
        if (loadMoreRequestId.current !== requestId || latestRequestKeyRef.current !== requestQueryKey) return
        const fetched: PlanSummary[] = json.plans ?? []
        const nextTotal = json.total ?? 0
        setTotal(nextTotal)
        if (fetched.length === 0) {
          setHasMore(false)
          return
        }
        setPlans(prev => {
          const merged = mergePlanRows(prev, fetched)
          offsetRef.current = merged.length
          setHasMore(merged.length < nextTotal)
          return merged
        })
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
      })
      .finally(() => {
        if (loadMoreRequestId.current === requestId) loadMoreAbortRef.current = null
        if (loadMoreRequestId.current === requestId && latestRequestKeyRef.current === requestQueryKey) setLoadingMore(false)
      })
  }, [loading, loadingMore, hasMore, serverQueryKey, buildPlannerSearchParams])

  useEffect(() => {
    loadMoreAbortRef.current?.abort()
    loadMoreRequestId.current += 1
    setLoadingMore(false)
  }, [serverQueryKey])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) loadMore() },
      { root: scrollRootRef.current, rootMargin: '300px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, serverQueryKey])

  useEffect(() => {
    collectionDataRef.current = collectionData
  }, [collectionData])

  useEffect(() => {
    if (!mobileFiltersOpen) return
    mobilePanelRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileFiltersOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = previousOverflow
    }
  }, [mobileFiltersOpen])

  const loadCollectionData = useCallback(async () => {
    if (collectionDataRef.current) return collectionDataRef.current
    if (!collectionRequestRef.current) {
      setCollectionLoading(true)
      collectionRequestRef.current = fetch('/api/collection')
        .then(r => r.json())
        .then((d: CollectionData) => {
          if (d.sinners?.length > 0) {
            collectionDataRef.current = d
            setCollectionData(d)
            return d
          }
          return null
        })
        .catch(() => null)
        .finally(() => {
          collectionRequestRef.current = null
          setCollectionLoading(false)
        })
    }
    return collectionRequestRef.current
  }, [])

  const loadProfileCollection = useCallback(async () => {
    if (authStatus !== 'authenticated') return false
    setCollectionLoading(true)
    try {
      const data = await loadCollectionData()
      if (!data) return false
      const profileData = await fetch('/api/profile').then(r => r.json()) as { profile?: { collection_code?: string | null } }
      const code = profileData.profile?.collection_code
      if (!code) return false
      const decoded = await decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
      if (decoded.size === 0) return false
      setOwnedIds(decoded)
      setHasCollection(true)
      return true
    } catch {
      return false
    } finally {
      setCollectionLoading(false)
    }
  }, [authStatus, loadCollectionData])

  // 로그인 유저: 프로필에서 컬렉션 코드 자동 로드
  useEffect(() => {
    void loadProfileCollection()
  }, [loadProfileCollection])

  // 보유 코드 적용
  const applyCollectionCode = useCallback(async (rawInput: string) => {
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
      const data = await loadCollectionData()
      if (!data) { setCodeError(true); return }
      const decoded = await decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
      if (decoded.size === 0) { setCodeError(true); return }
      setOwnedIds(decoded)
      setHasCollection(true)
    } catch {
      setCodeError(true)
    }
  }, [loadCollectionData])

  const toggleFilterOwnedIdentity = useCallback(async () => {
    let hasOwnedIds = ownedIds !== null
    if (!hasOwnedIds) {
      hasOwnedIds = await loadProfileCollection()
    }
    if (!hasOwnedIds) return
    setFilterOwnedIdentity(prev => !prev)
  }, [loadProfileCollection, ownedIds])

  const toggleFilterOwnedEgo = useCallback(async () => {
    let hasOwnedIds = ownedIds !== null
    if (!hasOwnedIds) {
      hasOwnedIds = await loadProfileCollection()
    }
    if (!hasOwnedIds) return
    setFilterOwnedEgo(prev => !prev)
  }, [loadProfileCollection, ownedIds])

  // 키워드 토글
  const toggleKeyword = useCallback((kw: string) => {
    const next = new Set(activeKeywords)
    if (next.has(kw)) next.delete(kw)
    else next.add(kw)
    void setKeywordQuery(serializeCsvParam(next) || null, QUERY_OPTIONS)
  }, [activeKeywords, setKeywordQuery])

  const toggleKeywordMode = useCallback(() => {
    void setKeywordModeQuery(keywordMode === 'or' ? 'and' : 'or', QUERY_OPTIONS)
  }, [keywordMode, setKeywordModeQuery])

  // 항상 전투 속성 키워드를 먼저 보여주고, 전체 테마 키워드를 중복 없이 이어붙인다.
  const availableKeywords = useMemo(() => [...new Set([...COMBAT_KEYWORDS, ...THEME_KEYWORDS])], [])

  const filterIdentities = useMemo(
    () => allIdentities.map(toDeckFilterIdentity),
    [allIdentities],
  )
  const identityFilterSinners = useMemo(() => {
    const byId = new Map<string, DeckFilterSinner>()
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
  const selectedIdentitiesBySinner = useMemo(() => {
    const grouped = new Map<string, DeckFilterIdentity[]>()
    for (const identity of selectedIdentities) {
      const group = grouped.get(identity.sinner_id) ?? []
      group.push(identity)
      grouped.set(identity.sinner_id, group)
    }
    return grouped
  }, [selectedIdentities])
  const identityModalSinner = useMemo(
    () => identityFilterSinners.find(sinner => sinner.id === identityModalSinnerId) ?? null,
    [identityFilterSinners, identityModalSinnerId],
  )
  const identityModalIdentities = useMemo(
    () => filterIdentities
      .filter(identity => identity.sinner_id === identityModalSinnerId)
      .sort((a, b) => {
        if (b.rarity !== a.rarity) return b.rarity - a.rarity
        return a.name_kr.localeCompare(b.name_kr, 'ko')
      }),
    [filterIdentities, identityModalSinnerId],
  )
  const toggleSelectedIdentity = useCallback((identityId: string) => {
    const next = new Set(selectedIdentityIds)
    const target = filterIdentities.find(identity => identity.id === identityId)

    if (next.has(identityId)) {
      next.delete(identityId)
      void setIdentityIdsQuery(serializeCsvParam(next) || null, QUERY_OPTIONS)
      return
    }

    if (target) {
      for (const identity of filterIdentities) {
        if (identity.sinner_id === target.sinner_id) next.delete(identity.id)
      }
    }

    next.add(identityId)
    void setIdentityIdsQuery(serializeCsvParam(next), QUERY_OPTIONS)
  }, [filterIdentities, selectedIdentityIds, setIdentityIdsQuery])
  const handleModalToggleIdentity = useCallback((identityId: string) => {
    const wasSelected = selectedIdentityIds.has(identityId)
    toggleSelectedIdentity(identityId)
    if (!wasSelected) setIdentityModalSinnerId(null)
  }, [selectedIdentityIds, toggleSelectedIdentity])
  const toggleIdentityMode = useCallback(() => {
    void setIdentityModeQuery(identityMode === 'or' ? 'and' : 'or', QUERY_OPTIONS)
  }, [identityMode, setIdentityModeQuery])
  const localizeSinnerName = useCallback((sinner: DeckFilterSinner) => (
    rootT(`sinner.${sinner.id}` as Parameters<typeof rootT>[0])
  ), [rootT])

  const planIndexes = useMemo((): PlanFilterIndex[] => plans.map(plan => ({
    plan,
    searchableFields: [
      plan.title,
      plan.description ?? '',
      ...getPlanIdentityNames(plan),
    ],
    filterKeywordSet: new Set(getPlanFilterKeywords(plan)),
    identityIds: (plan.deck ?? [])
      .map(s => s.identity_id)
      .filter((id): id is string => Boolean(id)),
    egoIds: (plan.egos ?? [])
      .map(e => e.ego_id)
      .filter((id): id is string => Boolean(id)),
  })), [plans])

  // 클라이언트 필터
  const filtered = useMemo(() => {
    let list = planIndexes

    // 텍스트 검색: 인격 + 제목 + 설명 (+: OR, *: AND)
    if (debouncedSearch.trim()) {
      const parsed = parseSearchQuery(debouncedSearch)
      if (parsed.terms.length > 0) {
        list = list.filter(({ searchableFields }) => {
          if (parsed.mode === 'and') {
            return parsed.terms.every(term => termMatchesAny(term, searchableFields))
          } else {
            return parsed.terms.some(term => termMatchesAny(term, searchableFields))
          }
        })
      }
    }

    // 키워드 필터
    if (activeKeywordList.length > 0) {
      list = list.filter(({ filterKeywordSet }) => {
        if (keywordMode === 'and') {
          return activeKeywordList.every(kw => filterKeywordSet.has(kw))
        } else {
          return activeKeywordList.some(kw => filterKeywordSet.has(kw))
        }
      })
    }

    // 선택 인격 필터: 서버 결과에 대한 안전한 fallback
    if (selectedIdentityIdList.length > 0) {
      list = list.filter(({ identityIds }) => {
        if (identityMode === 'and') {
          return selectedIdentityIdList.every(id => identityIds.includes(id))
        }
        return selectedIdentityIdList.some(id => identityIds.includes(id))
      })
    }

    // 보유 인격 필터
    if (filterOwnedIdentity && ownedIds) {
      list = list.filter(({ identityIds }) => {
        if (identityIds.length === 0) return true
        return identityIds.every(id => ownedIds.has(id))
      })
    }

    // 보유 에고 필터
    if (filterOwnedEgo && ownedIds) {
      list = list.filter(({ egoIds }) => {
        if (egoIds.length === 0) return true
        return egoIds.every(id => ownedIds.has(id))
      })
    }

    return list.map(({ plan }) => plan)
  }, [planIndexes, debouncedSearch, activeKeywordList, keywordMode, selectedIdentityIdList, identityMode, filterOwnedIdentity, filterOwnedEgo, ownedIds])

  const renderedPlanCards = useMemo(() => filtered.map(plan => (
    <PlanCard key={plan.id} plan={plan} localized onKeywordToggle={toggleKeyword} />
  )), [filtered, toggleKeyword])

  const collectionFilterCount = (filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0)
  const languageFilterCount = languageFilter === 'mine' ? 0 : 1
  const totalActiveCount = (inputValue.trim() ? 1 : 0) + (difficulty ? 1 : 0) + activeKeywords.size + selectedIdentityIds.size + languageFilterCount + collectionFilterCount
  const hasAnyFilter = totalActiveCount > 0

  const clearCollectionFilters = () => {
    setOwnedIds(null)
    setHasCollection(false)
    setFilterOwnedIdentity(false)
    setFilterOwnedEgo(false)
    setCodeInput('')
    setCodeError(false)
    setCollectionLoading(false)
  }

  const filterSurface = (
    <div className="flex flex-col gap-7">
      <section>
        <SectionLabel>{t('search.section')}</SectionLabel>
        <div className="relative" ref={searchRef}>
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: '#555', zIndex: 1 }} />
          <input
            type="text"
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('search.placeholder')}
            className="w-full rounded pl-7 pr-8 py-1.5 text-xs outline-none"
            style={{
              minHeight: 'var(--deck-filter-control-min)',
              background: 'var(--deck-filter-surface)',
              border: '1px solid var(--deck-filter-border-strong)',
              color: 'var(--deck-filter-text)',
              fontSize: 'var(--deck-filter-control-text)',
            }}
            aria-label={t('search.label')}
          />
          {inputValue && (
            <button
              onClick={() => { setInputValue(''); setShowSuggestions(false); setAcIndex(-1) }}
              className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center justify-center rounded transition-colors hover:bg-white/5"
              style={{ width: '1.75rem', height: '1.75rem', color: 'var(--deck-filter-text-muted)', cursor: 'pointer', zIndex: 1 }}
              aria-label={t('search.clear')}
            >
              <X size={14} />
            </button>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded"
              style={{
                top: '100%',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="px-2.5 py-1" style={{ background: 'rgba(255,255,255,0.03)', color: '#666', fontSize: '0.6875rem', fontWeight: 600 }}>
                {t('search.suggestionHeading')} <span style={{ color: '#555', fontWeight: 400 }}>{t('search.suggestionHint')}</span>
              </div>
              {suggestions.map((sg, i) => {
                const kwIconUrl = sg.type === 'keyword' ? getIconUrl(sg.label) : null
                const isFocused = acIndex === i
                return (
                  <button
                    key={`${sg.type}-${sg.label}-${i}`}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-white/5"
                    onClick={() => {
                      const { prefix } = getActiveTerm(inputValue)
                      setInputValue(prefix + sg.label)
                      setShowSuggestions(false)
                      setAcIndex(-1)
                    }}
                    style={{
                      minHeight: 'var(--deck-filter-control-min)',
                      cursor: 'pointer',
                      color: isFocused ? 'var(--gold)' : 'var(--deck-filter-text)',
                      background: isFocused ? 'var(--deck-filter-surface-active)' : undefined,
                      borderLeft: isFocused ? '0.125rem solid var(--gold)' : '0.125rem solid transparent',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {sg.type === 'identity' && sg.imageUrl ? (
                      <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.1875rem', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(200,144,10,0.2)' }}>
                        <Image src={sg.imageUrl} alt="" width={36} height={36} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
                      </div>
                    ) : sg.type === 'identity' ? (
                      <User size={14} style={{ flexShrink: 0, color: '#8a9bb0' }} />
                    ) : kwIconUrl ? (
                      <Image src={kwIconUrl} alt="" width={14} height={14} style={{ flexShrink: 0 }} />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{sg.type === 'keyword' ? localKeyword(sg.label) : sg.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: '#666', flexShrink: 0 }}>
                      {sg.type === 'identity' ? t('search.suggestionIdentity') : t('search.suggestionKeyword')}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <p className="mt-2" style={{ color: '#666', fontSize: '0.75rem', lineHeight: 1.35 }}>
          {t('search.hint')}
        </p>
      </section>


      <section>
        <SectionLabel>{t('sort.label')}</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {(['latest', 'popular'] as SortKey[]).map(key => {
            const active = normalizedSort === key
            return (
              <button
                key={key}
                onClick={() => setSort(key)}
                aria-pressed={active}
                className="rounded transition-all duration-200"
                style={{
                  minHeight: '2.25rem',
                  border: '1px solid transparent',
                  background: active ? 'var(--deck-filter-surface-active)' : 'var(--deck-filter-surface-muted)',
                  color: active ? 'var(--gold)' : 'var(--deck-filter-text-muted)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--deck-filter-control-text)',
                  fontWeight: 600,
                }}
              >
                {t(`sort.${key}`)}
              </button>
            )
          })}
        </div>
      </section>


      <section>
        <SectionLabel>{t('filters.difficulty')}</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setDifficulty(null)}
            aria-pressed={!difficulty}
            className="rounded transition-all duration-200"
            style={{
              minHeight: '2.25rem',
              border: '1px solid transparent',
              background: !difficulty ? 'var(--deck-filter-surface-active)' : 'var(--deck-filter-surface-muted)',
              color: !difficulty ? 'var(--gold)' : 'var(--deck-filter-text-muted)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--deck-filter-control-text)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('filters.all')}
          </button>
          {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(key => {
            const active = difficulty === key
            const ds = DIFFICULTY_STYLE[key]
            return (
              <button
                key={key}
                onClick={() => setDifficulty(active ? null : key)}
                aria-pressed={active}
                className="rounded transition-all duration-200"
                style={{
                  minHeight: '2.25rem',
                  border: '1px solid transparent',
                  background: active ? ds.bg : 'var(--deck-filter-surface-muted)',
                  color: active ? ds.color : 'var(--deck-filter-text-muted)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--deck-filter-control-text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t(`difficulty.${key}`)}
              </button>
            )
          })}
        </div>
      </section>


      <section>
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <SectionToggle
              label={t('filters.keywords')}
              open={showKeywordFilter}
              active={activeKeywords.size > 0}
              count={activeKeywords.size}
              onClick={() => setShowKeywordFilter(v => !v)}
            />
          </div>
          {activeKeywords.size >= 2 && (
            <button
              onClick={toggleKeywordMode}
              className="rounded transition-all"
              style={{
                minHeight: '1.5rem',
                padding: '0 0.4375rem',
                background: keywordMode === 'and' ? 'rgba(200,144,10,0.12)' : 'transparent',
                color: keywordMode === 'and' ? 'var(--gold)' : '#888',
                border: `1px solid ${keywordMode === 'and' ? 'rgba(200,144,10,0.28)' : 'rgba(255,255,255,0.08)'}`,
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                letterSpacing: '0.05em',
                fontWeight: 400,
              }}
              aria-label={t('filters.keywordModeToggle')}
            >
              {keywordMode === 'and' ? t('filters.and') : t('filters.or')}
            </button>
          )}
        </div>
        {showKeywordFilter && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="grid grid-cols-4 gap-1.5">
              {availableKeywords.map(kw => (
                <FilterButton
                  key={kw}
                  active={activeKeywords.has(kw)}
                  label={localKeyword(kw)}
                  iconUrl={getIconUrl(kw)}
                  onClick={() => toggleKeyword(kw)}
                />
              ))}
            </div>
            {activeKeywords.size > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => { void setKeywordQuery(null, QUERY_OPTIONS) }}
                  className="rounded transition-colors hover:bg-white/5"
                  style={{ minHeight: '1.75rem', padding: '0 0.5rem', color: '#888', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem' }}
                >
                  {t('filters.clear')}
                </button>
              </div>
            )}
          </div>
        )}
      </section>


      <section>
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <SectionToggle
              label={t('filters.identity')}
              open={showIdentityFilter}
              active={selectedIdentityIds.size > 0}
              count={selectedIdentityIds.size}
              onClick={() => setShowIdentityFilter(v => !v)}
            />
          </div>
          {selectedIdentityIds.size > 0 && (
            <button
              type="button"
              onClick={toggleIdentityMode}
              className="rounded transition-all"
              style={{
                minHeight: '1.5rem',
                padding: '0 0.4375rem',
                background: identityMode === 'and' ? 'rgba(200,144,10,0.12)' : 'transparent',
                color: identityMode === 'and' ? 'var(--gold)' : '#888',
                border: `1px solid ${identityMode === 'and' ? 'rgba(200,144,10,0.28)' : 'rgba(255,255,255,0.08)'}`,
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                letterSpacing: '0.05em',
                fontWeight: 400,
                cursor: 'pointer',
              }}
              aria-label={t('filters.identityModeToggle')}
              aria-pressed={identityMode === 'and'}
            >
              {identityMode === 'and' ? t('filters.and') : t('filters.or')}
            </button>
          )}
        </div>
        {showIdentityFilter && (
          <div className="flex flex-col gap-2 pt-1">
            <div
              className="grid grid-cols-2 gap-1.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0.25rem 0' }}
              aria-label={t('filters.identity')}
            >
              {identityFilterSinners.map(sinner => {
                const selectedForSinner = selectedIdentitiesBySinner.get(sinner.id) ?? []
                const representativeIdentity = selectedForSinner[0]
                const representativeImageUrl = representativeIdentity ? getIdentityInfoUrl(representativeIdentity) : null
                const sinnerName = localizeSinnerName(sinner)
                return (
                  <button
                    key={sinner.id}
                    onClick={() => setIdentityModalSinnerId(sinner.id)}
                    className="group relative min-w-0 overflow-hidden rounded-sm transition-colors duration-200 hover:bg-[rgba(200,144,10,0.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                    style={{
                      minHeight: '3.25rem',
                      padding: 0,
                      background: selectedForSinner.length > 0 ? 'rgba(25,18,10,0.92)' : 'rgba(255,255,255,0.018)',
                      boxShadow: selectedForSinner.length > 0 ? 'inset 0.1875rem 0 0 var(--gold)' : 'inset 0.0625rem 0 0 rgba(255,255,255,0.06)',
                      color: selectedForSinner.length > 0 ? 'var(--gold)' : '#9a8460',
                      cursor: 'pointer',
                    }}
                    aria-label={`${sinnerName} ${t('identityFilter.fallbackTitle')}${selectedForSinner.length > 0 ? `, ${selectedForSinner.length} ${t('filters.identitySelected')}` : ''}`}
                  >
                    {representativeImageUrl ? (
                      <>
                        <span className="pointer-events-none absolute inset-0" aria-hidden="true">
                          <Image
                            src={representativeImageUrl}
                            alt=""
                            fill
                            sizes="8rem"
                            style={{ objectFit: 'cover', objectPosition: 'center 14%' }}
                          />
                        </span>
                        <span
                          className="pointer-events-none absolute inset-0"
                          style={{ background: 'linear-gradient(90deg, rgba(13,11,8,0.48) 0%, rgba(13,11,8,0.18) 52%, rgba(13,11,8,0.36) 100%)' }}
                          aria-hidden="true"
                        />
                        <span className="pointer-events-none absolute inset-y-0 left-0" style={{ width: '0.1875rem', background: 'var(--gold)' }} aria-hidden="true" />
                      </>
                    ) : (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <Image
                          src={getSinnerLogoUrl(sinner.id)}
                          alt=""
                          width={44}
                          height={44}
                          style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain', opacity: 0.42, filter: 'sepia(0.35) saturate(0.85) brightness(0.86)' }}
                        />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {selectedIdentityIds.size > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => { void setIdentityIdsQuery(null, QUERY_OPTIONS) }}
                  className="rounded transition-colors hover:bg-white/5"
                  style={{ minHeight: '1.75rem', padding: '0 0.5rem', color: '#888', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem' }}
                >
                  {t('filters.clear')}
                </button>
              </div>
            )}
          </div>
        )}
      </section>


      <LanguageFilter
        value={languageFilter}
        onChange={value => { void setLanguageQuery(value === 'mine' ? null : value, QUERY_OPTIONS) }}
      />


      <section>
        <SectionToggle
          label={t('filters.collection')}
          open={showCollectionFilter}
          active={collectionFilterCount > 0}
          count={collectionFilterCount}
          onClick={() => setShowCollectionFilter(v => !v)}
        />
        {showCollectionFilter && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="grid grid-cols-2 gap-1.5">
              <FilterButton active={filterOwnedIdentity} label={t('filters.ownedIdentityPlan')} onClick={() => { void toggleFilterOwnedIdentity() }} />
              <FilterButton active={filterOwnedEgo} label={t('filters.ownedEgoPlan')} onClick={() => { void toggleFilterOwnedEgo() }} />
              {(hasCollection || filterOwnedIdentity || filterOwnedEgo || codeInput || codeError || collectionLoading) && (
                <button
                  onClick={clearCollectionFilters}
                  className="col-span-2 rounded transition-colors hover:bg-white/5"
                  style={{ minHeight: '2rem', color: '#888', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem' }}
                >
                  {t('filters.clear')}
                </button>
              )}
            </div>
            {collectionLoading && (
              <span style={{ color: '#888', fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
                {t('filters.collectionLoading')}
              </span>
            )}
            {!hasCollection && (
              <>
                <div className="flex items-center gap-2">
                  <Link2 size={13} style={{ color: '#777', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={codeInput}
                    onChange={e => { setCodeInput(e.target.value); setCodeError(false) }}
                    onKeyDown={e => { if (e.key === 'Enter') applyCollectionCode(codeInput) }}
                    placeholder={t('filters.collectionCodePlaceholder')}
                    className="min-w-0 flex-1 rounded px-2 py-1.5 outline-none"
                    style={{
                      minHeight: '2.25rem',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${codeError ? 'rgba(200,80,80,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      color: '#ccc',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                    aria-label={t('filters.collectionCodeLabel')}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => applyCollectionCode(codeInput)}
                    disabled={collectionLoading}
                    className="rounded transition-colors hover:bg-white/5"
                    style={{
                      minHeight: '2rem',
                      padding: '0 0.75rem',
                      background: 'rgba(200,144,10,0.1)',
                      color: 'var(--gold)',
                      border: '1px solid rgba(200,144,10,0.28)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.8125rem',
                      cursor: collectionLoading ? 'wait' : 'pointer',
                      opacity: collectionLoading ? 0.6 : 1,
                    }}
                  >
                    {t('filters.apply')}
                  </button>
                  {codeError && (
                    <span style={{ color: '#c85050', fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
                      {t('filters.invalidCode')}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )

  if (browse !== 'all' && !(search || keywordQuery || identityIdsQuery)) return <DiscoveryShelf kind="planner" onBrowse={() => setBrowse('all', { history: 'push' })} />

  return (
    <div data-board-browse className="relative min-h-0 flex-1 overflow-hidden px-4 pb-4 md:px-6">
      <div className="relative z-[1] mx-auto flex h-full min-h-0 w-full max-w-7xl gap-5">
        <aside
          className="hidden h-full w-64 shrink-0 overflow-y-auto pr-3 scrollbar-thin lg:block"

          aria-label={t('filters.aside')}
        >
          {filterSurface}
        </aside>

        <div ref={scrollRootRef} className="min-h-0 flex-1 overflow-y-auto pb-16 pr-1 scrollbar-thin">
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
                <span className="min-w-0">
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {hasAnyFilter || filtered.length !== total ? t('result.filtered', { filtered: filtered.length, total }) : t('result.total', { count: total })}
                </span>
                {hasAnyFilter && <span style={{ color: '#777' }}> {t('result.filterApplied')}</span>}
              </span>
            </div>
          )}

          {loading ? (
            <BoardSkeleton kind="planner" />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20" style={{ color: '#444' }}>
              <PackageOpen style={{ width: '2.5rem', height: '2.5rem', opacity: 0.4 }} />
              <p style={{ fontSize: '0.875rem' }}>
                {debouncedSearch.trim() ? t('grid.noSearchResults', { query: debouncedSearch }) : t('grid.empty')}
              </p>
              {!debouncedSearch.trim() && (
                <Link href="/planner" style={{ color: '#c8900a', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                  {t('grid.createFirst')}
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {renderedPlanCards}
              </div>

              <div ref={sentinelRef} className="flex justify-center py-8" aria-hidden={!hasMore && !loadingMore}>
                {loadingMore ? (
                  <BoardSkeleton kind="planner" count={2} />
                ) : hasMore ? (
                  <span style={{ color: '#444', fontSize: '0.875rem' }}>{t('grid.scrollForMore')}</span>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="flex items-center gap-2 rounded-full px-5 shadow-lg transition-transform active:scale-95"
          style={{
            minHeight: '3rem',
            cursor: 'pointer',
            background: 'var(--gold)',
            color: '#0d0b08',
            fontWeight: 600,
            fontSize: '0.9375rem',
          }}
        >
          <SlidersHorizontal size={17} />
          {t('filters.button')}{totalActiveCount > 0 ? ' (' + totalActiveCount + ')' : ''}
        </button>
      </div>

      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t('filters.panel')}
        >
          <button
            className="absolute inset-0 h-full w-full bg-black/60"
            onClick={() => setMobileFiltersOpen(false)}
            aria-label={t('filters.closePanel')}
          />
          <div
            ref={mobilePanelRef}
            tabIndex={-1}
            className="popup-drawer absolute bottom-0 left-0 right-0 max-h-[82dvh] overflow-y-auto rounded-t-lg outline-none scrollbar-thin"
            style={{
              background: '#1a1510',
              borderTop: '1px solid rgba(200,144,10,0.25)',
              animation: 'plannerCommunityFilterSlideUp 0.24s ease-out',
            }}
          >
            <div
              className="sticky top-0 flex items-center justify-between px-5 py-3"
              style={{
                background: '#1a1510',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                zIndex: 1,
              }}
            >
              <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-body)', letterSpacing: '0.1em', fontSize: '0.875rem' }}>
                {t('filters.button').toUpperCase()}
              </span>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="flex items-center justify-center rounded transition-colors hover:bg-white/5"
                style={{ width: '2.75rem', height: '2.75rem', cursor: 'pointer', color: '#9a938a' }}
                aria-label={t('filters.close')}
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4">
              {filterSurface}
            </div>
          </div>
        </div>
      )}

      <DeckIdentityFilterModal
        open={!!identityModalSinnerId}
        sinner={identityModalSinner}
        identities={identityModalIdentities}
        selectedIdentityIds={selectedIdentityIds}
        onToggleIdentity={handleModalToggleIdentity}
        onClose={() => setIdentityModalSinnerId(null)}
      />

      <style jsx>{`
        @keyframes plannerCommunityFilterSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
