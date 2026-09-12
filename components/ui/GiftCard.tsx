'use client'

import GiftArtwork, { type GiftArtworkGift } from '@/components/ui/GiftArtwork'

import { memo } from 'react'
import styles from './GiftCard.module.css'
import { useLocale, useTranslations } from 'next-intl'
import { X } from 'lucide-react'

// ── Props ────────────────────────────────────────────────────────────────────



interface GiftCardProps {
  gift: GiftArtworkGift
  onClick: () => void
  className?: string
  variant?: 'default' | 'insert'
  ariaLabel?: string
  title?: string
  /** Fixed card width */
  size?: string
  /** Show name text below card (default: true) */
  showName?: boolean
  disabled?: boolean
  // ── Selection ──
  isSelected?: boolean
  // ── Enhancement ──
  enhance?: number          // 0=base, 1=+, 2=++
  onEnhance?: () => void
  // ── Remove ──
  onRemove?: () => void
  // ── Condition status ──
  warning?: string
  conditionStatus?: { level: 'warn' | 'unmet'; text: string } | null
}

// ── Component ────────────────────────────────────────────────────────────────

const GiftCard = memo(function GiftCard({
  gift,
  onClick,
  className,
  variant = 'default',
  ariaLabel,
  title,
  size,
  showName = true,
  disabled,
  isSelected,
  enhance,
  onEnhance,
  onRemove,
  conditionStatus,
  warning,
}: GiftCardProps) {
  const locale = useLocale()
  const t = useTranslations('planner.giftTab.conditionStatus')
  const isInsert = variant === 'insert'
  const displayName = locale === 'en'
    ? gift.name_en || gift.name
    : locale === 'ja'
      ? gift.name_jp || gift.name
      : gift.name

  return (
    <button
      className={`gift-card ${styles.card}${className ? ` ${className}` : ''}`}
      aria-label={warning ? `${ariaLabel ?? displayName} · ${warning}` : ariaLabel ?? displayName}
      title={title ?? displayName}
      onClick={onClick}
      disabled={disabled}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: size ?? '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'none',
        border: 'none',
        padding: 0,
        opacity: disabled ? 0.4 : 1,
        transition: 'transform 0.2s ease, opacity 0.15s',
        position: 'relative',
      }}
    >
      <GiftArtwork gift={gift} displayName={displayName} isInsert={isInsert} isSelected={isSelected} className={styles.frame}>
        {/* Selected checkmark */}
        {!isInsert && isSelected && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(200,144,10,0.22)',
          }}>
            <span style={{ color: '#e8b030', fontSize: '1.5rem', textShadow: '0 0 0.5rem rgba(200,144,10,0.6)' }}>✓</span>
          </div>
        )}

        {/* Enhancement badge */}
        {!isInsert && enhance != null && enhance > 0 && (
          <div
            onClick={e => { e.stopPropagation(); onEnhance?.() }}
            style={{
              position: 'absolute', top: '1%', right: '6%', zIndex: 25, cursor: 'pointer',
              fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
              fontWeight: 800, fontSize: '1.25rem', lineHeight: 1,
              color: enhance === 2 ? '#ff8c00' : '#e8b030',
              textShadow: enhance === 2
                ? '0 0 0.5rem rgba(255,140,0,0.8), 0 0 1rem rgba(255,100,0,0.5), 0 0.125rem 0.25rem rgba(0,0,0,0.9)'
                : '0 0 0.375rem rgba(200,144,10,0.6), 0 0.125rem 0.25rem rgba(0,0,0,0.8)',
            }}
          >
            <span style={{
              display: 'inline-block', padding: '0.0625rem 0.125rem', borderRadius: '0.125rem',
              background: enhance === 2
                ? 'radial-gradient(ellipse, rgba(255,140,0,0.35) 0%, transparent 70%)'
                : 'radial-gradient(ellipse, rgba(232,176,48,0.3) 0%, transparent 70%)',
              filter: enhance === 2
                ? 'drop-shadow(0 0 0.375rem rgba(255,100,0,0.8)) drop-shadow(0 0 0.75rem rgba(255,140,0,0.4))'
                : 'drop-shadow(0 0 0.25rem rgba(232,176,48,0.7)) drop-shadow(0 0 0.5rem rgba(200,144,10,0.3))',
            }}>
              {enhance === 2 ? '++' : '+'}
            </span>
          </div>
        )}

        {/* Enhancement available indicator */}
        {!isInsert && enhance === 0 && onEnhance && (
          <div
            onClick={e => { e.stopPropagation(); onEnhance() }}
            style={{
              position: 'absolute', top: '1%', right: '6%', zIndex: 25, cursor: 'pointer',
              fontSize: '1.25rem', fontWeight: 800, color: '#44403c',
              fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
            }}
          >+</div>
        )}

        {/* Remove button */}
        {!isInsert && onRemove && (
          <div
            className={styles.remove}
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onRemove() }}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onRemove() } }}
            style={{
              position: 'absolute', bottom: '4%', left: '4%', zIndex: 25,
              background: 'rgba(220,38,38,0.85)', borderRadius: '50%',
              width: '1rem', height: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
              transition: 'opacity 0.15s',
            }}
          >
            <X size={10} color="#fff" />
          </div>
        )}

        {/* Condition overlay */}
        {!isInsert && conditionStatus && (
          <div
            title={conditionStatus.level === 'unmet'
              ? t('unmetTitle', { text: conditionStatus.text })
              : t('warnTitle', { text: conditionStatus.text })}
            style={{
              position: 'absolute', inset: 0, zIndex: 18,
              background: conditionStatus.level === 'unmet' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'auto', cursor: 'help',
            }}
          >
            <span style={{
              fontSize: '0.5rem', fontWeight: 700,
              color: conditionStatus.level === 'unmet' ? '#ef4444' : '#e8b030',
              textShadow: '0 0 0.25rem rgba(0,0,0,0.9)',
              textAlign: 'center', lineHeight: 1.3, padding: '0 0.125rem',
            }}>
              {conditionStatus.level === 'unmet' ? t('unmetLabel') : t('warnLabel')}
            </span>
          </div>
        )}

        {/* Hover glow */}
        <div className={styles.glow} style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(251,183,46,0.18) 0%, transparent 50%)',
          transition: 'opacity 0.2s', pointerEvents: 'none',
        }} />
      </GiftArtwork>

      {warning && (
        <svg viewBox="0 0 32 32" role="img" aria-label={warning} data-gift-warning
          className="pointer-events-none absolute right-0 -top-0.5 z-30 h-3.5 w-3.5 drop-shadow-[0_0_1px_#b81924]">
          <title>{warning}</title>
          <path d="M16 3 30 28H2Z" fill="#60151c" stroke="#bd2430" strokeWidth="4" strokeLinejoin="round" />
          <path d="M16 3 30 28H2Z" fill="none" stroke="#ff8b8b" strokeWidth="2.5" />
          <path d="M16 11v8" stroke="#ffaaaa" strokeWidth="3" />
          <circle cx="16" cy="23" r="1.7" fill="#ffaaaa" />
        </svg>
      )}

      {/* Name below card */}
      {showName && !isInsert && (
        <p style={{
          fontSize: '0.5625rem',
          color: conditionStatus?.level === 'unmet' ? '#ef4444'
            : conditionStatus?.level === 'warn' ? '#e8b030'
            : isSelected ? '#e8b030' : '#aaa',
          textAlign: 'center',
          marginTop: '0.25rem',
          lineHeight: 1.45,
          minHeight: '0.875rem',
          paddingTop: '0.0625rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
          transition: 'color 0.15s',
          fontFamily: 'var(--font-heading)',
        }}>
          {displayName}
        </p>
      )}
      {!isInsert && conditionStatus && (
        <p style={{ fontSize: '0.5rem', color: conditionStatus.level === 'unmet' ? '#ef4444' : '#e8b030', textAlign: 'center', lineHeight: 1.2, marginTop: '0.0625rem' }}>
          {conditionStatus.text}
        </p>
      )}
    </button>
  )
})

export default GiftCard
