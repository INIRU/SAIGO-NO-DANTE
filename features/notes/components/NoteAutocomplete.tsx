'use client'

import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import KeywordIcon from '@/components/ui/KeywordIcon'
import { getSuggestionMeta, localizeLabel, type AutocompleteSuggestion } from '@/features/notes/lib/autocomplete'

// Existing importers read these from here.
export { buildEgoGiftPool, buildKeywordPool, getNoteAutocompleteContext, getNoteAutocompleteSuggestions, type AutocompleteSuggestion } from '@/features/notes/lib/autocomplete'

// ── 타입 ─────────────────────────────────────────────────────────────────
export type CaretAnchor = {
  left: number
  top: number
  width?: number
}

const DROPDOWN_MAX_HEIGHT_REM = 10

// ── 자동완성 드롭다운 UI ─────────────────────────────────────────────────
export function NoteAutocompleteDropdown({
  suggestions,
  selectedIdx,
  onSelect,
  onHover,
  anchor,
}: {
  suggestions: AutocompleteSuggestion[]
  selectedIdx: number
  onSelect: (sugg: AutocompleteSuggestion) => void
  onHover: (idx: number) => void
  anchor?: CaretAnchor | null
}) {
  const lang = useLocale()
  if (suggestions.length === 0) return null
  const positionStyle: React.CSSProperties = anchor
    ? {
        left: anchor.left,
        top: anchor.top,
        width: anchor.width ? Math.min(anchor.width, 340) : undefined,
        maxWidth: 'calc(100vw - 1rem)',
      }
    : { left: 0, right: 0, bottom: '100%', marginBottom: -1 }
  const dropdown = (
    <div style={{
      position: anchor ? 'fixed' : 'absolute', ...positionStyle,
      background: 'rgba(18,15,11,0.98)',
      border: '1px solid rgba(200,144,10,0.2)',
      borderRadius: anchor ? '0.3125rem' : '0.3125rem 0.3125rem 0 0',
      padding: '0.1875rem',
      boxShadow: anchor ? '0 0.5rem 1.25rem rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.035)' : '0 -0.375rem 0.875rem rgba(0,0,0,0.32)',
      zIndex: 120,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.0625rem', maxHeight: `${DROPDOWN_MAX_HEIGHT_REM}rem`, overflowY: 'auto', scrollbarGutter: 'stable', overscrollBehavior: 'contain' }}>
        {suggestions.map((sugg, i) => {
          const isSelected = i === Math.max(selectedIdx, 0)
          const Icon = sugg.type === 'keyword' ? KeywordIcon : Image
          const hasLeadingMeta = !sugg.imageUrl && !sugg.iconUrl && Boolean(sugg.typeLabel)
          const meta = hasLeadingMeta ? undefined : getSuggestionMeta(sugg)
          const trailingMeta = meta && localizeLabel(meta, lang)
          return (
            <button
              key={sugg.token}
              onMouseDown={e => { e.preventDefault(); onSelect(sugg) }}
              onMouseEnter={() => onHover(i)}
              ref={isSelected ? element => { element?.scrollIntoView({ block: 'nearest' }) } : undefined}
              className="flex items-center gap-1.5 rounded text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
              style={{
                background: isSelected ? 'rgba(200,144,10,0.1)' : 'transparent',
                border: '1px solid transparent',
                boxShadow: isSelected ? 'inset 0 0 0 1px rgba(200,144,10,0.12)' : 'none',
                cursor: 'pointer',
                width: '100%',
                minHeight: '2rem',
                padding: '0.125rem 0.375rem',
                lineHeight: 1.2,
              }}
            >
              {sugg.imageUrl ? (
                <span style={{ width: 24, height: 24, borderRadius: '0.1875rem', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.055)' }}>
                  <Image src={sugg.imageUrl} alt="" width={24} height={24} style={{ width: 24, height: 24, objectFit: 'cover', objectPosition: 'top' }} unoptimized />
                </span>
              ) : sugg.iconUrl ? (
                <span style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon src={sugg.iconUrl} alt="" width={15} height={15} style={{ width: 15, height: 15, objectFit: 'contain' }} unoptimized />
                </span>
              ) : sugg.typeLabel ? (
                <span style={{ fontSize: '0.75rem', color: '#b9aa90', fontFamily: 'var(--font-mono)', flexShrink: 0, minWidth: sugg.syntax === 'block' ? '4rem' : '1.75rem', textAlign: 'center' }}>{sugg.typeLabel}</span>
              ) : (
                <span style={{ width: 24, flexShrink: 0 }} />
              )}
              <span style={{ color: sugg.color, fontSize: '0.875rem', fontWeight: 650, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sugg.token.endsWith(':') ? localizeLabel(sugg.label, lang) : sugg.label}</span>
              {trailingMeta && (
                <span style={{
                  color: '#a79a86',
                  fontSize: '0.75rem',
                  flexShrink: 0,
                  padding: '0 0.125rem',
                  fontFamily: 'var(--font-mono)',
                }}>{trailingMeta}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
  if (anchor && typeof document !== 'undefined') return createPortal(dropdown, document.body)
  return dropdown
}
