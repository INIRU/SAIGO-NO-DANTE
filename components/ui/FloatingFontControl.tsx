'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
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
  const wrapRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const circleRef = useRef<HTMLDivElement>(null)
  const gsapRef = useRef<typeof import('gsap')['gsap'] | null>(null)
  const isCollapsed = useRef(true)

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

  // GSAP 로드 + 입장 애니메이션
  useEffect(() => {
    if (!allowed) return
    isCollapsed.current = true
    let cancelled = false
    ;(async () => {
      const { gsap } = await import('gsap')
      if (cancelled) return
      gsapRef.current = gsap

      const wrap = wrapRef.current
      const controls = controlsRef.current
      const circle = circleRef.current
      if (!wrap || !controls || !circle) return

      // 접힌 원 크기 = CSS에서 결정 (lg: 2.75rem, else 2.25rem)
      const circleEl = circle.getBoundingClientRect()
      const cSize = circleEl.width || 36
      gsap.set(wrap, { width: cSize, height: cSize, y: 80, opacity: 0, visibility: 'visible', overflow: 'hidden' })
      gsap.set(controls, { opacity: 0, scale: 0.8, pointerEvents: 'none' })
      gsap.set(circle, { opacity: 1, scale: 1, pointerEvents: 'auto' })

      const tl = gsap.timeline({ delay: 0.8 })
      tl.to(wrap, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' })

      // lg 이상(데스크탑)이면 자동 펼침
      if (window.innerWidth >= 1024) {
        tl.to(circle, { opacity: 0, scale: 0, pointerEvents: 'none', duration: 0.15, ease: 'power2.in' }, '+=0.3')
        tl.to(wrap, { width: 'auto', height: 'auto', duration: 0.3, ease: 'power2.out' }, '-=0.05')
        tl.to(controls, { opacity: 1, scale: 1, pointerEvents: 'auto', duration: 0.25, ease: 'back.out(1.2)' }, '-=0.1')
        tl.add(() => { isCollapsed.current = false })
      }
    })()
    return () => { cancelled = true }
  }, [allowed])

  // 접기
  const collapse = useCallback(() => {
    const gsap = gsapRef.current
    if (!gsap || isCollapsed.current) return
    isCollapsed.current = true

    const wrap = wrapRef.current
    const controls = controlsRef.current
    const circle = circleRef.current
    if (!wrap || !controls || !circle) return

    const cSize = circle.offsetWidth || 36
    const tl = gsap.timeline({
      onComplete: () => {
        // GSAP inline width/height 제거 → Tailwind 반응형 복귀
        gsap.set(wrap, { clearProps: 'width,height' })
      }
    })
    tl.to(controls, { opacity: 0, scale: 0.8, pointerEvents: 'none', duration: 0.2, ease: 'power2.in' })
    tl.to(wrap, { width: cSize, height: cSize, overflow: 'hidden', duration: 0.3, ease: 'power2.inOut' }, '-=0.05')
    tl.to(circle, { opacity: 1, scale: 1, pointerEvents: 'auto', duration: 0.25, ease: 'back.out(1.4)' }, '-=0.1')
  }, [])

  // 펼치기
  const expand = useCallback(() => {
    const gsap = gsapRef.current
    if (!gsap || !isCollapsed.current) return
    isCollapsed.current = false

    const wrap = wrapRef.current
    const controls = controlsRef.current
    const circle = circleRef.current
    if (!wrap || !controls || !circle) return

    const tl = gsap.timeline()
    tl.to(circle, { opacity: 0, scale: 0, pointerEvents: 'none', duration: 0.15, ease: 'power2.in' })
    tl.to(wrap, { width: 'auto', height: 'auto', overflow: 'hidden', duration: 0.3, ease: 'power2.out' }, '-=0.05')
    tl.to(controls, { opacity: 1, scale: 1, pointerEvents: 'auto', duration: 0.25, ease: 'back.out(1.2)' }, '-=0.1')
  }, [])

  // 외부 클릭/터치 닫기
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (!isCollapsed.current && wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        collapse()
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [collapse])

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

  return (
    <div
      ref={wrapRef}
      className="fixed bottom-5 left-4 z-[45] flex items-center justify-center rounded-full invisible
        w-[2.25rem] h-[2.25rem] lg:w-[3rem] lg:h-[3rem] overflow-hidden"
      style={{
        background: 'rgba(26,21,16,0.95)',
        border: '1px solid var(--border-gold)',
        boxShadow: '0 0.25rem 1.5rem rgba(0,0,0,0.6), 0 0 1rem rgba(200,144,10,0.15)',
        backdropFilter: 'blur(0.75rem)',
        whiteSpace: 'nowrap',
      }}
    >
      {/* 접힌 상태: Aa 아이콘 */}
      <div
        ref={circleRef}
        onClick={expand}
        className="absolute flex items-center justify-center cursor-pointer
          w-[2.25rem] h-[2.25rem] lg:w-[3rem] lg:h-[3rem]"
        style={{ color: 'var(--gold)' }}
      >
        <span className="text-[0.75rem] lg:text-[1rem]" style={{ fontFamily: 'var(--font-heading)' }}>Aa</span>
      </div>

      {/* 펼쳐진 상태: 컨트롤 */}
      <div
        ref={controlsRef}
        className="flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2"
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
          onClick={collapse}
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
      </div>
    </div>
  )
}
