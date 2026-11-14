import type { SupportedLang } from '@/lib/i18n/types'

// How an E.G.O card's name is fitted into its banner: font size steps, then the best two-line break, measured with the text measuring library.
// The caches and observers below are shared by every card on the page.

export const EGO_NAME_FONT_FAMILY = "var(--font-kotra-bold), var(--font-noto-jp), 'Hiragino Sans', 'Yu Gothic', sans-serif"
export const EGO_NAME_MAX_FONT_REM = 0.82
const EGO_NAME_MIN_FONT_REM = 0.68
const EGO_NAME_FONT_STEP_REM = 0.02
export const EGO_NAME_FIT_BUFFER_PX = 8
const EGO_NAME_ACRONYM_RE = /E\.?G\.?O(?::[:：])?/ig
const EGO_NAME_BROKEN_PREFIX_RE = /^(?:G\.O|G\.|O)(?:[:：]{1,2}|$)/i
const EGO_NAME_LEADING_PARTICLE_RE = /^[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7a3]?(?:의|와|과|을|를|이|가|은|는|へ|を|が|は|に|の|と|も|で)(?:\s|$)/
const EGO_NAME_OPENING_BRACKET_RE = /[([{「『【]$/
const EGO_NAME_CLOSING_BRACKET_RE = /^[)\]}」』】]/
const EGO_NAME_BRACKET_PAIR_BY_OPENING: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '「': '」',
  '『': '』',
  '【': '】',
}
const EGO_NAME_OPENING_BY_CLOSING_BRACKET: Record<string, string> = Object.fromEntries(
  Object.entries(EGO_NAME_BRACKET_PAIR_BY_OPENING).map(([opening, closing]) => [closing, opening]),
)
let activeEgoPretextLocale: SupportedLang | null = null
// The name is measured after the card mounts, so the text measuring library (40KB) loads then, once for every card, and stays
// out of the first load of the pages that show E.G.O cards.
let pretext: typeof import('@chenglou/pretext') | null = null
let pretextLoad: Promise<void> | null = null
const loadPretext = () => (pretextLoad ??= import('@chenglou/pretext').then(mod => { pretext = mod }))

export type EgoNameLineLayout = {
  allowAnywhere: boolean
  fontSizeRem: number
  lineHeight: number
  lines: string[]
}

const getEgoNameUnits = (value: string) => {
  return Array.from(value).reduce((total, char) => {
    if (/\s/.test(char)) return total + 0.35
    if (/[·:：\-–—/／]/.test(char)) return total + 0.45
    if (/[\u1100-\u11ff\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(char)) return total + 1
    return total + 0.55
  }, 0)
}

const getEgoNameBreakpoints = (value: string) => {
  const breakCandidates: Array<{ index: number; keepSeparator: boolean }> = []

  Array.from(value).forEach((char, charIndex) => {
    if (/\s/.test(char)) breakCandidates.push({ index: charIndex, keepSeparator: false })
    if (/[·:：\-–—/／]/.test(char)) breakCandidates.push({ index: charIndex, keepSeparator: true })
    if (/[[({「『【]/.test(char) && charIndex > 0) breakCandidates.push({ index: charIndex, keepSeparator: false })
  })

  for (const match of value.matchAll(EGO_NAME_ACRONYM_RE)) {
    if (match.index !== undefined) breakCandidates.push({ index: match.index + match[0].length - 1, keepSeparator: true })
  }

  return breakCandidates
}

const hasUnclosedEgoNameBracket = (value: string) => {
  const stack: string[] = []

  for (const char of Array.from(value)) {
    const closing = EGO_NAME_BRACKET_PAIR_BY_OPENING[char]
    if (closing) {
      stack.push(closing)
      continue
    }

    if (EGO_NAME_OPENING_BY_CLOSING_BRACKET[char]) {
      if (stack[stack.length - 1] === char) {
        stack.pop()
      }
    }
  }

  return stack.length > 0
}

const hasUnmatchedEgoNameClosingBracket = (value: string) => {
  const stack: string[] = []

  for (const char of Array.from(value)) {
    const closing = EGO_NAME_BRACKET_PAIR_BY_OPENING[char]
    if (closing) {
      stack.push(closing)
      continue
    }

    if (EGO_NAME_OPENING_BY_CLOSING_BRACKET[char]) {
      if (stack[stack.length - 1] !== char) return true
      stack.pop()
    }
  }

  return false
}

const buildEgoNameLineCandidates = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  const candidates: string[][] = []
  const seen = new Set<string>()

  const addCandidate = (lines: string[]) => {
    const cleaned = lines.map(line => line.trim()).filter(Boolean)
    if (cleaned.length !== 2) return
    if (EGO_NAME_OPENING_BRACKET_RE.test(cleaned[0])) return
    if (EGO_NAME_CLOSING_BRACKET_RE.test(cleaned[1])) return
    if (hasUnclosedEgoNameBracket(cleaned[0])) return
    if (hasUnmatchedEgoNameClosingBracket(cleaned[1])) return
    const key = cleaned.join('\n')
    if (seen.has(key)) return
    seen.add(key)
    candidates.push(cleaned)
  }

  for (const candidate of getEgoNameBreakpoints(normalized)) {
    const splitIndex = candidate.index + (candidate.keepSeparator ? 1 : 0)
    addCandidate([
      normalized.slice(0, splitIndex).trim(),
      normalized.slice(splitIndex).trim(),
    ])
  }

  const chars = Array.from(normalized)
  for (let splitIndex = 1; splitIndex < chars.length; splitIndex += 1) {
    addCandidate([
      chars.slice(0, splitIndex).join('').trim(),
      chars.slice(splitIndex).join('').trim(),
    ])
  }

  return candidates
}

const getEgoNameFont = (fontSizePx: number) => {
  return `500 ${fontSizePx}px ${EGO_NAME_FONT_FAMILY}`
}

const getEgoNameLineWidth = (line: string, maxWidth: number, font: string, lineHeightPx: number) => {
  const result = pretext!.layoutWithLines(pretext!.prepareWithSegments(line, font), maxWidth, lineHeightPx)
  if (result.lineCount !== 1 || result.lines.length !== 1) return null
  return result.lines[0].width
}

const scoreEgoNameCandidate = (lines: string[], widths: number[], maxWidth: number) => {
  const maxWidthRatio = Math.max(...widths) / Math.max(maxWidth, 1)
  const averageWidth = widths.reduce((sum, width) => sum + width, 0) / widths.length
  const balancePenalty = widths.reduce((sum, width) => sum + Math.abs(width - averageWidth), 0) / Math.max(maxWidth, 1)
  const shortLinePenalty = Math.min(...lines.map(getEgoNameUnits)) < 2 ? 3 : 0
  const semanticPenalty = /[\s·:：\-–—/／]/.test(lines[0].slice(-1)) ? -0.6 : 0
  const badBreakPenalty = lines.reduce((sum, line) => {
    const compact = line.replace(/\s+/g, '')
    let penalty = 0
    if (EGO_NAME_OPENING_BRACKET_RE.test(line)) penalty += 28
    if (EGO_NAME_CLOSING_BRACKET_RE.test(line)) penalty += 28
    if (EGO_NAME_LEADING_PARTICLE_RE.test(line.trim())) penalty += 20
    if (EGO_NAME_BROKEN_PREFIX_RE.test(compact)) penalty += 28
    if (/E\.G\.$|E\.G$|E\.$/i.test(compact)) penalty += 28
    if (/^[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7a3]$/.test(compact)) penalty += 14
    return sum + penalty
  }, 0)

  return maxWidthRatio * 8 + balancePenalty + shortLinePenalty + semanticPenalty + badBreakPenalty
}

// The font variables are set once on <html>, so the resolved family is read once per page instead of per measurement.
let resolvedEgoNameFontFamily: string | null = null
const resolveEgoNameFontFamily = () => {
  if (typeof window === 'undefined') return EGO_NAME_FONT_FAMILY

  if (resolvedEgoNameFontFamily) return resolvedEgoNameFontFamily
  const rootStyle = getComputedStyle(document.documentElement)
  resolvedEgoNameFontFamily = EGO_NAME_FONT_FAMILY.replace(/var\(([^)]+)\)/g, (_, propertyName: string) => (
    rootStyle.getPropertyValue(propertyName).trim() || 'sans-serif'
  ))
  return resolvedEgoNameFontFamily
}

/**
 * One observer and one font listener shared by every card name on the page (a grid has a hundred or more), and the
 * layouts they measure, keyed by name, language, width, root font size and the fonts loaded so far.
 */
const egoNameBoxes = new Map<Element, () => void>()
let egoNameObserver: ResizeObserver | null = null
let egoNameFontGeneration = 0
let egoNameFontsWatched = false
const egoNameLayouts = new Map<string, EgoNameLineLayout>()

export function watchEgoNameBox(box: Element, update: () => void) {
  egoNameBoxes.set(box, update)
  if (!egoNameObserver && typeof ResizeObserver !== 'undefined') {
    egoNameObserver = new ResizeObserver(entries => { for (const entry of entries) egoNameBoxes.get(entry.target)?.() })
  }
  egoNameObserver?.observe(box)
  if (!egoNameFontsWatched) {
    egoNameFontsWatched = true
    const refresh = () => {
      egoNameFontGeneration += 1
      egoNameLayouts.clear()
      for (const updateBox of egoNameBoxes.values()) updateBox()
    }
    document.fonts.addEventListener('loadingdone', refresh)
    void document.fonts.ready.then(refresh)
  }
  return () => {
    egoNameBoxes.delete(box)
    egoNameObserver?.unobserve(box)
  }
}

export function cachedEgoNameLayout(name: string, locale: SupportedLang, maxWidth: number, rootFontSize: number): EgoNameLineLayout {
  const key = `${name}\u0001${locale}\u0001${maxWidth}\u0001${rootFontSize}\u0001${egoNameFontGeneration}`
  let layout = egoNameLayouts.get(key)
  if (!layout) {
    layout = measureEgoNameLayout(name, locale, maxWidth, rootFontSize)
    // Resizing the window measures every width it passes; keep the cache bounded.
    if (egoNameLayouts.size >= 2000) egoNameLayouts.clear()
    egoNameLayouts.set(key, layout)
  }
  return layout
}

const measureEgoNameLayout = (
  name: string,
  locale: SupportedLang,
  maxWidth: number,
  rootFontSize: number,
): EgoNameLineLayout => {
  const normalized = name.replace(/\s+/g, ' ').trim()
  const resolvedFontFamily = resolveEgoNameFontFamily()

  if (activeEgoPretextLocale !== locale) {
    pretext!.setLocale(locale)
    activeEgoPretextLocale = locale
  }

  for (
    let fontSizeRem = EGO_NAME_MAX_FONT_REM;
    fontSizeRem >= EGO_NAME_MIN_FONT_REM - 0.001;
    fontSizeRem -= EGO_NAME_FONT_STEP_REM
  ) {
    const fontSizePx = fontSizeRem * rootFontSize
    const lineHeightPx = fontSizePx
    const font = `500 ${fontSizePx}px ${resolvedFontFamily}`
    const width = getEgoNameLineWidth(normalized, maxWidth, font, lineHeightPx)

    if (width !== null && width <= maxWidth + 1) {
      return {
        allowAnywhere: false,
        fontSizeRem,
        lineHeight: 1,
        lines: [normalized],
      }
    }
  }

  const minFontSizePx = EGO_NAME_MIN_FONT_REM * rootFontSize
  const minFont = getEgoNameFont(minFontSizePx).replace(EGO_NAME_FONT_FAMILY, resolvedFontFamily)
  const minLineHeightPx = minFontSizePx * 0.95
  let best: { lines: string[]; score: number } | null = null

  for (const candidate of buildEgoNameLineCandidates(normalized)) {
    const widths: number[] = []
    let fits = true

    for (const line of candidate) {
      const width = getEgoNameLineWidth(line, maxWidth, minFont, minLineHeightPx)
      if (width === null || width > maxWidth + 1) {
        fits = false
        break
      }
      widths.push(width)
    }

    if (!fits) continue

    const score = scoreEgoNameCandidate(candidate, widths, maxWidth)
    if (!best || score < best.score) best = { lines: candidate, score }
  }

  if (best) {
    return {
      allowAnywhere: false,
      fontSizeRem: EGO_NAME_MIN_FONT_REM,
      lineHeight: 0.95,
      lines: best.lines,
    }
  }

  // Long localized names with a kanji subtitle ("… [着影揮刀]") drop the subtitle before wrapping past the banner; title keeps the full name.
  const withoutSubtitle = normalized.replace(/\s*[[(（【「][^\])）】」]*[\])）】」]$/, '')
  if (withoutSubtitle && withoutSubtitle !== normalized) return measureEgoNameLayout(withoutSubtitle, locale, maxWidth, rootFontSize)

  return {
    allowAnywhere: true,
    fontSizeRem: EGO_NAME_MIN_FONT_REM,
    lineHeight: 0.95,
    lines: [normalized],
  }
}

/** Runs `start` at once when the text measuring library is loaded, else after it loads (a failed load never runs it). */
export function whenEgoNameReady(start: () => void) {
  if (pretext) start()
  else loadPretext().then(start).catch(() => {})
}
