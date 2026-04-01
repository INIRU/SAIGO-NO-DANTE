'use client'

// Design Ref: §6.1 — 필터 상태 관리 커스텀 훅 (nuqs URL 동기화)
import { useMemo, useCallback } from 'react'
import { useQueryStates, parseAsString } from 'nuqs'
import type {
  IdentityBrowserItem,
  EGOBrowserItem,
  IdentityFilterState,
  EGOFilterState,
  SortOption,
} from '@/lib/types/browser'
import type { SinType } from '@/lib/types'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'

// ── URL ↔ Set 변환 유틸 ─────────────────────────────────────────────────────
function toStringSet(param: string): Set<string> {
  return new Set(param.split(',').filter(Boolean))
}
function toNumSet(param: string): Set<number> {
  return new Set(param.split(',').filter(Boolean).map(Number).filter(n => !isNaN(n)))
}
function fromSet<T>(set: Set<T>): string | null {
  return set.size > 0 ? Array.from(set).join(',') : null
}

// ── Set 토글 (URL param 문자열 기준) ────────────────────────────────────────
function toggleString(param: string, value: string): string | null {
  const set = toStringSet(param)
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return fromSet(set)
}
function toggleNum(param: string, value: number): string | null {
  const set = toNumSet(param)
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return fromSet(set)
}

// ── 활성 필터 수 ─────────────────────────────────────────────────────────────
function countActiveIdentity(f: IdentityFilterState): number {
  return f.sinners.size + f.keywords.size + f.sins.size +
    f.rarities.size + f.seasons.size + f.atkTypes.size + f.atkWeights.size + f.coinCounts.size
}
function countActiveEGO(f: EGOFilterState): number {
  return f.sinners.size + f.keywords.size + f.sins.size + f.grades.size
}

// ═════════════════════════════════════════════════════════════════════════════
// 인격 브라우저 필터
// ═════════════════════════════════════════════════════════════════════════════

const identityParams = {
  sinners: parseAsString.withDefault(''),
  keywords: parseAsString.withDefault(''),
  sins: parseAsString.withDefault(''),
  rarities: parseAsString.withDefault(''),
  seasons: parseAsString.withDefault(''),
  atkTypes: parseAsString.withDefault(''),
  atkWeights: parseAsString.withDefault(''),
  coinCounts: parseAsString.withDefault(''),
  sort: parseAsString.withDefault('default'),
}

export function useIdentityBrowserFilters(items: IdentityBrowserItem[]) {
  const [params, setParams] = useQueryStates(identityParams)

  const filters = useMemo<IdentityFilterState>(() => ({
    sinners: toStringSet(params.sinners),
    keywords: toStringSet(params.keywords),
    sins: toStringSet(params.sins) as Set<SinType>,
    rarities: toNumSet(params.rarities),
    seasons: toNumSet(params.seasons),
    atkTypes: toStringSet(params.atkTypes),
    atkWeights: toNumSet(params.atkWeights),
    coinCounts: toNumSet(params.coinCounts),
  }), [params.sinners, params.keywords, params.sins, params.rarities, params.seasons, params.atkTypes, params.atkWeights, params.coinCounts])

  const sort = (params.sort || 'default') as SortOption
  const setSort = useCallback((v: SortOption) => {
    setParams({ sort: v === 'default' ? null : v })
  }, [setParams])

  const toggle = useCallback((key: keyof IdentityFilterState, value: unknown) => {
    const numKeys = ['rarities', 'seasons', 'atkWeights', 'coinCounts'] as const
    if ((numKeys as readonly string[]).includes(key)) {
      setParams({ [key]: toggleNum(params[key], value as number) })
    } else {
      setParams({ [key]: toggleString(params[key], value as string) })
    }
  }, [params, setParams])

  const resetAll = useCallback(() => {
    setParams({
      sinners: null, keywords: null, sins: null, rarities: null,
      seasons: null, atkTypes: null, atkWeights: null, coinCounts: null,
    })
  }, [setParams])

  // Plan SC: SC-02 필터 변경 시 100ms 이내 반영 (useMemo)
  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filters.sinners.size > 0 && !filters.sinners.has(item.sinner_id)) return false
      if (filters.rarities.size > 0 && !filters.rarities.has(item.rarity)) return false
      if (filters.seasons.size > 0 && !filters.seasons.has(item.season)) return false
      if (filters.sins.size > 0 && !item.skill_sins.some(s => filters.sins.has(s))) return false
      if (filters.atkTypes.size > 0 && !item.skill_types.some(t => filters.atkTypes.has(t))) return false
      if (filters.atkWeights.size > 0 && !item.atk_weights.some(w => filters.atkWeights.has(w))) return false
      if (filters.coinCounts.size > 0 && !item.coin_counts.some(c => filters.coinCounts.has(c))) return false
      if (filters.keywords.size > 0) {
        const normalizedItemKws = item.keywords.map(normalizeThemeKeyword)
        for (const kw of filters.keywords) {
          if (!normalizedItemKws.includes(kw) && !item.keywords.includes(kw)) return false
        }
      }
      return true
    })
  }, [items, filters])

  const sorted = useMemo(() => {
    if (sort === 'default') return filtered
    const arr = [...filtered]
    if (sort === 'name') arr.sort((a, b) => (a.name_kr || a.name).localeCompare(b.name_kr || b.name, 'ko'))
    if (sort === 'rarity') arr.sort((a, b) => b.rarity - a.rarity)
    return arr
  }, [filtered, sort])

  const activeCount = useMemo(() => countActiveIdentity(filters), [filters])

  return {
    filters, sort, setSort,
    items: sorted,
    totalCount: items.length,
    filteredCount: sorted.length,
    activeCount,
    toggle,
    resetAll,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// EGO 브라우저 필터
// ═════════════════════════════════════════════════════════════════════════════

const GRADE_ORDER: Record<string, number> = { ZAYIN: 0, TETH: 1, HE: 2, WAW: 3, ALEPH: 4 }

const egoParams = {
  sinners: parseAsString.withDefault(''),
  keywords: parseAsString.withDefault(''),
  sins: parseAsString.withDefault(''),
  grades: parseAsString.withDefault(''),
  sort: parseAsString.withDefault('default'),
}

export function useEGOBrowserFilters(items: EGOBrowserItem[]) {
  const [params, setParams] = useQueryStates(egoParams)

  const filters = useMemo<EGOFilterState>(() => ({
    sinners: toStringSet(params.sinners),
    keywords: toStringSet(params.keywords),
    sins: toStringSet(params.sins) as Set<SinType>,
    grades: toStringSet(params.grades),
  }), [params.sinners, params.keywords, params.sins, params.grades])

  const sort = (params.sort || 'default') as SortOption
  const setSort = useCallback((v: SortOption) => {
    setParams({ sort: v === 'default' ? null : v })
  }, [setParams])

  const toggle = useCallback((key: keyof EGOFilterState, value: unknown) => {
    setParams({ [key]: toggleString(params[key], value as string) })
  }, [params, setParams])

  const resetAll = useCallback(() => {
    setParams({ sinners: null, keywords: null, sins: null, grades: null })
  }, [setParams])

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filters.sinners.size > 0 && !filters.sinners.has(item.sinner_id)) return false
      if (filters.grades.size > 0 && !filters.grades.has(item.grade)) return false
      if (filters.sins.size > 0) {
        if (!item.sin_affinity || !filters.sins.has(item.sin_affinity)) return false
      }
      if (filters.keywords.size > 0) {
        const kws = item.keywords ?? []
        const normalizedKws = kws.map(normalizeThemeKeyword)
        for (const kw of filters.keywords) {
          if (!normalizedKws.includes(kw) && !kws.includes(kw)) return false
        }
      }
      return true
    })
  }, [items, filters])

  const sorted = useMemo(() => {
    if (sort === 'default') return filtered
    const arr = [...filtered]
    if (sort === 'name') arr.sort((a, b) => (a.name_kr || a.name || '').localeCompare(b.name_kr || b.name || '', 'ko'))
    if (sort === 'grade') arr.sort((a, b) => (GRADE_ORDER[b.grade] ?? 0) - (GRADE_ORDER[a.grade] ?? 0))
    return arr
  }, [filtered, sort])

  const activeCount = useMemo(() => countActiveEGO(filters), [filters])

  return {
    filters, sort, setSort,
    items: sorted,
    totalCount: items.length,
    filteredCount: sorted.length,
    activeCount,
    toggle,
    resetAll,
  }
}
