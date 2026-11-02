'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { KEYWORD_FILTERS, getKeywordIconUrl } from './constants'

// ── Keyword filter sidebar (vertical) ────────────────────────────────────────
export default function KeywordSidebar({
  activeSlug,
  onSelect,
  giftCounts,
  orientation = 'vertical',
}: {
  activeSlug: string | null
  onSelect: (slug: string | null) => void
  giftCounts: Map<string | null, number>
  orientation?: 'vertical' | 'horizontal'
}) {
  const t = useTranslations('planner.giftTab')
  const keywordLabel = (slug: string | null) => t(`keywords.${slug ?? 'all'}`)

  return (
    <div className="planner-keyword-sidebar" style={{
      display: 'flex',
      flexDirection: orientation === 'horizontal' ? 'row' : 'column',
      gap: orientation === 'horizontal' ? '0.375rem' : '0.125rem',
      minWidth: orientation === 'horizontal' ? 0 : '7.5rem',
      maxWidth: orientation === 'horizontal' ? 'none' : '8.5rem',
      overflowX: orientation === 'horizontal' ? 'auto' : undefined,
      flexShrink: 0,
    }}>
      {KEYWORD_FILTERS.map(tab => {
        const isActive = activeSlug === tab.slug
        const count = giftCounts.get(tab.slug) ?? 0
        const iconUrl = tab.slug ? getKeywordIconUrl(tab.slug) : null
        const label = keywordLabel(tab.slug)
        const horizontalBorder = `1px solid ${isActive ? 'rgba(200,144,10,0.45)' : '#2a2520'}`

        return (
          <button
            key={tab.slug ?? 'all'}
            onClick={() => onSelect(tab.slug)}
            className={`planner-keyword-filter${isActive ? ' is-active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.5rem',
              background: isActive ? 'rgba(200,144,10,0.08)' : 'transparent',
              borderTop: orientation === 'horizontal' ? horizontalBorder : 'none',
              borderRight: orientation === 'horizontal' ? horizontalBorder : 'none',
              borderBottom: orientation === 'horizontal' ? horizontalBorder : 'none',
              borderLeft: orientation === 'horizontal' ? horizontalBorder : `2px solid ${isActive ? 'var(--gold)' : 'transparent'}`,
              borderRadius: orientation === 'horizontal' ? '0.375rem' : '0 0.25rem 0.25rem 0',
              cursor: 'pointer',
              color: isActive ? 'var(--gold-light)' : 'var(--text-muted)',
              fontSize: orientation === 'horizontal' ? '0.9375rem' : '0.75rem',
              fontWeight: isActive ? 700 : 400,
              transition: 'all 0.15s',
              textAlign: 'left',
              minHeight: orientation === 'horizontal' ? '2.75rem' : undefined,
              minWidth: orientation === 'horizontal' ? '8.25rem' : undefined,
              flex: orientation === 'horizontal' ? '0 0 auto' : undefined,
            }}
          >
            {iconUrl && (
              <Image
                src={iconUrl}
                alt={label}
                width={20}
                height={20}
                style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain', flexShrink: 0 }}
              />
            )}
            {!iconUrl && tab.slug === null && (
              <span className="planner-keyword-filter-mark" style={{ width: '1.25rem', textAlign: 'center', fontSize: '0.875rem', flexShrink: 0 }}>⬡</span>
            )}
            <span style={{ flex: 1 }}>{label}</span>
            <span style={{
              fontSize: '0.5625rem',
              color: isActive ? 'var(--gold)' : 'var(--text-muted)',
              background: isActive ? 'rgba(200,144,10,0.15)' : 'var(--bg-card)',
              padding: '0 0.375rem',
              borderRadius: '0.5rem',
              lineHeight: 1.6,
              minWidth: '1.25rem',
              textAlign: 'center',
            }}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
