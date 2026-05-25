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
}

const TITLE_MIN_FONT_REM = 0.5
const TITLE_SIDE_PADDING_PERCENT = 6
const THEME_CARD_ASPECT_RATIO = '416/684'
const TITLE_LINE_BREAK_REFERENCE = '어느 도서관의 어떤 책'

const EXPLICIT_KOREAN_TITLE_LINES = new Map<string, string[]>([
  ['어느 도서관의 어떤 책 속으로', ['어느 도서관의 어떤 책', '속으로']],
])

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim()
}

function getTitleVisualLength(title: string): number {
  return Array.from(title).reduce((total, char) => {
    if (/\s/.test(char)) return total + 0.3
    if (/[\u3000-\u9fff\uac00-\ud7af]/.test(char)) return total + 1
    if (/[A-Za-z0-9]/.test(char)) return total + 0.55
    return total + 0.25
  }, 0)
}

const TITLE_LINE_BREAK_LIMIT = getTitleVisualLength(TITLE_LINE_BREAK_REFERENCE)

function splitTitleAtBestPoint(title: string): string[] {
  const words = title.split(' ').filter(Boolean)

  if (words.length <= 1) {
    const chars = Array.from(title)
    const midpoint = Math.ceil(chars.length / 2)
    return [chars.slice(0, midpoint).join(''), chars.slice(midpoint).join('')]
  }

  let bestSplit = 1
  let bestScore = Number.POSITIVE_INFINITY

  for (let index = 1; index < words.length; index += 1) {
    const first = words.slice(0, index).join(' ')
    const second = words.slice(index).join(' ')
    const firstLength = getTitleVisualLength(first)
    const secondLength = getTitleVisualLength(second)
    const score = Math.max(firstLength, secondLength) + Math.abs(firstLength - secondLength) * 0.4

    if (score < bestScore) {
      bestScore = score
      bestSplit = index
    }
  }

  return [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')]
}

function getThemePackTitleLines(title: string, lang: SupportedLang): string[] {
  const normalizedTitle = normalizeTitle(title)
  const explicitTitleLines = lang === 'ko'
    ? EXPLICIT_KOREAN_TITLE_LINES.get(normalizedTitle)
    : null

  if (explicitTitleLines) return explicitTitleLines
  if (getTitleVisualLength(normalizedTitle) <= TITLE_LINE_BREAK_LIMIT) return [normalizedTitle]

  return splitTitleAtBestPoint(normalizedTitle)
}

export default function ThemePackCard({
  theme,
  onClick,
  isSelected,
  lang: langProp,
  showGiftCount,
  imageSurface = 'default',
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
  const displayName = normalizeTitle(getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang))
  const displayNameSegments = getThemePackNameSegments(numId, lang)
  const titleLines = displayNameSegments ? [displayName] : getThemePackTitleLines(displayName, lang)
  const isMultilineTitle = !displayNameSegments && titleLines.length > 1
  const titleMeasureText = titleLines.length > 1
    ? titleLines.reduce((longest, line) => (getTitleVisualLength(line) > getTitleVisualLength(longest) ? line : longest), '')
    : displayName
  const visualConfig = getThemePackVisualConfig(numId)
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
  const titleMaxFontRem = isMultilineTitle ? 1.05 : 1.5
  const fontSize = useAutoFontSize(titleMeasureText, titleMaxFontRem, TITLE_MIN_FONT_REM, titleMeasureWidth, titleFontFamily, titleFontWeight)
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
              top: isMultilineTitle ? '72.6%' : '74.6%',
              height: isMultilineTitle ? '11.5%' : '8.55%',
              paddingInline: `${TITLE_SIDE_PADDING_PERCENT}%`,
            }}
          >
            <div
              className="text-center [--theme-title-cap:0.9375rem] sm:[--theme-title-cap:1.5rem]"
              style={{
                '--theme-title-auto-size': `${fontSize}rem`,
                color: nameColor,
                fontFamily: titleFontFamily,
                fontSize: 'min(var(--theme-title-auto-size), var(--theme-title-cap))',
                fontWeight: titleFontWeight,
                lineHeight: isMultilineTitle ? 1.02 : 1.2,
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
              {isMultilineTitle
                ? titleLines.map(line => (
                    <span key={line} style={{ display: 'block', whiteSpace: 'nowrap' }}>
                      {line}
                    </span>
                  ))
                : displayNameSegments
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
          {isSelected && (
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center" style={{ padding: '0.375rem', background: 'rgba(200,144,10,0.15)' }}>
              <Check style={{ width: '0.875rem', height: '0.875rem', color: '#c8900a' }} />
              <span style={{ color: '#c8900a', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.25rem' }}>{t('mirrorDungeon.theme.selected')}</span>
            </div>
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
