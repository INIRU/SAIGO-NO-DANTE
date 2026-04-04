/**
 * MirrorDungeonSSRGrid — Server Component
 *
 * Renders the first 40 gifts as static HTML so the browser can paint the LCP
 * element before the large MirrorDungeonClient JS bundle hydrates.
 *
 * The client component hides this grid via `data-hidden="true"` on mount and
 * takes over rendering with the full interactive grid.
 *
 * RULES:
 * - No 'use client' — this is a Server Component
 * - No JSX component imports that are 'use client'
 * - Plain HTML only (mirrors GiftCard visual structure)
 * - All sizes in rem, next/image width/height in px with rem style override
 */

import Image from 'next/image'
import { OCTAGON_CLIP, GIFT_BG_URL, GRADE_ROMAN, getGiftKeywordSlug, getGiftKeywordIconUrl } from '@/lib/constants/gift'
import type { EgoGift } from '@/components/mirror-dungeon/types'

interface Props {
  gifts: EgoGift[]
  /** How many cards to pre-render (default 40 — first page) */
  count?: number
}

export default function MirrorDungeonSSRGrid({ gifts, count = 40 }: Props) {
  const visible = gifts.slice(0, count)

  return (
    <div
      id="mirror-ssr-grid"
      className="gift-grid"
      aria-hidden="true"
      style={{
        display: 'grid',
        gap: '0.5rem',
        position: 'relative',
        zIndex: 0,
      }}
    >
      {visible.map(gift => {
        const isEX = gift.grade === 'EX'
        const gradeLabel = GRADE_ROMAN[gift.grade ?? '1'] ?? gift.grade
        const kwSlug = getGiftKeywordSlug(gift.keyword ?? null)
        const kwIconUrl = kwSlug ? getGiftKeywordIconUrl(kwSlug) : null

        return (
          <div
            key={gift.id}
            className="gift-card"
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            {/* Octagon frame */}
            <div
              className="gift-frame"
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1',
                overflow: 'hidden',
                backgroundImage: `url(${GIFT_BG_URL})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                clipPath: OCTAGON_CLIP,
              }}
            >
              {/* Grade label */}
              <span
                style={{
                  position: 'absolute',
                  top: '4%',
                  left: '3%',
                  zIndex: 10,
                  pointerEvents: 'none',
                  fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  lineHeight: 1,
                  color: isEX ? 'rgb(198, 255, 46)' : 'rgb(251, 183, 46)',
                  textShadow: isEX
                    ? '0 0 0.625rem rgb(251,255,8), 0 0 0.25rem rgb(12,90,0), 0.0625rem 0.0625rem 0.125rem rgba(0,0,0,0.8)'
                    : '0 0 0.5rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
                }}
              >
                {gradeLabel}
              </span>

              {/* Keyword icon */}
              {kwIconUrl && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    zIndex: 10,
                    pointerEvents: 'none',
                    width: '30%',
                    height: '30%',
                  }}
                >
                  <Image
                    src={kwIconUrl}
                    alt=""
                    width={40}
                    height={40}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}

              {/* Gift image */}
              {gift.image_url && (
                <div
                  style={{
                    position: 'absolute',
                    inset: '15%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Image
                    src={gift.image_url}
                    alt={gift.name}
                    width={80}
                    height={80}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    // First batch is above the fold — mark as priority for LCP
                    priority={true}
                  />
                </div>
              )}
            </div>

            {/* Name below card */}
            <p
              style={{
                fontSize: '0.5625rem',
                color: '#aaa',
                textAlign: 'center',
                marginTop: '0.25rem',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {gift.name}
            </p>
          </div>
        )
      })}
    </div>
  )
}
