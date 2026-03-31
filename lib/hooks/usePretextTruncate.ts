'use client'

import { useEffect, useState } from 'react'

/**
 * Pretext 기반 텍스트 truncation 훅
 * 텍스트가 maxWidthPx * maxLines 안에 맞는지 측정하고,
 * 맞지 않으면 '...' 접미사로 잘라낸 displayText를 반환
 */
export function usePretextTruncate(
  text: string,
  maxLines: number,
  maxWidthPx: number,
  fontCss: string,
  lineHeightPx: number,
): { isTruncated: boolean; displayText: string } {
  const [result, setResult] = useState<{ isTruncated: boolean; displayText: string }>({
    isTruncated: false,
    displayText: text,
  })

  useEffect(() => {
    if (!text || maxWidthPx <= 0 || maxLines <= 0) {
      setResult({ isTruncated: false, displayText: text })
      return
    }

    let cancelled = false

    import('@chenglou/pretext').then(({ prepare, layout }) => {
      if (cancelled) return

      // 원본 텍스트가 maxLines 안에 맞는지 체크
      const prepared = prepare(text, fontCss)
      const measured = layout(prepared, maxWidthPx, lineHeightPx)

      if (measured.lineCount <= maxLines) {
        if (!cancelled) setResult({ isTruncated: false, displayText: text })
        return
      }

      // 맞지 않으면 이진 탐색으로 '...' 포함 최적 길이 찾기
      const ellipsis = '...'
      let lo = 0
      let hi = text.length
      let bestLen = 0

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        const candidate = text.slice(0, mid) + ellipsis
        const candidatePrepared = prepare(candidate, fontCss)
        const candidateMeasured = layout(candidatePrepared, maxWidthPx, lineHeightPx)

        if (candidateMeasured.lineCount <= maxLines) {
          bestLen = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }

      const truncated = text.slice(0, bestLen).trimEnd() + ellipsis
      if (!cancelled) setResult({ isTruncated: true, displayText: truncated })
    }).catch(() => {
      // Pretext 로드 실패 시 원본 텍스트 그대로 반환
      if (!cancelled) setResult({ isTruncated: false, displayText: text })
    })

    return () => { cancelled = true }
  }, [text, maxLines, maxWidthPx, fontCss, lineHeightPx])

  return result
}

/**
 * 단일 행 truncation용 편의 훅
 * overflow: hidden + text-overflow: ellipsis 대체
 */
export function usePretextSingleLineTruncate(
  text: string,
  maxWidthPx: number,
  fontCss: string,
): { isTruncated: boolean; displayText: string } {
  const [result, setResult] = useState<{ isTruncated: boolean; displayText: string }>({
    isTruncated: false,
    displayText: text,
  })

  useEffect(() => {
    if (!text || maxWidthPx <= 0) {
      setResult({ isTruncated: false, displayText: text })
      return
    }

    let cancelled = false

    import('@chenglou/pretext').then(({ prepare, layout }) => {
      if (cancelled) return

      // fontSize를 fontCss에서 추출 (e.g. "bold 9px KotraBold" -> 9)
      const sizeMatch = fontCss.match(/(\d+(?:\.\d+)?)\s*px/)
      const fontSize = sizeMatch ? parseFloat(sizeMatch[1]) : 14
      const lineHeight = fontSize * 1.2

      const prepared = prepare(text, fontCss)
      const measured = layout(prepared, maxWidthPx, lineHeight)

      if (measured.lineCount <= 1) {
        if (!cancelled) setResult({ isTruncated: false, displayText: text })
        return
      }

      // 이진 탐색
      const ellipsis = '...'
      let lo = 0
      let hi = text.length
      let bestLen = 0

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        const candidate = text.slice(0, mid) + ellipsis
        const candidatePrepared = prepare(candidate, fontCss)
        const candidateMeasured = layout(candidatePrepared, maxWidthPx, lineHeight)

        if (candidateMeasured.lineCount <= 1) {
          bestLen = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }

      const truncated = text.slice(0, bestLen).trimEnd() + ellipsis
      if (!cancelled) setResult({ isTruncated: true, displayText: truncated })
    }).catch(() => {
      if (!cancelled) setResult({ isTruncated: false, displayText: text })
    })

    return () => { cancelled = true }
  }, [text, maxWidthPx, fontCss])

  return result
}
