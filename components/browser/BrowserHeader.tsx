'use client'

// Design Ref: §5.6 — 브라우저 헤더 (타이틀 + 카운트 + 정렬)
import { Link } from '@/lib/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('browser')
  const showFiltered = filteredCount !== totalCount
  const gold = (chunks: React.ReactNode) => <span style={{ color: 'var(--gold)' }}>{chunks}</span>

  return (
    <div className="mb-6">
      {/* 뒤로가기 + 타이틀 */}
      <div className="flex items-center gap-3 mb-3">
        <Link
          href={backHref}
          className="transition-colors hover:text-[var(--gold)]"
          style={{ color: '#666' }}
          aria-label={t('back')}
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="break-keep font-[family-name:var(--font-heading)] text-[1.375rem] leading-tight text-[var(--gold)] md:text-[1.75rem]">
          {title}
        </h1>
      </div>

      {/* 카운트 + 정렬 */}
      <div className="flex items-center justify-between">
        <p aria-live="polite" style={{ color: '#888', fontSize: '0.8125rem' }}>
          {showFiltered
            ? t.rich('countFiltered', { filtered: filteredCount, total: totalCount, b: gold })
            : t.rich('countAll', { total: totalCount, b: gold })}
        </p>
        <Dropdown
          value={sort}
          options={sortOptions}
          onChange={onSortChange}
          prefix={t('sortPrefix')}
          defaultValue={'default' as SortOption}
        />
      </div>
    </div>
  )
}
