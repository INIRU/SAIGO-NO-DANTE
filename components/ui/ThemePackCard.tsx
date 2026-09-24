'use client'

import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { getThemePackNameColor, getThemePackNameSegments } from '@/lib/data/theme-pack-colors'
import {
  getThemePackCompositeImageUrl,
  getThemePackVisualConfig,
} from '@/lib/data/theme-pack-visuals'
import { useAutoFontSize } from '@/lib/hooks/useAutoFontSize'
import { getLocalizedName } from '@/lib/i18n/localize'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { Check } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

interface ThemePackCardTheme {
  id: number | string
  name: string
  name_en?: string | null
  name_jp?: string | null
  image_url?: string | null
  ego_gift_ids?: number[] | null
  specific_ego_gift_ids?: number[] | null
}

interface ThemePackCardProps {
  theme: ThemePackCardTheme
  onClick: () => void
  isSelected?: boolean
  lang?: SupportedLang
  /** Show gift count below name (default: false) */
  showGiftCount?: boolean
  /** Use a bare image surface when the surrounding layout already provides the frame. */
  imageSurface?: 'default' | 'bare'
  /** Mirror Dungeon selection sprite; only used by the assist theme picker. */
  selectedFrameOverlay?: boolean
}

const TITLE_MIN_FONT_REM = 0.32
const THEME_CARD_ASPECT_RATIO = '416/684'

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim()
}


export default function ThemePackCard({
  theme,
  onClick,
  isSelected,
  lang: langProp,
  showGiftCount,
  imageSurface = 'default',
  selectedFrameOverlay = false,
}: ThemePackCardProps) {
  const locale = useLocale()
  const lang = langProp ?? (locale as SupportedLang)
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }
  const numId = typeof theme.id === 'number' ? theme.id : parseInt(String(theme.id), 10) || 0
  const nameColor = getThemePackNameColor(numId)
  const titleTrackRef = useRef<HTMLDivElement>(null)
  const [titleMeasureWidth, setTitleMeasureWidth] = useState(0)
  const [titleTrackHeight, setTitleTrackHeight] = useState(0)
  const [rootFontSize, setRootFontSize] = useState(16)
  const displayName = normalizeTitle(getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang))
  const displayNameSegments = getThemePackNameSegments(numId, lang)
  const visualConfig = getThemePackVisualConfig(numId)
  const isExtreme = visualConfig?.kind === 'extreme'
  const imageSrc = visualConfig ? getThemePackCompositeImageUrl(numId) : theme.image_url
  const isBareImageSurface = imageSurface === 'bare'
  const titleFontFamily = lang === 'en'
    ? 'var(--font-mikodacs), var(--font-scdream), system-ui, sans-serif'
    : lang === 'ja'
      ? 'var(--font-noto-jp), var(--font-kotra-bold), sans-serif'
      : 'var(--font-kotra-bold), var(--font-scdream), sans-serif'
  const titleFontWeight = lang === 'en' ? 400 : 700
  const titleTextShadow = lang === 'en'
    ? '0.04rem 0.04rem 0 rgba(0,0,0,0.95), 0.08rem 0.08rem 0.08rem rgba(0,0,0,0.65)'
    : '0.05rem 0.05rem 0 rgba(0,0,0,0.95), 0.1rem 0.1rem 0 rgba(0,0,0,0.6), 0.15rem 0.15rem 0.1rem rgba(0,0,0,0.3)'
  const titleMaxFontRem = titleMeasureWidth && titleTrackHeight
    ? Math.max(TITLE_MIN_FONT_REM, Math.min(1.5, (titleMeasureWidth / (isExtreme ? 0.64 : 0.65328)) * 0.097 / rootFontSize, titleTrackHeight / rootFontSize))
    : 0.75
  const fontSize = useAutoFontSize(displayName, titleMaxFontRem, TITLE_MIN_FONT_REM, titleMeasureWidth, titleFontFamily, titleFontWeight)
  const giftCount = (theme.ego_gift_ids ?? []).length
  const giftCountLabel = lang === 'en'
    ? `${giftCount} ${t('mirrorDungeon.theme.gifts')}`
    : `${t('mirrorDungeon.theme.gifts')} ${giftCount}${t('mirrorDungeon.theme.giftCountSuffix')}`

  useEffect(() => {
    const element = titleTrackRef.current
    if (!element) return

    const updateMeasureWidth = () => {
      const style = getComputedStyle(element)
      const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const nextWidth = Math.max(1, Math.round(element.getBoundingClientRect().width - horizontalPadding))
      setTitleMeasureWidth(prevWidth => (Math.abs(prevWidth - nextWidth) > 1 ? nextWidth : prevWidth))
      const nextHeight = element.getBoundingClientRect().height
      setTitleTrackHeight(prevHeight => (Math.abs(prevHeight - nextHeight) > 1 ? nextHeight : prevHeight))
      const nextRootFontSize = parseFloat(getComputedStyle(element.ownerDocument.documentElement).fontSize) || 16
      setRootFontSize(prevSize => (Math.abs(prevSize - nextRootFontSize) > 0.1 ? nextRootFontSize : prevSize))
    }

    const measure = () => updateMeasureWidth()
    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(updateMeasureWidth)
    observer.observe(element)

    return () => observer.disconnect()
  }, [imageSrc])

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={displayName}
      aria-pressed={isSelected}
      className="group relative w-full overflow-hidden text-left transition-[border-color,box-shadow,transform] duration-200 motion-safe:active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131110]"
      style={{
        background: 'transparent',
        border: isSelected ? '0.125rem solid var(--gold)' : '0.125rem solid transparent',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        padding: 0,
        boxShadow: isSelected ? '0 0 1rem rgba(200,144,10,0.3)' : 'none',
      }}
    >
      {/* Selected indicator */}
      {isSelected && !imageSrc && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center" style={{ padding: '0.375rem', background: 'rgba(200,144,10,0.15)' }}>
          <Check style={{ width: '0.875rem', height: '0.875rem', color: '#c8900a' }} />
          <span style={{ color: '#c8900a', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.25rem' }}>{t('mirrorDungeon.theme.selected')}</span>
        </div>
      )}
      {imageSrc ? (
        <div
          className="relative w-full overflow-hidden transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
          style={{
            aspectRatio: THEME_CARD_ASPECT_RATIO,
            borderRadius: 'var(--radius-md)',
            background: isBareImageSurface ? 'transparent' : '#0d0b08',
          }}
        >
          <ImageWithFallback
            src={imageSrc}
            alt={displayName}
            fill
            fallbackType="theme"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
            className="object-contain"
          />
          {!isBareImageSurface && (
            <div className="absolute" style={{ inset: '-0.0625rem', background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, rgba(13,11,8,0.3) 35%, transparent 100%)' }} />
          )}

          {/* Theme name */}
          <div
            ref={titleTrackRef}
            className="absolute left-0 right-0 flex items-center justify-center"
            style={{
              left: isExtreme ? '18%' : '18.273%',
              right: isExtreme ? '18%' : '16.399%',
              top: isExtreme ? '81%' : '74.5667%',
              height: isExtreme ? '10%' : '8.5%',
            }}
          >
            <div
              className="text-center"
              style={{
                '--theme-title-auto-size': `${fontSize}rem`,
                color: nameColor,
                fontFamily: titleFontFamily,
                fontSize: 'var(--theme-title-auto-size)',
                fontWeight: titleFontWeight,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                wordSpacing: '-0.05em',
                transform: 'translateY(0.104em)',
                textShadow: titleTextShadow,
                WebkitTextStroke: 0,
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                paddingBlock: '0.125rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                overflowWrap: 'normal',
                wordBreak: lang === 'ko' || lang === 'ja' ? 'keep-all' : 'normal',
                display: 'block',
              } as CSSProperties}
            >
              {displayNameSegments
                ? displayNameSegments.map((segment, index) => (
                    <span key={`${segment.text}-${index}`} style={{ color: segment.color ?? nameColor }}>
                      {segment.text}
                    </span>
                  ))
                : displayName}
            </div>
          </div>

          {/* Gift count */}
          {showGiftCount && giftCount > 0 && (
            <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: '7%' }}>
              <span style={{ color: '#c8900a', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                {giftCountLabel}
              </span>
            </div>
          )}

          {/* Selected indicator */}
          {isSelected && !selectedFrameOverlay && (
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center" style={{ padding: '0.375rem', background: 'rgba(200,144,10,0.15)' }}>
              <Check style={{ width: '0.875rem', height: '0.875rem', color: '#c8900a' }} />
              <span style={{ color: '#c8900a', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.25rem' }}>{t('mirrorDungeon.theme.selected')}</span>
            </div>
          )}
          {isSelected && selectedFrameOverlay && (
            <>
              {/* The transparent center exposes the original theme poster. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/game-ui/themes/selected-frame.webp" alt="" aria-hidden="true" data-theme-selected-frame loading="eager" className="pointer-events-none absolute inset-0 z-20 h-full w-full object-fill" />
              <span className="pointer-events-none absolute inset-x-[10%] top-1/2 z-30 -translate-y-1/2 bg-[rgba(13,11,8,0.82)] py-1 text-center font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--gold-light)]">
                {t('mirrorDungeon.theme.selected')}
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="px-3 py-4" style={{ minHeight: '8rem' }}>
          <div className="font-serif font-bold leading-tight" style={{ color: nameColor, fontSize: '0.875rem' }}>
            {displayName}
          </div>
          {showGiftCount && giftCount > 0 && (
            <span style={{ color: '#c8900a', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginTop: '0.25rem', display: 'block' }}>
              {giftCountLabel}
            </span>
          )}
        </div>
      )}
    </button>
  )
}
