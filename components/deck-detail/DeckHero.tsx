import Image from 'next/image'
import { getIdentityPortraitUrl } from '@/lib/utils/images'

// Matches the string-keyed map used in DeckIdentityCard (rarity is number, coerced to string key)
const RARITY_COLORS: Record<string, string> = {
  '1성': '#667788',
  '2성': '#4898b0',
  '3성': '#c8900a',
}

export type HeroSlot = {
  slot_order: number
  gacksung: boolean | null
  identities: {
    sinner_id: string
    folder_name: string | null
    game_id: string | null
    rarity: number
  } | null
}

type Props = {
  /** 12-element array, nulls for empty slots, already sorted by page.tsx */
  slots: (HeroSlot | null)[]
}

/**
 * DeckHero — static portrait panorama strip.
 * Server component: no state, no event handlers, no 'use client'.
 */
export default function DeckHero({ slots }: Props) {
  return (
    <div className="relative" style={{ paddingTop: '4rem' }}>
      <div className="relative overflow-hidden" style={{ height: '21.25rem' }}>

        {/* 12 포트레이트 스트립 */}
        <div
          className="absolute inset-0"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}
        >
          {slots.map((slot, i) => {
            const id_ = slot?.identities
            const imgUrl = id_
              ? getIdentityPortraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, slot?.gacksung ?? false)
              : ''
            const rarityColor = id_?.rarity
              ? (RARITY_COLORS[String(id_.rarity) + '성'] ?? null)
              : null
            return (
              <div key={i} className="relative overflow-hidden">
                {imgUrl ? (
                  <Image
                    src={imgUrl}
                    alt=""
                    fill
                    unoptimized
                    priority={i === 0}
                    style={{
                      objectFit: 'cover',
                      objectPosition: 'center top',
                      filter: 'brightness(0.65) saturate(0.85)',
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#08060410' }} />
                )}
                {i > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: '1px',
                      background: 'rgba(0,0,0,0.5)',
                    }}
                  />
                )}
                {rarityColor && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: rarityColor,
                      opacity: 0.6,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* 그라디언트 오버레이 */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(13,11,8,0.1) 0%, rgba(13,11,8,0.0) 25%, rgba(13,11,8,0.55) 60%, rgba(13,11,8,0.96) 90%, rgba(13,11,8,1) 100%)',
            pointerEvents: 'none',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(13,11,8,0.65) 0%, transparent 18%, transparent 82%, rgba(13,11,8,0.65) 100%)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}
