'use client'

import { useMemo, useEffect, useLayoutEffect, useRef, useCallback, useState, useDeferredValue, memo, type ReactNode } from 'react'
import Image from 'next/image'
import { Search, X, SlidersHorizontal, ArrowUp, ArrowDown } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import Dropdown from '@/components/ui/Dropdown'
import GiftCard from '@/components/mirror-dungeon/GiftCard'
import { GiftWarningMark } from '@/components/ui/GiftCard'
import type { EgoGift, EgoGiftTheme } from '@/components/mirror-dungeon/types'
import { KEYWORD_COLORS, GRADE_LABELS, GRADES } from '@/components/mirror-dungeon/types'
import type { GiftData } from '@/lib/planner/types'
import { getGiftKeywordIconUrl, getGiftKeywordSlug } from '@/lib/constants/gift'

const KEYWORDS = [
  { key: '전체', label: '전체' },
  { key: '공통', label: '공통' },
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
]

const keywordRank = (keyword: string | null | undefined) => {
  if (!keyword || keyword.startsWith('공통')) return 0
  const index = KEYWORDS.findIndex(kw => kw.key === keyword)
  return index < 0 ? 99 : index
}

const GRADE_ORDER: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, 'EX': 6 }
const PAGE_SIZE = 40
const PINNED_GROUP = '__pinned'

/** '난이도:' 같은 기존 접두어 번역에서 콜론을 떼어 칩 이름으로 쓴다. */
const filterName = (prefix: string) => prefix.replace(/\s*[:：]\s*$/, '')

const KEYWORD_LABEL_KEYS: Record<string, string> = {
  '전체': 'mirrorDungeon.filter.all', '화상': 'mirrorDungeon.filter.combustion', '출혈': 'mirrorDungeon.filter.laceration',
  '진동': 'mirrorDungeon.filter.vibration', '파열': 'mirrorDungeon.filter.burst', '침잠': 'mirrorDungeon.filter.sinking',
  '호흡': 'mirrorDungeon.filter.breath', '충전': 'mirrorDungeon.filter.charge', '참격': 'mirrorDungeon.filter.slash',
  '관통': 'mirrorDungeon.filter.pierce', '타격': 'mirrorDungeon.filter.blunt', '공통': 'mirrorDungeon.filter.common',
}

/** 기프트 키워드 탭 이름('화상', '공통' …)을 언어에 맞게 돌려준다. */
export function giftKeywordLabel(key: string, lang: SupportedLang): string {
  const entry = translations[KEYWORD_LABEL_KEYS[key] as keyof typeof translations] as Record<string, string> | undefined
  return entry?.[lang] ?? entry?.ko ?? key
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0d0b08]'

/** 키워드 밑줄 탭 하나. 미러 던전 기프트 목록과 플래너 최종 기프트가 같이 쓴다. color가 없으면 '전체' 탭. */
export function GiftKeywordTab({ label, iconUrl, color, active, count, onClick }: {
  label: string; iconUrl?: string | null; color?: string; active: boolean; count?: number; onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-[2.5rem] shrink-0 items-center gap-1.5 px-2.5 text-[0.8125rem] transition-colors hover:text-[var(--text-primary)] md:px-3 ${FOCUS_RING}`}
      style={{
        cursor: 'pointer',
        color: active ? 'var(--text-primary)' : '#9c8b73',
        fontFamily: 'var(--font-heading)',
        borderBottom: `2px solid ${active ? color ?? 'var(--gold)' : 'transparent'}`,
        marginBottom: '-1px',
        background: active && color ? `${color}1f` : 'transparent',
      }}
    >
      {iconUrl && <KeywordImage src={iconUrl} size={16} dim={!active} />}
      {label}
      {count !== undefined && <span className="tabular-nums" style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: active ? '#b9aa98' : '#7f7364' }}>{count}</span>}
    </button>
  )
}

/** 등급 칩(Ⅰ~EX) 하나. */
export function GiftGradeChip({ grade, ariaLabel, active, count, onClick }: {
  grade: string; ariaLabel: string; active: boolean; count?: number; onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={count === undefined ? ariaLabel : `${ariaLabel} ${count}`}
      onClick={onClick}
      className={`inline-flex h-9 min-w-[2.125rem] flex-1 items-center justify-center gap-1 rounded px-1.5 text-[1rem] leading-none transition-colors hover:text-[var(--text-primary)] sm:flex-none ${FOCUS_RING}`}
      style={{
        fontFamily: 'var(--font-title)',
        letterSpacing: '0.04em',
        color: active ? 'var(--gold-light)' : '#9c8b73',
        background: active ? 'rgba(200,144,10,0.14)' : 'transparent',
      }}
    >
      {GRADE_LABELS[grade] ?? grade}
      {count !== undefined && <span className="tabular-nums" style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: 0, color: active ? '#b9aa98' : '#7f7364' }}>{count}</span>}
    </button>
  )
}

/** 키워드 아이콘. 목록이 다시 그려질 때 next/image를 매번 다시 계산하지 않게 memo한다. */
const KeywordImage = memo(function KeywordImage({ src, size, dim = false }: { src: string; size: number; dim?: boolean }) {
  return <Image src={src} alt="" width={size} height={size} style={{ opacity: dim ? 0.55 : 1, width: `${size / 16}rem`, height: `${size / 16}rem` }} />
})

// 목록을 품은 가장 가까운 세로 스크롤 상자(내용이 넘치는 것만). 없으면 null = 창.
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflow = getComputedStyle(p).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

/** 미선택이면 필터 이름만, 선택하면 값과 지우기(×)를 보여 주는 칩. */
function FilterChip({ label, clearLabel, value, options, onChange, minWidth }: {
  label: string; clearLabel: string; value: string | null; options: { value: string; label: string }[]; onChange: (value: string | null) => void; minWidth: number
}) {
  const set = value !== null
  return (
    <div
      className={`flex min-w-0 max-w-[13rem] shrink-0 items-stretch rounded border ${set ? '[&>div>button>svg]:hidden' : ''}`}
      style={{ borderColor: set ? 'rgba(200,144,10,0.45)' : '#2e2417', background: set ? 'rgba(200,144,10,0.08)' : 'transparent' }}
    >
      <Dropdown
        ariaLabel={label}
        // 옵션에 없는 값(label)을 넘기면 Dropdown이 그 값을 그대로 표시한다 → 미선택 칩은 필터 이름만 보인다.
        value={value ?? label}
        options={options}
        onChange={onChange}
        minWidth={minWidth}
        className="min-w-0"
        buttonStyle={{ minHeight: '2.125rem', maxWidth: '100%', borderWidth: 0, background: 'transparent', padding: set ? '0 0.125rem 0 0.625rem' : '0 0.5rem 0 0.625rem', fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: set ? 'var(--gold-light)' : '#9c8b73' }}
      />
      {set && (
        <button
          type="button"
          aria-label={`${label} ${clearLabel}`}
          onClick={() => onChange(null)}
          className="flex w-7 shrink-0 items-center justify-center text-[#9c8b73] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gold-light)]"
        >
          <X size={12} aria-hidden />
        </button>
      )}
    </div>
  )
}

type SetFilter = (fn: Set<string> | ((prev: Set<string>) => Set<string>)) => void

/** URL-synced filter state owned by the page. */
export interface GiftCatalogFilters {
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
  setKeywords: SetFilter
  setGrades: SetFilter
  setTiers: SetFilter
  setSortBy: (v: 'default' | 'name' | 'grade') => void
  setSortDesc: (v: boolean | ((prev: boolean) => boolean)) => void
  setSlotFilter: (v: string) => void
  setSelectedThemeId: (v: number | null) => void
}

const noop = () => {}
/** Used when no filters are passed: everything shown, grouped by keyword. */
const NO_FILTERS: GiftCatalogFilters = {
  search: '', keywords: new Set(), grades: new Set(), tiers: new Set(), sortBy: 'default', sortDesc: false, slotFilter: '전체',
  selectedThemeId: null, themeGiftNames: null, giftSlotMap: new Map(), inputValue: '',
  setInputValue: noop, setSearch: noop, setKeywords: noop, setGrades: noop, setTiers: noop, setSortBy: noop, setSortDesc: noop, setSlotFilter: noop, setSelectedThemeId: noop,
}

/** Component-local filter state (keyword, grade, search) for catalogs outside the Mirror Dungeon page. */
export function useGiftCatalogFilters(): GiftCatalogFilters {
  const [search, setSearch] = useState('')
  const [keywords, setKeywords] = useState<Set<string>>(() => new Set())
  const [grades, setGrades] = useState<Set<string>>(() => new Set())
  return useMemo(() => ({
    ...NO_FILTERS, search, keywords, grades, inputValue: search,
    setInputValue: setSearch, setSearch, setKeywords, setGrades,
  }), [search, keywords, grades])
}

/** Planner gift in the catalog's shape. id is the game id as a string. */
export function toCatalogGift(gift: GiftData): EgoGift {
  const keyword = !gift.keyword || gift.keyword.startsWith('공통') ? '공통' : gift.keyword
  return { ...gift, id: String(gift.game_id), keyword, grade: gift.grade ?? '1', is_synthesis: false, difficulty: null } as unknown as EgoGift
}

/** Keyword icon for toCatalogGift gifts. */
export const giftKeywordIcon = (keyword: string) => getGiftKeywordIconUrl(getGiftKeywordSlug(keyword) ?? 'general')

/** Per-card GiftCard options (disabled with a reason, condition overlay, remove button). */
export interface GiftCatalogCardProps {
  disabled?: boolean
  title?: string
  ariaLabel?: string
  conditionStatus?: import('@/lib/planner/gift-condition-status').GiftConditionStatus | null
  conditionDetail?: boolean
  /** Red warning mark with this reason (e.g. only obtainable on this floor). */
  warning?: string
  onRemove?: () => void
}

export interface GiftCatalogProps {
  gifts: EgoGift[]
  themes?: EgoGiftTheme[]
  getGiftKeywordIcon: (keyword: string) => string | null
  onGiftClick: (gift: EgoGift) => void
  /** Omit for an unfiltered catalog; the toolbar is hidden too. */
  filters?: GiftCatalogFilters
  hideFilters?: boolean
  /** Smaller cells without names; the toolbar sticks to the nearest scroller's top and keeps only keyword, search and grade. */
  compact?: boolean
  selectedIds?: ReadonlySet<string>
  /** Dimmed with a check (e.g. acquired). */
  markedIds?: ReadonlySet<string>
  /** Screen-reader suffix for marked gifts. */
  markedLabel?: string
  /** Overlay drawn above each card, outside its button (e.g. an info button). */
  renderBadge?: (gift: EgoGift) => ReactNode
  cardProps?: (gift: EgoGift) => GiftCatalogCardProps | undefined
  /** Extra controls at the end of the toolbar. */
  toolbarEnd?: ReactNode
  /** Shown instead of the grid until a keyword, grade or search narrows the list. */
  idleHint?: ReactNode
  /** Groups listed first, in this order, each under its own heading; a gift sits in the first group that has it.
   *  `warning` draws the red mark (e.g. gifts only this floor gives). */
  pinned?: { ids: ReadonlySet<string>; label: string; warning?: boolean }[]
}

type GiftItemProps = {
  gift: EgoGift
  onSelect: (gift: EgoGift) => void
  lang: SupportedLang
  compact?: boolean
  isSelected?: boolean
  isMarked?: boolean
  markedLabel?: string
  badge?: ReactNode
  extra?: GiftCatalogCardProps
}

const shallowEqual = (a?: object, b?: object) => {
  if (a === b) return true
  if (!a || !b) return false
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every(k => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k])
}

// cardProps는 칸마다 새 객체를 만든다: 내용이 같으면 다시 그리지 않는다(기프트 하나를 눌러도 448칸이 다시 그려지던 지연)
const sameGiftItem = (prev: GiftItemProps, next: GiftItemProps) =>
  (Object.keys(next) as (keyof GiftItemProps)[]).every(key => key === 'extra' || prev[key] === next[key]) &&
  shallowEqual(prev.extra, next.extra)

const MemoGiftItem = memo(function MemoGiftItem({
  gift,
  onSelect,
  lang,
  compact,
  isSelected,
  isMarked,
  markedLabel,
  badge,
  extra,
}: GiftItemProps) {
  const localizedGift = useMemo(() => ({
    ...gift,
    name: getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang),
  }), [gift, lang])
  const handleClick = useCallback(() => onSelect(gift), [gift, onSelect])
  const card = <GiftCard gift={localizedGift} onClick={handleClick} showName={!compact} isSelected={isSelected}
    ariaLabel={isMarked && markedLabel ? `${localizedGift.name}, ${markedLabel}` : undefined} {...extra} />
  if (!isMarked && !badge) return card
  return (
    <div className="relative">
      <div style={isMarked ? { opacity: 0.35, filter: 'grayscale(0.7)' } : undefined}>{card}</div>
      {isMarked && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 grid aspect-square place-items-center">
          <svg viewBox="0 0 24 24" className="h-[42%] w-[42%] drop-shadow-[0_0_0.25rem_rgba(0,0,0,0.9)]">
            <circle cx="12" cy="12" r="11" fill="#17120c" stroke="#c8900a" strokeWidth="1.5" />
            <path d="M6.5 12.4 10.2 16 17.5 8.2" fill="none" stroke="#e8b030" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      {badge}
    </div>
  )
}, sameGiftItem)

type GiftCell = Omit<GiftItemProps, 'onSelect' | 'lang' | 'compact' | 'markedLabel'>
type GiftGridProps = Pick<GiftItemProps, 'onSelect' | 'lang' | 'compact' | 'markedLabel'> & { cells: GiftCell[] }

// 칸 목록을 묶음마다 비교해 누른 기프트가 없는 묶음은 칸 요소도 만들지 않는다
const GiftGrid = memo(function GiftGrid({ cells, onSelect, lang, compact, markedLabel }: GiftGridProps) {
  return cells.map(cell => (
    <MemoGiftItem key={cell.gift.id} {...cell} onSelect={onSelect} lang={lang} compact={compact} markedLabel={markedLabel} />
  ))
}, (prev, next) =>
  prev.onSelect === next.onSelect && prev.lang === next.lang && prev.compact === next.compact && prev.markedLabel === next.markedLabel &&
  prev.cells.length === next.cells.length &&
  prev.cells.every((cell, i) => {
    const other = next.cells[i]
    return cell.gift === other.gift && cell.isSelected === other.isSelected && cell.isMarked === other.isMarked &&
      cell.badge === other.badge && shallowEqual(cell.extra, other.extra)
  }))

/** Keyword tabs, toolbar and grouped gift grid used by the Mirror Dungeon gift list. */
export default function GiftCatalog({
  gifts,
  themes = [],
  getGiftKeywordIcon,
  onGiftClick,
  filters,
  hideFilters = false,
  compact = false,
  selectedIds,
  markedIds,
  markedLabel,
  renderBadge,
  cardProps,
  toolbarEnd,
  idleHint,
  pinned,
}: GiftCatalogProps) {
  const {
    search, keywords, grades, tiers, sortBy, sortDesc, slotFilter, themeGiftNames, giftSlotMap, inputValue,
    setInputValue, setSearch, setKeywords, setGrades, setTiers, setSortBy, setSortDesc, setSlotFilter, selectedThemeId, setSelectedThemeId,
  } = filters ?? NO_FILTERS
  const showToolbar = !hideFilters && filters != null
  // 부모가 선택 상태마다 새 클릭 함수를 넘겨도 칸들은 같은 함수를 받는다
  const onGiftClickRef = useRef(onGiftClick)
  useLayoutEffect(() => { onGiftClickRef.current = onGiftClick })
  const selectGift = useCallback((gift: EgoGift) => onGiftClickRef.current(gift), [])
  const locale = useLocale()
  const lang = locale as SupportedLang
  const tp = useTranslations('mirrorDungeonPage')
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return (entry as Record<string, string>)[lang] ?? (entry as Record<string, string>)['ko'] ?? key
  }

  const keywordLabels = useMemo(() => Object.fromEntries(KEYWORDS.map(kw => [kw.key, giftKeywordLabel(kw.key, lang)])), [lang])

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

  const query = search.trim().toLocaleLowerCase()
  const filtered = useMemo(() => {
    const slotNum = slotFilter !== '전체' ? Number(slotFilter) : null
    const result = gifts.filter(g => {
      if (keywords.size > 0 && !keywords.has(g.keyword)) return false
      if (grades.size > 0 && !grades.has(g.grade)) return false
      // Difficulty = the first difficulty the gift can be obtained in (sync: giftTiers), so each option lists only the
      // gifts that start there: 익스트림 shows the extreme-only gifts, not everything obtainable in extreme.
      if (tiers.size > 0 && !tiers.has(g.difficulty || '노말')) return false
      if (slotNum !== null) {
        const slots = giftSlotMap.get(g.id)
        if (!slots || !slots.has(slotNum)) return false
      }
      if (query && ![g.name, g.name_en, g.name_jp].some(name => name?.toLocaleLowerCase().includes(query))) return false
      if (themeGiftNames && !themeGiftNames.has(g.name)) return false
      return true
    })

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    } else if (sortBy === 'grade') {
      result.sort((a, b) => (GRADE_ORDER[a.grade] ?? 0) - (GRADE_ORDER[b.grade] ?? 0))
    } else {
      // 키워드별: 공통 → 키워드 → 참격·관통·타격, 같은 키워드는 등급순
      result.sort((a, b) => keywordRank(a.keyword) - keywordRank(b.keyword) || (GRADE_ORDER[a.grade] ?? 0) - (GRADE_ORDER[b.grade] ?? 0))
    }

    if (sortDesc) result.reverse()
    if (!pinned?.length) return result
    const rank = (g: EgoGift) => { const index = pinned.findIndex(group => group.ids.has(g.id)); return index < 0 ? pinned.length : index }
    return result.map((g, i) => [g, rank(g), i] as const).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([g]) => g)
  }, [gifts, keywords, grades, tiers, query, sortBy, sortDesc, themeGiftNames, slotFilter, giftSlotMap, pinned])

  const deferredFiltered = useDeferredValue(filtered)
  const isStale = deferredFiltered !== filtered

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  // Back to the first page only when the user changes a filter. Parents often rebuild the gifts array on every
  // render (picking a gift re-renders them); resetting then shortened the list and threw the scroll back up.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    loadingRef.current = false
  }, [keywords, grades, tiers, query, sortBy, sortDesc, themeGiftNames, slotFilter])

  const visibleGifts = useMemo(() => deferredFiltered.slice(0, visibleCount), [deferredFiltered, visibleCount])

  // 도구줄이 붙어 있을 만큼 내려간 상태에서 필터를 바꾸면 결과 첫 줄을 도구줄 바로 아래에 둔다(목록이 줄며 페이지가 튀지 않게).
  // 따로 스크롤되는 상자 안이면 그 상자를, 아니면 창을 움직인다(compact는 --gift-catalog-sticky-top을 준 페이지 흐름 배치일 때만 창).
  const rootRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  // 기프트 선택으로 gifts가 바뀔 때는 움직이지 않도록 필터 값에만 반응한다.
  const filterMountedRef = useRef(false)
  useLayoutEffect(() => {
    if (!filterMountedRef.current) { filterMountedRef.current = true; return }
    const root = rootRef.current
    const toolbar = toolbarRef.current
    if (!root || !toolbar) return
    const scroller = compact ? scrollParent(root) : null
    if (compact && !scroller && !getComputedStyle(root).getPropertyValue('--gift-catalog-sticky-top')) return
    const stuckTop = parseFloat(getComputedStyle(toolbar).top) || 0
    const rootTop = root.getBoundingClientRect().top - (scroller?.getBoundingClientRect().top ?? 0)
    if (rootTop < stuckTop - 1) (scroller ?? window).scrollBy(0, rootTop - stuckTop)
  }, [compact, keywords, grades, tiers, query, sortBy, sortDesc, slotFilter, themeGiftNames])

  // 기본 정렬 = 키워드별, 등급 정렬 = 등급별 묶음. 이름 정렬은 한 덩어리.
  const groupBy: 'keyword' | 'grade' | null = sortBy === 'default' ? 'keyword' : sortBy === 'grade' ? 'grade' : null
  const groupCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of deferredFiltered) {
      const pin = pinned?.findIndex(group => group.ids.has(g.id)) ?? -1
      const key = pin >= 0 ? PINNED_GROUP + pin : groupBy === 'keyword' ? g.keyword : groupBy === 'grade' ? g.grade : ''
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [deferredFiltered, groupBy, pinned])
  const groups = useMemo(() => {
    const out: { key: string; gifts: EgoGift[] }[] = []
    for (const g of visibleGifts) {
      const pin = pinned?.findIndex(group => group.ids.has(g.id)) ?? -1
      const key = pin >= 0 ? PINNED_GROUP + pin : groupBy === 'keyword' ? g.keyword : groupBy === 'grade' ? g.grade : ''
      const last = out[out.length - 1]
      if (last && last.key === key) last.gifts.push(g)
      else out.push({ key, gifts: [g] })
    }
    return out
  }, [visibleGifts, groupBy, pinned])

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  // 모바일 '필터' 버튼 숫자: 시트 안에 접힌 등급·난이도·편성·테마팩 중 켜진 수
  const mobileFilterCount = (grades.size > 0 ? 1 : 0) + (tiers.size > 0 ? 1 : 0) + (slotFilter !== '전체' ? 1 : 0) + (selectedThemeId !== null ? 1 : 0)
  const hasActiveFilters = keywords.size > 0 || grades.size > 0 || tiers.size > 0 || slotFilter !== '전체' || selectedThemeId !== null

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

  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0d0b08]'

  return (
    <div ref={rootRef} className={compact ? undefined : 'mb-8'}>
      {/* 필터 — 스크롤해도 상단에 붙어 있음 */}
      {showToolbar && <div
        ref={toolbarRef}
        role="search"
      aria-label={tp('giftFilters')}
        className={compact ? 'sticky z-10 pb-2 transition-[top] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none' : 'sticky-under-nav z-30 -mx-4 px-4 pt-1 pb-2 md:-mx-6 md:px-6'}
        style={{ top: compact ? 'var(--gift-catalog-sticky-top, 0px)' : undefined, background: compact ? 'var(--gift-catalog-bg, #0d0b08)' : '#0d0b08', borderBottom: '1px solid #2e2417' }}
      >
        {/* 키워드 */}
        <div className={`flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${compact ? '' : '-mx-4 px-4 md:mx-0 md:px-0'}`} style={{ borderBottom: '1px solid #2e2417' }}>
          {KEYWORDS.map(kw => {
            const isAll = kw.key === '전체'
            return (
              <GiftKeywordTab
                key={kw.key}
                label={keywordLabels[kw.key] ?? kw.key}
                iconUrl={isAll ? null : getGiftKeywordIcon(kw.key)}
                color={isAll ? undefined : KEYWORD_COLORS[kw.key] ?? '#9c8b73'}
                active={isAll ? keywords.size === 0 : keywords.has(kw.key)}
                onClick={() => toggleKeyword(kw.key)}
              />
            )
          })}
        </div>

        {/* 검색 · 등급 · 세부 필터 · 결과 수 · 정렬 — 한 줄. 모바일은 검색과 필터 버튼만 두고 나머지는 시트로 */}
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-x-3">
          <div className="relative min-w-0 flex-1 sm:w-[13rem] sm:flex-none">
            <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9c8b73]" />
            <input
              type="search"
              aria-label={t('mirrorDungeon.search.placeholder')}
              placeholder={t('mirrorDungeon.search.placeholder')}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="h-9 w-full min-w-0 rounded border border-[#2e2417] bg-[#17120c] pl-8 pr-7 text-[0.8125rem] text-[var(--text-primary)] outline-none placeholder:text-[#6a6058] focus-visible:border-[var(--gold)] [&::-webkit-search-cancel-button]:hidden"
            />
            {(inputValue || search) && (
              <button
                type="button"
                aria-label={t('mirrorDungeon.filter.reset')}
                onClick={() => {
                  setInputValue('')
                  setSearch('')
                }}
                className={`absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-[#9c8b73] hover:text-[var(--text-primary)] ${focusRing}`}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            aria-expanded={mobileFiltersOpen}
            aria-controls="md-gift-more-filters"
            onClick={() => setMobileFiltersOpen(v => !v)}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded border px-3 text-[0.8125rem] sm:hidden ${focusRing}`}
            style={{
              fontFamily: 'var(--font-heading)',
              color: mobileFilterCount > 0 || mobileFiltersOpen ? 'var(--gold-light)' : '#9c8b73',
              borderColor: mobileFilterCount > 0 ? 'rgba(200,144,10,0.45)' : '#2e2417',
            }}
          >
            <SlidersHorizontal size={14} aria-hidden />
            {tp('moreFilters')}
            {mobileFilterCount > 0 && <span className="tabular-nums">{mobileFilterCount}</span>}
          </button>

          <p className="shrink-0 text-[0.8125rem] tabular-nums text-[#9c8b73] sm:order-1 sm:ml-auto" aria-live="polite">
            <span className="text-[var(--text-primary)]">{filtered.length}</span>{lang === 'en' ? ' ' : ''}{tp('giftUnit')}
          </p>

          {/* 모바일에서는 접히는 시트, sm 이상에서는 display:contents로 같은 줄에 풀린다. */}
          <div
            id="md-gift-more-filters"
            className={`${mobileFiltersOpen ? 'flex' : 'hidden'} basis-full flex-wrap items-center gap-2 rounded border border-[#2e2417] bg-[#17120c] p-2.5 sm:contents`}
          >
            <div role="group" aria-label={t('mirrorDungeon.filter.grade')} className="flex w-full items-center gap-0.5 sm:w-auto">
              {GRADES.filter(g => g !== '전체').map(g => (
                <GiftGradeChip
                  key={g}
                  grade={g}
                  ariaLabel={`${t('mirrorDungeon.filter.grade')} ${GRADE_LABELS[g] ?? g}`}
                  active={grades.has(g)}
                  onClick={() => toggleGrade(g)}
                />
              ))}
            </div>

            {!compact && <>
            <span aria-hidden className="hidden h-5 w-px bg-[#2e2417] sm:block" />

            <FilterChip
              label={filterName(t('mirrorDungeon.filter.difficulty'))}
              clearLabel={t('mirrorDungeon.filter.reset')}
              value={tiers.size === 0 ? null : [...tiers][0]}
              options={[
                { value: '노말', label: t('mirrorDungeon.tier.normal') },
                { value: '하드', label: t('mirrorDungeon.tier.hard') },
                { value: '익스트림', label: t('mirrorDungeon.tier.extreme') },
              ]}
              onChange={v => setTiers(v === null ? new Set() : new Set([v]))}
              minWidth={120}
            />
            <FilterChip
              label={filterName(t('mirrorDungeon.filter.slotPrefix'))}
              clearLabel={t('mirrorDungeon.filter.reset')}
              value={slotFilter === '전체' ? null : slotFilter}
              options={Array.from({ length: 8 }, (_, i) => ({ value: `${i + 1}`, label: `${i + 1}${t('mirrorDungeon.filter.slot')}` }))}
              onChange={v => setSlotFilter(v ?? '전체')}
              minWidth={120}
            />
            <FilterChip
              label={filterName(t('mirrorDungeon.filter.themePrefix'))}
              clearLabel={t('mirrorDungeon.filter.reset')}
              value={selectedThemeId === null ? null : String(selectedThemeId)}
              options={themes.map(theme => ({ value: String(theme.id), label: getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang) }))}
              onChange={v => setSelectedThemeId(v === null ? null : Number(v))}
              minWidth={200}
            />
            </>}

            {(hasActiveFilters || inputValue || search) && (
              <button
                type="button"
                onClick={() => {
                  setKeywords(new Set())
                  setGrades(new Set())
                  setTiers(new Set())
                  setSlotFilter('전체')
                  setSelectedThemeId(null)
                  setInputValue('')
                  setSearch('')
                }}
                className={`h-9 shrink-0 px-1 text-[0.8125rem] text-[#9c8b73] underline-offset-2 hover:text-[var(--text-primary)] hover:underline ${focusRing}`}
              >
                {t('mirrorDungeon.filter.reset')}
              </button>
            )}

            {/* 정렬: 조용한 드롭다운. 이름·등급 정렬만 방향을 뒤집을 수 있다. */}
            {!compact && <div className="ml-auto flex items-center sm:order-2 sm:ml-0">
              <Dropdown
                ariaLabel={tp('sort')}
                value={sortBy}
                options={[
                  { value: 'default', label: tp('sortKeyword') },
                  { value: 'name', label: t('mirrorDungeon.sort.name') },
                  { value: 'grade', label: t('mirrorDungeon.sort.grade') },
                ]}
                onChange={v => {
                  if (v === sortBy) return
                  setSortBy(v)
                  setSortDesc(false)
                }}
                minWidth={120}
                buttonStyle={{ minHeight: '2.25rem', borderWidth: 0, background: 'transparent', padding: '0 0.375rem', fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: '#9c8b73' }}
              />
              {sortBy !== 'default' && (
                <button
                  type="button"
                  aria-label={tp('sortReverse')}
                  aria-pressed={sortDesc}
                  onClick={() => setSortDesc(v => !v)}
                  className={`flex h-9 w-7 items-center justify-center rounded text-[#9c8b73] hover:text-[var(--text-primary)] ${focusRing}`}
                >
                  {sortDesc ? <ArrowDown size={13} aria-hidden /> : <ArrowUp size={13} aria-hidden />}
                </button>
              )}
            </div>}
          </div>
          {toolbarEnd && <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-1 sm:order-3 sm:basis-auto">{toolbarEnd}</div>}
        </div>
      </div>}

      {/* 그리드 */}
      {idleHint && !keywords.size && !grades.size && !query ? (
        <div className="py-6 text-center text-[0.8125rem]" style={{ color: '#9c8b73' }}>{idleHint}</div>
      ) : deferredFiltered.length === 0 ? (
        <div className={`${compact ? 'py-8' : 'py-20'} text-center`} style={{ minHeight: compact ? 'var(--gift-catalog-min-h)' : undefined }}>
          <p className="mb-2 text-lg" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-heading)' }}>{t('mirrorDungeon.empty.title')}</p>
          <p className="text-sm" style={{ color: '#9c8b73' }}>{t('mirrorDungeon.empty.description')}</p>
        </div>
      ) : (
        <div className="mt-4" style={{ minHeight: compact ? 'var(--gift-catalog-min-h)' : undefined, opacity: isStale ? 0.7 : 1, transition: 'opacity 0.1s ease' }}>
          {groups.map((group, gi) => {
            const iconUrl = groupBy === 'keyword' ? getGiftKeywordIcon(group.key) : null
            const pin = group.key.startsWith(PINNED_GROUP) ? pinned?.[Number(group.key.slice(PINNED_GROUP.length))] : undefined
            const isPinned = pin !== undefined
            return (
              <section key={`${group.key}-${gi}`} className="mb-5" aria-label={pin ? pin.label : groupBy ? (groupBy === 'keyword' ? keywordLabels[group.key] ?? group.key : `${t('mirrorDungeon.filter.grade')} ${GRADE_LABELS[group.key] ?? group.key}`) : undefined}>
                {(groupBy || isPinned) && (
                  <h2 className="mb-2 flex items-center gap-2" style={{ borderBottom: pin?.warning ? '1px solid rgba(189,36,48,0.45)' : pin ? '1px solid rgba(200,144,10,0.35)' : '1px solid #2e2417', paddingBottom: '0.375rem' }}>
                    {pin ? (
                      <>
                        {pin.warning && <span className="relative inline-block h-[1.125rem] w-[1.125rem] shrink-0"><GiftWarningMark label={pin.label} className="inset-0 h-full w-full" /></span>}
                        <span style={{ color: pin.warning ? '#ff9c9c' : 'var(--gold-light)', fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>{pin.label}</span>
                      </>
                    ) : groupBy === 'keyword' ? (
                      <>
                        {iconUrl && <KeywordImage src={iconUrl} size={18} />}
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>{keywordLabels[group.key] ?? group.key}</span>
                      </>
                    ) : (
                      <>
                        <span style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-title)', fontSize: '1.5rem', lineHeight: 1 }}>{group.key}</span>
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>{t('mirrorDungeon.filter.grade')}</span>
                      </>
                    )}
                    <span className="tabular-nums" style={{ color: '#9c8b73', fontFamily: 'var(--font-title)', fontSize: '1.125rem', lineHeight: 1 }}>{groupCounts.get(group.key) ?? group.gifts.length}</span>
                  </h2>
                )}
                <div
                  className={compact ? 'gift-grid [&_.gift-card:hover]:[transform:none]!' : 'gift-grid'}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? '4.5rem' : '3.625rem'}, 1fr))`,
                    gap: '0.5rem 0.375rem',
                  }}
                >
                  <GiftGrid onSelect={selectGift} lang={lang} compact={compact} markedLabel={markedLabel}
                    cells={group.gifts.map(gift => ({ gift, isSelected: selectedIds?.has(gift.id), isMarked: markedIds?.has(gift.id), badge: renderBadge?.(gift), extra: cardProps?.(gift) }))} />
                </div>
              </section>
            )
          })}
          {visibleCount < filtered.length && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              <span className="motion-safe:animate-pulse" style={{ color: '#9c8b73', fontSize: '0.75rem', fontFamily: 'var(--font-heading)' }}>
                {t('mirrorDungeon.filter.loading')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
