'use client'

import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { getThemePackNameColor } from '@/lib/data/theme-pack-colors'
import { useAutoFontSize } from '@/lib/hooks/useAutoFontSize'
import { Check } from 'lucide-react'

interface ThemePackCardTheme {
  id: number | string
  name: string
  image_url?: string | null
  boss_image_url?: string | null
  ego_gift_ids?: number[] | null
  specific_ego_gift_ids?: number[] | null
}

interface ThemePackCardProps {
  theme: ThemePackCardTheme
  onClick: () => void
  isSelected?: boolean
  /** Show gift count below name (default: false) */
  showGiftCount?: boolean
}

export default function ThemePackCard({ theme, onClick, isSelected, showGiftCount }: ThemePackCardProps) {
  const numId = typeof theme.id === 'number' ? theme.id : parseInt(String(theme.id), 10) || 0
  const nameColor = getThemePackNameColor(numId)
  const fontSize = useAutoFontSize(theme.name, 1.5, 0.6875, 130, 'var(--font-kotra-bold), serif')
  const giftCount = (theme.ego_gift_ids ?? []).length

  return (
    <button
      onClick={onClick}
      className="group text-left overflow-hidden transition-all duration-200"
      style={{
        background: 'transparent',
        border: isSelected ? '2px solid #c8900a' : '2px solid transparent',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        padding: 0,
        boxShadow: isSelected ? '0 0 1rem rgba(200,144,10,0.3)' : 'none',
      }}
    >
      {/* Selected indicator */}
      {isSelected && !theme.image_url && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center" style={{ padding: '0.375rem', background: 'rgba(200,144,10,0.15)' }}>
          <Check style={{ width: '0.875rem', height: '0.875rem', color: '#c8900a' }} />
          <span style={{ color: '#c8900a', fontSize: '0.625rem', fontWeight: 700, marginLeft: '0.25rem' }}>선택됨</span>
        </div>
      )}
      {theme.image_url ? (
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '380/690', borderRadius: 'var(--radius-md)' }}>
          <ImageWithFallback
            src={theme.image_url}
            alt={theme.name}
            fill
            fallbackType="theme"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {theme.boss_image_url && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-full" style={{ aspectRatio: '391/432' }}>
                <ImageWithFallback
                  src={theme.boss_image_url}
                  alt=""
                  fill
                  fallbackType="default"
                  sizes="(max-width: 640px) 33vw, 20vw"
                  className="object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            </div>
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, rgba(13,11,8,0.3) 35%, transparent 100%)' }} />

          {/* Theme name */}
          <div className="absolute left-0 right-0 flex items-center justify-center px-1" style={{ bottom: '14%', height: '1.75rem' }}>
            <div
              className="font-serif font-bold text-center"
              style={{
                color: nameColor,
                fontSize: `${fontSize}rem`,
                lineHeight: '1.75rem',
                textShadow: '0.05rem 0.05rem 0 rgba(0,0,0,0.95), 0.1rem 0.1rem 0 rgba(0,0,0,0.6), 0.15rem 0.15rem 0.1rem rgba(0,0,0,0.3)',
                maxWidth: '92%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {theme.name}
            </div>
          </div>

          {/* Gift count */}
          {showGiftCount && giftCount > 0 && (
            <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: '7%' }}>
              <span style={{ color: '#c8900a', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>
                기프트 {giftCount}종
              </span>
            </div>
          )}

          {/* Selected indicator */}
          {isSelected && (
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center" style={{ padding: '0.375rem', background: 'rgba(200,144,10,0.15)' }}>
              <Check style={{ width: '0.875rem', height: '0.875rem', color: '#c8900a' }} />
              <span style={{ color: '#c8900a', fontSize: '0.625rem', fontWeight: 700, marginLeft: '0.25rem' }}>선택됨</span>
            </div>
          )}
        </div>
      ) : (
        <div className="px-3 py-4" style={{ minHeight: '8rem' }}>
          <div className="font-serif font-bold leading-tight" style={{ color: nameColor, fontSize: '0.875rem' }}>
            {theme.name}
          </div>
          {showGiftCount && giftCount > 0 && (
            <span style={{ color: '#c8900a', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', marginTop: '0.25rem', display: 'block' }}>
              기프트 {giftCount}종
            </span>
          )}
        </div>
      )}
    </button>
  )
}
