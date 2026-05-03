'use client'

import { useEffect, useState } from 'react'

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
      const maxPx = maxRem * rootFontSize
      const minPx = minRem * rootFontSize
      const step = rootFontSize * 0.0625 // 1px step in rem terms

      // Resolve CSS variables (e.g. var(--font-kotra-bold)) to actual font-family names
      const rootStyle = getComputedStyle(document.documentElement)
      const resolvedFamily = fontFamily.replace(/var\(([^)]+)\)/g, (_, v) => rootStyle.getPropertyValue(v).trim() || '')
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      for (let sizePx = maxPx; sizePx >= minPx; sizePx -= step) {
        const font = `${fontWeight} ${sizePx}px ${resolvedFamily}`
        const measuredWidth = (() => {
          if (!context) return 0
          context.font = font
          return context.measureText(text).width
        })()
        const prepared = prepare(text, font)
        const result = layout(prepared, maxWidthPx, sizePx * 1.2)

        if (result.lineCount <= 1 && measuredWidth <= maxWidthPx) {
          if (!cancelled) setFontSizeRem(sizePx / rootFontSize)
          return
        }
      }

      if (!cancelled) setFontSizeRem(minRem)
    }).catch(() => {
      if (!cancelled) setFontSizeRem(maxRem)
    })

    return () => { cancelled = true }
  }, [text, maxRem, minRem, maxWidthPx, fontFamily, fontWeight])

  return fontSizeRem
}
