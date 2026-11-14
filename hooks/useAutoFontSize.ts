'use client'

import { useEffect, useState } from 'react'
import { splitTitleInTwo } from '@/lib/mirror-dungeon/title-lines'
import type { SupportedLang } from '@/lib/i18n/types'

// One canvas for every card, the resolved font variables (set once on <html>), and the sizes already found.
let measureContext: CanvasRenderingContext2D | null | undefined
const resolvedFamilies = new Map<string, string>()
const fitted = new Map<string, number>()

function resolveFamily(fontFamily: string) {
  let resolved = resolvedFamilies.get(fontFamily)
  if (resolved === undefined) {
    const rootStyle = getComputedStyle(document.documentElement)
    // Resolve CSS variables (e.g. var(--font-kotra-bold)) to actual font-family names
    resolved = fontFamily.replace(/var\(([^)]+)\)/g, (_, v) => rootStyle.getPropertyValue(v).trim() || '')
    resolvedFamilies.set(fontFamily, resolved)
  }
  return resolved
}

/**
 * Pretext 기반 자동 폰트 사이징 훅
 * 텍스트가 maxWidth 안에 1~2줄로 맞게 fontSize를 자동 축소
 * @returns rem 단위 폰트 크기
 */
export function useAutoFontSize(
  text: string,
  maxRem: number,
  minRem: number,
  maxWidthPx: number,
  fontFamily: string = 'var(--font-kotra-bold), serif',
  fontWeight: number | string = 700,
): number {
  const [fontSizeRem, setFontSizeRem] = useState(maxRem)

  useEffect(() => {
    if (!text || maxWidthPx <= 0) {
      setFontSizeRem(maxRem)
      return
    }

    let cancelled = false

    import('@chenglou/pretext').then(({ prepare, layout }) => {
      if (cancelled) return

      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const resolvedFamily = resolveFamily(fontFamily)
      const key = [text, maxRem, minRem, maxWidthPx, resolvedFamily, fontWeight, rootFontSize, document.fonts.status].join('\u0001')
      const known = fitted.get(key)
      if (known !== undefined) {
        setFontSizeRem(known)
        return
      }

      const maxPx = maxRem * rootFontSize
      const minPx = minRem * rootFontSize
      const step = rootFontSize * 0.0625 // 1px step in rem terms
      if (measureContext === undefined) measureContext = document.createElement('canvas').getContext('2d')
      const context = measureContext
      const widthAt = (sizePx: number) => {
        if (!context) return 0
        context.font = `${fontWeight} ${sizePx}px ${resolvedFamily}`
        return context.measureText(text).width
      }

      // A line's width grows linearly with the font size, so sizes well above the one that fits are skipped; the
      // search starts two steps above the predicted size and steps down exactly as before.
      const widest = widthAt(maxPx)
      const predicted = widest > 0 ? maxPx * maxWidthPx / widest : maxPx
      const skipped = Math.max(0, Math.floor((maxPx - predicted) / step) - 2)
      let result = minRem
      for (let sizePx = maxPx - skipped * step; sizePx >= minPx; sizePx -= step) {
        const measuredWidth = widthAt(sizePx)
        const lines = layout(prepare(text, `${fontWeight} ${sizePx}px ${resolvedFamily}`), maxWidthPx, sizePx * 1.2)

        if (lines.lineCount <= 1 && measuredWidth <= maxWidthPx) {
          result = sizePx / rootFontSize
          break
        }
      }
      if (fitted.size >= 2000) fitted.clear()
      fitted.set(key, result)
      if (!cancelled) setFontSizeRem(result)
    }).catch(() => {
      if (!cancelled) setFontSizeRem(maxRem)
    })

    return () => { cancelled = true }
  }, [text, maxRem, minRem, maxWidthPx, fontFamily, fontWeight])

  return fontSizeRem
}

/**
 * Two-line layout for a title the one-line fit shrinks too far (below `wrapBelow` of `maxRem`): the most balanced
 * break (lib/mirror-dungeon/title-lines.ts) at the largest size that fits, capped at `twoLineMax` of `maxRem`.
 * Returns null while the one-line size is good enough or the title cannot break.
 */
export function useTwoLineTitle(
  text: string,
  lang: SupportedLang,
  oneLineRem: number,
  maxRem: number,
  maxWidthPx: number,
  fontFamily: string,
  fontWeight: number | string,
  { wrapBelow = 0.75, twoLineMax = 0.85 }: { wrapBelow?: number; twoLineMax?: number } = {},
): { lines: [string, string]; fontSizeRem: number } | null {
  const [layoutResult, setLayoutResult] = useState<{ lines: [string, string]; fontSizeRem: number } | null>(null)

  useEffect(() => {
    if (!text || maxWidthPx <= 0 || oneLineRem >= maxRem * wrapBelow) {
      setLayoutResult(null)
      return
    }
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    if (measureContext === undefined) measureContext = document.createElement('canvas').getContext('2d')
    const context = measureContext
    if (!context) return
    const basePx = maxRem * rootFontSize
    context.font = `${fontWeight} ${basePx}px ${resolveFamily(fontFamily)}`
    const measure = (s: string) => context.measureText(s).width
    const lines = splitTitleInTwo(text, lang, measure)
    if (!lines) { setLayoutResult(null); return }
    const widest = Math.max(measure(lines[0]), measure(lines[1]))
    const sizeRem = Math.min(maxRem * twoLineMax, (maxRem * maxWidthPx) / widest)
    // Wrap only when it clearly beats the one-line size.
    setLayoutResult(sizeRem > oneLineRem * 1.1 ? { lines, fontSizeRem: sizeRem } : null)
  }, [text, lang, oneLineRem, maxRem, maxWidthPx, fontFamily, fontWeight, wrapBelow, twoLineMax])

  return layoutResult
}
