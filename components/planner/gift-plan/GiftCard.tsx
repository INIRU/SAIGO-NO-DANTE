'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import type { GiftData } from '@/lib/planner/types'
import { OCTAGON_CLIP, GRADE_ROMAN, STORAGE_BASE, getKeywordIconUrl, getKeywordSlug } from './constants'

// ── 8-sided gift card ────────────────────────────────────────────────────────
export default function GiftCard({
  gift,
  isSelected,
  onClick,
  disabled,
  enhance,
  onEnhance,
  onRemove,
  conditionStatus,
}: {
  gift: GiftData
  isSelected: boolean
  onClick: () => void
  disabled?: boolean
  enhance?: number       // 0=기본, 1=+, 2=++
  onEnhance?: () => void // 강화 순환 클릭
  onRemove?: () => void  // 제거 클릭
  conditionStatus?: { level: 'warn' | 'unmet'; text: string } | null
}) {
  const [hovered, setHovered] = useState(false)
  const kwSlug = getKeywordSlug(gift.keyword ?? null)
  const kwIconUrl = kwSlug ? getKeywordIconUrl(kwSlug) : null

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: '4.5rem',
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
      {/* 8-sided frame */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        overflow: 'hidden',
        backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        clipPath: OCTAGON_CLIP,
        outline: isSelected ? '2px solid #c8900a' : 'none',
        outlineOffset: '2px',
        boxShadow: hovered && !disabled
          ? '0 0 0.75rem rgba(200,144,10,0.3)'
          : 'none',
      }}>
        {/* Grade label top-left */}
        <span style={{
          position: 'absolute',
          top: '4%',
          left: '3%',
          zIndex: 10,
          pointerEvents: 'none',
          fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
          fontWeight: 700,
          fontSize: '1.25rem',
          lineHeight: 1,
          color: (gift.grade === 'EX') ? 'rgb(198, 255, 46)' : 'rgb(251, 183, 46)',
          textShadow: (gift.grade === 'EX')
            ? '0 0 0.625rem rgb(251,255,8), 0 0 0.25rem rgb(12,90,0), 0.0625rem 0.0625rem 0.125rem rgba(0,0,0,0.8)'
            : '0 0 0.5rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
        }}>
          {GRADE_ROMAN[gift.grade ?? '1'] ?? gift.grade}
        </span>

        {/* Keyword icon bottom-right */}
        {kwIconUrl && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            zIndex: 10,
            pointerEvents: 'none',
            width: '30%',
            height: '30%',
          }}>
            <Image src={kwIconUrl} alt="" fill sizes="40px" style={{ objectFit: 'contain' }} />
          </div>
        )}

        {/* Gift image centered */}
        <div style={{
          position: 'absolute',
          inset: '15%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {gift.image_url?.startsWith('http') ? (
            <Image src={gift.image_url} alt={gift.name} fill style={{ objectFit: 'contain' }} sizes="80px" />
          ) : (
            <div style={{ width: '1.75rem', height: '1.75rem', background: '#333', borderRadius: '50%' }} />
          )}
        </div>

        {/* Selected checkmark overlay */}
        {isSelected && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
            background: 'rgba(200,144,10,0.22)',
          }}>
            <span style={{
              color: '#e8b030',
              fontSize: '1.5rem',
              textShadow: '0 0 0.5rem rgba(200,144,10,0.6)',
            }}>
              ✓
            </span>
          </div>
        )}

        {/* 강화 배지 — 오른쪽 위 (카드 내부) */}
        {enhance != null && enhance > 0 && (
          <div
            onClick={e => { e.stopPropagation(); onEnhance?.() }}
            style={{
              position: 'absolute',
              top: '1%',
              right: '6%',
              zIndex: 25,
              cursor: 'pointer',
              fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
              fontWeight: 800,
              fontSize: '1.25rem',
              lineHeight: 1,
              color: enhance === 2 ? '#ff8c00' : '#e8b030',
              textShadow: enhance === 2
                ? '0 0 0.5rem rgba(255,140,0,0.8), 0 0 1rem rgba(255,100,0,0.5), 0 0.125rem 0.25rem rgba(0,0,0,0.9)'
                : '0 0 0.375rem rgba(200,144,10,0.6), 0 0.125rem 0.25rem rgba(0,0,0,0.8)',
            }}
          >
            <span style={{
              display: 'inline-block',
              padding: '0.0625rem 0.125rem',
              borderRadius: '0.125rem',
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

        {/* 강화 가능 표시 (미강화) */}
        {enhance === 0 && onEnhance && (
          <div
            onClick={e => { e.stopPropagation(); onEnhance() }}
            style={{
              position: 'absolute', top: '1%', right: '6%', zIndex: 25, cursor: 'pointer',
              fontSize: '1.25rem', fontWeight: 800, color: '#44403c',
              fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
            }}
          >+</div>
        )}

        {/* 제거 버튼 — 왼쪽 아래 (호버 시만) */}
        {onRemove && (
          <div
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onRemove() }}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onRemove() } }}
            style={{
              position: 'absolute', bottom: '4%', left: '4%', zIndex: 25,
              background: 'rgba(220,38,38,0.85)', borderRadius: '50%',
              width: '1rem', height: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
            }}
          >
            <X size={10} color="#fff" />
          </div>
        )}

        {/* 조건 오버레이 */}
        {conditionStatus && (
          <div
            title={conditionStatus.level === 'unmet'
              ? `조건 미달: ${conditionStatus.text} — 편성+대기 포함해도 부족`
              : `조건 주의: ${conditionStatus.text} — 편성(1-7)만으로는 부족, 대기 포함 시 충족`}
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
              {conditionStatus.level === 'unmet' ? '조건 미달' : '조건 주의'}
            </span>
          </div>
        )}

        {/* Hover glow gradient */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(251,183,46,0.18) 0%, transparent 50%)',
          opacity: hovered && !disabled ? 1 : 0,
          transition: 'opacity 0.2s',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Name below card */}
      <p style={{
        fontSize: '0.5625rem',
        color: conditionStatus?.level === 'unmet' ? '#ef4444' : conditionStatus?.level === 'warn' ? '#e8b030' : isSelected ? '#e8b030' : '#aaa',
        textAlign: 'center',
        marginTop: '0.25rem',
        lineHeight: 1.2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%',
        transition: 'color 0.15s',
      }}>
        {gift.name}
      </p>
      {conditionStatus && (
        <p style={{ fontSize: '0.5rem', color: conditionStatus.level === 'unmet' ? '#ef4444' : '#e8b030', textAlign: 'center', lineHeight: 1.2, marginTop: '0.0625rem' }}>
          {conditionStatus.text}
        </p>
      )}
    </button>
  )
}
