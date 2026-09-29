'use client'

import { useEffect, useState } from 'react'

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
