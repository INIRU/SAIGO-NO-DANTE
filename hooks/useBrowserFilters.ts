'use client'

// Design Ref: §6.1 — 필터 상태 관리 커스텀 훅
import { useState, useMemo, useCallback } from 'react'
import type {
  IdentityBrowserItem,
  EGOBrowserItem,
  IdentityFilterState,
  EGOFilterState,
  SortOption,
} from '@/lib/types/browser'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'

// ── 유틸: Set 토글 ──────────────────────────────────────────────────────────
function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

// ── 인격 필터 초기 상태 ──────────────────────────────────────────────────────
function createIdentityFilterState(): IdentityFilterState {
  return {
    sinners: new Set(),
    keywords: new Set(),
    sins: new Set(),
    rarities: new Set(),
    atkTypes: new Set(),
    atkWeights: new Set(),
    coinCounts: new Set(),
  }
}

// ── EGO 필터 초기 상태 ──────────────────────────────────────────────────────
function createEGOFilterState(): EGOFilterState {
  return {
    sinners: new Set(),
    keywords: new Set(),
    sins: new Set(),
    grades: new Set(),
  }
}

// ── 활성 필터 수 ─────────────────────────────────────────────────────────────
function countActive(f: IdentityFilterState | EGOFilterState): number {
  let n = f.sinners.size + f.keywords.size + f.sins.size
  if ('rarities' in f) n += f.rarities.size + f.atkTypes.size + f.atkWeights.size + f.coinCounts.size
  if ('grades' in f) n += f.grades.size
  return n
}

// ═════════════════════════════════════════════════════════════════════════════
// 인격 브라우저 필터
// ═════════════════════════════════════════════════════════════════════════════

export function useIdentityBrowserFilters(items: IdentityBrowserItem[]) {
  const [filters, setFilters] = useState(createIdentityFilterState)
  const [sort, setSort] = useState<SortOption>('default')

  const toggle = useCallback((key: keyof IdentityFilterState, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: toggleInSet(prev[key] as Set<unknown>, value) }))
  }, [])

  const resetAll = useCallback(() => setFilters(createIdentityFilterState), [])

  // Plan SC: SC-02 필터 변경 시 100ms 이내 반영 (useMemo)
  const filtered = useMemo(() => {
    return items.filter(item => {
      // 수감자 (OR)
      if (filters.sinners.size > 0 && !filters.sinners.has(item.sinner_id)) return false
      // 등급 (OR)
      if (filters.rarities.size > 0 && !filters.rarities.has(item.rarity)) return false
      // 죄악 (OR) — 스킬 기준
      if (filters.sins.size > 0 && !item.skill_sins.some(s => filters.sins.has(s))) return false
      // 공격 유형 (OR)
      if (filters.atkTypes.size > 0 && !item.skill_types.some(t => filters.atkTypes.has(t))) return false
      // 가중치 (OR)
      if (filters.atkWeights.size > 0 && !item.atk_weights.some(w => filters.atkWeights.has(w))) return false
      // 코인 수 (OR)
      if (filters.coinCounts.size > 0 && !item.coin_counts.some(c => filters.coinCounts.has(c))) return false
      // 키워드 (AND — 선택된 모든 키워드 보유해야, 특수 충전→충전 매핑)
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

  const activeCount = useMemo(() => countActive(filters), [filters])

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

export function useEGOBrowserFilters(items: EGOBrowserItem[]) {
  const [filters, setFilters] = useState(createEGOFilterState)
  const [sort, setSort] = useState<SortOption>('default')

  const toggle = useCallback((key: keyof EGOFilterState, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: toggleInSet(prev[key] as Set<unknown>, value) }))
  }, [])

  const resetAll = useCallback(() => setFilters(createEGOFilterState), [])

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

  const activeCount = useMemo(() => countActive(filters), [filters])

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
