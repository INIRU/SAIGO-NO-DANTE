'use client'

import { useState, memo } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { X, FlaskConical } from 'lucide-react'
import { OCTAGON_CLIP, GRADE_ROMAN, GIFT_BG_URL, getGiftKeywordSlug, getGiftKeywordIconUrl } from '@/lib/constants/gift'

// ── Props ────────────────────────────────────────────────────────────────────

interface GiftCardGift {
  grade?: string | null
  keyword?: string | null
  image_url?: string | null
  name: string
  name_en?: string | null
  name_jp?: string | null
}

interface GiftCardProps {
  gift: GiftCardGift
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
}: GiftCardProps) {
  const locale = useLocale()
  const t = useTranslations('planner.giftTab.conditionStatus')
  const [hovered, setHovered] = useState(false)
  const isInsert = variant === 'insert'
  const isEX = gift.grade === 'EX'
  const gradeLabel = GRADE_ROMAN[gift.grade ?? '1'] ?? gift.grade
  const kwSlug = getGiftKeywordSlug(gift.keyword ?? null)
  const kwIconUrl = kwSlug ? getGiftKeywordIconUrl(kwSlug) : null
  const displayName = locale === 'en'
    ? gift.name_en || gift.name
    : locale === 'ja'
      ? gift.name_jp || gift.name
      : gift.name

  return (
    <button
      className={className ? `gift-card ${className}` : 'gift-card'}
      aria-label={ariaLabel ?? displayName}
      title={title ?? displayName}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        transform: hovered && !disabled ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 0.2s ease, opacity 0.15s',
        zIndex: hovered ? 10 : 1,
        position: 'relative',
      }}
    >
      {/* Octagon frame */}
      <div className="gift-frame" style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        overflow: 'hidden',
        backgroundImage: `url(${GIFT_BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        clipPath: OCTAGON_CLIP,
        containerType: 'inline-size',
        outline: isSelected ? '2px solid #c8900a' : 'none',
        outlineOffset: '2px',
        boxShadow: hovered && !disabled ? '0 0 0.75rem rgba(200,144,10,0.3)' : 'none',
      }}>
        {/* Grade label */}
        {!isInsert && (
          <span style={{
            position: 'absolute',
            top: '4%',
            left: '3%',
            zIndex: 10,
            pointerEvents: 'none',
            fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(1rem, 28cqw, 2.5rem)',
            lineHeight: 1,
            color: isEX ? 'rgb(198, 255, 46)' : 'rgb(251, 183, 46)',
            textShadow: isEX
              ? '0 0 0.625rem rgb(251,255,8), 0 0 0.25rem rgb(12,90,0), 0.0625rem 0.0625rem 0.125rem rgba(0,0,0,0.8)'
              : '0 0 0.5rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
          }}>
            {gradeLabel}
          </span>
        )}

        {/* Keyword icon */}
        {!isInsert && kwIconUrl && (
          <div style={{
            position: 'absolute',
            right: '5%',
            bottom: '5%',
            zIndex: 10,
            pointerEvents: 'none',
            width: '28%',
            height: '28%',
          }}>
            <Image src={kwIconUrl} alt="" fill sizes="40px" style={{ objectFit: 'contain' }} />
          </div>
        )}

        {/* Gift image */}
        <div style={{
          position: 'absolute', inset: '15%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isInsert ? (
            <span style={{
              color: '#f0d48a',
              fontFamily: 'var(--font-mono)',
              fontSize: 'clamp(1rem, 32cqw, 2rem)',
              fontWeight: 800,
              lineHeight: 1,
              textShadow: '0 0 0.375rem rgba(0,0,0,0.85)',
            }}>
              +
            </span>
          ) : gift.image_url ? (
            <div className="relative w-full h-full">
              <ImageWithFallback src={gift.image_url} alt={displayName} fill fallbackType="gift" className="object-contain" sizes="120px" />
            </div>
          ) : (
            <FlaskConical size="1.5rem" style={{ color: '#444' }} />
          )}
        </div>

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
              opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
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
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(251,183,46,0.18) 0%, transparent 50%)',
          opacity: hovered && !disabled ? 1 : 0,
          transition: 'opacity 0.2s', pointerEvents: 'none',
        }} />
      </div>

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
