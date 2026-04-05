'use client'

import { useMemo, useEffect, useRef, useCallback, useState } from 'react'
import Image from 'next/image'
import { Search, X } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import GiftCard from '@/components/mirror-dungeon/GiftCard'
import GradeMultiDropdown from '@/components/mirror-dungeon/GradeMultiDropdown'
import type { EgoGift, EgoGiftTheme } from '@/components/mirror-dungeon/types'
import { KEYWORD_COLORS, GRADE_LABELS } from '@/components/mirror-dungeon/types'

const KEYWORDS = [
  { key: '전체', label: '전체' },
  { key: '화상', label: '화상' },
  { key: '출혈', label: '출혈' },
  { key: '진동', label: '진동' },
  { key: '파열', label: '파열' },
  { key: '침잠', label: '침잠' },
  { key: '호흡', label: '호흡' },
  { key: '충전', label: '충전' },
  { key: '참격', label: '참격' },
  { key: '관통', label: '관통' },
  { key: '타격', label: '타격' },
  { key: '공통', label: '공통' },
]

const GRADE_ORDER: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, 'EX': 6 }
const PAGE_SIZE = 40

interface GiftTabProps {
  gifts: EgoGift[]
  themes: EgoGiftTheme[]
  // URL-synced filter state (passed from parent to keep URL-sync in one place)
  search: string
  keywords: Set<string>
  grades: Set<string>
  tiers: Set<string>
  sortBy: 'default' | 'name' | 'grade'
  sortDesc: boolean
  slotFilter: string
  selectedThemeId: number | null
  themeGiftNames: Set<string> | null
  giftSlotMap: Map<string, Set<number>>
  inputValue: string
  setInputValue: (v: string) => void
  setSearch: (v: string) => void
  setKeywords: (fn: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  setGrades: (fn: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  setTiers: (fn: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  setSortBy: (v: 'default' | 'name' | 'grade') => void
  setSortDesc: (v: boolean | ((prev: boolean) => boolean)) => void
  setSlotFilter: (v: string) => void
  setSelectedThemeId: (v: number | null) => void
  getGiftKeywordIcon: (keyword: string) => string | null
  recipeMap: Map<string, import('./types').Recipe>
  giftImageMap: Map<string, string>
  onSelectGift: (gift: EgoGift) => void
}

export default function GiftTab({
  gifts,
  themes,
  search,
  keywords,
  grades,
  tiers,
  sortBy,
  sortDesc,
  slotFilter,
  themeGiftNames,
  giftSlotMap,
  inputValue,
  setInputValue,
  setSearch,
  setKeywords,
  setGrades,
  setTiers,
  setSortBy,
  setSortDesc,
  setSlotFilter,
  selectedThemeId,
  setSelectedThemeId,
  getGiftKeywordIcon,
  onSelectGift,
}: GiftTabProps) {
  const toggleKeyword = useCallback(
    (key: string) => {
      setKeywords(prev => {
        if (key === '전체') return new Set()
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    },
    [setKeywords]
  )

  const toggleGrade = useCallback(
    (g: string) => {
      setGrades(prev => {
        if (g === '전체') return new Set()
        const next = new Set(prev)
        if (next.has(g)) next.delete(g)
        else next.add(g)
        return next
      })
    },
    [setGrades]
  )

  const filtered = useMemo(() => {
    const DIFF_ORDER = { '노말': 0, '하드': 1, '익스트림': 2 } as const
    const slotNum = slotFilter !== '전체' ? Number(slotFilter) : null
    const result = gifts.filter(g => {
      if (keywords.size > 0 && !keywords.has(g.keyword)) return false
      if (grades.size > 0 && !grades.has(g.grade)) return false
      if (tiers.size > 0 && !g.is_synthesis) {
        const selected = [...tiers][0] as keyof typeof DIFF_ORDER
        const giftDiff = (g.difficulty || '노말') as keyof typeof DIFF_ORDER
        const selectedIdx = DIFF_ORDER[selected] ?? 2
        const giftIdx = DIFF_ORDER[giftDiff] ?? 0
        if (giftIdx > selectedIdx) return false
      }
      if (slotNum !== null) {
        const slots = giftSlotMap.get(g.id)
        if (!slots || !slots.has(slotNum)) return false
      }
      if (search && !g.name.includes(search)) return false
      if (themeGiftNames && !themeGiftNames.has(g.name)) return false
      return true
    })

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    } else if (sortBy === 'grade') {
      result.sort((a, b) => (GRADE_ORDER[a.grade] ?? 0) - (GRADE_ORDER[b.grade] ?? 0))
    }

    if (sortDesc) result.reverse()
    return result
  }, [gifts, keywords, grades, tiers, search, sortBy, sortDesc, themeGiftNames, slotFilter, giftSlotMap])

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    loadingRef.current = false
  }, [filtered])

  const visibleGifts = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])

  const filteredLenRef = useRef(filtered.length)
  filteredLenRef.current = filtered.length

  // IntersectionObserver for lazy loading
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    loadingRef.current = false
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingRef.current) {
          loadingRef.current = true
          setVisibleCount(prev => {
            const next = Math.min(prev + PAGE_SIZE, filteredLenRef.current)
            setTimeout(() => { loadingRef.current = false }, 100)
            return next
          })
        }
      },
      { rootMargin: '600px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [visibleCount, filtered.length])

  return (
    <div className="space-y-3 mb-8">
      {/* 키워드 필터 */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
        {KEYWORDS.map(kw => {
          const isAll = kw.key === '전체'
          const active = isAll ? keywords.size === 0 : keywords.has(kw.key)
          const kwColor = !isAll ? (KEYWORD_COLORS[kw.key] ?? '#666') : 'var(--gold)'
          const iconUrl = !isAll ? getGiftKeywordIcon(kw.key) : null
          return (
            <button
              key={kw.key}
              onClick={() => toggleKeyword(kw.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
              style={{
                cursor: 'pointer',
                background: active ? kwColor : 'rgba(255,255,255,0.04)',
                color: active ? '#0d0b08' : '#666',
                border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.06)'}`,
                fontFamily: 'var(--font-heading)',
                boxShadow: active && !isAll ? `0 0 0.75rem ${KEYWORD_COLORS[kw.key] ?? '#666'}30` : 'none',
              }}
            >
              {iconUrl && (
                <Image
                  src={iconUrl}
                  alt={kw.label}
                  width={14}
                  height={14}
                  style={{ opacity: active ? 0.9 : 0.4, width: '0.875rem', height: '0.875rem' }}
                />
              )}
              {kw.label}
            </button>
          )
        })}
      </div>

      {/* 컨트롤 바 */}
      <div
        className="flex items-center gap-3 flex-wrap rounded-lg"
        style={{
          padding: '0.5rem 0.75rem',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* 필터 드롭다운 그룹 */}
        <div className="flex items-center gap-2 flex-wrap">
          <GradeMultiDropdown grades={grades} toggleGrade={toggleGrade} />
          <Dropdown
            value={tiers.size === 0 ? '전체' : [...tiers][0]}
            options={[
              { value: '전체', label: '전체' },
              { value: '노말', label: '노말' },
              { value: '하드', label: '하드' },
              { value: '익스트림', label: '익스트림' },
            ]}
            onChange={v => {
              if (v === '전체') setTiers(new Set())
              else setTiers(new Set([v]))
            }}
            prefix="난이도:"
            defaultValue="전체"
            minWidth={120}
          />
          <Dropdown
            value={slotFilter}
            options={[
              { value: '전체', label: '전체' },
              ...Array.from({ length: 8 }, (_, i) => ({ value: `${i + 1}`, label: `${i + 1}번` })),
            ]}
            onChange={v => setSlotFilter(v)}
            prefix="편성 전용:"
            defaultValue="전체"
            minWidth={120}
          />
          <Dropdown
            value={selectedThemeId !== null ? String(selectedThemeId) : '전체'}
            options={[
              { value: '전체', label: '전체' },
              ...themes.map(t => ({ value: String(t.id), label: t.name })),
            ]}
            onChange={v => setSelectedThemeId(v === '전체' ? null : Number(v))}
            prefix="테마팩:"
            defaultValue="전체"
            minWidth={140}
          />
        </div>

        {/* 구분선 */}
        <div
          className="hidden sm:block flex-shrink-0"
          style={{ width: '1px', height: '1.25rem', background: 'rgba(255,255,255,0.06)' }}
        />

        {/* 정렬 + 검색 그룹 */}
        <div className="flex items-center gap-2 ml-auto">
          {/* 세그먼트 정렬 */}
          <div
            className="flex items-center overflow-hidden rounded-md"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {(['default', 'name', 'grade'] as const).map((key, i, arr) => {
              const labels = { default: '기본', name: '이름', grade: '등급' }
              const isSort = sortBy === key
              return (
                <button
                  key={key}
                  onClick={() => {
                    if (sortBy === key && key !== 'default') setSortDesc(v => !v)
                    else {
                      setSortBy(key)
                      setSortDesc(false)
                    }
                  }}
                  className="transition-colors"
                  style={{
                    padding: '0.375rem 0.625rem',
                    fontSize: '0.6875rem',
                    background: isSort ? 'rgba(200,144,10,0.12)' : 'transparent',
                    color: isSort ? 'var(--gold)' : '#555',
                    fontFamily: 'var(--font-heading)',
                    cursor: 'pointer',
                    borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  {labels[key]}
                  {isSort && key !== 'default' && (sortDesc ? ' ↓' : ' ↑')}
                </button>
              )
            })}
          </div>

          {/* 검색 */}
          <div className="relative">
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.625rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#444',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="기프트 검색..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="pl-8 pr-7 py-1.5 rounded-md text-xs w-36 sm:w-44"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#ccc',
                outline: 'none',
              }}
            />
            {(inputValue || search) && (
              <button
                onClick={() => {
                  setInputValue('')
                  setSearch('')
                }}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#555',
                  cursor: 'pointer',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* 결과 수 */}
          <span
            className="flex-shrink-0 tabular-nums"
            style={{ color: '#555', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}
          >
            {filtered.length}
            <span style={{ fontSize: '0.5625rem', marginLeft: '1px' }}>건</span>
          </span>
        </div>
      </div>

      {/* 활성 필터 칩 */}
      {(keywords.size > 0 || grades.size > 0 || tiers.size > 0 || slotFilter !== '전체') && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            style={{
              color: '#3a3530',
              fontSize: '0.625rem',
              fontFamily: 'var(--font-heading)',
              marginRight: '0.125rem',
            }}
          >
            필터
          </span>
          {[...keywords].map(kw => {
            const c = KEYWORD_COLORS[kw] ?? '#666'
            const iconUrl = getGiftKeywordIcon(kw)
            return (
              <button
                key={`fk-${kw}`}
                onClick={() => toggleKeyword(kw)}
                className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full transition-colors hover:brightness-125"
                style={{
                  background: `${c}15`,
                  border: `1px solid ${c}25`,
                  color: c,
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-heading)',
                  cursor: 'pointer',
                }}
              >
                {iconUrl && (
                  <Image src={iconUrl} alt="" width={10} height={10} style={{ width: '0.625rem', height: '0.625rem' }} />
                )}
                {kw}
                <X size={10} style={{ opacity: 0.5 }} />
              </button>
            )
          })}
          {[...grades].map(g => (
            <button
              key={`fg-${g}`}
              onClick={() => toggleGrade(g)}
              className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full transition-colors hover:brightness-125"
              style={{
                background: 'rgba(200,144,10,0.1)',
                border: '1px solid rgba(200,144,10,0.2)',
                color: 'var(--gold)',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
              }}
            >
              등급 {GRADE_LABELS[g] ?? g}
              <X size={10} style={{ opacity: 0.5 }} />
            </button>
          ))}
          {[...tiers].map(t => (
            <button
              key={`ft-${t}`}
              onClick={() => setTiers(new Set())}
              className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full transition-colors hover:brightness-125"
              style={{
                background:
                  t === '익스트림'
                    ? 'rgba(224,64,64,0.1)'
                    : t === '하드'
                    ? 'rgba(232,144,48,0.1)'
                    : 'rgba(255,255,255,0.05)',
                border: `1px solid ${
                  t === '익스트림'
                    ? 'rgba(224,64,64,0.2)'
                    : t === '하드'
                    ? 'rgba(232,144,48,0.2)'
                    : 'rgba(255,255,255,0.08)'
                }`,
                color: t === '익스트림' ? '#e04040' : t === '하드' ? '#e89030' : '#888',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
              }}
            >
              {t}
              <X size={10} style={{ opacity: 0.5 }} />
            </button>
          ))}
          {slotFilter !== '전체' && (
            <button
              onClick={() => setSlotFilter('전체')}
              className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full transition-colors hover:brightness-125"
              style={{
                background: 'rgba(200,144,10,0.1)',
                border: '1px solid rgba(200,144,10,0.2)',
                color: 'var(--gold)',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
              }}
            >
              {slotFilter}번 전용
              <X size={10} style={{ opacity: 0.5 }} />
            </button>
          )}
          <button
            onClick={() => {
              setKeywords(new Set())
              setGrades(new Set())
              setTiers(new Set())
              setSlotFilter('전체')
              setInputValue('')
              setSearch('')
            }}
            className="ml-auto px-2 py-0.5 rounded-full transition-colors hover:bg-white/5"
            style={{
              color: '#444',
              fontSize: '0.625rem',
              fontFamily: 'var(--font-heading)',
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            초기화
          </button>
        </div>
      )}

      {/* 그리드 */}
      {filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: '#555' }}>
          <p className="text-lg font-serif mb-2">결과 없음</p>
          <p className="text-sm" style={{ color: '#3a3530' }}>
            필터를 변경하거나 검색어를 확인해 보세요.
          </p>
        </div>
      ) : (
        <>
          <div
            className="gift-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(4.5rem, 1fr))',
              gap: '0.5rem',
              position: 'relative',
              zIndex: 0,
            }}
          >
            {visibleGifts.map((gift, i) => (
              <div
                key={gift.id}
                style={{
                  contentVisibility: 'auto',
                  containIntrinsicSize: 'auto 6rem',
                  animation: 'giftCardFadeIn 0.25s ease-out both',
                  animationDelay: `${(i % PAGE_SIZE) * 0.008}s`,
                }}
              >
                <GiftCard gift={gift} onClick={() => onSelectGift(gift)} />
              </div>
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              <div className="flex items-center gap-2">
                <div
                  className="animate-spin"
                  style={{
                    width: '0.875rem',
                    height: '0.875rem',
                    border: '2px solid rgba(200,144,10,0.15)',
                    borderTopColor: 'var(--gold)',
                    borderRadius: '50%',
                  }}
                />
                <span style={{ color: '#444', fontSize: '0.6875rem', fontFamily: 'var(--font-heading)' }}>
                  불러오는 중...
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
