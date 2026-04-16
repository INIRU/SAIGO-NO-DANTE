'use client'

// Design Ref: §5.6 — 브라우저 헤더 (타이틀 + 카운트 + 정렬)
import { Link } from '@/lib/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import Dropdown, { type DropdownOption } from '@/components/ui/Dropdown'
import type { SortOption } from '@/lib/types/browser'

type Props = {
  title: string
  totalCount: number
  filteredCount: number
  sort: SortOption
  onSortChange: (sort: SortOption) => void
  sortOptions: DropdownOption<SortOption>[]
  backHref?: string
}

export default function BrowserHeader({
  title,
  totalCount,
  filteredCount,
  sort,
  onSortChange,
  sortOptions,
  backHref = '/sinners',
}: Props) {
  const showFiltered = filteredCount !== totalCount

  return (
    <div className="mb-6">
      {/* 뒤로가기 + 타이틀 */}
      <div className="flex items-center gap-3 mb-3">
        <Link
          href={backHref}
          className="transition-colors hover:text-[var(--gold)]"
          style={{ color: '#666' }}
          aria-label="수감자 목록으로 돌아가기"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-serif text-2xl md:text-3xl font-bold" style={{ color: 'var(--gold)' }}>
          {title}
        </h1>
      </div>

      {/* 카운트 + 정렬 */}
      <div className="flex items-center justify-between">
        <p aria-live="polite" style={{ color: '#888', fontSize: '0.8125rem' }}>
          {showFiltered ? (
            <><span style={{ color: 'var(--gold)' }}>{filteredCount}개</span> / 전체 {totalCount}개</>
          ) : (
            <>전체 <span style={{ color: 'var(--gold)' }}>{totalCount}개</span></>
          )}
        </p>
        <Dropdown
          value={sort}
          options={sortOptions}
          onChange={onSortChange}
          prefix="정렬:"
          defaultValue={'default' as SortOption}
        />
      </div>
    </div>
  )
}
