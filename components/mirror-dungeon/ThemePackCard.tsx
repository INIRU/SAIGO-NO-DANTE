'use client'

import ImageWithFallback from '@/components/ui/ImageWithFallback'
import type { EgoGiftTheme } from '@/components/mirror-dungeon/types'
import { getThemePackNameColor } from '@/lib/data/theme-pack-colors'
import { useAutoFontSize } from '@/lib/hooks/useAutoFontSize'

interface Props {
  theme: EgoGiftTheme
  onClick: () => void
}

export default function ThemePackCard({ theme, onClick }: Props) {
  const nameColor = getThemePackNameColor(theme.id)
  const fontSize = useAutoFontSize(theme.name, 1.5, 0.6875, 130, 'KotraBold, serif')

  return (
    <button
      onClick={onClick}
      className="group text-left overflow-hidden transition-all duration-200"
      style={{
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        padding: 0,
      }}
    >
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
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, rgba(13,11,8,0.3) 35%, transparent 100%)' }} />

          {/* 테마팩 이름 */}
          <div className="absolute left-0 right-0 flex flex-col items-center px-1" style={{ bottom: '12%' }}>
            <div
              className="font-serif font-bold leading-tight text-center"
              style={{
                color: nameColor,
                fontSize: `${fontSize}rem`,
                textShadow: '0.05rem 0.05rem 0 rgba(0,0,0,0.95), 0.1rem 0.1rem 0 rgba(0,0,0,0.6), 0.15rem 0.15rem 0.1rem rgba(0,0,0,0.3)',
                maxWidth: '92%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {theme.name}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 py-4" style={{ minHeight: '8rem' }}>
          <div className="font-serif font-bold leading-tight" style={{ color: nameColor, fontSize: '0.875rem' }}>
            {theme.name}
          </div>
        </div>
      )}
    </button>
  )
}
