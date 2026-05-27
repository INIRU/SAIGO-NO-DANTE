'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from '@/lib/i18n/navigation'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'motion/react'
import { Minus, Plus } from 'lucide-react'

const FONT_SIZES = ['small', 'default', 'large'] as const
type FontSize = (typeof FONT_SIZES)[number]

function isAllowedPage(path: string): boolean {
  return (
    /^\/sinners\/[^/]+\/(identities|ego)\//.test(path) ||
    /^\/decks\/.+/.test(path) ||
    path === '/collection' ||
    path === '/mirror-dungeon' ||
    path === '/keywords'
  )
}

export default function FloatingFontControl() {
  const t = useTranslations('common.fontControl')
  const pathname = usePathname()
  const allowed = isAllowedPage(pathname ?? '')
  const [fontSize, setFontSize] = useState<FontSize>('default')
  // Controls whether the panel is visible at all (entrance delay)
  const [mounted, setMounted] = useState(false)
  // CSS entrance state; separated from mount so the browser can interpolate.
  const [entered, setEntered] = useState(false)
  // Controls whether the expanded controls are shown
  const [expanded, setExpanded] = useState(false)
  // Tracks font size change for label pulse animation
  const [labelPulse, setLabelPulse] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // localStorage 복원
  useEffect(() => {
    const saved = localStorage.getItem('font-size') as FontSize | null
    if (saved && FONT_SIZES.includes(saved)) {
      setFontSize(saved)
      if (saved !== 'default') document.documentElement.dataset.fontSize = saved
    }
  }, [])

  // 비허용 페이지: 글자 크기 효과 제거
  useEffect(() => {
    if (!allowed) {
      const saved = document.documentElement.dataset.fontSize
      delete document.documentElement.dataset.fontSize
      return () => {
        if (saved) document.documentElement.dataset.fontSize = saved
      }
    }
  }, [allowed])

  // 입장 애니메이션 + 데스크탑 자동 펼침
  useEffect(() => {
    if (!allowed) {
      setMounted(false)
      setEntered(false)
      setExpanded(false)
      return
    }
    setMounted(false)
    setEntered(false)
    setExpanded(false)
    // Delay entrance by 0.8s (matches original GSAP delay)
    let expandTimer: ReturnType<typeof setTimeout> | undefined
    let frame = 0
    const entranceTimer = setTimeout(() => {
      setMounted(true)
      frame = requestAnimationFrame(() => setEntered(true))
      // Auto-expand on desktop after entrance animation completes (0.5s + 0.3s gap)
      if (window.innerWidth >= 1024) {
        expandTimer = setTimeout(() => setExpanded(true), 800)
      }
    }, 800)
    return () => {
      clearTimeout(entranceTimer)
      if (expandTimer) clearTimeout(expandTimer)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [allowed])

  // 외부 클릭/터치 닫기
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (expanded && wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [expanded])

  const changeFontSize = useCallback((dir: -1 | 1) => {
    setFontSize(prev => {
      const idx = FONT_SIZES.indexOf(prev)
      const next = FONT_SIZES[idx + dir]
      if (!next) return prev
      localStorage.setItem('font-size', next)
      if (next === 'default') delete document.documentElement.dataset.fontSize
      else document.documentElement.dataset.fontSize = next
      setLabelPulse(true)
      return next
    })
  }, [])

  useEffect(() => {
    if (!labelPulse) return
    const timer = setTimeout(() => setLabelPulse(false), 220)
    return () => clearTimeout(timer)
  }, [labelPulse])

  if (!allowed || !mounted) return null

  const isMinSize = fontSize === 'small'
  const isMaxSize = fontSize === 'large'

  return (
    <div
      ref={wrapRef}
      onClick={() => { if (!expanded) setExpanded(true) }}
      onKeyDown={(e) => {
        if (!expanded && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          setExpanded(true)
        } else if (expanded && e.key === 'Escape') {
          setExpanded(false)
        }
      }}
      className="fixed bottom-5 left-4 z-[45] flex items-center rounded-full transition-[opacity,transform,padding,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.04] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
      style={{
        padding: expanded ? '0.375rem 0.625rem' : '0.375rem',
        height: '2.5rem',
        gap: '0.5rem',
        background: 'rgba(20, 16, 12, 0.92)',
        border: '1px solid rgba(200, 144, 10, 0.25)',
        backdropFilter: 'blur(1rem)',
        WebkitBackdropFilter: 'blur(1rem)',
        boxShadow: expanded
          ? '0 0.25rem 1.5rem rgba(0,0,0,0.55), 0 0 1rem rgba(200,144,10,0.18)'
          : '0 0.25rem 1.5rem rgba(0,0,0,0.5), 0 0 0.5rem rgba(200,144,10,0.08)',
        cursor: expanded ? 'default' : 'pointer',
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0) scale(1) rotate(0)' : 'translateY(4rem) scale(0.88) rotate(-4deg)',
        transformOrigin: 'left bottom',
        WebkitTapHighlightColor: 'transparent',
      }}
      role={expanded ? undefined : 'button'}
      tabIndex={expanded ? -1 : 0}
      aria-label={expanded ? undefined : t('open')}
    >
      {!expanded ? (
        <span
          className="flex items-center justify-center select-none transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none"
          style={{
            width: '1.75rem',
            height: '1.75rem',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--gold-light)',
              fontSize: '0.875rem',
              lineHeight: 1,
              letterSpacing: '0.02em',
            }}
          >
            Aa
          </span>
        </span>
      ) : (
        /* ── Expanded state: [−] [label] [+] ── */
        <div
          className="flex items-center transition-[opacity] duration-150 ease-out motion-reduce:transition-none"
          style={{ gap: '0.5rem' }}
        >
          {/* Minus button */}
          <button
            onClick={(e) => { e.stopPropagation(); changeFontSize(-1) }}
            disabled={isMinSize}
            className="flex items-center justify-center rounded-full shrink-0 transition-[border-color,color,background,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] enabled:hover:scale-110 enabled:hover:shadow-[0_0_0.5rem_rgba(200,144,10,0.4)] enabled:active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] motion-reduce:transition-none motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:active:scale-100"
            style={{
              width: '1.625rem',
              height: '1.625rem',
              background: isMinSize ? 'transparent' : 'rgba(200,144,10,0.1)',
              border: '1px solid',
              borderColor: isMinSize ? 'rgba(58,42,21,0.4)' : 'var(--gold-dim)',
              color: isMinSize ? 'rgba(58,42,21,0.4)' : 'var(--gold)',
              cursor: isMinSize ? 'default' : 'pointer',
            }}
            aria-label={t('decrease')}
          >
            <Minus aria-hidden="true" style={{ width: '0.6875rem', height: '0.6875rem' }} />
          </button>

          {/* Gold divider */}
          <span
            style={{
              width: '1px',
              height: '1rem',
              background: 'rgba(200,144,10,0.2)',
              flexShrink: 0,
            }}
          />

          {/* Font size label — click to collapse */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(false)
            }}
            className="text-center select-none cursor-pointer shrink-0 transition-[color,opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--gold)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] motion-reduce:transition-none motion-reduce:active:scale-100"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--gold-light)',
              fontSize: '0.75rem',
              letterSpacing: '0.04em',
              WebkitTapHighlightColor: 'transparent',
              minWidth: '1.875rem',
              display: 'inline-block',
              whiteSpace: 'nowrap',
              transform: labelPulse ? 'scale(1.08) translateY(-0.0625rem)' : 'scale(1) translateY(0)',
            }}
            aria-label={t('collapse')}
          >
            {t(fontSize)}
          </button>

          {/* Gold divider */}
          <span
            style={{
              width: '1px',
              height: '1rem',
              background: 'rgba(200,144,10,0.2)',
              flexShrink: 0,
            }}
          />

          {/* Plus button */}
          <button
            onClick={(e) => { e.stopPropagation(); changeFontSize(1) }}
            disabled={isMaxSize}
            className="flex items-center justify-center rounded-full shrink-0 transition-[border-color,color,background,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] enabled:hover:scale-110 enabled:hover:shadow-[0_0_0.5rem_rgba(200,144,10,0.4)] enabled:active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] motion-reduce:transition-none motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:active:scale-100"
            style={{
              width: '1.625rem',
              height: '1.625rem',
              background: isMaxSize ? 'transparent' : 'rgba(200,144,10,0.1)',
              border: '1px solid',
              borderColor: isMaxSize ? 'rgba(58,42,21,0.4)' : 'var(--gold-dim)',
              color: isMaxSize ? 'rgba(58,42,21,0.4)' : 'var(--gold)',
              cursor: isMaxSize ? 'default' : 'pointer',
            }}
            aria-label={t('increase')}
          >
            <Plus aria-hidden="true" style={{ width: '0.6875rem', height: '0.6875rem' }} />
          </button>
        </div>
      )}
    </div>
  )
}
