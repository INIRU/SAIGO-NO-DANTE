'use client'

// Design Ref: §5.1 — 인격 전체 브라우저 클라이언트
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@/lib/i18n/navigation'
import { Search } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { Sinner } from '@/lib/types'
import type { IdentityBrowserItem, SortOption } from '@/lib/types/browser'
import type { DropdownOption } from '@/components/ui/Dropdown'
import { useIdentityBrowserFilters } from '@/hooks/useBrowserFilters'
import FilterSidebar from '@/components/browser/FilterSidebar'
import SinnerFilter from '@/components/browser/SinnerFilter'
import RarityFilter from '@/components/browser/RarityFilter'
import SinFilter from '@/components/browser/SinFilter'
import AtkTypeFilter from '@/components/browser/AtkTypeFilter'
import KeywordFilter from '@/components/browser/KeywordFilter'
import FilterToggleGroup, { filterStyles } from '@/components/browser/FilterToggleGroup'
import NumericFilter from '@/components/browser/NumericFilter'
import ActiveFilterChips from '@/components/browser/ActiveFilterChips'
import BrowserHeader from '@/components/browser/BrowserHeader'
import IdentityCard from '@/components/sinners/IdentityCard'
import { staggerContainer, workbenchReveal, workbenchStaggerItem } from '@/lib/animations'

const GRID_PAGE = 36

type Props = {
  identities: IdentityBrowserItem[]
  sinners: Sinner[]
}

type IdentityBrowserItemWithRepresentativeKeywords = IdentityBrowserItem & {
  skill_keyword_list?: string[] | null
  keywords?: string[] | null
}

const SORT_OPTIONS: DropdownOption<SortOption>[] = [
  { value: 'default', label: '기본' },
  { value: 'name', label: '이름순' },
  { value: 'rarity', label: '등급순' },
]

export default function IdentityBrowserClient({ identities, sinners }: Props) {
  const [nameQuery, setNameQuery] = useState('')
  const shouldReduceMotion = useReducedMotion()
  const representativeKeywordIdentities = useMemo<IdentityBrowserItem[]>(() => (
    (identities as IdentityBrowserItemWithRepresentativeKeywords[]).map(identity => ({
      ...identity,
      keywords: identity.skill_keyword_list && identity.skill_keyword_list.length > 0
        ? identity.skill_keyword_list
        : (identity.keywords ?? []),
    }))
  ), [identities])

  const {
    filters, sort, setSort,
    items: filterResult,
    totalCount, filteredCount: filterCount, activeCount,
    toggle, resetAll,
  } = useIdentityBrowserFilters(representativeKeywordIdentities)

  // 이름 검색 적용
  const filtered = useMemo(() => {
    const q = nameQuery.trim().toLowerCase()
    if (!q) return filterResult
    return filterResult.filter(id =>
      (id.name_kr || '').toLowerCase().includes(q) ||
      (id.name || '').toLowerCase().includes(q)
    )
  }, [filterResult, nameQuery])

  const filteredCount = nameQuery.trim() ? filtered.length : filterCount

  // Render the grid in pages as the reader scrolls: 188 cards at once is ~5k DOM nodes.
  const [shown, setShown] = useState(GRID_PAGE)
  const moreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = moreRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setShown(n => n + GRID_PAGE) }, { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [shown, filtered.length])

  // 숫자 필터용 가능한 값 추출
  const availableWeights = useMemo(() => {
    const ws = new Set<number>()
    representativeKeywordIdentities.forEach(id => id.atk_weights.forEach(w => ws.add(w)))
    return [...ws].sort((a, b) => a - b)
  }, [representativeKeywordIdentities])

  const availableCoins = useMemo(() => {
    const cs = new Set<number>()
    representativeKeywordIdentities.forEach(id => id.coin_counts.forEach(c => cs.add(c)))
    return [...cs].sort((a, b) => a - b)
  }, [representativeKeywordIdentities])

  return (
    <div className="min-h-[100dvh] pt-[5.5rem] pb-16 px-4 md:px-6 max-w-7xl mx-auto">
      <motion.div
        initial={shouldReduceMotion ? false : 'initial'}
        animate="animate"
        variants={shouldReduceMotion ? undefined : workbenchReveal}
      >
        <BrowserHeader
          title="인격 전체"
          totalCount={totalCount}
          filteredCount={filteredCount}
          sort={sort}
          onSortChange={setSort}
          sortOptions={SORT_OPTIONS}
        />
      </motion.div>

      <div className="flex gap-6">
        {/* 사이드바 */}
        <motion.div
          className="shrink-0"
          initial={shouldReduceMotion ? false : 'initial'}
          animate="animate"
          variants={shouldReduceMotion ? undefined : workbenchReveal}
        >
          <FilterSidebar activeCount={activeCount}>
            {/* 이름 검색 */}
            <div>
              <div className={filterStyles.label}>
                이름 검색
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-hidden />
                <input
                  type="text"
                  value={nameQuery}
                  onChange={e => setNameQuery(e.target.value)}
                  placeholder="인격 이름..."
                  className={filterStyles.input}
                  aria-label="인격 이름 검색"
                />
              </div>
            </div>
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <SinnerFilter
              sinners={sinners}
              selected={filters.sinners}
              onToggle={v => toggle('sinners', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <RarityFilter
              selected={filters.rarities}
              onToggle={v => toggle('rarities', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <FilterToggleGroup
              sectionLabel="시즌"
              items={[0,1,2,3,4,5,6,7].map(s => ({ value: s, label: s === 0 ? '기본' : `S${s}` }))}
              selected={filters.seasons}
              onToggle={(v: number) => toggle('seasons', v)}
              columns={4}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <SinFilter
              selected={filters.sins}
              onToggle={v => toggle('sins', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <AtkTypeFilter
              selected={filters.atkTypes}
              onToggle={v => toggle('atkTypes', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <KeywordFilter
              selected={filters.keywords}
              onToggle={v => toggle('keywords', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <NumericFilter
              sectionLabel="가중치"
              values={availableWeights}
              selected={filters.atkWeights}
              onToggle={v => toggle('atkWeights', v)}
            />
            <div style={{ borderTop: '1px solid #2e2417' }} />
            <NumericFilter
              sectionLabel="코인 수"
              values={availableCoins}
              selected={filters.coinCounts}
              onToggle={v => toggle('coinCounts', v)}
            />
            <ActiveFilterChips activeCount={activeCount} onReset={resetAll} />
          </FilterSidebar>
        </motion.div>

        {/* 카드 그리드 */}
        <div className="flex-1 min-w-0">
          {filteredCount === 0 ? (
            <motion.div
              className="flex items-center justify-center py-20"
              initial={shouldReduceMotion ? false : 'initial'}
              animate="animate"
              variants={shouldReduceMotion ? undefined : workbenchReveal}
            >
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>조건에 맞는 인격이 없습니다</p>
            </motion.div>
          ) : (
            <motion.div
              role="list"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-x-3 gap-y-6 pt-2"
              initial={shouldReduceMotion ? false : 'initial'}
              whileInView={shouldReduceMotion ? undefined : 'animate'}
              viewport={shouldReduceMotion ? undefined : { once: true, margin: '-48px' }}
              variants={shouldReduceMotion ? undefined : staggerContainer(0.025)}
            >
              {filtered.slice(0, shown).map(id => (
                <motion.div
                  key={id.id}
                  role="listitem"
                  variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
                >
                  <Link
                    href={`/sinners/${id.sinner_slug}/identities/${id.id}`}
                    aria-label={id.name_kr || id.name}
                  >
                    <IdentityCard
                      identity={{
                        ...id,
                        tier: 0,
                      }}
                    />
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
          {shown < filtered.length && <div ref={moreRef} aria-hidden="true" />}
        </div>
      </div>
    </div>
  )
}
