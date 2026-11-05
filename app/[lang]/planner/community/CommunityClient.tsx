'use client'

import { useLoadMoreSentinel } from '@/hooks/useLoadMoreSentinel'
import DiscoveryShelf, { type InitialShelf } from '@/components/discovery/DiscoveryShelf'
import BoardBrowseLock from '@/components/discovery/BoardBrowseLock'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQueryState, parseAsBoolean, parseAsInteger, parseAsString } from 'nuqs'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { Link2, Search, User, X } from 'lucide-react'
import { type PlanSummary } from '@/components/planner/PlanCard'
import { BoardResults, BrowseBar } from '@/components/board/Browse'
import type { RowPost } from '@/components/board/parts'
import { DIFFICULTY_CONFIG, type Difficulty } from '@/lib/planner/types'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import DeckIdentityFilterModal, { type DeckFilterIdentity, type DeckFilterSinner } from '@/components/decks/DeckIdentityFilterModal'
import FormationCountFilter from '@/components/decks/FormationCountFilter'
import { FacetPickerModal, FacetSections, type FacetKind } from '@/components/board/FacetPicker'
import { FilterChoice, FilterFieldHelp, FilterIconTile, FilterSection, FilterSinnerTiles, FilterTextButton, filterStyles } from '@/components/board/FilterControls'
import { hasAll, useBoardFacets } from '@/hooks/useBoardFacets'
import { decodeCollectionAsync, missingFormationCount, withBaseIdentities, type CollectionData } from '@/lib/collection'
import { useOwnedIdentities } from '@/hooks/useOwnedIdentities'
import { parseSearchQuery, getActiveTerm, termMatchesAny } from '@/lib/utils/search'
import { THEME_KEYWORDS } from '@/lib/constants/keywords'
import { normalizePlannerListKeywords } from '@/lib/planner/stripPlanForList'
import { useLocale, useTranslations } from 'next-intl'
import {
  localizeDeckKeyword,
} from '@/components/decks/decks-types'
import { getIdentityPortraitUrl, getIdentityInfoUrl } from '@/lib/utils/images'
import type { SupportedLang } from '@/lib/i18n'
import Sheet from '@/components/ui/Sheet'

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
  release_date?: string | null
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
// A multiple of 6, so every page fills whole rows of the one-, two- and three-column grids.
const PAGE_SIZE = 24
const QUERY_OPTIONS = { history: 'replace', shallow: true, scroll: false } as const
const COMBAT_KEYWORDS = ['참격', '관통', '타격'] as const
const IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS = 'id, sinner_id, name_kr, name_en, name_jp, rarity, release_date, keywords, skill_keyword_list, folder_name, game_id, hp, speed_min, speed_max, def_level, sinner:sinners(id, name_kr, order_num)'
const IDENTITY_FILTER_SELECT_LEGACY = 'id, sinner_id, name_kr, name_en, name_jp, rarity, release_date, keywords, folder_name, game_id, hp, speed_min, speed_max, def_level, sinner:sinners(id, name_kr, order_num)'

const DIFFICULTY_COLOR: Record<string, string> = { normal: '#4a9868', hard: '#e8b030', overlap: '#48b0c0', extreme: '#ec6a5e' }


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
    name: identity.name_kr,
    name_kr: identity.name_kr,
    name_en: identity.name_en,
    name_jp: identity.name_jp,
    rarity: identity.rarity,
    release_date: identity.release_date ?? undefined,
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
  initialShelf?: InitialShelf
}

export default function CommunityClient({ initialPlans, initialTotal, initialShelf }: CommunityClientProps) {
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
  const [keywordQuery, setKeywordQuery] = useQueryState('kt', parseAsString.withDefault(''))
  const [keywordModeQuery, setKeywordModeQuery] = useQueryState('ktm', parseAsString.withDefault('or'))
  const [identityIdsQuery, setIdentityIdsQuery] = useQueryState('ids', parseAsString.withDefault(''))
  const [identityModeQuery, setIdentityModeQuery] = useQueryState('im', parseAsString.withDefault('or'))
  // 소속·E.G.O·기프트·테마팩: 고른 것을 모두 담은 글만 남긴다
  const [affiliationQuery, setAffiliationQuery] = useQueryState('af', parseAsString.withDefault(''))
  const [egoQuery, setEgoQuery] = useQueryState('eg', parseAsString.withDefault(''))
  const [giftQuery, setGiftQuery] = useQueryState('gf', parseAsString.withDefault(''))
  const [themeQuery, setThemeQuery] = useQueryState('tp', parseAsString.withDefault(''))
  const facetSelections: Record<FacetKind, string[]> = {
    affiliation: parseCsvParam(affiliationQuery), ego: parseCsvParam(egoQuery), gift: parseCsvParam(giftQuery), theme: parseCsvParam(themeQuery),
  }
  const facetSetters = { affiliation: setAffiliationQuery, ego: setEgoQuery, gift: setGiftQuery, theme: setThemeQuery }
  const toggleFacet = (kind: FacetKind, id: string) => {
    const next = new Set(facetSelections[kind])
    if (next.has(id)) next.delete(id)
    else next.add(id)
    void facetSetters[kind](serializeCsvParam(next) || null, QUERY_OPTIONS)
  }
  const [facetModal, setFacetModal] = useState<FacetKind | null>(null)
  const facetData = useBoardFacets('planner').data
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
  const [showKeywordFilter, setShowKeywordFilter] = useState(true)
  const [showIdentityFilter, setShowIdentityFilter] = useState(true)
  const [showFormationFilter, setShowFormationFilter] = useState(true)
  const [identityModalSinnerId, setIdentityModalSinnerId] = useState<string | null>(null)

  // 컬렉션 필터
  const [showCollectionFilter, setShowCollectionFilter] = useState(true)
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
  }, [normalizedSort, difficulty, activeKeywordList, keywordMode, selectedIdentityIdList, identityMode, formationCount])

  const buildPlannerSearchParams = useCallback((offset: number) => {
    const params = new URLSearchParams(serverQueryKey)
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(offset))
    return params
  }, [serverQueryKey])

  // Only browsing all or searching shows the list; the default view is the discovery shelf, so nothing is loaded for it.
  const listVisible = browse === 'all' || Boolean(search || keywordQuery || identityIdsQuery)

  useEffect(() => {
    if (!listVisible) return
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
  }, [listVisible, serverQueryKey, buildPlannerSearchParams, initialPlans, initialTotal]) // eslint-disable-line react-hooks/exhaustive-deps

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

    const { affiliation, ego, gift, theme } = facetSelections
    if (affiliation.length) list = list.filter(({ affiliations }) => hasAll(affiliation, affiliations))
    if (ego.length) list = list.filter(({ egoIds }) => hasAll(ego, new Set(egoIds)))
    if (gift.length) list = list.filter(({ giftIds }) => hasAll(gift, giftIds))
    if (theme.length) list = list.filter(({ themeIds }) => hasAll(theme, themeIds))

    return list.map(({ plan }) => plan)
  }, [planIndexes, debouncedSearch, activeKeywordList, keywordMode, selectedIdentityIdList, identityMode, filterOwnedIdentity, filterOwnedEgo, effectiveOwned, affiliationQuery, egoQuery, giftQuery, themeQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  const collectionFilterCount = (filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0)
  const totalActiveCount = (inputValue.trim() ? 1 : 0) + (difficulty ? 1 : 0) + (formationCount !== null ? 1 : 0) + activeKeywords.size + selectedIdentityIds.size + collectionFilterCount + Object.values(facetSelections).reduce((sum, list) => sum + list.length, 0)
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

  const filterSurface = (
    <div className={filterStyles.surface}>
      <section>
        <div className="relative" ref={searchRef}>
          <label className={filterStyles.field}>
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              value={inputValue}
              onChange={e => { setInputValue(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('search.placeholder')}
              className={filterStyles.fieldInput}
              aria-label={t('search.label')}
            />
            {inputValue ? (
              <button type="button" onClick={() => { setInputValue(''); setShowSuggestions(false); setAcIndex(-1) }} aria-label={t('search.clear')}>
                <X size={14} aria-hidden="true" />
              </button>
            ) : <FilterFieldHelp text={t('search.hint')} />}
          </label>
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
              <div className="px-2.5 py-1" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', fontSize: '0.6875rem', fontWeight: 600 }}>
                {t('search.suggestionHeading')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('search.suggestionHint')}</span>
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
                    <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {sg.type === 'identity' ? t('search.suggestionIdentity') : t('search.suggestionKeyword')}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <FilterSection label={t('sort.label')}>
        <div className={filterStyles.choices}>
          {(['latest', 'popular'] as SortKey[]).map(key => (
            <FilterChoice key={key} active={normalizedSort === key} onClick={() => setSort(key)}>{t(`sort.${key}`)}</FilterChoice>
          ))}
        </div>
      </FilterSection>

      <FilterSection label={t('filters.difficulty')}>
        <div className={filterStyles.choices}>
          <FilterChoice active={!difficulty} onClick={() => setDifficulty(null)}>{t('filters.all')}</FilterChoice>
          {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(key => {
            const active = difficulty === key
            return <FilterChoice key={key} active={active} tone={DIFFICULTY_COLOR[key]} onClick={() => setDifficulty(active ? null : key)}>{t(`difficulty.${key}`)}</FilterChoice>
          })}
        </div>
      </FilterSection>

      <FilterSection
        label={t('filters.keywords')}
        count={activeKeywords.size}
        open={showKeywordFilter}
        onToggle={() => setShowKeywordFilter(v => !v)}
        end={<>
          {activeKeywords.size >= 2 && <FilterTextButton onClick={toggleKeywordMode} aria-pressed={keywordMode === 'and'} aria-label={t('filters.keywordModeToggle')}>{keywordMode === 'and' ? t('filters.and') : t('filters.or')}</FilterTextButton>}
          {activeKeywords.size > 0 && <FilterTextButton onClick={() => { void setKeywordQuery(null, QUERY_OPTIONS) }}>{t('filters.clear')}</FilterTextButton>}
        </>}
      >
        <div className={filterStyles.tiles}>
          {availableKeywords.map(kw => (
            <FilterIconTile key={kw} active={activeKeywords.has(kw)} label={localKeyword(kw)} iconUrl={getIconUrl(kw)} onClick={() => toggleKeyword(kw)} />
          ))}
        </div>
      </FilterSection>

      <FilterSection
        label={t('filters.identity')}
        count={selectedIdentityIds.size}
        open={showIdentityFilter}
        onToggle={() => setShowIdentityFilter(v => !v)}
        end={<>
          {selectedIdentityIds.size >= 2 && <FilterTextButton onClick={toggleIdentityMode} aria-pressed={identityMode === 'and'} aria-label={t('filters.identityModeToggle')}>{identityMode === 'and' ? t('filters.and') : t('filters.or')}</FilterTextButton>}
          {selectedIdentityIds.size > 0 && <FilterTextButton onClick={() => { void setIdentityIdsQuery(null, QUERY_OPTIONS) }}>{t('filters.clear')}</FilterTextButton>}
        </>}
      >
        <FilterSinnerTiles
          sinners={identityFilterSinners}
          picked={selectedIdentitiesBySinner}
          image={getIdentityInfoUrl}
          groupLabel={t('filters.identity')}
          label={(sinner, count) => `${localizeSinnerName(sinner)} ${t('identityFilter.fallbackTitle')}${count > 0 ? `, ${count} ${t('filters.identitySelected')}` : ''}`}
          onOpen={setIdentityModalSinnerId}
        />
      </FilterSection>

      <FacetSections kinds={['affiliation', 'ego', 'gift', 'theme']} facets={facetData} selections={facetSelections}
        onRemove={toggleFacet} onOpen={setFacetModal} />

      <FilterSection
        label={rootT('decks.filters.formationCount')}
        count={formationCount !== null ? 1 : 0}
        open={showFormationFilter}
        onToggle={() => setShowFormationFilter(v => !v)}
      >
        <FormationCountFilter value={formationCount} onChange={value => { void setFormationCountQuery(value, QUERY_OPTIONS) }} />
      </FilterSection>

      <FilterSection
        label={t('filters.collection')}
        count={collectionFilterCount}
        open={showCollectionFilter}
        onToggle={() => setShowCollectionFilter(v => !v)}
        end={(hasCollection || filterOwnedIdentity || filterOwnedEgo || codeInput || codeError || collectionLoading) && <FilterTextButton onClick={clearCollectionFilters}>{t('filters.clear')}</FilterTextButton>}
      >
        <div className={filterStyles.choices}>
          <FilterChoice active={filterOwnedIdentity} onClick={() => { void toggleFilterOwnedIdentity() }}>{t('filters.ownedIdentityPlan')}</FilterChoice>
          <FilterChoice active={filterOwnedEgo} onClick={() => { void toggleFilterOwnedEgo() }}>{t('filters.ownedEgoPlan')}</FilterChoice>
        </div>
        {collectionLoading && <p className={filterStyles.hint} role="status">{t('filters.collectionLoading')}</p>}
        {!hasCollection && (
          <div className="mt-2 flex items-center gap-2">
            <label className={`${filterStyles.field} min-w-0 flex-1`} data-invalid={codeError || undefined}>
              <Link2 size={15} aria-hidden="true" />
              <input
                type="text"
                value={codeInput}
                onChange={e => { setCodeInput(e.target.value); setCodeError(false) }}
                onKeyDown={e => { if (e.key === 'Enter') applyCollectionCode(codeInput) }}
                placeholder={t('filters.collectionCodePlaceholder')}
                className={filterStyles.fieldInput}
                aria-label={t('filters.collectionCodeLabel')}
              />
            </label>
            <button type="button" className={filterStyles.action} onClick={() => applyCollectionCode(codeInput)} disabled={collectionLoading}>{t('filters.apply')}</button>
          </div>
        )}
        {codeError && <p className={filterStyles.hint} role="alert" style={{ color: 'var(--error-text)' }}>{t('filters.invalidCode')}</p>}
      </FilterSection>
    </div>
  )

  if (!listVisible) return <DiscoveryShelf kind="planner" initialData={initialShelf} onBrowse={() => setBrowse('all', { history: 'push' })} />

  return (
    <div data-board-browse className="relative min-h-0 flex-1 px-4 pb-4 md:px-6 lg:overflow-hidden">
      <BoardBrowseLock />
      <div className="relative z-[1] mx-auto flex h-full min-h-0 w-full max-w-7xl gap-5">
        <aside
          className="board-filters hidden h-full shrink-0 overflow-y-auto pr-3 lg:block"
          aria-label={t('filters.aside')}
        >
          {filterSurface}
        </aside>

        <div ref={scrollRootRef} className="min-h-0 flex-1 pb-16 lg:overflow-y-auto lg:pr-1">
          <BrowseBar
            search={{ value: inputValue, onChange: v => { setInputValue(v); setShowSuggestions(false) }, onClear: () => { setInputValue(''); setShowSuggestions(false); setAcIndex(-1) }, placeholder: t('search.placeholder'), label: t('search.label') }}
            filterCount={totalActiveCount}
            onOpenFilters={() => setMobileFiltersOpen(true)}
            summary={loading ? '' : hasAnyFilter || filtered.length !== total ? t('result.filtered', { filtered: filtered.length, total }) : t('result.total', { count: total })}
          />

          <BoardResults kind="planner" posts={filtered as unknown as RowPost[]} loading={loading} hasMore={hasMore} loadingMore={loadingMore} sentinelRef={sentinelRef}
            empty={(
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-[1rem] text-[var(--text-secondary)]">{debouncedSearch.trim() ? t('grid.noSearchResults', { query: debouncedSearch }) : t('grid.empty')}</p>
                {!debouncedSearch.trim() && <Link href="/planner" className="min-h-11 content-center text-[0.9375rem] font-semibold text-[var(--gold-light)] underline-offset-4 hover:underline">{t('grid.createFirst')}</Link>}
              </div>
            )} />
        </div>
      </div>

      <Sheet open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} title={t('filters.button')} closeLabel={t('filters.close')}>
        <div className="px-5 py-4">
          {filterSurface}
        </div>
      </Sheet>

      <FacetPickerModal kind={facetModal} facets={facetData} selected={facetModal ? facetSelections[facetModal] : []}
        onToggle={id => { if (facetModal) toggleFacet(facetModal, id) }} onClose={() => setFacetModal(null)} />

      <DeckIdentityFilterModal
        open={identityModalSinnerId !== null}
        sinnerId={identityModalSinnerId ?? ''}
        sinners={identityFilterSinners}
        identities={filterIdentities}
        selectedIdentityIds={selectedIdentityIds}
        onToggleIdentity={toggleSelectedIdentity}
        onClearIdentities={() => { void setIdentityIdsQuery(null, QUERY_OPTIONS) }}
        onSinnerChange={setIdentityModalSinnerId}
        onClose={() => setIdentityModalSinnerId(null)}
      />

    </div>
  )
}
