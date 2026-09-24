'use client'

import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { getThemePackNameColor, getThemePackNameSegments } from '@/lib/data/theme-pack-colors'
import {
  THEME_PACK_TITLE_BOX,
  getThemePackCompositeImageUrl,
  getThemePackVisualConfig,
} from '@/lib/data/theme-pack-visuals'
import { useAutoFontSize } from '@/lib/hooks/useAutoFontSize'
import { getLocalizedName } from '@/lib/i18n/localize'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { Check } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'

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
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  /** Replaces the theme name as the accessible name and tooltip. */
  ariaLabel?: string
  title?: string
  /** Image `sizes` hint when the card width is known. */
  sizes?: string
  isSelected?: boolean
  lang?: SupportedLang
  /** Show gift count below name (default: false) */
  showGiftCount?: boolean
  /** Use a bare image surface when the surrounding layout already provides the frame. */
  imageSurface?: 'default' | 'bare'
}

const TITLE_MIN_FONT_REM = 0.32
// The game's pack name is about 11.5% of the poster width; long names shrink to fit one line.
const TITLE_FONT_RATIO = 0.115
// 8-way hard outline in the page's darkest brown so any pack colour stays legible on busy art.
const TITLE_OUTLINE = '0.07em 0 0 #0d0b08, -0.07em 0 0 #0d0b08, 0 0.07em 0 #0d0b08, 0 -0.07em 0 #0d0b08, 0.05em 0.05em 0 #0d0b08, -0.05em 0.05em 0 #0d0b08, 0.05em -0.05em 0 #0d0b08, -0.05em -0.05em 0 #0d0b08, 0 0.12em 0.25em rgba(0,0,0,0.85)'
const THEME_CARD_ASPECT_RATIO = '416/684'
// The 436x740 selection sprite, placed so its gold line sits 1.5px outside the 416x684 poster art.
// Measured from the sprite stroke vs. the poster alpha edge (normal: pack outline incl. crimp notches,
// extreme: the metal box body); percentages keep it aligned at every card size.
const SELECTED_FRAME_BOX = {
  normal: { left: '-2.002%', top: '-1.329%', width: '104.366%', height: '102.833%' },
  extreme: { left: '-5.461%', top: '-0.811%', width: '110.549%', height: '100.786%' },
} as const

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
  ariaLabel,
  title,
  sizes = '(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw',
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
  const titleBox = { ...THEME_PACK_TITLE_BOX[isExtreme ? 'extreme' : 'normal'], ...visualConfig?.title }
  const titleWidthRatio = (100 - titleBox.left - titleBox.right) / 100
  const showTitle = !visualConfig?.title?.printedIn?.includes(lang)
  const imageSrc = visualConfig ? getThemePackCompositeImageUrl(numId) : theme.image_url
  const isBareImageSurface = imageSurface === 'bare'
  const titleFontFamily = lang === 'en'
    ? 'var(--font-mikodacs), var(--font-scdream), system-ui, sans-serif'
    : lang === 'ja'
      ? 'var(--font-noto-jp), var(--font-kotra-bold), sans-serif'
      : 'var(--font-kotra-bold), var(--font-scdream), sans-serif'
  const titleFontWeight = lang === 'en' ? 400 : 700
  const titleMaxFontRem = titleMeasureWidth && titleTrackHeight
    ? Math.max(TITLE_MIN_FONT_REM, Math.min(1.75, (titleMeasureWidth / titleWidthRatio) * TITLE_FONT_RATIO / rootFontSize, titleTrackHeight * 0.9 / rootFontSize))
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
      aria-label={ariaLabel ?? displayName}
      title={title}
      aria-pressed={isSelected}
      data-theme-pack-card={numId}
      className="group relative w-full overflow-hidden text-left transition-[border-color,box-shadow,transform] duration-200 motion-safe:active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131110]"
      style={{
        background: 'transparent',
        border: isSelected && !imageSrc ? '0.125rem solid var(--gold)' : '0.125rem solid transparent',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        padding: 0,
        boxShadow: isSelected && !imageSrc ? '0 0 1rem rgba(200,144,10,0.3)' : 'none',
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
            sizes={sizes}
            className="object-contain"
          />
          {!isBareImageSurface && (
            <div className="absolute" style={{ inset: '-0.0625rem', background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, rgba(13,11,8,0.3) 35%, transparent 100%)' }} />
          )}

          {/* Theme name, in the poster's title band (per-pack box when a printed logo sits there) */}
          {showTitle && <div
            ref={titleTrackRef}
            aria-hidden="true"
            className="absolute flex items-center justify-center"
            style={{
              left: titleBox.left + '%',
              right: titleBox.right + '%',
              top: titleBox.top + '%',
              height: titleBox.height + '%',
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
                textShadow: TITLE_OUTLINE,
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
          </div>}

          {/* Gift count */}
          {showGiftCount && giftCount > 0 && (
            <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: '7%' }}>
              <span style={{ color: '#c8900a', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                {giftCountLabel}
              </span>
            </div>
          )}

          {/* Selected: the in-game selection sprite traced around the poster outline; aria-pressed carries the state. */}
          {isSelected && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/assets/game-ui/themes/selected-frame.webp" alt="" aria-hidden="true" data-theme-selected-frame loading="eager" className="pointer-events-none absolute z-20 max-w-none" style={SELECTED_FRAME_BOX[isExtreme ? 'extreme' : 'normal']} />
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
