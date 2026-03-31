'use client'

import Image from 'next/image'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import type { EgoGiftTheme, EgoGift } from '@/components/mirror-dungeon/types'
import { getThemePackNameColor } from '@/lib/data/theme-pack-colors'
import { useAutoFontSize } from '@/lib/hooks/useAutoFontSize'

interface Props {
  theme: EgoGiftTheme
  themeGifts: EgoGift[]
  specificCount: number
  topKeywordIcons: Array<{ kw: string; iconUrl: string | null }>
  onClick: () => void
}

export default function ThemePackCard({ theme, themeGifts, specificCount, topKeywordIcons, onClick }: Props) {
  const isExtreme = theme.difficulty === 'extreme'
  const isHard = theme.difficulty === 'hard'
  const borderColor = isExtreme ? 'rgba(224,64,64,0.5)' : isHard ? 'rgba(232,144,48,0.3)' : 'var(--border)'
  const hoverBorder = isExtreme ? 'rgba(224,64,64,0.8)' : isHard ? 'rgba(232,144,48,0.6)' : 'rgba(200,144,10,0.35)'
  const nameColor = getThemePackNameColor(theme.id)

  // Pretext 기반 자동 폰트 사이징: 카드 폭 ~140px 기준, 최대 16px → 최소 10px
  const fontSize = useAutoFontSize(theme.name, 16, 10, 130, 'KotraBold, serif')

  return (
    <button
      onClick={onClick}
      className="group text-left overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--bg-panel)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        ...(isExtreme ? { boxShadow: '0 0 0.5rem rgba(224,64,64,0.1)' } : {}),
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = hoverBorder; e.currentTarget.style.background = 'var(--bg-card)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.background = 'var(--bg-panel)' }}
    >
      {theme.image_url ? (
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '380/690' }}>
          <ImageWithFallback
            src={theme.image_url}
            alt={theme.name}
            fill
            fallbackType="theme"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            style={{ opacity: 0.85 }}
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
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, rgba(13,11,8,0.4) 40%, transparent 100%)' }} />

          {/* 테마팩 이름 (Pretext 자동 사이징) */}
          <div className="absolute left-0 right-0 flex flex-col items-center px-1" style={{ bottom: '16%' }}>
            <div
              className="font-serif font-bold leading-tight text-center"
              style={{
                color: nameColor,
                fontSize: `${fontSize / 16}rem`,
                textShadow: 'rgba(0,0,0,0.9) 0.075rem 0.075rem 0',
                maxWidth: '92%',
                wordBreak: 'keep-all',
              }}
            >
              {theme.name}
            </div>
          </div>

          {/* 하단 정보 */}
          <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {topKeywordIcons.map(({ kw, iconUrl }) =>
                  iconUrl ? (
                    <Image key={kw} src={iconUrl} alt={kw} width={12} height={12} style={{ width: '0.75rem', height: '0.75rem', opacity: 0.8 }} />
                  ) : null,
                )}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
                {specificCount > 0 ? `★${specificCount}` : ''} {themeGifts.length}종
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 py-4" style={{ minHeight: '8rem' }}>
          <div className="font-serif font-bold leading-tight mb-2" style={{ color: nameColor, fontSize: '0.875rem' }}>
            {theme.name}
          </div>
          <div className="flex items-center gap-1">
            {topKeywordIcons.map(({ kw, iconUrl }) =>
              iconUrl ? (
                <Image key={kw} src={iconUrl} alt={kw} width={12} height={12} style={{ width: '0.75rem', height: '0.75rem', opacity: 0.7 }} />
              ) : null,
            )}
            <span style={{ color: '#888', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
              {themeGifts.length}종
            </span>
          </div>
        </div>
      )}
    </button>
  )
}
