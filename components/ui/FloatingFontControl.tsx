'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'
import { springTransition } from '@/lib/animations'

const FONT_SIZES = ['small', 'default', 'large'] as const
type FontSize = (typeof FONT_SIZES)[number]
const LABELS: Record<FontSize, string> = { small: '작게', default: '보통', large: '크게' }

function isAllowedPage(path: string): boolean {
  return (
    /^\/sinners\/[^/]+\/(identities|ego)\//.test(path) ||
    /^\/decks\/.+/.test(path) ||
    path === '/collection' ||
    path === '/mirror-dungeon' ||
    path === '/keywords'
  )
}

// Layout spring — snappy morph between collapsed/expanded
const layoutSpring = { type: 'spring', stiffness: 500, damping: 35 } as const

export default function FloatingFontControl() {
  const pathname = usePathname()
  const allowed = isAllowedPage(pathname)
  const [fontSize, setFontSize] = useState<FontSize>('default')
  // Controls whether the panel is visible at all (entrance delay)
  const [mounted, setMounted] = useState(false)
  // Controls whether the expanded controls are shown
  const [expanded, setExpanded] = useState(false)
  // Tracks font size change for label pulse animation
  const [labelKey, setLabelKey] = useState(0)
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
      setExpanded(false)
      return
    }
    setMounted(false)
    setExpanded(false)
    // Delay entrance by 0.8s (matches original GSAP delay)
    const entranceTimer = setTimeout(() => {
      setMounted(true)
      // Auto-expand on desktop after entrance animation completes (0.5s + 0.3s gap)
      if (window.innerWidth >= 1024) {
        const expandTimer = setTimeout(() => setExpanded(true), 800)
        return () => clearTimeout(expandTimer)
      }
    }, 800)
    return () => clearTimeout(entranceTimer)
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
      setLabelKey(k => k + 1)
      return next
    })
  }, [])

  if (!allowed) return null

  const isMinSize = fontSize === 'small'
  const isMaxSize = fontSize === 'large'

  return (
    <AnimatePresence>
      {mounted && (
        <motion.div
          ref={wrapRef}
          // layout: container auto-morphs between collapsed/expanded sizes
          layout
          // Entrance: slide up + spring bounce + slight tilt
          initial={{ y: '4rem', opacity: 0, scale: 0.88, rotate: -4 }}
          animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
          exit={{ scale: 0.82, opacity: 0, y: '1.5rem' }}
          transition={{
            layout: layoutSpring,
            y: { type: 'spring', stiffness: 200, damping: 22 },
            opacity: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
            scale: { type: 'spring', stiffness: 280, damping: 22 },
            rotate: { type: 'spring', stiffness: 180, damping: 20 },
          }}
          onClick={() => { if (!expanded) setExpanded(true) }}
          className="fixed bottom-5 left-4 z-[45] flex items-center rounded-full"
          style={{
            padding: expanded ? '0.375rem 0.625rem' : '0.375rem',
            gap: '0.5rem',
            background: 'rgba(20, 16, 12, 0.92)',
            border: '1px solid rgba(200, 144, 10, 0.25)',
            backdropFilter: 'blur(1rem)',
            WebkitBackdropFilter: 'blur(1rem)',
            boxShadow: expanded
              ? '0 0.25rem 1.5rem rgba(0,0,0,0.55), 0 0 1rem rgba(200,144,10,0.18)'
              : '0 0.25rem 1.5rem rgba(0,0,0,0.5), 0 0 0.5rem rgba(200,144,10,0.08)',
            cursor: expanded ? 'default' : 'pointer',
            WebkitTapHighlightColor: 'transparent',
            // Isolate stacking context for hover z-index
            position: 'fixed',
          }}
          whileHover={expanded ? {} : {
            scale: 1.08,
            boxShadow: '0 0.25rem 1.5rem rgba(0,0,0,0.6), 0 0 0.875rem rgba(200,144,10,0.28)',
          }}
          whileTap={expanded ? {} : { scale: 0.95 }}
          aria-label={expanded ? undefined : '글자 크기 조절 열기'}
        >
          {/* ── Collapsed state: "Aa" pill ── */}
          <AnimatePresence mode="wait" initial={false}>
            {!expanded ? (
              <motion.span
                key="collapsed"
                layout="position"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="flex items-center justify-center select-none"
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
              </motion.span>
            ) : (
              /* ── Expanded state: [−] [label] [+] ── */
              <motion.div
                key="expanded"
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="flex items-center"
                style={{ gap: '0.5rem' }}
              >
                {/* Minus button */}
                <motion.button
                  whileHover={isMinSize ? {} : {
                    scale: 1.15,
                    boxShadow: '0 0 0.5rem rgba(200,144,10,0.4)',
                  }}
                  whileTap={isMinSize ? {} : { scale: 0.88 }}
                  onClick={(e) => { e.stopPropagation(); changeFontSize(-1) }}
                  disabled={isMinSize}
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: '1.625rem',
                    height: '1.625rem',
                    background: isMinSize ? 'transparent' : 'rgba(200,144,10,0.1)',
                    border: '1px solid',
                    borderColor: isMinSize ? 'rgba(58,42,21,0.4)' : 'var(--gold-dim)',
                    color: isMinSize ? 'rgba(58,42,21,0.4)' : 'var(--gold)',
                    cursor: isMinSize ? 'default' : 'pointer',
                    transition: 'border-color 0.2s, color 0.2s, background 0.2s',
                  }}
                  aria-label="글자 크기 줄이기"
                >
                  <Minus style={{ width: '0.6875rem', height: '0.6875rem' }} />
                </motion.button>

                {/* Gold divider */}
                <span
                  style={{
                    width: '1px',
                    height: '1rem',
                    background: 'rgba(200,144,10,0.2)',
                    flexShrink: 0,
                  }}
                />

                {/* Font size label — AnimatePresence for swap pulse on change */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={labelKey}
                    initial={{ opacity: 0, scale: 0.72, y: '0.25rem' }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.72, y: '-0.25rem' }}
                    transition={{ ...springTransition, stiffness: 320, damping: 22 }}
                    onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
                    className="text-center select-none cursor-pointer shrink-0"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      color: 'var(--gold-light)',
                      fontSize: '0.75rem',
                      letterSpacing: '0.04em',
                      WebkitTapHighlightColor: 'transparent',
                      minWidth: '1.875rem',
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                    }}
                    aria-label="접기"
                  >
                    {LABELS[fontSize]}
                  </motion.span>
                </AnimatePresence>

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
                <motion.button
                  whileHover={isMaxSize ? {} : {
                    scale: 1.15,
                    boxShadow: '0 0 0.5rem rgba(200,144,10,0.4)',
                  }}
                  whileTap={isMaxSize ? {} : { scale: 0.88 }}
                  onClick={(e) => { e.stopPropagation(); changeFontSize(1) }}
                  disabled={isMaxSize}
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: '1.625rem',
                    height: '1.625rem',
                    background: isMaxSize ? 'transparent' : 'rgba(200,144,10,0.1)',
                    border: '1px solid',
                    borderColor: isMaxSize ? 'rgba(58,42,21,0.4)' : 'var(--gold-dim)',
                    color: isMaxSize ? 'rgba(58,42,21,0.4)' : 'var(--gold)',
                    cursor: isMaxSize ? 'default' : 'pointer',
                    transition: 'border-color 0.2s, color 0.2s, background 0.2s',
                  }}
                  aria-label="글자 크기 키우기"
                >
                  <Plus style={{ width: '0.6875rem', height: '0.6875rem' }} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
