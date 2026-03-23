'use client'

import Image from 'next/image'
import { KEYWORD_FILTERS, getKeywordIconUrl } from './constants'

// ── Keyword filter sidebar (vertical) ────────────────────────────────────────
export default function KeywordSidebar({
  activeSlug,
  onSelect,
  giftCounts,
}: {
  activeSlug: string | null
  onSelect: (slug: string | null) => void
  giftCounts: Map<string | null, number>
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.125rem',
      minWidth: '7.5rem',
      maxWidth: '8.5rem',
      flexShrink: 0,
    }}>
      {KEYWORD_FILTERS.map(tab => {
        const isActive = activeSlug === tab.slug
        const count = giftCounts.get(tab.slug) ?? 0
        const iconUrl = tab.slug ? getKeywordIconUrl(tab.slug) : null

        return (
          <button
            key={tab.slug ?? 'all'}
            onClick={() => onSelect(tab.slug)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.5rem',
              background: isActive ? 'rgba(200,144,10,0.08)' : 'transparent',
              border: 'none',
              borderLeft: `2px solid ${isActive ? '#c8900a' : 'transparent'}`,
              borderRadius: '0 0.25rem 0.25rem 0',
              cursor: 'pointer',
              color: isActive ? '#e8b030' : '#777',
              fontSize: '0.75rem',
              fontWeight: isActive ? 700 : 400,
              transition: 'all 0.15s',
              textAlign: 'left',
            }}
          >
            {iconUrl && (
              <Image
                src={iconUrl}
                alt={tab.label}
                width={20}
                height={20}
                style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain', flexShrink: 0 }}
              />
            )}
            {!iconUrl && tab.slug === null && (
              <span style={{ width: '1.25rem', textAlign: 'center', fontSize: '0.875rem', flexShrink: 0 }}>⬡</span>
            )}
            <span style={{ flex: 1 }}>{tab.label}</span>
            <span style={{
              fontSize: '0.5625rem',
              color: isActive ? '#c8900a' : '#444',
              background: isActive ? 'rgba(200,144,10,0.15)' : '#1a1510',
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
