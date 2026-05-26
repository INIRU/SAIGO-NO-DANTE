'use client'

// Design Ref: §5.1 — EGO 전체 브라우저 클라이언트
import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { Sinner } from '@/lib/types'
import type { EGOBrowserItem, SortOption } from '@/lib/types/browser'
import type { DropdownOption } from '@/components/ui/Dropdown'
import { useEGOBrowserFilters } from '@/hooks/useBrowserFilters'
import FilterSidebar from '@/components/browser/FilterSidebar'
import SinnerFilter from '@/components/browser/SinnerFilter'
import GradeFilter from '@/components/browser/GradeFilter'
import SinFilter from '@/components/browser/SinFilter'
import KeywordFilter from '@/components/browser/KeywordFilter'
import ActiveFilterChips from '@/components/browser/ActiveFilterChips'
import BrowserHeader from '@/components/browser/BrowserHeader'
import EGOBrowserCard from '@/components/browser/EGOBrowserCard'
import { staggerContainer, workbenchReveal, workbenchStaggerItem } from '@/lib/animations'

type Props = {
  egos: EGOBrowserItem[]
  sinners: Sinner[]
}

const SORT_OPTIONS: DropdownOption<SortOption>[] = [
  { value: 'default', label: '기본' },
  { value: 'name', label: '이름순' },
  { value: 'grade', label: '등급순' },
]

export default function EGOBrowserClient({ egos, sinners }: Props) {
  const [nameQuery, setNameQuery] = useState('')
  const shouldReduceMotion = useReducedMotion()

  const {
    filters, sort, setSort,
    items: filterResult,
    totalCount, filteredCount: filterCount, activeCount,
    toggle, resetAll,
  } = useEGOBrowserFilters(egos)

  const filtered = useMemo(() => {
    const q = nameQuery.trim().toLowerCase()
    if (!q) return filterResult
    return filterResult.filter(e =>
      (e.name_kr || '').toLowerCase().includes(q) ||
      (e.name || '').toLowerCase().includes(q)
    )
  }, [filterResult, nameQuery])

  const filteredCount = nameQuery.trim() ? filtered.length : filterCount

  return (
    <div className="min-h-[100dvh] pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto">
      <motion.div
        initial={shouldReduceMotion ? false : 'initial'}
        animate="animate"
        variants={shouldReduceMotion ? undefined : workbenchReveal}
      >
        <BrowserHeader
          title="E.G.O 전체"
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
              <div className="font-mono mb-2" style={{
                fontSize: '0.5625rem',
                letterSpacing: '0.15em',
                color: 'var(--gold-dim)',
                textTransform: 'uppercase',
              }}>
                이름 검색
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: '#555' }} />
                <input
                  type="text"
                  value={nameQuery}
                  onChange={e => setNameQuery(e.target.value)}
                  placeholder="E.G.O 이름..."
                  className="w-full rounded pl-7 pr-2 py-1.5 text-xs outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#ccc',
                    fontSize: '0.75rem',
                  }}
                  aria-label="E.G.O 이름 검색"
                />
              </div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
            <SinnerFilter
              sinners={sinners}
              selected={filters.sinners}
              onToggle={v => toggle('sinners', v)}
            />
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
            <GradeFilter
              selected={filters.grades}
              onToggle={v => toggle('grades', v)}
            />
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
            <SinFilter
              selected={filters.sins}
              onToggle={v => toggle('sins', v)}
            />
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
            <KeywordFilter
              selected={filters.keywords}
              onToggle={v => toggle('keywords', v)}
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
              <p style={{ color: '#555', fontSize: '0.875rem' }}>조건에 맞는 E.G.O가 없습니다</p>
            </motion.div>
          ) : (
            <motion.div
              role="list"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3"
              initial={shouldReduceMotion ? false : 'initial'}
              whileInView={shouldReduceMotion ? undefined : 'animate'}
              viewport={shouldReduceMotion ? undefined : { once: true, margin: '-48px' }}
              variants={shouldReduceMotion ? undefined : staggerContainer(0.025)}
            >
              {filtered.map(ego => (
                <motion.div
                  key={ego.id}
                  role="listitem"
                  variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.6 }}
                >
                  <EGOBrowserCard ego={ego} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
