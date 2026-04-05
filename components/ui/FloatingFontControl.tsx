'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'

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

export default function FloatingFontControl() {
  const pathname = usePathname()
  const allowed = isAllowedPage(pathname)
  const [fontSize, setFontSize] = useState<FontSize>('default')
  // Controls whether the panel is visible at all (entrance delay)
  const [mounted, setMounted] = useState(false)
  // Controls whether the expanded controls are shown
  const [expanded, setExpanded] = useState(false)
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
      return () => { if (saved) document.documentElement.dataset.fontSize = saved }
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
      return next
    })
  }, [])

  if (!allowed) return null

  const sharedStyle: React.CSSProperties = {
    background: 'rgba(26,21,16,0.95)',
    border: '1px solid var(--border-gold)',
    boxShadow: '0 0.25rem 1.5rem rgba(0,0,0,0.6), 0 0 1rem rgba(200,144,10,0.15)',
    backdropFilter: 'blur(0.75rem)',
  }

  return (
    // Outer wrapper: entrance slide-up from below
    <AnimatePresence>
      {mounted && (
        <motion.div
          ref={wrapRef}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.175, 0.885, 0.32, 1.4] }}
          className="fixed bottom-5 left-4 z-[45] flex items-center justify-center rounded-full overflow-hidden"
          style={sharedStyle}
        >
          <AnimatePresence mode="wait" initial={false}>
            {!expanded ? (
              // Collapsed: show Aa circle button
              <motion.div
                key="circle"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.2, ease: [0.175, 0.885, 0.32, 1.4] }}
                onClick={() => setExpanded(true)}
                className="flex items-center justify-center cursor-pointer w-[2.25rem] h-[2.25rem] lg:w-[3rem] lg:h-[3rem]"
                style={{ color: 'var(--gold)' }}
              >
                <span className="text-[0.75rem] lg:text-[1rem]" style={{ fontFamily: 'var(--font-heading)' }}>Aa</span>
              </motion.div>
            ) : (
              // Expanded: show controls
              <motion.div
                key="controls"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.25, ease: [0.175, 0.885, 0.32, 1.2] }}
                className="flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2"
                style={{ whiteSpace: 'nowrap' }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); changeFontSize(-1) }}
                  disabled={fontSize === 'small'}
                  className="w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{
                    background: fontSize === 'small' ? 'transparent' : 'rgba(200,144,10,0.1)',
                    border: '1px solid',
                    borderColor: fontSize === 'small' ? 'rgba(58,42,21,0.3)' : 'var(--gold-dim)',
                    color: fontSize === 'small' ? '#3a2a15' : 'var(--gold)',
                    cursor: fontSize === 'small' ? 'default' : 'pointer',
                  }}
                  aria-label="글자 크기 줄이기"
                >
                  <Minus className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                </button>

                <span
                  onClick={() => setExpanded(false)}
                  className="text-[0.6875rem] lg:text-[0.8125rem] min-w-[1.75rem] lg:min-w-[2rem] text-center select-none cursor-pointer"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--gold-light)',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  aria-label="접기"
                >
                  {LABELS[fontSize]}
                </span>

                <button
                  onClick={(e) => { e.stopPropagation(); changeFontSize(1) }}
                  disabled={fontSize === 'large'}
                  className="w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{
                    background: fontSize === 'large' ? 'transparent' : 'rgba(200,144,10,0.1)',
                    border: '1px solid',
                    borderColor: fontSize === 'large' ? 'rgba(58,42,21,0.3)' : 'var(--gold-dim)',
                    color: fontSize === 'large' ? '#3a2a15' : 'var(--gold)',
                    cursor: fontSize === 'large' ? 'default' : 'pointer',
                  }}
                  aria-label="글자 크기 키우기"
                >
                  <Plus className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
