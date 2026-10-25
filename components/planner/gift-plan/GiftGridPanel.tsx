'use client'

import { memo, useState, useMemo, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { GiftData } from '@/lib/planner/types'
import { GRADE_COLORS, GRADE_ROMAN, getKeywordSlug } from './constants'
import GiftCard from '@/components/ui/GiftCard'
import KeywordSidebar from './KeywordSidebar'
import { refNameLabels } from '@/lib/game-text/rich-text'
import { giftSearchText } from '@/lib/planner/gift-search'
import { useGameTextRefs, wantGameTextRefs } from '@/lib/hooks/useGameTextRefs'

// ── Gift grid with grade groups ──────────────────────────────────────────────
export default memo(function GiftGridPanel({
  gifts,
  selectedIds,
  onToggle,
  maxSelect,
  gradeOrder,
  searchable = false,
  searchPlaceholder,
  emptyLabel,
  readOnly = false,
  maxHeight = '28rem',
  layout = 'default',
}: {
  gifts: GiftData[]
  selectedIds: Set<number>
  onToggle: (gift: GiftData) => void
  maxSelect?: number
  gradeOrder: string[]
  searchable?: boolean
  searchPlaceholder?: string
  emptyLabel?: string
  readOnly?: boolean
  maxHeight?: string
  layout?: 'default' | 'stacked'
}) {
  const t = useTranslations('planner.giftTab')
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const locale = useLocale()
  // Effects of raw game text hold [Id]s; the search reads them as the names the screen shows, once the table is loaded.
  const { names } = useGameTextRefs({ lazy: true })
  const labels = useMemo(() => (names ? refNameLabels(names) : undefined), [names])
  useEffect(() => { if (query.trim()) wantGameTextRefs() }, [query])

  const filteredGifts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return gifts.filter(g => {
      const slug = getKeywordSlug(g.keyword)
      const matchesKeyword = !activeSlug || slug === activeSlug || (activeSlug === 'general' && (!g.keyword || g.keyword.includes('범용') || g.keyword.includes('공통')))
      if (!matchesKeyword) return false
      if (!normalizedQuery) return true

      const searchableText = giftSearchText(g, { names: labels, locale })

      return searchableText.includes(normalizedQuery)
    })
  }, [gifts, activeSlug, query, labels, locale])

  const giftCounts = useMemo(() => {
    const counts = new Map<string | null, number>()
    counts.set(null, gifts.length)
    for (const g of gifts) {
      const slug = getKeywordSlug(g.keyword)
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
    return counts
  }, [gifts])

  const grouped = useMemo(() => {
    const map = new Map<string, GiftData[]>()
    for (const grade of gradeOrder) map.set(grade, [])
    for (const g of filteredGifts) {
      const gr = g.grade ?? '1'
      if (!map.has(gr)) map.set(gr, [])
      map.get(gr)!.push(g)
    }
    return map
  }, [filteredGifts, gradeOrder])

  const atLimit = maxSelect !== undefined && selectedIds.size >= maxSelect

  return (
    <div
      className="planner-gift-grid-panel"
      style={{
        display: 'flex',
        flexDirection: layout === 'stacked' ? 'column' : 'row',
        gap: '0.75rem',
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* Keyword sidebar */}
      <KeywordSidebar
        activeSlug={activeSlug}
        onSelect={setActiveSlug}
        giftCounts={giftCounts}
        orientation={layout === 'stacked' ? 'horizontal' : 'vertical'}
      />

      {/* Grid area */}
      <div className="planner-gift-grid-scroll" style={{
        flex: 1,
        minWidth: 0,
        maxHeight,
        overflowY: 'auto',
        paddingRight: '0.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem',
      }}>
        {searchable && (
          <label style={{ display: 'block' }}>
            <span className="sr-only">{searchPlaceholder ?? t('final.searchPlaceholder')}</span>
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={searchPlaceholder ?? t('final.searchPlaceholder')}
              className="w-full rounded-md border bg-[var(--bg-deep)] px-3 py-2 text-[0.9375rem] text-neutral-200 outline-none transition-colors placeholder:text-neutral-600 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]"
              style={{ borderColor: '#30271d', minHeight: '2.75rem' }}
            />
          </label>
        )}

        {gradeOrder.map(grade => {
          const gradeGifts = grouped.get(grade) ?? []
          if (gradeGifts.length === 0) return null
          const gradeColor = GRADE_COLORS[grade] ?? '#888'

          return (
            <div key={grade}>
              {/* Grade divider header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                paddingBottom: '0.375rem',
                borderBottom: `1px solid ${gradeColor}22`,
              }}>
                <span style={{
                  fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: gradeColor,
                  letterSpacing: '0.03em',
                }}>
                  {t('grid.grade', { grade: GRADE_ROMAN[grade] ?? grade })}
                </span>
                <span style={{
                  fontSize: '0.625rem',
                  color: '#555',
                }}>
                  {gradeGifts.length}
                </span>
                <div style={{ flex: 1, height: '1px', background: `${gradeColor}15` }} />
              </div>

              {/* Gift cards */}
              <div className="planner-gift-card-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(4.5rem, 1fr))',
                gap: '0.5rem',
              }}>
                {gradeGifts.map(gift => {
                  const isSelected = selectedIds.has(gift.game_id)
                  return (
                    <div
                      key={gift.id}
                      style={{
                        contentVisibility: 'auto',
                        contain: 'layout style paint',
                        containIntrinsicSize: '4.5rem',
                      }}
                    >
                      <GiftCard
                        gift={gift}
                        isSelected={isSelected}
                        disabled={readOnly || (atLimit && !isSelected)}
                        onClick={() => {
                          if (!readOnly) onToggle(gift)
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {filteredGifts.length === 0 && (
          <div className="planner-gift-empty" style={{
            padding: '2.5rem',
            textAlign: 'center',
            color: '#4b5563',
            fontSize: '0.9375rem',
            border: '1px dashed #222',
            borderRadius: '0.5rem',
          }}>
            {emptyLabel ?? t('grid.emptyKeyword')}
          </div>
        )}
      </div>
    </div>
  )
})
