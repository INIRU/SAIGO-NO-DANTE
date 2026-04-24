'use client'

import { useMemo, useEffect, useRef, useCallback, useState, useDeferredValue, memo } from 'react'
import Image from 'next/image'
import { Search, X } from 'lucide-react'
import { useLocale } from 'next-intl'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
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

const MemoGiftItem = memo(function MemoGiftItem({
  gift,
  onSelect,
  lang,
}: {
  gift: EgoGift
  onSelect: (gift: EgoGift) => void
  lang: SupportedLang
}) {
  const localizedGift = useMemo(() => ({
    ...gift,
    name: getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang),
  }), [gift, lang])
  const handleClick = useCallback(() => onSelect(gift), [gift, onSelect])
  return <GiftCard gift={localizedGift} onClick={handleClick} />
})

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
  const locale = useLocale()
  const lang = locale as SupportedLang
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return (entry as Record<string, string>)[lang] ?? (entry as Record<string, string>)['ko'] ?? key
  }

  const keywordLabels = useMemo(() => {
    const map: Record<string, string> = {
      '전체': t('mirrorDungeon.filter.all'),
      '화상': t('mirrorDungeon.filter.combustion'),
      '출혈': t('mirrorDungeon.filter.laceration'),
      '진동': t('mirrorDungeon.filter.vibration'),
      '파열': t('mirrorDungeon.filter.burst'),
      '침잠': t('mirrorDungeon.filter.sinking'),
      '호흡': t('mirrorDungeon.filter.breath'),
      '충전': t('mirrorDungeon.filter.charge'),
      '참격': t('mirrorDungeon.filter.slash'),
      '관통': t('mirrorDungeon.filter.pierce'),
      '타격': t('mirrorDungeon.filter.blunt'),
      '공통': t('mirrorDungeon.filter.common'),
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

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

  const deferredFiltered = useDeferredValue(filtered)
  const isStale = deferredFiltered !== filtered

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    loadingRef.current = false
  }, [deferredFiltered])

  const visibleGifts = useMemo(() => deferredFiltered.slice(0, visibleCount), [deferredFiltered, visibleCount])

  const selectedThemeLabel = useMemo(() => {
    if (selectedThemeId === null) return null
    const theme = themes.find(item => item.id === selectedThemeId)
    if (!theme) return null
    return getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang)
  }, [lang, selectedThemeId, themes])

  const dropdownShellClass = 'min-w-0 [&>div]:w-full [&>div>button]:min-h-[2rem] [&>div>button]:w-full [&>div>button]:min-w-0 [&>div>button]:justify-between [&>div>button]:overflow-hidden [&>div>button]:whitespace-nowrap'

  const filteredLenRef = useRef(deferredFiltered.length)
  filteredLenRef.current = deferredFiltered.length

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
      { rootMargin: '300px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [deferredFiltered, visibleCount])

  return (
    <div className="space-y-3 mb-8">
      {/* 키워드 필터 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:gap-2 sm:overflow-visible sm:pb-0">
        {KEYWORDS.map(kw => {
          const isAll = kw.key === '전체'
          const active = isAll ? keywords.size === 0 : keywords.has(kw.key)
          const kwColor = !isAll ? (KEYWORD_COLORS[kw.key] ?? '#666') : 'var(--gold)'
          const iconUrl = !isAll ? getGiftKeywordIcon(kw.key) : null
          return (
            <button
              key={kw.key}
              onClick={() => toggleKeyword(kw.key)}
              className="flex min-h-[1.875rem] shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-all duration-200 sm:gap-1.5 sm:px-3 sm:py-1.5"
              style={{
                cursor: 'pointer',
                background: active ? kwColor : 'rgba(255,255,255,0.06)',
                color: active ? '#0d0b08' : '#888',
                border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                fontFamily: 'var(--font-heading)',
                backdropFilter: 'blur(4px)',
                boxShadow: active && !isAll
                  ? `0 0 0.75rem ${KEYWORD_COLORS[kw.key] ?? '#666'}40, inset 0 1px 0 rgba(255,255,255,0.15)`
                  : 'none',
              }}
            >
              {iconUrl && (
                <Image
                  src={iconUrl}
                  alt={keywordLabels[kw.key] ?? kw.key}
                  width={14}
                  height={14}
                  style={{ opacity: active ? 0.9 : 0.4, width: '0.875rem', height: '0.875rem' }}
                />
              )}
              {keywordLabels[kw.key] ?? kw.key}
            </button>
          )
        })}
      </div>

      {/* 컨트롤 바 */}
      <div
        className="flex flex-col gap-2 rounded-lg p-2 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-2.5"
        style={{
          background: 'rgba(255,255,255,0.035)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(8px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 0.25rem rgba(0,0,0,0.3)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div className="order-1 flex w-full min-w-0 items-center gap-2 sm:order-4 sm:w-auto">
          {/* 검색 */}
          <div className="relative min-w-0 flex-1 sm:flex-none">
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
              placeholder={t('mirrorDungeon.search.placeholder')}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'rgba(200,144,10,0.35)'
                e.currentTarget.style.boxShadow = '0 0 0 0.125rem rgba(200,144,10,0.08)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'
                e.currentTarget.style.boxShadow = 'none'
              }}
              className="min-h-[2.25rem] w-full min-w-0 rounded-md py-1.5 pl-8 pr-7 text-xs placeholder:text-[#555] sm:w-44"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: '#ccc',
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
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
            className="flex-shrink-0 whitespace-nowrap tabular-nums"
            style={{ color: '#777', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}
          >
            {filtered.length}
            <span style={{ fontSize: '0.5625rem', marginLeft: '1px' }}>건</span>
          </span>
        </div>

        {/* 필터 드롭다운 그룹 */}
        <div className="order-2 grid w-full grid-cols-2 gap-1.5 sm:order-1 sm:flex sm:w-auto sm:items-center sm:gap-2">
          <div className={dropdownShellClass}>
            <GradeMultiDropdown grades={grades} toggleGrade={toggleGrade} />
          </div>
          <div className={dropdownShellClass}>
            <Dropdown
              value={tiers.size === 0 ? '전체' : [...tiers][0]}
              options={[
                { value: '전체', label: t('mirrorDungeon.tier.all') },
                { value: '노말', label: t('mirrorDungeon.tier.normal') },
                { value: '하드', label: t('mirrorDungeon.tier.hard') },
                { value: '익스트림', label: t('mirrorDungeon.tier.extreme') },
              ]}
              onChange={v => {
                if (v === '전체') setTiers(new Set())
                else setTiers(new Set([v]))
              }}
              prefix={t('mirrorDungeon.filter.difficulty')}
              defaultValue="전체"
              minWidth={120}
            />
          </div>
          <div className={dropdownShellClass}>
            <Dropdown
              value={slotFilter}
              options={[
                { value: '전체', label: t('mirrorDungeon.filter.all') },
                ...Array.from({ length: 8 }, (_, i) => ({ value: `${i + 1}`, label: `${i + 1}${t('mirrorDungeon.filter.slot')}` })),
              ]}
              onChange={v => setSlotFilter(v)}
              prefix={t('mirrorDungeon.filter.slotPrefix')}
              defaultValue="전체"
              minWidth={120}
            />
          </div>
          <div className={dropdownShellClass}>
            <Dropdown
              value={selectedThemeId !== null ? String(selectedThemeId) : '전체'}
              options={[
                { value: '전체', label: t('mirrorDungeon.filter.all') },
                ...themes.map(theme => ({ value: String(theme.id), label: getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang) })),
              ]}
              onChange={v => setSelectedThemeId(v === '전체' ? null : Number(v))}
              prefix={t('mirrorDungeon.filter.themePrefix')}
              defaultValue="전체"
              minWidth={140}
            />
          </div>
        </div>

        {/* 구분선 */}
        <div
          className="hidden flex-shrink-0 sm:order-2 sm:block"
          style={{ width: '1px', height: '1.25rem', background: 'rgba(255,255,255,0.06)' }}
        />

        {/* 세그먼트 정렬 */}
        <div
          className="order-3 flex w-full shrink-0 items-center overflow-hidden rounded-md sm:order-3 sm:ml-auto sm:w-auto"
          style={{ border: '1px solid rgba(255,255,255,0.09)' }}
        >
          {(['default', 'name', 'grade'] as const).map((key, i, arr) => {
            const labels = { default: t('mirrorDungeon.sort.default'), name: t('mirrorDungeon.sort.name'), grade: t('mirrorDungeon.sort.grade') }
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
                className="flex min-h-[2rem] min-w-0 flex-1 items-center justify-center whitespace-nowrap px-2 py-1.5 text-center transition-colors sm:flex-none sm:px-3"
                style={{
                  fontSize: '0.6875rem',
                  lineHeight: '1rem',
                  background: isSort ? 'rgba(200,144,10,0.18)' : 'transparent',
                  color: isSort ? 'var(--gold)' : '#666',
                  fontFamily: 'var(--font-heading)',
                  cursor: 'pointer',
                  borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  borderBottom: isSort ? '2px solid var(--gold)' : '2px solid transparent',
                }}
              >
                {labels[key]}
                {isSort && key !== 'default' && (sortDesc ? ' ↓' : ' ↑')}
              </button>
            )
          })}
        </div>
      </div>

      {/* 활성 필터 칩 */}
      {(keywords.size > 0 || grades.size > 0 || tiers.size > 0 || slotFilter !== '전체' || selectedThemeId !== null) && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
          <span
            className="hidden sm:inline"
            style={{
              color: '#666',
              fontSize: '0.5625rem',
              fontFamily: 'var(--font-heading)',
              marginRight: '0.125rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
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
                className="inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-2 pr-1.5 transition-colors hover:brightness-125"
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
                {keywordLabels[kw] ?? kw}
                <X size={10} style={{ opacity: 0.5 }} />
              </button>
            )
          })}
          {[...grades].map(g => (
            <button
              key={`fg-${g}`}
              onClick={() => toggleGrade(g)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-2 pr-1.5 transition-colors hover:brightness-125"
              style={{
                background: 'rgba(200,144,10,0.1)',
                border: '1px solid rgba(200,144,10,0.2)',
                color: 'var(--gold)',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
              }}
            >
              {t('mirrorDungeon.filter.grade')} {GRADE_LABELS[g] ?? g}
              <X size={10} style={{ opacity: 0.5 }} />
            </button>
          ))}
          {[...tiers].map(tier => (
            <button
              key={`ft-${tier}`}
              onClick={() => setTiers(new Set())}
              className="inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-2 pr-1.5 transition-colors hover:brightness-125"
              style={{
                background:
                  tier === '익스트림'
                    ? 'rgba(224,64,64,0.1)'
                    : tier === '하드'
                    ? 'rgba(232,144,48,0.1)'
                    : 'rgba(255,255,255,0.05)',
                border: `1px solid ${
                  tier === '익스트림'
                    ? 'rgba(224,64,64,0.2)'
                    : tier === '하드'
                    ? 'rgba(232,144,48,0.2)'
                    : 'rgba(255,255,255,0.08)'
                }`,
                color: tier === '익스트림' ? '#e04040' : tier === '하드' ? '#e89030' : '#888',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
              }}
            >
              {tier === '익스트림' ? t('mirrorDungeon.tier.extreme') : tier === '하드' ? t('mirrorDungeon.tier.hard') : t('mirrorDungeon.tier.normal')}
              <X size={10} style={{ opacity: 0.5 }} />
            </button>
          ))}
          {slotFilter !== '전체' && (
            <button
              onClick={() => setSlotFilter('전체')}
              className="inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-2 pr-1.5 transition-colors hover:brightness-125"
              style={{
                background: 'rgba(200,144,10,0.1)',
                border: '1px solid rgba(200,144,10,0.2)',
                color: 'var(--gold)',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
              }}
            >
              {slotFilter}{t('mirrorDungeon.filter.slot')}
              <X size={10} style={{ opacity: 0.5 }} />
            </button>
          )}
          {selectedThemeId !== null && selectedThemeLabel && (
            <button
              onClick={() => setSelectedThemeId(null)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-2 pr-1.5 transition-colors hover:brightness-125"
              style={{
                background: 'rgba(200,144,10,0.1)',
                border: '1px solid rgba(200,144,10,0.2)',
                color: 'var(--gold)',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
              }}
            >
              {selectedThemeLabel}
              <X size={10} style={{ opacity: 0.5 }} />
            </button>
          )}
          <button
            onClick={() => {
              setKeywords(new Set())
              setGrades(new Set())
              setTiers(new Set())
              setSlotFilter('전체')
              setSelectedThemeId(null)
              setInputValue('')
              setSearch('')
            }}
            className="shrink-0 rounded-full px-2 py-0.5 transition-colors hover:bg-white/5 sm:ml-auto"
            style={{
              color: '#444',
              fontSize: '0.625rem',
              fontFamily: 'var(--font-heading)',
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            {t('mirrorDungeon.filter.reset')}
          </button>
        </div>
      )}

      {/* 그리드 */}
      {deferredFiltered.length === 0 ? (
        <div className="text-center py-20" style={{ color: '#555' }}>
          <p className="text-lg font-serif mb-2">{t('mirrorDungeon.empty.title')}</p>
          <p className="text-sm" style={{ color: '#3a3530' }}>
            {t('mirrorDungeon.empty.description')}
          </p>
        </div>
      ) : (
        <>
          <div
            className="gift-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(3.75rem, 1fr))',
              gap: '0.5rem',
              position: 'relative',
              zIndex: 0,
              willChange: 'transform',
              opacity: isStale ? 0.7 : 1,
              transition: 'opacity 0.1s ease',
            }}
          >
            {visibleGifts.map((gift) => (
              <div
                key={gift.id}
                style={{
                  animation: 'giftCardFadeIn 0.15s ease-out forwards',
                }}
              >
                <MemoGiftItem gift={gift} onSelect={onSelectGift} lang={lang} />
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
                  {t('mirrorDungeon.filter.loading')}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
