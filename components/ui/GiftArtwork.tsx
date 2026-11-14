import type { ReactNode } from 'react'
import QuietImage from '@/components/ui/QuietImage'
import { FlaskConical } from 'lucide-react'
import GiftGrade from './GiftGrade'
import { OCTAGON_CLIP, GIFT_BG_URL, GIFT_BG_ENHANCED_URL, getGiftKeywordSlug, getGiftKeywordIconUrl } from '@/lib/constants/gift'

export interface GiftArtworkGift {
  grade?: string | null
  keyword?: string | null
  image_url?: string | null
  name: string
  name_en?: string | null
  name_jp?: string | null
}

/** Non-interactive artwork shared by gift controls and event-card previews. */
export default function GiftArtwork({ gift, displayName, isInsert = false, isSelected = false, enhance = 0, className = '', sizes = '120px', children }: {
  gift: GiftArtworkGift
  displayName: string
  isInsert?: boolean
  isSelected?: boolean
  /** 1 (+) or 2 (++) swaps in the game's enhanced slot. */
  enhance?: number
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
        outline: isSelected ? '2px solid var(--gold)' : 'none',
        outlineOffset: '2px',
      }}>
        {/* A real, eagerly loaded image lets all consumers verify the shared background. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enhance > 0 && !isInsert ? GIFT_BG_ENHANCED_URL : GIFT_BG_URL} alt="" aria-hidden="true" data-gift-background loading="eager"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
        {/* Grade numeral: cap height 26% of the card like in game; 6%/6% keeps its corner inside the octagon cut. */}
        {!isInsert && (
          <GiftGrade grade={gift.grade} style={{
            position: 'absolute',
            top: '6%',
            left: '6%',
            zIndex: 10,
            pointerEvents: 'none',
            fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
            fontWeight: 700,
            fontSize: 'calc(26cqw / 0.85)',
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
            <QuietImage src={kwIconUrl} alt="" fill sizes="40px" style={{ objectFit: 'contain' }} />
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
            // The slot carries the gift's name; the art inside is decoration, so a failed load leaves the empty game slot.
            <div className="relative w-full h-full" role="img" aria-label={displayName}>
              <QuietImage src={gift.image_url} alt="" fill className="object-contain" sizes={sizes} />
            </div>
          ) : (
            <FlaskConical size="1.5rem" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>

        {children}
      </div>
  )
}
