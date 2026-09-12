'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import { FlaskConical } from 'lucide-react'
import GiftGrade from './GiftGrade'
import ImageWithFallback from './ImageWithFallback'
import { OCTAGON_CLIP, GIFT_BG_URL, getGiftKeywordSlug, getGiftKeywordIconUrl } from '@/lib/constants/gift'

export interface GiftArtworkGift {
  grade?: string | null
  keyword?: string | null
  image_url?: string | null
  name: string
  name_en?: string | null
  name_jp?: string | null
}

/** Non-interactive artwork shared by gift controls and event-card previews. */
export default function GiftArtwork({ gift, displayName, isInsert = false, isSelected = false, className = '', sizes = '120px', children }: {
  gift: GiftArtworkGift
  displayName: string
  isInsert?: boolean
  isSelected?: boolean
  className?: string
  sizes?: string
  children?: ReactNode
}) {
  const isEX = gift.grade === 'EX'
  const kwSlug = getGiftKeywordSlug(gift.keyword ?? null)
  const kwIconUrl = kwSlug ? getGiftKeywordIconUrl(kwSlug) : null
  return (
      <div className={`gift-frame ${className}`} style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        overflow: 'hidden',
        background: 'var(--bg-deep)',
        clipPath: OCTAGON_CLIP,
        containerType: 'inline-size',
        outline: isSelected ? '2px solid #c8900a' : 'none',
        outlineOffset: '2px',
      }}>
        {/* A real, eagerly loaded image lets all consumers verify the shared background. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={GIFT_BG_URL} alt="" aria-hidden="true" data-gift-background loading="eager"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
        {/* Grade label */}
        {!isInsert && (
          <GiftGrade grade={gift.grade} style={{
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
          }} />
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
              <ImageWithFallback src={gift.image_url} alt={displayName} fill fallbackType="gift" className="object-contain" sizes={sizes} />
            </div>
          ) : (
            <FlaskConical size="1.5rem" style={{ color: '#444' }} />
          )}
        </div>

        {children}
      </div>
  )
}
