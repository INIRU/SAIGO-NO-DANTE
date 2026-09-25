'use client'

import BoardSkeleton from '@/components/discovery/BoardSkeleton'
import { useLoadMoreSentinel } from '@/hooks/useLoadMoreSentinel'
import DiscoveryShelf from '@/components/discovery/DiscoveryShelf'
import BoardBrowseLock from '@/components/discovery/BoardBrowseLock'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQueryState, parseAsBoolean, parseAsInteger, parseAsString } from 'nuqs'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { Check, Link2, PackageOpen, Search, User, X } from 'lucide-react'
import ThemePackCard from '@/components/ui/ThemePackCard'
import FilterDock, { FacetChip, FacetSearch, FacetTile, type DockApplied, type DockFacet } from '@/components/board/FilterDock'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import GiftCatalog, { giftKeywordIcon, toCatalogGift, useGiftCatalogFilters } from '@/components/gifts/GiftCatalog'
import type { EgoGift } from '@/components/mirror-dungeon/types'
import type { GiftData } from '@/lib/planner/types'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { hasAll, useBoardFacets } from '@/hooks/useBoardFacets'
import { getLocalizedAffiliation } from '@/lib/i18n/localize'
import PlanCard, { type PlanSummary } from '@/components/planner/PlanCard'
import { DIFFICULTY_CONFIG, type Difficulty } from '@/lib/planner/types'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import DeckIdentityFilterModal, { type DeckFilterIdentity, type DeckFilterSinner } from '@/components/decks/DeckIdentityFilterModal'
import FormationCountFilter from '@/components/decks/FormationCountFilter'
import { decodeCollectionAsync, missingFormationCount, withBaseIdentities, type CollectionData } from '@/lib/collection'
import { useOwnedIdentities } from '@/hooks/useOwnedIdentities'
import { parseSearchQuery, getActiveTerm, termMatchesAny } from '@/lib/utils/search'
import { THEME_KEYWORDS } from '@/lib/constants/keywords'
import { normalizePlannerListKeywords } from '@/lib/planner/stripPlanForList'
import { useLocale, useTranslations } from 'next-intl'
import {
  DECK_LANGUAGE_FILTERS,
  localizeDeckKeyword,
  normalizeDeckLanguageFilter,
  resolveDeckLanguageParam,
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
  affiliations: Set<string>
  giftIds: Set<string>
  themeIds: Set<string>
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
  // 소속·E.G.O·기프트·테마팩: 고른 것을 모두 담은 글만 남긴다
  const [affiliationQuery, setAffiliationQuery] = useQueryState('af', parseAsString.withDefault(''))
  const [egoQuery, setEgoQuery] = useQueryState('eg', parseAsString.withDefault(''))
  const [giftQuery, setGiftQuery] = useQueryState('gf', parseAsString.withDefault(''))
  const [themeQuery, setThemeQuery] = useQueryState('tp', parseAsString.withDefault(''))
  const selectedAffiliations = useMemo(() => parseCsvParam(affiliationQuery), [affiliationQuery])
  const selectedEgoIds = useMemo(() => parseCsvParam(egoQuery), [egoQuery])
  const selectedGiftIds = useMemo(() => parseCsvParam(giftQuery), [giftQuery])
  const selectedThemeIds = useMemo(() => parseCsvParam(themeQuery), [themeQuery])
  const facetData = useBoardFacets('planner').data
  const giftFilters = useGiftCatalogFilters()
  const [egoSinner, setEgoSinner] = useState<string | null>(null)
  const [formationCountQuery, setFormationCountQuery] = useQueryState('fc', parseAsInteger)
  const formationCount = formationCountQuery !== null && Number.isInteger(formationCountQuery) && formationCountQuery >= 1 && formationCountQuery <= 12
    ? formationCountQuery : null
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

  // 전체 인격 목록 (자동완성용 - 이름 + 일러스트)
  const [allIdentities, setAllIdentities] = useState<IdentityNameEntry[]>([])
  const identitiesRequestRef = useRef<Promise<void> | null>(null)
  const ensureIdentities = useCallback(() => {
    if (allIdentities.length > 0) return Promise.resolve()
    if (identitiesRequestRef.current) return identitiesRequestRef.current

    identitiesRequestRef.current = (async () => {
      try {
        const { createClient: createBrowserClient } = await import('@/lib/supabase/client')
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
  const [identityModalSinnerId, setIdentityModalSinnerId] = useState<string | null>(null)

  // 컬렉션 필터
  // URL에 남긴다: 게시판 위 "보유 인격으로 편성할 수 있는 플랜만 보기" 링크가 이 필터를 켠 채로 연다(덱 게시판과 같은 oi)
  const [filterOwnedIdentity, setFilterOwnedIdentity] = useQueryState('oi', parseAsBoolean.withDefault(false))
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
    if (formationCount !== null) params.set('formation_count', String(formationCount))
    params.sort()
    return params.toString()
  }, [normalizedSort, plannerLanguageParam, difficulty, activeKeywordList, keywordMode, selectedIdentityIdList, identityMode, formationCount])

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

  const sentinelRef = useLoadMoreSentinel(loadMore, scrollRootRef, serverQueryKey)

  useEffect(() => {
    collectionDataRef.current = collectionData
  }, [collectionData])

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
      const ticked = await decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
      // An empty code is invalid; LCB identities are added only after that check.
      const decoded = ticked.size ? withBaseIdentities(ticked, data.identities) : ticked
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
      const ticked = await decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
      // An empty code is invalid; LCB identities are added only after that check.
      const decoded = ticked.size ? withBaseIdentities(ticked, data.identities) : ticked
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
    void setFilterOwnedIdentity(prev => !prev)
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
    affiliations: new Set((plan.deck ?? []).filter(slot => (slot.slot_order ?? 99) < 99)
      .flatMap(slot => (slot.identity_id && facetData?.identityAffiliations[slot.identity_id]) || [])),
    giftIds: new Set((plan.gift_ids ?? []).map(String)),
    themeIds: new Set((plan.theme_ids ?? []).map(String)),
  })), [plans, facetData])

  // 붙여 넣은 보유 코드가 없으면 카드 뱃지와 같은 저장된 보유 현황을 쓴다(링크로 oi=1이 먼저 켜져도 바로 걸린다)
  const profileOwned = useOwnedIdentities()
  const effectiveOwned = ownedIds ?? profileOwned
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
    if (filterOwnedIdentity && effectiveOwned) {
      // 카드 뱃지와 같은 기준: 편성 순서가 있는 인격만(대기 인격은 없어도 된다)
      list = list.filter(({ plan }) => missingFormationCount((plan.deck ?? []).map(slot => ({ id: slot.identity_id, slot_order: slot.slot_order })), effectiveOwned) === 0)
    }

    // 보유 에고 필터
    if (filterOwnedEgo && effectiveOwned) {
      list = list.filter(({ egoIds }) => {
        if (egoIds.length === 0) return true
        return egoIds.every(id => effectiveOwned.has(id))
      })
    }

    if (selectedAffiliations.length) list = list.filter(({ affiliations }) => hasAll(selectedAffiliations, affiliations))
    if (selectedEgoIds.length) list = list.filter(({ egoIds }) => hasAll(selectedEgoIds, new Set(egoIds)))
    if (selectedGiftIds.length) list = list.filter(({ giftIds }) => hasAll(selectedGiftIds, giftIds))
    if (selectedThemeIds.length) list = list.filter(({ themeIds }) => hasAll(selectedThemeIds, themeIds))

    return list.map(({ plan }) => plan)
  }, [planIndexes, debouncedSearch, activeKeywordList, keywordMode, selectedIdentityIdList, identityMode, filterOwnedIdentity, filterOwnedEgo, effectiveOwned, selectedAffiliations, selectedEgoIds, selectedGiftIds, selectedThemeIds])

  const renderedPlanCards = useMemo(() => filtered.map(plan => (
    <PlanCard key={plan.id} plan={plan} onKeywordToggle={toggleKeyword} />
  )), [filtered, toggleKeyword])

  const collectionFilterCount = (filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0)
  const languageFilterCount = languageFilter === 'mine' ? 0 : 1
  const totalActiveCount = (inputValue.trim() ? 1 : 0) + (difficulty ? 1 : 0) + (formationCount !== null ? 1 : 0) + activeKeywords.size + selectedIdentityIds.size + languageFilterCount + collectionFilterCount + selectedAffiliations.length + selectedEgoIds.length + selectedGiftIds.length + selectedThemeIds.length
  const hasAnyFilter = totalActiveCount > 0

  const clearCollectionFilters = () => {
    setOwnedIds(null)
    setHasCollection(false)
    void setFilterOwnedIdentity(false)
    setFilterOwnedEgo(false)
    setCodeInput('')
    setCodeError(false)
    setCollectionLoading(false)
  }

  // ── 필터 막대: 위쪽 도구줄 + 항목 탭(한 번에 하나의 넓은 패널) + 적용된 필터 칩 ──
  const [facetQuery, setFacetQuery] = useState('')
  const facetMatch = (...names: (string | null | undefined)[]) => {
    const query = facetQuery.trim().toLocaleLowerCase()
    return !query || names.some(name => name?.toLocaleLowerCase().includes(query))
  }
  const toggleCsv = (list: string[], value: string, set: (value: string | null, options?: typeof QUERY_OPTIONS) => unknown) => {
    const next = new Set(list)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    void set(serializeCsvParam(next) || null, QUERY_OPTIONS)
  }
  const localized = (item: { name: string; name_kr?: string | null; name_en?: string | null; name_jp?: string | null }) =>
    (locale === 'en' ? item.name_en : locale === 'ja' ? item.name_jp : null) || item.name_kr || item.name
  const egoById = useMemo(() => new Map((facetData?.egos ?? []).map(ego => [ego.id, ego])), [facetData])
  const giftById = useMemo(() => new Map((facetData?.gifts ?? []).map(gift => [String(gift.game_id), gift])), [facetData])
  const themeById = useMemo(() => new Map((facetData?.themes ?? []).map(theme => [String(theme.id), theme])), [facetData])
  const segment = (active: boolean) => `min-h-10 rounded-md px-3 text-[0.875rem] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b030] ${active ? 'bg-[rgba(200,144,10,0.16)] text-[#e8b030]' : 'text-[#9c8b73] hover:text-[#e8dcc8]'}`
  const modeToggle = (mode: 'or' | 'and', onToggle: () => void) => (
    <div className="mt-3 inline-flex rounded-lg border border-[#2e2417] bg-[#0d0b08] p-0.5" role="group">
      {(['or', 'and'] as const).map(value => (
        <button key={value} type="button" aria-pressed={mode === value} onClick={() => { if (mode !== value) onToggle() }} className={segment(mode === value)}>
          {t(value === 'or' ? 'filters.matchAny' : 'filters.matchAll')}
        </button>
      ))}
    </div>
  )

  const searchBox = (
    <div className="relative min-w-[14rem] flex-1" ref={searchRef}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[#7f7364]" aria-hidden="true" />
      <input
        type="text"
        value={inputValue}
        onChange={e => { setInputValue(e.target.value); setShowSuggestions(true) }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleSearchKeyDown}
        placeholder={t('search.placeholder')}
        title={t('search.hint')}
        className="min-h-11 w-full rounded-lg border border-[#2e2417] bg-[#120e09] pl-9 pr-9 text-[0.9375rem] text-[#e8dcc8] outline-none placeholder:text-[#6a6058] focus:border-[#5a4526]"
        aria-label={t('search.label')}
      />
      {inputValue && (
        <button
          type="button"
          onClick={() => { setInputValue(''); setShowSuggestions(false); setAcIndex(-1) }}
          className="absolute right-1.5 top-1/2 z-[1] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-[#9c8b73] hover:bg-white/5"
          aria-label={t('search.clear')}
        >
          <X size={14} />
        </button>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[#2e2417] bg-[#17120c] shadow-[0_0.75rem_1.5rem_rgba(0,0,0,0.5)]">
          <div className="px-3 py-1.5 text-[0.75rem] font-semibold text-[#7f7364]">
            {t('search.suggestionHeading')} <span className="font-normal">{t('search.suggestionHint')}</span>
          </div>
          {suggestions.map((sg, i) => {
            const kwIconUrl = sg.type === 'keyword' ? getIconUrl(sg.label) : null
            const isFocused = acIndex === i
            return (
              <button
                key={`${sg.type}-${sg.label}-${i}`}
                type="button"
                className={`flex min-h-10 w-full items-center gap-2 border-l-2 px-3 text-left text-[0.875rem] hover:bg-white/5 ${isFocused ? 'border-[#c8900a] bg-[rgba(200,144,10,0.1)] text-[#e8b030]' : 'border-transparent text-[#e8dcc8]'}`}
                onClick={() => {
                  const { prefix } = getActiveTerm(inputValue)
                  setInputValue(prefix + sg.label)
                  setShowSuggestions(false)
                  setAcIndex(-1)
                }}
              >
                {sg.type === 'identity' && sg.imageUrl ? (
                  <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-[0.1875rem]">
                    <Image src={sg.imageUrl} alt="" fill sizes="24px" className="object-cover object-[center_15%]" />
                  </span>
                ) : sg.type === 'identity' ? (
                  <User size={14} className="shrink-0 text-[#8a9bb0]" />
                ) : kwIconUrl ? (
                  <Image src={kwIconUrl} alt="" width={14} height={14} className="shrink-0" />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{sg.type === 'keyword' ? localKeyword(sg.label) : sg.label}</span>
                <span className="shrink-0 text-[0.6875rem] text-[#7f7364]">
                  {sg.type === 'identity' ? t('search.suggestionIdentity') : t('search.suggestionKeyword')}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  const toolbar = (
    <>
      {searchBox}
      <div className="flex rounded-lg border border-[#2e2417] bg-[#120e09] p-0.5" role="group" aria-label={t('sort.label')}>
        {(['latest', 'popular'] as SortKey[]).map(key => (
          <button key={key} type="button" onClick={() => setSort(key)} aria-pressed={normalizedSort === key} className={segment(normalizedSort === key)}>
            {t(`sort.${key}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap rounded-lg border border-[#2e2417] bg-[#120e09] p-0.5" role="group" aria-label={t('filters.difficulty')}>
        <button type="button" onClick={() => setDifficulty(null)} aria-pressed={!difficulty} className={segment(!difficulty)}>{t('filters.all')}</button>
        {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(key => {
          const active = difficulty === key
          return (
            <button key={key} type="button" onClick={() => setDifficulty(active ? null : key)} aria-pressed={active}
              className={segment(false)} style={active ? { background: DIFFICULTY_STYLE[key].bg, color: DIFFICULTY_STYLE[key].color } : undefined}>
              {t(`difficulty.${key}`)}
            </button>
          )
        })}
      </div>
    </>
  )

  const keywordPanel = (
    <>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-11">
        {availableKeywords.map(kw => {
          const icon = getIconUrl(kw)
          return <FacetTile key={kw} active={activeKeywords.has(kw)} onClick={() => toggleKeyword(kw)} label={localKeyword(kw)}
            icon={icon ? <Image src={icon} alt="" width={28} height={28} className="h-7 w-7 object-contain" /> : null} />
        })}
      </div>
      {activeKeywords.size >= 2 && modeToggle(keywordMode, toggleKeywordMode)}
    </>
  )

  const affiliationPanel = (
    <>
      <FacetSearch value={facetQuery} onChange={setFacetQuery} placeholder={t('filters.searchAffiliation')} />
      <div className="flex flex-wrap gap-1.5">
        {(facetData?.affiliations ?? []).filter(item => facetMatch(item.key, getLocalizedAffiliation(item.key, locale))).map(item => (
          <FacetChip key={item.key} active={selectedAffiliations.includes(item.key)} onClick={() => toggleCsv(selectedAffiliations, item.key, setAffiliationQuery)}
            label={getLocalizedAffiliation(item.key, locale)} count={item.count} />
        ))}
      </div>
    </>
  )

  const identityPanel = (
    <>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 xl:grid-cols-12" aria-label={t('filters.identity')}>
        {identityFilterSinners.map(sinner => {
          const selectedForSinner = selectedIdentitiesBySinner.get(sinner.id) ?? []
          const representative = selectedForSinner[0]
          const imageUrl = representative ? getIdentityInfoUrl(representative) : null
          const sinnerName = localizeSinnerName(sinner)
          return (
            <button
              key={sinner.id}
              type="button"
              onClick={() => setIdentityModalSinnerId(sinner.id)}
              className={`relative flex aspect-[3/4] min-w-0 flex-col justify-end overflow-hidden rounded-md border text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b030] ${selectedForSinner.length ? 'border-[#c8900a]' : 'border-[#2e2417] hover:border-[#5a4526]'}`}
              aria-label={`${sinnerName} ${t('identityFilter.fallbackTitle')}${selectedForSinner.length > 0 ? `, ${selectedForSinner.length} ${t('filters.identitySelected')}` : ''}`}
            >
              {selectedForSinner.length > 0 && <span aria-hidden="true" className="absolute right-1 top-1 z-[1] grid h-4 w-4 place-items-center rounded-sm bg-[#c8900a] text-[#0d0b08]"><Check size={11} strokeWidth={3.5} /></span>}
              {imageUrl
                ? <Image src={imageUrl} alt="" fill sizes="6rem" className="object-cover object-[center_14%]" />
                : <span className="absolute inset-0 grid place-items-center bg-[#17120c]"><Image src={getSinnerLogoUrl(sinner.id)} alt="" width={40} height={40} className="h-9 w-9 object-contain opacity-50" /></span>}
              <span className="relative bg-gradient-to-t from-[rgba(13,11,8,0.92)] to-transparent px-1.5 pb-1 pt-4 text-[0.75rem] font-semibold leading-tight text-[#e8dcc8]">
                {sinnerName}{selectedForSinner.length > 1 ? ` +${selectedForSinner.length - 1}` : ''}
              </span>
            </button>
          )
        })}
      </div>
      {selectedIdentityIds.size >= 2 && modeToggle(identityMode, toggleIdentityMode)}
    </>
  )

  const egoSinners = SINNER_SLUGS.filter(id => (facetData?.egos ?? []).some(ego => ego.sinner_id === id))
  const egoPanel = (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-1" role="group" aria-label={t('filters.egoSinner')}>
        {egoSinners.map(id => {
          const active = egoSinner === id
          return (
            <button key={id} type="button" aria-pressed={active} onClick={() => setEgoSinner(active ? null : id)}
              title={rootT(`sinner.${id}` as Parameters<typeof rootT>[0])}
              className={`grid h-10 w-10 place-items-center rounded border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b030] ${active ? 'border-[#c8900a] bg-[#241c12]' : 'border-[#241c14] bg-[#17120c] hover:border-[#3a2a15]'}`}>
              <Image src={getSinnerLogoUrl(id)} alt={rootT(`sinner.${id}` as Parameters<typeof rootT>[0])} width={28} height={28} className={`h-7 w-7 object-contain ${active ? '' : 'opacity-55'}`} />
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-5 lg:grid-cols-8">
        {(facetData?.egos ?? []).filter(ego => !egoSinner || ego.sinner_id === egoSinner).map(ego => (
          <div key={ego.id} className="min-w-0">
            <EgoDisplayCard ego={ego} name={localized(ego)} sinnerId={ego.sinner_id} lang={locale} selected={selectedEgoIds.includes(ego.id)}
              onClick={() => toggleCsv(selectedEgoIds, ego.id, setEgoQuery)} />
            <p className="mt-1 text-center text-[0.75rem] text-[#7f7364]">{t('filters.postCount', { count: ego.count })}</p>
          </div>
        ))}
      </div>
    </>
  )

  const catalogGifts = useMemo(() => (facetData?.gifts ?? []).map(gift => toCatalogGift(gift as unknown as GiftData)), [facetData])
  const selectedGiftSet = useMemo(() => new Set(selectedGiftIds), [selectedGiftIds])
  const onGiftFacet = useCallback((gift: EgoGift) => toggleCsv(selectedGiftIds, gift.id, setGiftQuery), [selectedGiftIds]) // eslint-disable-line react-hooks/exhaustive-deps
  const giftPanel = (
    <div style={{ '--gift-catalog-bg': '#120e09', '--gift-catalog-sticky-top': '0px', '--gift-catalog-min-h': '0px' } as React.CSSProperties}>
      <GiftCatalog compact gifts={catalogGifts} getGiftKeywordIcon={giftKeywordIcon} filters={giftFilters} selectedIds={selectedGiftSet} onGiftClick={onGiftFacet} />
    </div>
  )

  const themePanel = (
    <>
      <FacetSearch value={facetQuery} onChange={setFacetQuery} placeholder={t('filters.searchTheme')} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-x-3 gap-y-2">
        {(facetData?.themes ?? []).filter(theme => facetMatch(theme.name, theme.name_en, theme.name_jp)).map(theme => (
          <div key={theme.id} className="min-w-0">
            <ThemePackCard theme={theme} sizes="7rem" isSelected={selectedThemeIds.includes(String(theme.id))}
              onClick={() => toggleCsv(selectedThemeIds, String(theme.id), setThemeQuery)} />
            <p className="mt-1 text-center text-[0.75rem] tabular-nums text-[#9c8b73]">{t('filters.postCount', { count: theme.count })}</p>
          </div>
        ))}
      </div>
    </>
  )

  const ownedPanel = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        <FacetChip active={filterOwnedIdentity} onClick={() => { void toggleFilterOwnedIdentity() }} label={t('filters.ownedIdentityPlan')} />
        <FacetChip active={filterOwnedEgo} onClick={() => { void toggleFilterOwnedEgo() }} label={t('filters.ownedEgoPlan')} />
      </div>
      {collectionLoading && <span className="text-[0.875rem] text-[#9c8b73]">{t('filters.collectionLoading')}</span>}
      {!hasCollection && !effectiveOwned && (
        <div className="flex flex-wrap items-center gap-2">
          <Link2 size={14} className="shrink-0 text-[#7f7364]" aria-hidden="true" />
          <input
            type="text"
            value={codeInput}
            onChange={e => { setCodeInput(e.target.value); setCodeError(false) }}
            onKeyDown={e => { if (e.key === 'Enter') applyCollectionCode(codeInput) }}
            placeholder={t('filters.collectionCodePlaceholder')}
            aria-label={t('filters.collectionCodeLabel')}
            className={`min-h-9 min-w-[12rem] flex-1 rounded-md border bg-[#0d0b08] px-3 text-[0.875rem] text-[#e8dcc8] outline-none ${codeError ? 'border-[rgba(200,80,80,0.6)]' : 'border-[#2e2417] focus:border-[#5a4526]'}`}
          />
          <button type="button" onClick={() => applyCollectionCode(codeInput)} disabled={collectionLoading}
            className="min-h-9 rounded-md border border-[rgba(200,144,10,0.4)] bg-[rgba(200,144,10,0.1)] px-3 text-[0.875rem] font-semibold text-[#e8b030] disabled:opacity-60">
            {t('filters.apply')}
          </button>
          {codeError && <span className="text-[0.875rem] text-[#e0685c]">{t('filters.invalidCode')}</span>}
        </div>
      )}
    </div>
  )

  const languagePanel = (
    <div className="flex flex-wrap gap-1.5">
      {DECK_LANGUAGE_FILTERS.map(option => (
        <FacetChip key={option} active={languageFilter === option} onClick={() => { void setLanguageQuery(option === 'mine' ? null : option, QUERY_OPTIONS) }}
          label={t(`languageFilter.${option === 'mine' ? 'current' : option}`)} />
      ))}
    </div>
  )

  const facetsList: DockFacet[] = [
    { key: 'keyword', label: t('filters.keywordsShort'), count: activeKeywords.size, content: keywordPanel },
    { key: 'affiliation', label: t('filters.affiliation'), count: selectedAffiliations.length, content: affiliationPanel },
    { key: 'identity', label: t('filters.identityShort'), count: selectedIdentityIds.size, content: identityPanel },
    { key: 'ego', label: 'E.G.O', count: selectedEgoIds.length, content: egoPanel },
    { key: 'gift', label: t('filters.gift'), count: selectedGiftIds.length, content: giftPanel },
    { key: 'theme', label: t('filters.theme'), count: selectedThemeIds.length, content: themePanel },
    { key: 'formation', label: rootT('decks.filters.formationCount'), count: formationCount !== null ? 1 : 0, content: <FormationCountFilter value={formationCount} onChange={value => { void setFormationCountQuery(value, QUERY_OPTIONS) }} /> },
    { key: 'owned', label: t('filters.collection'), count: collectionFilterCount, content: ownedPanel },
    { key: 'language', label: t('languageFilter.label'), count: languageFilterCount, content: languagePanel },
  ]

  const appliedFilters: DockApplied[] = [
    ...(difficulty ? [{ key: 'difficulty', label: t(`difficulty.${difficulty}`), onRemove: () => setDifficulty(null) }] : []),
    ...[...activeKeywords].map(kw => ({ key: `kw-${kw}`, label: localKeyword(kw), onRemove: () => toggleKeyword(kw) })),
    ...selectedAffiliations.map(key => ({ key: `af-${key}`, label: getLocalizedAffiliation(key, locale), onRemove: () => toggleCsv(selectedAffiliations, key, setAffiliationQuery) })),
    ...selectedIdentities.map(identity => ({ key: `id-${identity.id}`, label: identity.name, onRemove: () => handleModalToggleIdentity(identity.id) })),
    ...selectedEgoIds.map(id => ({ key: `eg-${id}`, label: egoById.get(id) ? localized(egoById.get(id)!) : 'E.G.O', onRemove: () => toggleCsv(selectedEgoIds, id, setEgoQuery) })),
    ...selectedGiftIds.map(id => ({ key: `gf-${id}`, label: giftById.get(id) ? localized(giftById.get(id)!) : t('filters.gift'), onRemove: () => toggleCsv(selectedGiftIds, id, setGiftQuery) })),
    ...selectedThemeIds.map(id => ({ key: `tp-${id}`, label: themeById.get(id) ? localized(themeById.get(id)!) : t('filters.theme'), onRemove: () => toggleCsv(selectedThemeIds, id, setThemeQuery) })),
    ...(formationCount !== null ? [{ key: 'fc', label: `${rootT('decks.filters.formationCount')} ${formationCount}`, onRemove: () => { void setFormationCountQuery(null, QUERY_OPTIONS) } }] : []),
    ...(filterOwnedIdentity ? [{ key: 'oi', label: t('filters.ownedIdentityPlan'), onRemove: () => { void toggleFilterOwnedIdentity() } }] : []),
    ...(filterOwnedEgo ? [{ key: 'oe', label: t('filters.ownedEgoPlan'), onRemove: () => { void toggleFilterOwnedEgo() } }] : []),
  ]
  const clearAllFilters = () => {
    setDifficulty(null)
    setInputValue('')
    void setKeywordQuery(null, QUERY_OPTIONS)
    void setIdentityIdsQuery(null, QUERY_OPTIONS)
    void setAffiliationQuery(null, QUERY_OPTIONS)
    void setEgoQuery(null, QUERY_OPTIONS)
    void setGiftQuery(null, QUERY_OPTIONS)
    void setThemeQuery(null, QUERY_OPTIONS)
    void setFormationCountQuery(null, QUERY_OPTIONS)
    clearCollectionFilters()
  }

  if (browse !== 'all' && !(search || keywordQuery || identityIdsQuery)) return <DiscoveryShelf kind="planner" onBrowse={() => setBrowse('all', { history: 'push' })} />

  return (
    <div data-board-browse className="relative min-h-0 flex-1 overflow-hidden px-4 pb-4 md:px-6">
      <BoardBrowseLock />
      <div className="relative z-[1] mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col">
        <div ref={scrollRootRef} className="min-h-0 flex-1 overflow-y-auto pb-16 pr-1 scrollbar-thin">
          <FilterDock
            toolbar={toolbar}
            facets={facetsList}
            applied={appliedFilters}
            onClearAll={clearAllFilters}
            clearLabel={t('filters.clearAll')}
            removeLabel={label => t('filters.remove', { label })}
            summary={loading ? null : hasAnyFilter || filtered.length !== total ? t('result.filtered', { filtered: filtered.length, total }) : t('result.total', { count: total })}
          />
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      <DeckIdentityFilterModal
        open={!!identityModalSinnerId}
        sinner={identityModalSinner}
        identities={identityModalIdentities}
        selectedIdentityIds={selectedIdentityIds}
        onToggleIdentity={handleModalToggleIdentity}
        onClose={() => setIdentityModalSinnerId(null)}
      />

    </div>
  )
}
