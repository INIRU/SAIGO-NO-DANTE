'use client'

import { useProgressiveRender } from '@/hooks/useProgressiveRender'
import type { SupportedLang } from '@/lib/i18n/types'
import KeywordCard, { KeywordCardSkeleton, kt, type KeywordEntry } from './KeywordCard'

const COLUMNS = {
  detail: 'repeat(auto-fill, minmax(min(100%, 26rem), 1fr))',
  compact: 'repeat(auto-fill, minmax(5.75rem, 1fr))',
}

/** Grid of placeholder cards for loading.tsx. */
export function KeywordGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid gap-x-8" style={{ gridTemplateColumns: COLUMNS.detail }}>
      {Array.from({ length: count }, (_, i) => <KeywordCardSkeleton key={i} />)}
    </div>
  )
}

export default function KeywordGrid({ keywords, countMaps, onSelect, viewMode, lang }: {
  keywords: KeywordEntry[]
  countMaps: { identity: Record<string, number>; ego: Record<string, number>; gift: Record<string, number> }
  onSelect: (kw: KeywordEntry) => void
  viewMode: 'detail' | 'compact'
  lang: SupportedLang
}) {
  const compact = viewMode === 'compact'
  const { visible, sentinelRef } = useProgressiveRender(keywords.length, compact ? 120 : 60)
  // Placeholder cards hold the next rows; the first one is the scroll sentinel.
  const placeholders = Math.max(0, Math.min(keywords.length - visible, compact ? 12 : 8))

  if (keywords.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="font-[family-name:var(--font-heading)] text-[1rem] text-[#9c8b73]">{kt('keyword.noResults.title', lang)}</p>
        <p className="mt-1 text-[0.8125rem] text-[var(--text-muted)]">{kt('keyword.noResults.subtitle', lang)}</p>
      </div>
    )
  }

  return (
    <div className={compact ? 'grid gap-2.5' : 'grid gap-x-8'} style={{ gridTemplateColumns: COLUMNS[viewMode] }}>
      {keywords.slice(0, visible).map(kw => (
        <KeywordCard
          key={kw.name}
          keyword={kw}
          counts={{ identity: countMaps.identity[kw.name] || 0, ego: countMaps.ego[kw.name] || 0, gift: countMaps.gift[kw.name] || 0 }}
          onClick={() => onSelect(kw)}
          lang={lang}
          compact={compact}
        />
      ))}
      {Array.from({ length: placeholders }, (_, i) => (
        <KeywordCardSkeleton key={i} ref={i === 0 ? sentinelRef : undefined} compact={compact} />
      ))}
    </div>
  )
}
