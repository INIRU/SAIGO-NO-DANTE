'use client'

import { memo } from 'react'
import Image from 'next/image'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { FlaskConical } from 'lucide-react'
import { STORAGE_BASE } from '@/lib/data/sinners'
import { GRADE_LABELS } from './types'
import type { EgoGift } from './types'

const GiftCard = memo(function GiftCard({ gift, onClick, getGiftKeywordIcon }: { gift: EgoGift; onClick: () => void; getGiftKeywordIcon: (keyword: string) => string | null }) {
  const gradeLabel = GRADE_LABELS[gift.grade] ?? gift.grade
  const isEX = gift.grade === 'EX'

  return (
    <button
      onClick={onClick}
      className="gift-card group relative flex flex-col items-center transition-all duration-200 hover:scale-[1.06] hover:z-10"
      style={{ cursor: 'pointer' }}
    >
      <div
        className="gift-frame relative w-full aspect-square overflow-hidden"
        style={{
          backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transition: 'filter 0.3s',
          clipPath: 'polygon(12% 0%, 88% 0%, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0% 88%, 0% 12%)',
        }}
      >
        <span
          className="absolute top-[4%] left-[3%] z-10 pointer-events-none"
          style={{
            fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(20px, 42cqw, 48px)',
            lineHeight: 1,
            letterSpacing: '0.02em',
            color: isEX ? 'rgb(198, 255, 46)' : 'rgb(251, 183, 46)',
            textShadow: isEX
              ? '0 0 14px rgb(251,255,8), 0 0 6px rgb(12,90,0), 1px 1px 2px rgba(0,0,0,0.8)'
              : '0 0 8px rgb(255,114,21), 0 0 2px rgba(0,0,0,0.6)',
            filter: isEX ? 'brightness(1.1) drop-shadow(0 0 3px rgb(12,90,0))' : undefined,
          }}
        >
          {gradeLabel}
        </span>

        <div className="absolute bottom-0 right-0 z-10 w-[30%] h-[30%] pointer-events-none">
          {(() => {
            const iconUrl = getGiftKeywordIcon(gift.keyword)
            return iconUrl ? (
              <Image src={iconUrl} alt={gift.keyword} fill sizes="40px" className="object-contain" />
            ) : null
          })()}
        </div>

        <div className="absolute inset-[15%] flex items-center justify-center">
          {gift.image_url ? (
            <div className="relative w-full h-full">
              <ImageWithFallback
                src={gift.image_url}
                alt={gift.name}
                fill
                fallbackType="gift"
                className="object-contain"
                sizes="120px"
              />
            </div>
          ) : (
            <FlaskConical size={28} style={{ color: '#444' }} />
          )}
        </div>

        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(251,183,46,0.15) 0%, transparent 50%)',
          }}
        />
      </div>

      <p
        className="text-[0.5625rem] md:text-[0.625rem] leading-tight text-center mt-1 line-clamp-2 w-full"
        style={{ color: '#aaa', fontFamily: 'var(--font-heading)' }}
      >
        {gift.name}
      </p>
    </button>
  )
})

export default GiftCard
