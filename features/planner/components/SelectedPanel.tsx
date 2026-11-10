'use client'

import { useTranslations } from 'next-intl'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import type { GiftData } from '@/lib/planner/types'

// ── Selected gift panel (right sidebar) ──────────────────────────────────────
export default function SelectedPanel({
  title,
  selectedGifts,
  onRemove,
  badge,
  footer,
  bandLabel,
}: {
  /** The band over each card (관측 / 시작). */
  bandLabel?: string
  title: string
  selectedGifts: GiftData[]
  onRemove: (gift: GiftData) => void
  badge?: React.ReactNode
  footer?: React.ReactNode
}) {
  const t = useTranslations('planner.giftTab')

  return (
    <div className="planner-selected-panel" style={{
      background: 'rgba(17,17,17,0.6)',
      border: '1px solid #1f1a14',
      borderRadius: '0.5rem',
      padding: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      minWidth: '16rem',
      maxWidth: '20rem',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '0.375rem',
        borderBottom: '1px solid #1f1a14',
      }}>
        <span className="planner-selected-panel-title" style={{
          fontSize: '0.75rem',
          color: 'var(--gold)',
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}>
          {title}
        </span>
        {badge}
      </div>

      {/* Gift list */}
      {selectedGifts.length === 0 ? (
        <div className="planner-selected-panel-empty" style={{
          padding: '1.5rem 0',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          border: '1px dashed #1f1a14',
          borderRadius: '0.375rem',
        }}>
          {t('selectedPanel.empty')}
        </div>
      ) : (
        <ul className="planner-selected-panel-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(4.25rem, 1fr))', gap: '0.5rem' }}>
          {selectedGifts.map(gift => (
            <li key={gift.id} style={{ minWidth: 0 }}>
              {/* 카드를 누르면 빠진다(꾹 누르면 설명). 왼쪽 아래 ×는 마우스를 올렸을 때의 표시다. */}
              <GiftCard gift={gift} size="100%" bandLabel={bandLabel} title={t('selectedPanel.remove')}
                onClick={() => onRemove(gift)} onRemove={() => onRemove(gift)} />
            </li>
          ))}
        </ul>
      )}

      {/* Footer (starlight cost, etc.) */}
      {footer}
    </div>
  )
}
