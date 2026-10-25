'use client'

import GiftGrade from '@/components/ui/GiftGrade'

import { GIFT_BG_URL } from '@/lib/constants/gift'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import type { GiftData } from '@/lib/planner/types'
import { OCTAGON_CLIP, GRADE_COLORS } from './constants'

// ── Selected gift panel (right sidebar) ──────────────────────────────────────
export default function SelectedPanel({
  title,
  selectedGifts,
  onRemove,
  badge,
  footer,
}: {
  title: string
  selectedGifts: GiftData[]
  onRemove: (gift: GiftData) => void
  badge?: React.ReactNode
  footer?: React.ReactNode
}) {
  const locale = useLocale()
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
          color: '#2f2a20',
          fontSize: '0.75rem',
          border: '1px dashed #1f1a14',
          borderRadius: '0.375rem',
        }}>
          {t('selectedPanel.empty')}
        </div>
      ) : (
        <div className="planner-selected-panel-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {selectedGifts.map(gift => {
            const gradeColor = GRADE_COLORS[gift.grade ?? '1'] ?? '#888'
            const displayName = locale === 'en'
              ? gift.name_en || gift.name
              : locale === 'ja'
                ? gift.name_jp || gift.name
                : gift.name
            return (
              <div
                key={gift.id}
                className="planner-selected-gift-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.3rem 0.375rem',
                  background: 'var(--bg-card)',
                  border: '1px solid #2a2520',
                  borderRadius: '0.375rem',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Mini octagon image with grade */}
                <div style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  flexShrink: 0,
                  clipPath: OCTAGON_CLIP,
                  backgroundImage: `url(${GIFT_BG_URL})`,
                  backgroundSize: 'contain',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <GiftGrade grade={gift.grade} style={{
                    position: 'absolute', top: '2%', left: '4%', zIndex: 10,
                    fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                    fontWeight: 700, fontSize: '0.75rem', lineHeight: 1,
                    color: 'rgb(251,183,46)',
                    textShadow: '0 0 0.25rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
                  }} />
                  {gift.image_url?.startsWith('http') && (
                    <Image
                      src={gift.image_url}
                      alt={displayName}
                      fill
                      sizes="36px"
                      style={{ objectFit: 'contain', padding: '15%' }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: '0.6875rem',
                    color: '#d1d5db',
                    lineHeight: 1.3,
                    wordBreak: 'keep-all',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {displayName}
                  </span>
                  <GiftGrade plain grade={gift.grade} style={{
                    fontSize: '0.5rem',
                    color: gradeColor,
                    fontWeight: 700,
                  }} />
                </div>
                <button
                  className="planner-selected-remove"
                  onClick={() => onRemove(gift)}
                  style={{
                    background: 'rgba(220,38,38,0.6)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '1rem',
                    height: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                  title={t('selectedPanel.remove')}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.9)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.6)')}
                >
                  <X size={10} color="#fff" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer (starlight cost, etc.) */}
      {footer}
    </div>
  )
}
