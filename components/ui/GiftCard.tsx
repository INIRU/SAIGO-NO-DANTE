'use client'

import GiftArtwork, { type GiftArtworkGift } from '@/components/ui/GiftArtwork'

import { memo, type CSSProperties } from 'react'
import Image from 'next/image'
import styles from './GiftCard.module.css'
import { useLocale, useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import type { GiftConditionStatus } from '@/lib/planner/gift-condition-status'
import { GiftConditionLine, GiftConditionMark } from './GiftCondition'

// ── Props ────────────────────────────────────────────────────────────────────



interface GiftCardProps {
  gift: GiftArtworkGift
  onClick: () => void
  className?: string
  variant?: 'default' | 'insert'
  ariaLabel?: string
  title?: string
  /** Written as `data-gift-id`, so a list can tell which gift a pointer event started on without a handler per card. */
  giftId?: string
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
  conditionStatus?: GiftConditionStatus | null
  /** 조건 덮개 아래 설명 줄. 촘촘한 격자에서는 꺼서 줄 높이를 맞춘다(설명은 덮개 title에 남는다). */
  conditionDetail?: boolean
}

// ── Component ────────────────────────────────────────────────────────────────

const WARNING_TONES = {
  red: { glow: 'drop-shadow-[0_0_1px_#b81924]', fill: '#60151c', edge: '#bd2430', line: '#ff8b8b', mark: '#ffaaaa' },
  yellow: { glow: 'drop-shadow-[0_0_1px_#c8900a]', fill: '#4a3605', edge: '#c8900a', line: '#e8b030', mark: '#ffe08a' },
}

/** Warning triangle: red for a gift the plan asks to obtain, yellow for a fusion gift. The parent must be positioned. */
export function GiftWarningMark({ label, className = 'right-0 -top-0.5 h-3.5 w-3.5', tone = 'red' }: { label: string; className?: string; tone?: keyof typeof WARNING_TONES }) {
  const { glow, fill, edge, line, mark } = WARNING_TONES[tone]
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={label} data-gift-warning
      className={`pointer-events-none absolute z-30 ${glow} ${className}`}>
      <title>{label}</title>
      <path d="M16 3 30 28H2Z" fill={fill} stroke={edge} strokeWidth="4" strokeLinejoin="round" />
      <path d="M16 3 30 28H2Z" fill="none" stroke={line} strokeWidth="2.5" />
      <path d="M16 11v8" stroke={mark} strokeWidth="3" />
      <circle cx="16" cy="23" r="1.7" fill={mark} />
    </svg>
  )
}

// Intrinsic sizes of the game's enhancement sprites (MainUI_MirrorDungeon7_2).
const ENHANCE_SPRITES = {
  minus: { src: 'gift/enhance-minus', width: 30, height: 18 },
  plusIdle: { src: 'gift/enhance-plus-idle', width: 31, height: 30 },
  plusplusIdle: { src: 'gift/enhance-plusplus-idle', width: 61, height: 30 },
  plus: { src: 'gift/enhance-plus', width: 40, height: 41 },
  plusplus: { src: 'gift/enhance-plusplus', width: 70, height: 41 },
} as const

function EnhanceSprite({ sprite, alt = '', className, style }: { sprite: keyof typeof ENHANCE_SPRITES; alt?: string; className?: string; style?: CSSProperties }) {
  const { src, width, height } = ENHANCE_SPRITES[sprite]
  return <Image src={getGameUiAsset(src)} alt={alt} width={width} height={height} draggable={false} className={className} style={{ height: '100%', width: 'auto', ...style }} />
}

/** The +/++ mark in a gift's top-right corner. Level 0 shows a faint + when the gift can still be enhanced. */
export function GiftEnhanceMark({ level, onClick }: { level: number; onClick?: () => void }) {
  const t = useTranslations('giftEnhance')
  const sprite = level >= 2 ? 'plusplus' : level === 1 ? 'plus' : 'plusIdle'
  return (
    <span
      aria-hidden={level === 0 || undefined}
      onClick={onClick ? e => { e.stopPropagation(); onClick() } : undefined}
      className="pointer-events-auto absolute z-25 flex justify-end"
      style={{ top: '1%', right: '2%', height: level > 0 ? '30%' : '22%', maxWidth: '62%', opacity: level > 0 ? 1 : 0.35, cursor: onClick ? 'pointer' : undefined }}
    >
      <EnhanceSprite sprite={sprite} alt={level > 0 ? t(level >= 2 ? 'plusplus' : 'plus') : ''} style={{ filter: 'drop-shadow(0 0.0625rem 0.125rem rgba(0,0,0,0.9))' }} />
    </span>
  )
}

/**
 * Base / + / ++ switch shown under a picked gift. It sits outside GiftCard (a button) so the buttons stay valid,
 * and stays visible because touch screens have no hover.
 */
export function GiftEnhancePicker({ level, max, giftName, onChange }: { level: number; max: 1 | 2; giftName: string; onChange: (level: number) => void }) {
  const t = useTranslations('giftEnhance')
  const options = [
    { value: 0, label: t('base'), idle: 'minus', active: 'minus' },
    { value: 1, label: t('plus'), idle: 'plusIdle', active: 'plus' },
    { value: 2, label: t('plusplus'), idle: 'plusplusIdle', active: 'plusplus' },
  ].slice(0, max + 1) as { value: number; label: string; idle: keyof typeof ENHANCE_SPRITES; active: keyof typeof ENHANCE_SPRITES }[]
  return (
    <div role="radiogroup" aria-label={t('group', { gift: giftName })} className="mt-1 flex w-full overflow-hidden rounded-sm border" style={{ borderColor: '#2e2417', background: '#0d0b08' }}>
      {options.map(option => {
        const checked = level === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.value)}
            className="flex h-7 min-w-0 flex-1 items-center justify-center px-0.5 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#e8b030] motion-reduce:transition-none"
            style={{ background: checked ? 'rgba(200,144,10,0.16)' : undefined, boxShadow: checked ? 'inset 0 -2px 0 #c8900a' : undefined }}
          >
            <span className="flex max-w-full justify-center" style={{ height: option.value === 0 ? '0.4375rem' : checked && option.value > 0 ? '0.9375rem' : '0.6875rem', opacity: checked ? 1 : 0.55 }}>
              <EnhanceSprite sprite={checked ? option.active : option.idle} className="max-w-full object-contain" />
            </span>
          </button>
        )
      })}
    </div>
  )
}

const GiftCard = memo(function GiftCard({
  gift,
  onClick,
  className,
  variant = 'default',
  ariaLabel,
  title,
  giftId,
  size,
  showName = true,
  disabled,
  isSelected,
  enhance,
  onEnhance,
  onRemove,
  conditionStatus,
  conditionDetail = true,
  warning,
}: GiftCardProps) {
  const locale = useLocale()
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
      data-gift-id={giftId}
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
      <GiftArtwork gift={gift} displayName={displayName} isInsert={isInsert} isSelected={isSelected} enhance={enhance} className={styles.frame}>
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

        {/* Enhancement mark: the game's own +/++ sprite in the top-right corner. */}
        {!isInsert && enhance != null && enhance > 0 && (
          <GiftEnhanceMark level={enhance} onClick={onEnhance} />
        )}

        {/* Enhancement available indicator */}
        {!isInsert && enhance === 0 && onEnhance && (
          <GiftEnhanceMark level={0} onClick={onEnhance} />
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

        {!isInsert && conditionStatus && <GiftConditionMark status={conditionStatus} />}

        {/* Hover glow */}
        <div className={styles.glow} style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(251,183,46,0.18) 0%, transparent 50%)',
          transition: 'opacity 0.2s', pointerEvents: 'none',
        }} />
      </GiftArtwork>

      {warning && <GiftWarningMark label={warning} />}

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
      {!isInsert && conditionStatus && conditionDetail && <GiftConditionLine status={conditionStatus} />}
    </button>
  )
})

export default GiftCard
