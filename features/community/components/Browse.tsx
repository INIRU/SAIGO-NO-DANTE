'use client'

import type { ReactNode, Ref } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { BoardCardSkeleton, CardGridSkeleton } from './BoardShelfSkeleton'
import type { DiscoveryKind } from '@/features/community/lib/recommend'
import BoardCard from './BoardCard'
import type { RowPost } from './BoardParts'

/**
 * The list view's top bar. On a phone it sticks under the navigation: the search field and the filters button, then the
 * result count and the sort. From lg up the filter panel at the side has the search, so only the count and sort remain.
 */
export function BrowseBar({ search, sort, filterCount, onOpenFilters, summary }: {
  search: { value: string; onChange: (value: string) => void; onClear: () => void; placeholder: string; label: string }
  sort?: { value: string; options: { key: string; label: string }[]; onChange: (key: string) => void }
  filterCount: number
  onOpenFilters: () => void
  summary: ReactNode
}) {
  const t = useTranslations('discoveryShelf')
  return (
    <div className="sticky-under-nav z-20 -mx-4 border-b border-[#241c14] bg-[var(--bg-deep)] px-4 pb-1 pt-2.5 md:mx-0 md:px-0 lg:static! lg:mb-2 lg:border-0 lg:pb-0 lg:pt-0">
      <div className="flex items-center gap-2 lg:hidden">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md border border-[#2e2417] bg-[#17120c] px-3 text-[var(--text-secondary)] focus-within:border-[var(--gold)]">
          <Search size={17} aria-hidden="true" className="shrink-0" />
          <input type="text" value={search.value} onChange={event => search.onChange(event.target.value)} placeholder={search.placeholder} aria-label={search.label} enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[1rem] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none" />
          {search.value && <button type="button" onClick={search.onClear} aria-label={t('clear')} className="grid h-8 w-8 shrink-0 place-items-center text-[var(--text-tertiary)]"><X size={15} aria-hidden="true" /></button>}
        </label>
        <button type="button" onClick={onOpenFilters} aria-label={t('filters')}
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#2e2417] bg-[#17120c] text-[var(--text-secondary)] transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none">
          <SlidersHorizontal size={18} aria-hidden="true" />
          {filterCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--gold)] px-1 font-[family-name:var(--font-title)] text-[0.875rem] leading-none text-[var(--bg-deep)]">{filterCount}</span>}
        </button>
      </div>
      <div className="flex min-h-11 items-center gap-3">
        <span role="status" aria-live="polite" className="min-w-0 flex-1 truncate text-[0.9375rem] text-[var(--text-secondary)]">{summary}</span>
        {sort && (
          <div role="group" className="flex shrink-0 gap-1">
            {sort.options.map(option => (
              <button key={option.key} type="button" aria-pressed={sort.value === option.key} onClick={() => sort.onChange(option.key)}
                className={`min-h-10 rounded-full px-3.5 text-sm transition-colors ${sort.value === option.key ? 'bg-[var(--gold)]/10 text-[var(--gold)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** The result list: board cards, with the loading shapes and the sentinel that loads the next page. */
export function BoardResults({ kind, posts, loading, hasMore, loadingMore, sentinelRef, empty }: {
  kind: DiscoveryKind
  posts: RowPost[]
  loading: boolean
  hasMore: boolean
  loadingMore: boolean
  sentinelRef: Ref<HTMLDivElement>
  empty: ReactNode
}) {
  if (loading) return <CardGridSkeleton plan={kind === 'planner'} />
  if (posts.length === 0) return <>{empty}</>
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {posts.map(post => <div key={post.id} className="min-w-0"><BoardCard kind={kind} post={post} compactOnPhone /></div>)}
        {/* The next page's shapes in the same grid, so they take the cells after the last card: two on a phone, six from md up. */}
        {loadingMore && Array.from({ length: 6 }, (_, index) => (
          <div key={`loading-${index}`} data-loading-card="" className={index < 2 ? 'min-w-0' : 'min-w-0 max-md:hidden'}><BoardCardSkeleton phoneRows={1} plan={kind === 'planner'} /></div>
        ))}
      </div>
      <div ref={sentinelRef} className="py-6" aria-hidden={!hasMore && !loadingMore} />
    </>
  )
}
