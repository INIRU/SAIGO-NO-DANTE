'use client'

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { placePopoverIn, type PopoverPlacement } from '@/lib/utils/popover'

// ── 툴팁 hover + 터치 관리 훅 ───────────────────────────────────────────
// 한 번에 하나의 칩 툴팁만 표시
let activeChipClose: (() => void) | null = null

export function useTooltip(ref: React.RefObject<HTMLElement | null>) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const hide = useCallback(() => setRect(null), [])
  const show = useCallback(() => {
    if (activeChipClose && activeChipClose !== hide) activeChipClose()
    clearTimeout(hideTimeout.current)
    setRect(ref.current?.getBoundingClientRect() ?? null)
    activeChipClose = hide
  }, [ref, hide])

  const scheduleHide = useCallback(() => {
    hideTimeout.current = setTimeout(() => { setRect(null); if (activeChipClose === hide) activeChipClose = null }, 120)
  }, [hide])

  const cancelHide = useCallback(() => {
    clearTimeout(hideTimeout.current)
  }, [])

  // 모바일 터치 토글
  const toggle = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setRect(prev => {
      if (prev) { if (activeChipClose === hide) activeChipClose = null; return null }
      if (activeChipClose && activeChipClose !== hide) activeChipClose()
      activeChipClose = hide
      return ref.current?.getBoundingClientRect() ?? null
    })
  }, [ref, hide])

  // 외부 탭 시 닫기
  useEffect(() => {
    if (!rect) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setRect(null)
        if (activeChipClose === hide) activeChipClose = null
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [rect, ref, hide])

  return { rect, show, scheduleHide, cancelHide, toggle }
}

// ── 공용 툴팁 래퍼 (스마트 포지셔닝 + 스크롤 + 페이드) ─────────────────
export function TooltipPopup({
  rect, children, minWidth = 200, maxWidth = 300, onMouseEnter, onMouseLeave,
}: {
  rect: DOMRect
  children: React.ReactNode
  minWidth?: number
  maxWidth?: number
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  const cardRef = useRef<HTMLSpanElement>(null)
  const [place, setPlace] = useState<PopoverPlacement | null>(null)

  // Measured on the real card before it shows: maxWidth, then 1.5x, then 2x, the narrowest that fits (a short note keeps its own width).
  useLayoutEffect(() => {
    const card = cardRef.current, scroller = contentRef.current
    if (!card || !scroller) return
    setPlace(placePopoverIn(card, scroller, { anchor: rect, view: { width: window.innerWidth, height: window.innerHeight }, widths: [maxWidth, maxWidth * 1.5, maxWidth * 2], gap: 6, margin: 10, fit: 'shrink' }))
  }, [rect, maxWidth])

  useEffect(() => {
    const el = contentRef.current
    if (el) setOverflowing(el.scrollHeight > el.clientHeight)
  }, [place])

  return (
    <span
      ref={cardRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left: place?.left ?? 0,
        ...(place ? (place.above ? { bottom: window.innerHeight - place.top } : { top: place.top }) : { top: 0 }),
        visibility: place ? 'visible' : 'hidden',
        zIndex: 200,
        background: 'var(--bg-card)',
        border: '1px solid #3a3020',
        borderRadius: 4,
        minWidth, maxWidth: place?.width ?? maxWidth,
        whiteSpace: 'normal',
        overflow: 'hidden',
      }}
    >
      <div
        ref={contentRef}
        style={{
          padding: '8px 10px',
          maxHeight: place?.maxHeight,
          overflowY: overflowing ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
        }}
      >
        {children}
      </div>
      {overflowing && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0, height: 32,
          background: 'linear-gradient(to bottom, transparent, var(--bg-card))',
          borderRadius: '0 0 4px 4px',
          pointerEvents: 'none',
        }} />
      )}
    </span>
  )
}
