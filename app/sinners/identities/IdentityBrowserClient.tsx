'use client'

// Design Ref: §5.1 — 인격 전체 브라우저 클라이언트
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
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
import NumericFilter from '@/components/browser/NumericFilter'
import ActiveFilterChips from '@/components/browser/ActiveFilterChips'
import BrowserHeader from '@/components/browser/BrowserHeader'
import IdentityCard from '@/components/sinners/IdentityCard'

type Props = {
  identities: IdentityBrowserItem[]
  sinners: Sinner[]
}

const SORT_OPTIONS: DropdownOption<SortOption>[] = [
  { value: 'default', label: '기본' },
  { value: 'name', label: '이름순' },
  { value: 'rarity', label: '등급순' },
]

export default function IdentityBrowserClient({ identities, sinners }: Props) {
  const [nameQuery, setNameQuery] = useState('')

  const {
    filters, sort, setSort,
    items: filterResult,
    totalCount, filteredCount: filterCount, activeCount,
    toggle, resetAll,
  } = useIdentityBrowserFilters(identities)

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

  // 숫자 필터용 가능한 값 추출
  const availableWeights = useMemo(() => {
    const ws = new Set<number>()
    identities.forEach(id => id.atk_weights.forEach(w => ws.add(w)))
    return [...ws].sort((a, b) => a - b)
  }, [identities])

  const availableCoins = useMemo(() => {
    const cs = new Set<number>()
    identities.forEach(id => id.coin_counts.forEach(c => cs.add(c)))
    return [...cs].sort((a, b) => a - b)
  }, [identities])

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto">
      <BrowserHeader
        title="인격 전체"
        totalCount={totalCount}
        filteredCount={filteredCount}
        sort={sort}
        onSortChange={setSort}
        sortOptions={SORT_OPTIONS}
      />

      <div className="flex gap-6">
        {/* 사이드바 */}
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
                placeholder="인격 이름..."
                className="w-full rounded pl-7 pr-2 py-1.5 text-xs outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ccc',
                  fontSize: '0.75rem',
                }}
                aria-label="인격 이름 검색"
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
          <RarityFilter
            selected={filters.rarities}
            onToggle={v => toggle('rarities', v)}
          />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
          <SinFilter
            selected={filters.sins}
            onToggle={v => toggle('sins', v)}
          />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
          <AtkTypeFilter
            selected={filters.atkTypes}
            onToggle={v => toggle('atkTypes', v)}
          />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
          <KeywordFilter
            selected={filters.keywords}
            onToggle={v => toggle('keywords', v)}
          />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
          <NumericFilter
            sectionLabel="가중치"
            values={availableWeights}
            selected={filters.atkWeights}
            onToggle={v => toggle('atkWeights', v)}
          />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
          <NumericFilter
            sectionLabel="코인 수"
            values={availableCoins}
            selected={filters.coinCounts}
            onToggle={v => toggle('coinCounts', v)}
          />
          <ActiveFilterChips activeCount={activeCount} onReset={resetAll} />
        </FilterSidebar>

        {/* 카드 그리드 */}
        <div className="flex-1 min-w-0">
          {filteredCount === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p style={{ color: '#555', fontSize: '0.875rem' }}>조건에 맞는 인격이 없습니다</p>
            </div>
          ) : (
            <div role="list" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map(id => (
                <Link
                  key={id.id}
                  href={`/sinners/${id.sinner_slug}/identities/${id.id}`}
                  role="listitem"
                  aria-label={`${id.name_kr || id.name} 상세 보기`}
                >
                  <IdentityCard
                    identity={{
                      ...id,
                      tier: 0,
                    }}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
