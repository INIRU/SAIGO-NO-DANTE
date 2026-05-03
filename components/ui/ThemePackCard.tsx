'use client'

import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { getThemePackNameColor, getThemePackNameSegments } from '@/lib/data/theme-pack-colors'
import {
  getThemePackBaseImageUrl,
  getThemePackBossLayerUrl,
  getThemePackVisualConfig,
  THEME_PACK_LAYER_IMAGES,
} from '@/lib/data/theme-pack-visuals'
import { useAutoFontSize } from '@/lib/hooks/useAutoFontSize'
import { getLocalizedName } from '@/lib/i18n/localize'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { Check } from 'lucide-react'
import Image from 'next/image'
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
}

const TITLE_MIN_FONT_REM = 0.9375
const TITLE_SIDE_PADDING_REM = 0.625
const THEME_CARD_ASPECT_RATIO = '420/720'

export default function ThemePackCard({ theme, onClick, isSelected, lang: langProp, showGiftCount }: ThemePackCardProps) {
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
  const titleTextRef = useRef<HTMLDivElement>(null)
  const [titleMeasureWidth, setTitleMeasureWidth] = useState(0)
  const [minTitleOverflows, setMinTitleOverflows] = useState(false)
  const [titleSingleLineOverflows, setTitleSingleLineOverflows] = useState(false)
  const displayName = getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang)
  const displayNameSegments = getThemePackNameSegments(numId, lang)
  const visualConfig = getThemePackVisualConfig(numId)
  const imageSrc = visualConfig ? getThemePackBaseImageUrl(numId) : theme.image_url
  const chainBattleLabel = lang === 'en' ? 'Long Battle' : lang === 'ja' ? '長期戦闘' : '장기 전투'
  const fontSize = useAutoFontSize(displayName, 1.5, TITLE_MIN_FONT_REM, titleMeasureWidth, 'var(--font-kotra-bold), serif')
  const shouldWrapTitle = titleSingleLineOverflows || minTitleOverflows || fontSize <= TITLE_MIN_FONT_REM + 0.001
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

  useEffect(() => {
    if (!displayName || titleMeasureWidth <= 0) {
      setMinTitleOverflows(false)
      return
    }

    let cancelled = false

    const measureMinimumTitle = () => {
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const rootStyle = getComputedStyle(document.documentElement)
      const resolvedFamily =
        rootStyle.getPropertyValue('--font-kotra-bold').trim() || 'var(--font-kotra-bold), serif'
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) return

      context.font = `700 ${TITLE_MIN_FONT_REM * rootFontSize}px ${resolvedFamily}`
      const measuredWidth = context.measureText(displayName).width

      if (!cancelled) {
        setMinTitleOverflows(measuredWidth > titleMeasureWidth)
      }
    }

    measureMinimumTitle()
    document.fonts?.ready.then(measureMinimumTitle)

    return () => {
      cancelled = true
    }
  }, [displayName, titleMeasureWidth])

  useEffect(() => {
    setTitleSingleLineOverflows(false)
  }, [displayName, titleMeasureWidth])

  useEffect(() => {
    const element = titleTextRef.current
    if (!element || titleSingleLineOverflows || shouldWrapTitle) return

    let cancelled = false

    const measureRenderedTitle = () => {
      if (!cancelled) {
        setTitleSingleLineOverflows(element.scrollWidth > element.clientWidth + 1)
      }
    }

    const frameId = window.requestAnimationFrame(measureRenderedTitle)
    document.fonts?.ready.then(measureRenderedTitle)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frameId)
    }
  }, [displayName, fontSize, shouldWrapTitle, titleSingleLineOverflows])

  return (
    <button
      onClick={onClick}
      aria-label={displayName}
      className="relative group text-left overflow-hidden transition-all duration-200"
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
          <span style={{ color: '#c8900a', fontSize: '0.625rem', fontWeight: 700, marginLeft: '0.25rem' }}>{t('mirrorDungeon.theme.selected')}</span>
        </div>
      )}
      {imageSrc ? (
        <div
          className="relative w-full overflow-hidden transition-transform duration-300 group-hover:scale-[1.03]"
          style={{
            aspectRatio: THEME_CARD_ASPECT_RATIO,
            borderRadius: 'var(--radius-md)',
            background: '#0d0b08',
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
          {visualConfig && (
            <>
              {visualConfig.bossSpriteId && (
                <Image
                  src={getThemePackBossLayerUrl(visualConfig.bossSpriteId)}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                  className="pointer-events-none select-none object-contain"
                  aria-hidden="true"
                />
              )}
              {!visualConfig.hideLogo && visualConfig.kind === 'normal' && (
                <Image
                  src={THEME_PACK_LAYER_IMAGES.limbusLogo}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                  className="pointer-events-none select-none object-contain"
                  aria-hidden="true"
                />
              )}
              {visualConfig.showWarning && (
                <Image
                  src={THEME_PACK_LAYER_IMAGES.warning}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                  className="pointer-events-none select-none object-contain"
                  aria-hidden="true"
                />
              )}
              {visualConfig.showBaton && (
                <Image
                  src={THEME_PACK_LAYER_IMAGES.baton}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                  className="pointer-events-none select-none object-contain"
                  aria-hidden="true"
                />
              )}
              {visualConfig.kind === 'extreme' && (
                <Image
                  src={THEME_PACK_LAYER_IMAGES.extremeFrame}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                  className="pointer-events-none select-none object-contain"
                  aria-hidden="true"
                />
              )}
              {visualConfig.kind === 'normal' && (
                <Image
                  src={THEME_PACK_LAYER_IMAGES.vinyl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                  className="pointer-events-none select-none object-contain"
                  style={{ transform: 'translateY(-0.0625rem) scale(1.025)', transformOrigin: 'center top' }}
                  aria-hidden="true"
                />
              )}
              {visualConfig.showBaton && (
                <div
                  aria-hidden="true"
                  className="absolute left-0 right-0 pointer-events-none select-none text-center font-sans"
                  style={{
                    top: visualConfig.kind === 'extreme' ? '29.8%' : '29.25%',
                    color: '#5ff4e6',
                    fontSize: '0.5rem',
                    fontWeight: 500,
                    lineHeight: 1.05,
                    letterSpacing: '0.02em',
                    textShadow: '0 0 0.25rem rgba(95,244,230,0.65), 0 0.0625rem 0 rgba(0,0,0,0.9)',
                  }}
                >
                  {chainBattleLabel}
                </div>
              )}
            </>
          )}
          <div className="absolute" style={{ inset: '-0.0625rem', background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, rgba(13,11,8,0.3) 35%, transparent 100%)' }} />

          {/* Theme name */}
          <div
            ref={titleTrackRef}
            className="absolute left-0 right-0 flex items-center justify-center"
            style={{ bottom: '9.5%', height: '2.875rem', paddingInline: `${TITLE_SIDE_PADDING_REM}rem` }}
          >
            <div
              ref={titleTextRef}
              className="font-serif font-bold text-center [--theme-title-cap:0.9375rem] sm:[--theme-title-cap:1.5rem]"
              style={{
                '--theme-title-auto-size': `${fontSize}rem`,
                color: nameColor,
                fontSize: shouldWrapTitle ? `${TITLE_MIN_FONT_REM}rem` : 'min(var(--theme-title-auto-size), var(--theme-title-cap))',
                lineHeight: 1.2,
                textShadow: '0.05rem 0.05rem 0 rgba(0,0,0,0.95), 0.1rem 0.1rem 0 rgba(0,0,0,0.6), 0.15rem 0.15rem 0.1rem rgba(0,0,0,0.3)',
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                paddingBlock: '0.125rem',
                whiteSpace: shouldWrapTitle ? 'normal' : 'nowrap',
                overflow: shouldWrapTitle ? 'hidden' : 'visible',
                overflowWrap: 'break-word',
                display: shouldWrapTitle ? '-webkit-box' : 'block',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: shouldWrapTitle ? 2 : 1,
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
              <span style={{ color: '#c8900a', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>
                {giftCountLabel}
              </span>
            </div>
          )}

          {/* Selected indicator */}
          {isSelected && (
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center" style={{ padding: '0.375rem', background: 'rgba(200,144,10,0.15)' }}>
              <Check style={{ width: '0.875rem', height: '0.875rem', color: '#c8900a' }} />
              <span style={{ color: '#c8900a', fontSize: '0.625rem', fontWeight: 700, marginLeft: '0.25rem' }}>{t('mirrorDungeon.theme.selected')}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="px-3 py-4" style={{ minHeight: '8rem' }}>
          <div className="font-serif font-bold leading-tight" style={{ color: nameColor, fontSize: '0.875rem' }}>
            {displayName}
          </div>
          {showGiftCount && giftCount > 0 && (
            <span style={{ color: '#c8900a', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', marginTop: '0.25rem', display: 'block' }}>
              {giftCountLabel}
            </span>
          )}
        </div>
      )}
    </button>
  )
}
