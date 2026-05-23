'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { layoutWithLines, prepareWithSegments, setLocale as setPretextLocale } from '@chenglou/pretext'
import { Identity, getIdentityInfoUrl, getIdentitySinColor, getSinnerLogoUrl, SIN_COLORS, RARITY_ICON_MAP, IDENTITY_CARD_FRAME_MAP, STORAGE_BASE, BLUR_PLACEHOLDER } from '@/lib/data/sinners'
import { RARITY_COLORS } from '@/lib/constants/game'
import { getBlurDataURL } from '@/lib/utils/thumbhash'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import styles from '@/styles/components/IdentityCard.module.css'
import { useTranslations, useLocale } from 'next-intl'
import { getLocalizedAffiliation } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n/types'


interface IdentityCardProps {
  identity: Identity
  onClick?: () => void
  selected?: boolean
  gacksung?: boolean
  compact?: boolean
  board?: boolean
  disableHoverEffects?: boolean
  formationOverlay?: {
    kind: 'selected' | 'backup'
    order: number
    bannerUrl: string
  }
  giftBadgeUrls?: string[]
}

type IdentityWithRepresentativeKeywords = Identity & {
  skill_keyword_list?: string[] | null
  keywords?: string[] | null
}

const DEFAULT_MAX_MANUAL_NAME_LINES = 3
const HANGUL_RE = /[\uac00-\ud7a3]/
const SINGLE_HANGUL_RE = /^[\uac00-\ud7a3]$/
const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7a3]/
const EGO_FRAGMENT_RE = /(?:^|[^A-Za-z])E\.?G?\.?O?[:：]*$/i
const BROKEN_EGO_PREFIX_RE = /^(?:G\.O|G\.|O)(?:[:：]{1,2}|$)/i
const EGO_ACRONYM_RE = /E\.?G\.?O(?::[:：])?/ig
const LEADING_PARTICLE_RE = /^[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7a3]?(?:의|와|과|을|를|이|가|은|는|へ|を|が|は|に|の|と|も|で)(?:\s|$)/
const TITLE_SUFFIX_RE = /^(?:대표|해결사|대행|아비)$/
const COMPACT_DETERMINISTIC_LINE_UNITS = 6.1
const REGULAR_DETERMINISTIC_LINE_UNITS = 9.4
const SHORT_SINGLE_LINE_MAX_WEIGHT = 7
const SELECTED_BANNER_URL = `${STORAGE_BASE}/icons/ui/identity-selected-banner.webp`
let activePretextLocale: string | null = null

function getRepresentativeKeywords(identity: IdentityWithRepresentativeKeywords) {
  return identity.skill_keyword_list && identity.skill_keyword_list.length > 0
    ? identity.skill_keyword_list
    : (identity.keywords ?? [])
}

function getAssociationChips(identity: Identity, locale: SupportedLang) {
  const associations = identity.association_list
    ?.map(association => association.trim())
    .filter(Boolean)

  if (associations && associations.length > 0) {
    return associations.map(association => getLocalizedAffiliation(association, locale))
  }
  return identity.affiliation ? [getLocalizedAffiliation(identity.affiliation, locale)] : []
}

function getLineTextWeight(value: string) {
  return Array.from(value.replace(/\s+/g, '')).length
}

function normalizeLineComparison(value: string) {
  return value.replace(/\s+/g, '')
}

function shouldPreferMeasuredSingleLine(value: string) {
  const compact = normalizeLineComparison(value)
  if (!compact) return false
  if (getLineTextWeight(value) > SHORT_SINGLE_LINE_MAX_WEIGHT) return false
  return /[\s-–—]/.test(value)
}

function getMaxManualNameLines(locale: string, compact: boolean) {
  if (!compact) return DEFAULT_MAX_MANUAL_NAME_LINES
  if (locale === 'ja') return 4
  return DEFAULT_MAX_MANUAL_NAME_LINES
}

function getGraphemeCount(value: string) {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)).length
  }

  return Array.from(value).length
}

function getLetterSpacingWidth(value: string, letterSpacing: number) {
  if (letterSpacing <= 0) return 0
  return Math.max(0, getGraphemeCount(value) - 1) * letterSpacing
}

function getTextWidthWithLetterSpacing(width: number, value: string, letterSpacing: number) {
  return width + getLetterSpacingWidth(value, letterSpacing)
}

function parseLetterSpacing(style: CSSStyleDeclaration) {
  if (!style.letterSpacing || style.letterSpacing === 'normal') return 0
  const parsed = Number.parseFloat(style.letterSpacing)
  return Number.isFinite(parsed) ? parsed : 0
}

function getMeasuredLineLimit(maxWidth: number, locale: string, letterSpacing: number) {
  const bufferedWidth = Math.max(1, maxWidth - 4)
  if (locale !== 'en') return bufferedWidth
  return bufferedWidth - Math.max(2, letterSpacing * 3)
}

function getSemanticBreakpoints(value: string, locale: string) {
  const breaks = new Set<number>()

  for (const match of value.matchAll(/\s+/g)) {
    if (match.index !== undefined) breaks.add(match.index + match[0].length)
  }

  for (const match of value.matchAll(/\s*[-–—]\s*/g)) {
    if (match.index === undefined) continue

    const previous = value[match.index - 1] ?? ''
    const next = value[match.index + match[0].length] ?? ''
    const isInnerEnglishHyphen = locale === 'en' && /[A-Za-z]/.test(previous) && /[A-Za-z]/.test(next)
    if (!isInnerEnglishHyphen) breaks.add(match.index + match[0].length)
  }

  for (const match of value.matchAll(/[:：]{2,}/g)) {
    if (match.index !== undefined) breaks.add(match.index + match[0].length)
  }

  for (const match of value.matchAll(EGO_ACRONYM_RE)) {
    if (match.index !== undefined) breaks.add(match.index + match[0].length)
  }

  for (const match of value.matchAll(/[【「『（(\[]/g)) {
    if (match.index !== undefined && match.index > 0) breaks.add(match.index)
  }

  if (locale === 'ja') {
    for (const match of value.matchAll(/[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*(?::[:：])?/g)) {
      if (match.index === undefined) continue

      const tokenStart = match.index
      const tokenEnd = tokenStart + match[0].length
      const previous = value[tokenStart - 1] ?? ''
      const next = value[tokenEnd] ?? ''

      if (tokenStart > 0 && CJK_RE.test(previous)) breaks.add(tokenStart)
      if (tokenEnd > 0 && tokenEnd < value.length && CJK_RE.test(next)) breaks.add(tokenEnd)
    }

    for (const match of value.matchAll(/[\u3040-\u30ff\u3400-\u9fff]{4,}/g)) {
      if (match.index === undefined) continue

      const runStart = match.index
      const runLength = match[0].length
      for (let offset = 3; offset < runLength; offset++) {
        breaks.add(runStart + offset)
      }
    }
  }

  return Array.from(breaks)
    .filter(position => position > 0 && position < value.length)
    .sort((a, b) => a - b)
}

function buildBreakpointCombinations(breakpoints: number[], count: number, start = 0, current: number[] = [], output: number[][] = []) {
  if (current.length === count) {
    output.push([...current])
    return output
  }

  for (let index = start; index < breakpoints.length; index++) {
    current.push(breakpoints[index])
    buildBreakpointCombinations(breakpoints, count, index + 1, current, output)
    current.pop()
  }

  return output
}

function buildNameLineCandidates(value: string, maxLines: number, locale: string) {
  const breakpoints = getSemanticBreakpoints(value, locale)
  const candidates: string[][] = [[value.trim()]]
  const egoTokenMatch = value.match(/^(.*?\bE\.?G\.?O[:：]{2})(.+)$/i)

  if (egoTokenMatch && maxLines >= 2) {
    const prefix = egoTokenMatch[1].trim()
    const rest = egoTokenMatch[2].trim()
    candidates.push([prefix, rest])

    if (maxLines >= 3) {
      const prefixBreakpoints = getSemanticBreakpoints(prefix, locale)
      for (const breakpoint of prefixBreakpoints) {
        candidates.push([
          prefix.slice(0, breakpoint).trim(),
          prefix.slice(breakpoint).trim(),
          rest,
        ])
      }

      const restBreakpoints = getSemanticBreakpoints(rest, locale)
      for (const breakpoint of restBreakpoints) {
        candidates.push([
          prefix,
          rest.slice(0, breakpoint).trim(),
          rest.slice(breakpoint).trim(),
        ])
      }
    }
  }

  for (let lineCount = 2; lineCount <= maxLines; lineCount++) {
    for (const selectedBreakpoints of buildBreakpointCombinations(breakpoints, lineCount - 1)) {
      const positions = [0, ...selectedBreakpoints, value.length]
      candidates.push(positions.slice(0, -1).map((position, index) => (
        value.slice(position, positions[index + 1]).trim()
      )))
    }
  }

  const seen = new Set<string>()
  return candidates.filter(candidate => {
    if (candidate.length > maxLines || candidate.some(line => line.length === 0)) return false
    const key = candidate.join('\n')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function hasBrokenProtectedNameLines(lines: string[]) {
  return lines.some(line => {
    const compact = line.replace(/\s+/g, '')
    return (
      BROKEN_EGO_PREFIX_RE.test(compact) ||
      /E\.G\.$|E\.G$|E\.$/i.test(compact) ||
      LEADING_PARTICLE_RE.test(line.trim()) ||
      /^[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7a3]$/.test(compact)
    )
  })
}

function estimateLineUnits(value: string) {
  return Array.from(value).reduce((sum, char) => {
    if (/\s/.test(char)) return sum + 0.36
    if (HANGUL_RE.test(char)) return sum + 1
    if (/[A-Za-z0-9]/.test(char)) return sum + 0.56
    if (/[-–—:.：]/.test(char)) return sum + 0.34
    if (/[【】「」『』()[\]]/.test(char)) return sum + 0.42
    return sum + 0.8
  }, 0)
}

function scoreNameLines(lines: string[], widths: number[], maxWidth: number) {
  const visualWeights = lines.map(getLineTextWeight)
  const averageWidth = widths.reduce((sum, width) => sum + width, 0) / widths.length
  const balancePenalty = widths.reduce((sum, width) => sum + Math.abs(width - averageWidth), 0) / Math.max(maxWidth, 1)
  const finalWeight = visualWeights[visualWeights.length - 1] ?? 0
  const finalCompact = lines[lines.length - 1]?.replace(/\s+/g, '') ?? ''
  let score = lines.length * 8 + balancePenalty

  if (lines.length === 1) score += 16
  if (lines.length > 2) score += 4
  if (finalWeight <= 1) score += 160
  if (finalWeight === 2) score += lines.length === 2 && HANGUL_RE.test(finalCompact) ? 35 : 8
  if (TITLE_SUFFIX_RE.test(finalCompact)) score -= 40

  lines.forEach((line, index) => {
    const compact = line.replace(/\s+/g, '')
    if (SINGLE_HANGUL_RE.test(compact)) score += 140
    if (LEADING_PARTICLE_RE.test(line.trim())) score += 180
    if (/^[)\]】」』,.:;:：]/.test(compact)) score += 45
    if (/^[-–—]/.test(compact)) score += 180
    if (/^[\u3040-\u30ff][【「『（(\[]/.test(compact)) score += 100
    if (BROKEN_EGO_PREFIX_RE.test(compact)) score += 240
    if (/E\.G\.$|E\.G$|E\.$/i.test(compact)) score += 240
    if (/[A-Za-z]-$/.test(compact)) score += 90
    if (EGO_FRAGMENT_RE.test(compact) && !/E\.G\.O[:：]{2}$/i.test(compact)) score += 90
    if (index < lines.length - 1 && /E\.G\.$|E\.G\.O?$/i.test(compact)) score += 90
    if (index < lines.length - 1 && /(?:[-–—]|[:：]{2})$/.test(compact)) score -= 25
    if (index < lines.length - 1 && getLineTextWeight(compact) <= 2) score += 50
    if (index < lines.length - 1 && getLineTextWeight(compact) === 3) score += 15
    if (index === lines.length - 1 && HANGUL_RE.test(compact) && compact.length <= 2) score += 10
  })

  return score
}

function scoreDeterministicNameLines(lines: string[], maxUnits: number) {
  const estimatedWidths = lines.map(estimateLineUnits)
  const overflowPenalty = estimatedWidths.reduce((sum, width) => {
    if (width <= maxUnits) return sum
    return sum + (width - maxUnits) * 90
  }, 0)
  const finalCompact = lines[lines.length - 1]?.replace(/\s+/g, '') ?? ''
  const looseSuffixPenalty = TITLE_SUFFIX_RE.test(finalCompact) ? 34 : 0

  return scoreNameLines(lines, estimatedWidths, maxUnits) + overflowPenalty + looseSuffixPenalty
}

function chooseDeterministicNameLines(value: string, compact: boolean, locale: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (shouldPreferMeasuredSingleLine(normalized)) return null

  const candidates = buildNameLineCandidates(normalized, getMaxManualNameLines(locale, compact), locale)
  if (candidates.length <= 1) return null

  const maxUnits = compact ? COMPACT_DETERMINISTIC_LINE_UNITS : REGULAR_DETERMINISTIC_LINE_UNITS
  let best: { lines: string[]; score: number } | null = null

  for (const candidate of candidates) {
    const score = scoreDeterministicNameLines(candidate, maxUnits)
    if (best === null || score < best.score) best = { lines: candidate, score }
  }

  if (!best || best.lines.length <= 1) return null
  return best.lines
}

function getCanvasFont(style: CSSStyleDeclaration) {
  const fontStyle = style.fontStyle && style.fontStyle !== 'normal' ? `${style.fontStyle} ` : ''
  const fontVariant = style.fontVariant && style.fontVariant !== 'normal' ? `${style.fontVariant} ` : ''
  return `${fontStyle}${fontVariant}${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
}

function measureCanvasTextWidth(value: string, font: string, letterSpacing: number) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return null
  context.font = font
  return getTextWidthWithLetterSpacing(context.measureText(value).width, value, letterSpacing)
}

function chooseMeasuredNameLines(value: string, maxWidth: number, font: string, lineHeight: number, locale: string, compact: boolean, letterSpacing: number) {
  if (!value.trim() || maxWidth <= 0) return null

  const normalizedValue = value.replace(/\s+/g, ' ').trim()
  const maxLines = getMaxManualNameLines(locale, compact)
  const lineLimit = getMeasuredLineLimit(maxWidth, locale, letterSpacing)
  const canvasWidth = measureCanvasTextWidth(normalizedValue, font, letterSpacing)
  if (
    canvasWidth !== null &&
    canvasWidth <= lineLimit &&
    shouldPreferMeasuredSingleLine(normalizedValue)
  ) {
    return [normalizedValue]
  }

  if (activePretextLocale !== locale) {
    setPretextLocale(locale)
    activePretextLocale = locale
  }

  const measureLine = (line: string) => {
    const canvasWidth = measureCanvasTextWidth(line, font, letterSpacing)
    const prepared = prepareWithSegments(line, font)
    const result = layoutWithLines(prepared, maxWidth, lineHeight)
    if (result.lineCount !== 1 || result.lines.length !== 1) {
      return canvasWidth !== null && canvasWidth <= lineLimit ? canvasWidth : null
    }
    const pretextWidth = getTextWidthWithLetterSpacing(result.lines[0].width, line, letterSpacing)
    return Math.max(pretextWidth, canvasWidth ?? 0)
  }

  const singleLineWidth = measureLine(normalizedValue)
  if (
    singleLineWidth !== null &&
    singleLineWidth <= lineLimit &&
    shouldPreferMeasuredSingleLine(normalizedValue)
  ) {
    return [normalizedValue]
  }

  let best: { lines: string[]; score: number } | null = null

  for (const candidate of buildNameLineCandidates(normalizedValue, maxLines, locale)) {
    const widths: number[] = []
    let fits = true

    for (const line of candidate) {
      const width = measureLine(line)
      if (width === null || width > lineLimit) {
        fits = false
        break
      }
      widths.push(width)
    }

    if (!fits) continue

    const score = scoreNameLines(candidate, widths, maxWidth)
    if (best === null || score < best.score) best = { lines: candidate, score }
  }

  if (best) return best.lines

  let fallbackMaxWidth = maxWidth

  for (let attempt = 0; attempt < 4; attempt++) {
    const fallback = layoutWithLines(prepareWithSegments(normalizedValue, font), fallbackMaxWidth, lineHeight)
    const fallbackLines = fallback.lines.map(line => line.text.trim()).filter(Boolean).slice(0, maxLines)
    const fits = fallbackLines.every(line => {
      const width = measureCanvasTextWidth(line, font, letterSpacing)
      return width !== null && width <= lineLimit
    })

    if (fallbackLines.length > 0 && fits && !hasBrokenProtectedNameLines(fallbackLines)) return fallbackLines

    fallbackMaxWidth = Math.max(maxWidth * 0.72, fallbackMaxWidth - Math.max(2, letterSpacing * 6))
  }

  return null
}

export default function IdentityCard({
  identity,
  onClick,
  selected = false,
  gacksung = false,
  compact = false,
  board = false,
  disableHoverEffects = false,
  formationOverlay,
  giftBadgeUrls = [],
}: IdentityCardProps) {
  const { sinMap: kwSinMap, getIconUrl } = useKeywordData()
  const t = useTranslations()
  const locale = useLocale()
  const getName = (kr?: string | null, en?: string | null, jp?: string | null) => {
    if (locale === 'en') return en ?? kr ?? ''
    if (locale === 'ja') return jp ?? kr ?? ''
    return kr ?? ''
  }
  const displayName = getName(identity.name_kr, identity.name_en, identity.name_jp)
  const associationChips = getAssociationChips(identity, locale as SupportedLang)
  const representativeKeywords = getRepresentativeKeywords(identity)
  const representativeIdentity = representativeKeywords === identity.keywords
    ? identity
    : { ...identity, keywords: representativeKeywords }
  const sinColor = getIdentitySinColor(representativeIdentity, kwSinMap)
  const rarity = RARITY_COLORS[identity.rarity] || RARITY_COLORS[1]
  const rarityNum = identity.rarity
  const hoverEnabled = !disableHoverEffects && !board
  const cardClassName = [
    styles.card,
    compact ? styles.compact : '',
    board ? styles.board : '',
    selected ? styles.selected : '',
    hoverEnabled ? 'group transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:scale-[1.04]' : 'group',
  ].filter(Boolean).join(' ')
  const frameClassName = [
    styles.frame,
    hoverEnabled ? `transition-[filter] duration-300 group-hover:brightness-130 group-hover:drop-shadow-[0_0_8px_${rarity.glow}]` : '',
  ].filter(Boolean).join(' ')
  const infoUrl = getIdentityInfoUrl(identity, gacksung)
  const fallbackUrl = gacksung ? getIdentityInfoUrl(identity, false) : ''
  const [imgSrc, setImgSrc] = useState(infoUrl)
  const [imgKey, setImgKey] = useState(infoUrl)
  const cardRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLDivElement>(null)
  const [measuredNameLines, setMeasuredNameLines] = useState<string[] | null>(null)
  const deterministicNameLines = useMemo(
    () => chooseDeterministicNameLines(displayName, compact, locale),
    [compact, displayName, locale],
  )
  const renderedNameLines = useMemo(() => {
    if (
      measuredNameLines &&
      normalizeLineComparison(measuredNameLines.join('')) === normalizeLineComparison(displayName)
    ) {
      return measuredNameLines
    }
    return deterministicNameLines
  }, [deterministicNameLines, displayName, measuredNameLines])
  const nameLayout = measuredNameLines && measuredNameLines === renderedNameLines
    ? 'measured'
    : deterministicNameLines === renderedNameLines
      ? 'deterministic'
      : undefined

  useEffect(() => {
    const node = nameRef.current
    const cardNode = cardRef.current
    if (!node) return

    let cancelled = false
    let scheduled = false
    let pendingMeasure = false
    let lastRequestedFontLoad: string | null = null
    const rafIds = new Set<number>()
    const timeoutIds = new Set<number>()
    const minimumStableNameWidth = compact ? 64 : 96

    const runAnimationFrame = (callback: () => void) => {
      const rafId = window.requestAnimationFrame(() => {
        rafIds.delete(rafId)
        callback()
      })
      rafIds.add(rafId)
    }

    const runTimeout = (callback: () => void, delay: number) => {
      const timeoutId = window.setTimeout(() => {
        timeoutIds.delete(timeoutId)
        callback()
      }, delay)
      timeoutIds.add(timeoutId)
    }

    const measure = () => {
      if (cancelled) return

      try {
        const measuredWidth = node.clientWidth
        if (measuredWidth < minimumStableNameWidth) return

        const style = window.getComputedStyle(node)
        const font = getCanvasFont(style)
        const parsedLineHeight = Number.parseFloat(style.lineHeight)
        const parsedFontSize = Number.parseFloat(style.fontSize)
        const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : parsedFontSize * 1.2
        const letterSpacing = parseLetterSpacing(style)
        const fontLoadKey = `${font}\n${displayName}`

        if (document.fonts && fontLoadKey !== lastRequestedFontLoad) {
          lastRequestedFontLoad = fontLoadKey
          document.fonts.load(font, displayName).then(scheduleMeasure).catch(() => undefined)
        }
        if (locale === 'en' && document.fonts && !document.fonts.check(font, displayName)) {
          return
        }

        const lines = chooseMeasuredNameLines(displayName, measuredWidth, font, lineHeight, locale, compact, letterSpacing)

        if (!cancelled) {
          setMeasuredNameLines(previous => {
            if (previous && lines && previous.join('\n') === lines.join('\n')) return previous
            if (!previous && !lines) return previous
            return lines
          })
        }
      } catch {
        if (!cancelled) setMeasuredNameLines(null)
      }
    }

    const scheduleMeasure = () => {
      if (cancelled) return
      if (scheduled) {
        pendingMeasure = true
        return
      }
      scheduled = true

      runAnimationFrame(() => {
        runAnimationFrame(() => {
          scheduled = false
          measure()
          if (pendingMeasure) {
            pendingMeasure = false
            scheduleMeasure()
          }
        })
      })
    }

    setMeasuredNameLines(null)
    scheduleMeasure()
    const fontsReady = document.fonts?.ready
    fontsReady?.then(scheduleMeasure).catch(() => undefined)

    runTimeout(scheduleMeasure, 80)
    runTimeout(scheduleMeasure, 240)

    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(node)
    if (cardNode) resizeObserver.observe(cardNode)

    const intersectionObserver = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) scheduleMeasure()
        })
      : null
    if (cardNode && intersectionObserver) intersectionObserver.observe(cardNode)

    window.addEventListener('resize', scheduleMeasure)
    window.visualViewport?.addEventListener('resize', scheduleMeasure)

    return () => {
      cancelled = true
      rafIds.forEach(rafId => window.cancelAnimationFrame(rafId))
      timeoutIds.forEach(timeoutId => window.clearTimeout(timeoutId))
      resizeObserver.disconnect()
      intersectionObserver?.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
      window.visualViewport?.removeEventListener('resize', scheduleMeasure)
    }
  }, [displayName, locale, compact])

  // gacksung prop이 바뀌면 이미지 URL 갱신
  if (imgKey !== infoUrl) {
    setImgSrc(infoUrl)
    setImgKey(infoUrl)
  }

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={cardClassName}
      data-rarity={rarityNum}
      data-gacksung={gacksung || undefined}
      data-formation={formationOverlay?.kind}
      style={{ transformOrigin: 'center center' }}
    >
      {/* 포트레이트 영역 */}
      <div className={styles.portrait} style={{ aspectRatio: '2/3' }}>

        {/* 일러스트 */}
        <div className={styles.portraitInner}>
          {imgSrc ? (
            <Image
              src={imgSrc}
              alt={displayName}
              fill
              placeholder="blur"
              blurDataURL={getBlurDataURL(imgSrc) ?? BLUR_PLACEHOLDER}
              className="object-cover object-top"
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 150px"
              onError={() => {
                if (fallbackUrl && imgSrc !== fallbackUrl) {
                  setImgSrc(fallbackUrl)
                } else {
                  setImgSrc('')
                }
              }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(160deg, #1e1810 0%, #0d0a06 100%)` }}
            >
              <span
                className="font-serif font-light"
                style={{ fontSize: '2.25rem', color: `${sinColor}18`, lineHeight: 1 }}
              >
                {identity.name[0]}
              </span>
            </div>
          )}
          <div className={styles.gradient} />
        </div>

        {formationOverlay && (
          <div className={styles.formationOverlay} aria-hidden="true">
            <Image
              src={formationOverlay.bannerUrl}
              alt=""
              width={320}
              height={96}
              className={styles.formationBanner}
              sizes="(max-width: 640px) 6.5rem, 8rem"
            />
            <span className={styles.formationNumber}>
              {formationOverlay.order}
            </span>
          </div>
        )}

        {formationOverlay && giftBadgeUrls.length > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              top: '71%',
              zIndex: 25,
              display: 'inline-flex',
              maxWidth: '70%',
              transform: 'translate(-50%, -50%)',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.125rem',
              pointerEvents: 'none',
            }}
          >
            {giftBadgeUrls.slice(0, 4).map((url, index) => (
              <Image
                key={`${url}-${index}`}
                src={url}
                alt=""
                width={24}
                height={24}
                style={{
                  width: 'clamp(0.8125rem, 15cqi, 1.125rem)',
                  height: 'clamp(0.8125rem, 15cqi, 1.125rem)',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 0.125rem rgba(0,0,0,0.85))',
                }}
              />
            ))}
          </div>
        )}

        {/* 인격명 */}
        <div
          ref={nameRef}
          className={styles.name}
          data-locale={locale}
          data-layout={nameLayout}
          aria-label={displayName}
        >
          {renderedNameLines
            ? renderedNameLines.map((line, index) => (
              <span className={styles.nameLine} key={`${line}-${index}`}>
                {line}
              </span>
            ))
            : displayName}
        </div>

        {/* 등급 아이콘 */}
        <div className={styles.rarityIcon}>
          {RARITY_ICON_MAP[identity.rarity] ? (
            <Image
              src={RARITY_ICON_MAP[identity.rarity]}
              alt={`${identity.rarity}성`}
              width={identity.rarity === 1 ? 20 : identity.rarity === 2 ? 34 : 46}
              height={14}

              style={{ height: '0.875rem', width: 'auto', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }}
            />
          ) : (
            <span
              style={{
                color: rarity.border,
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                background: 'rgba(13,11,8,0.85)',
                padding: '0.0625rem 0.3125rem',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${rarity.border}40`,
              }}
            >
              {identity.rarity}성
            </span>
          )}
        </div>

        {/* 수감자 로고 배지 */}
        <div className={styles.sinnerBadge} aria-hidden="true">
          <span className={styles.sinnerBadgeLogoSlot}>
            <Image
              src={getSinnerLogoUrl(identity.sinner_id)}
              alt=""
              fill
              className={styles.sinnerBadgeLogo}
              sizes="(max-width: 420px) 1.9rem, (max-width: 640px) 2.25rem, 3.1rem"
            />
          </span>
          <Image
            src={`${STORAGE_BASE}/icons/ui/portrait-frame-${rarityNum}star.webp`}
            alt=""
            fill
            className={styles.sinnerBadgeRing}
            sizes="(max-width: 640px) 2.55rem, 3.4rem"
          />
        </div>

        {/* 등급 프레임 오버레이 */}
        {IDENTITY_CARD_FRAME_MAP[identity.rarity] && (
          <Image
            src={IDENTITY_CARD_FRAME_MAP[identity.rarity]}
            alt=""
            width={200}
            height={300}

            className={frameClassName}
          />
        )}

        {selected && !formationOverlay && !board && (
          <Image
            src={SELECTED_BANNER_URL}
            alt=""
            width={320}
            height={96}
            className={styles.selectedRibbon}
            sizes="(max-width: 640px) 6rem, 7.25rem"
            aria-hidden="true"
          />
        )}
      </div>

      {/* 스탯 바 (compact 모드에서는 숨김) */}
      {!compact && (
        <div
          className="px-2 py-1.5 mt-1"
          style={{
            borderTop: `1px solid ${sinColor}30`,
            background: 'rgba(13,11,8,0.85)',
          }}
        >
          <div className="flex items-center justify-between gap-1 text-center">
            {[
              { label: t('identity.stat.hp'), value: identity.hp },
              { label: t('identity.stat.speed'), value: `${identity.speed_min}-${identity.speed_max}` },
              { label: t('identity.stat.defense'), value: identity.def_level },
            ].map(({ label, value }) => (
              <div key={label} className="min-w-0 flex-1">
                <div className="font-mono font-semibold" style={{ color: sinColor, fontSize: 'var(--text-xs)' }}>
                  {value}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* 키워드 배지 (특수 충전→충전 정규화) */}
          {representativeKeywords.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {[...new Set(representativeKeywords.map(normalizeThemeKeyword))].filter(kw => kwSinMap[kw]).slice(0, 3).map(kw => {
                const kwColor = SIN_COLORS[kwSinMap[kw]] || sinColor
                const iconUrl = getIconUrl(kw)
                return (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-0.5"
                    style={{
                      background: `${kwColor}18`,
                      color: kwColor,
                      border: `1px solid ${kwColor}35`,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.5rem',
                      padding: '0.0625rem 0.1875rem',
                    }}
                  >
                    {iconUrl && (
                      <Image src={iconUrl} alt="" width={10} height={10} style={{ display: 'inline-block' }} unoptimized />
                    )}
                    {kw}
                  </span>
                )
              })}
            </div>
          )}

          {/* 소속 */}
          {associationChips.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-0.5">
              {associationChips.map(association => (
                <span
                  key={association}
                  style={{
                    background: `${sinColor}18`,
                    color: sinColor,
                    border: `1px solid ${sinColor}40`,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.5rem',
                    padding: '0 0.25rem',
                  }}
                >
                  {association}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
