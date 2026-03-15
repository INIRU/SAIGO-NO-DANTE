'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Minus, Plus } from 'lucide-react'

const FONT_SIZES = ['small', 'default', 'large'] as const
type FontSize = (typeof FONT_SIZES)[number]
const LABELS: Record<FontSize, string> = { small: '작게', default: '보통', large: '크게' }

// 글자 크기 조정이 표시되는 페이지만 허용
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
  const [isMobile, setIsMobile] = useState(false)

  // 모바일 감지
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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

  // GSAP 로드 + 입장 애니메이션 (allowed 변경 시 재실행)
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

      const size = 48
      gsap.set(wrap, { width: size, height: size, y: 80, xPercent: -50, opacity: 0, visibility: 'visible' })
      gsap.set(controls, { opacity: 0, scale: 0.8, pointerEvents: 'none' })
      gsap.set(circle, { opacity: 1, scale: 1, pointerEvents: 'auto' })

      const tl = gsap.timeline({ delay: 0.8 })

      // Step 1: Aa 원이 아래에서 올라옴
      tl.to(wrap, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' })

      // Step 2: 잠깐 대기 후 중앙 기준으로 펼쳐짐
      tl.to(circle, { opacity: 0, scale: 0, pointerEvents: 'none', duration: 0.15, ease: 'power2.in' }, '+=0.3')
      tl.to(wrap, { width: 'auto', height: 'auto', xPercent: -50, duration: 0.3, ease: 'power2.out' }, '-=0.05')
      tl.to(controls, { opacity: 1, scale: 1, pointerEvents: 'auto', duration: 0.25, ease: 'back.out(1.2)' }, '-=0.1')
      tl.add(() => { isCollapsed.current = false })
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

    const size = 48
    const tl = gsap.timeline()
    tl.to(controls, { opacity: 0, scale: 0.8, pointerEvents: 'none', duration: 0.2, ease: 'power2.in' })
    tl.to(wrap, { width: size, height: size, xPercent: -50, duration: 0.3, ease: 'power2.inOut' }, '-=0.05')
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
    tl.to(wrap, { width: 'auto', height: 'auto', xPercent: -50, duration: 0.3, ease: 'power2.out' }, '-=0.05')
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

  // 모바일: 버튼 크기 증가, 하단 safe area 고려
  const btnSize = isMobile ? 40 : 32
  const iconSize = isMobile ? 18 : 14
  const circleSize = 48

  // 허용된 페이지에서만 표시
  if (!allowed) return null

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'fixed',
        bottom: isMobile ? 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' : '1.5rem',
        left: '50%',
        zIndex: 45,
        visibility: 'hidden',
        overflow: 'hidden',
        background: 'rgba(26,21,16,0.95)',
        border: '1px solid var(--border-gold)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6), 0 0 16px rgba(200,144,10,0.2)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '999px',
        whiteSpace: 'nowrap',
      }}
    >
      {/* 접힌 상태: Aa 아이콘 */}
      <div
        ref={circleRef}
        onClick={expand}
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--gold)',
          cursor: 'pointer',
          width: circleSize,
          height: circleSize,
        }}
      >
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: isMobile ? '1.0625rem' : '0.9375rem' }}>Aa</span>
      </div>

      {/* 펼쳐진 상태: 컨트롤 */}
      <div
        ref={controlsRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '0.8125rem' : '0.5625rem',
          padding: isMobile ? '0.5rem 1.0625rem' : '0.5rem 0.8125rem',
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); changeFontSize(-1) }}
          disabled={fontSize === 'small'}
          style={{
            width: btnSize, height: btnSize, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: fontSize === 'small' ? 'transparent' : 'rgba(200,144,10,0.1)',
            border: '1px solid',
            borderColor: fontSize === 'small' ? 'rgba(58,42,21,0.3)' : 'var(--gold-dim)',
            color: fontSize === 'small' ? '#3a2a15' : 'var(--gold)',
            cursor: fontSize === 'small' ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}
          aria-label="글자 크기 줄이기"
        >
          <Minus size={iconSize} />
        </button>

        <span
          onClick={collapse}
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: isMobile ? '0.9375rem' : '0.8125rem',
            color: 'var(--gold-light)',
            minWidth: isMobile ? '2.6875rem' : '2.125rem',
            textAlign: 'center',
            userSelect: 'none',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label="접기"
        >
          {LABELS[fontSize]}
        </span>

        <button
          onClick={(e) => { e.stopPropagation(); changeFontSize(1) }}
          disabled={fontSize === 'large'}
          style={{
            width: btnSize, height: btnSize, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: fontSize === 'large' ? 'transparent' : 'rgba(200,144,10,0.1)',
            border: '1px solid',
            borderColor: fontSize === 'large' ? 'rgba(58,42,21,0.3)' : 'var(--gold-dim)',
            color: fontSize === 'large' ? '#3a2a15' : 'var(--gold)',
            cursor: fontSize === 'large' ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}
          aria-label="글자 크기 키우기"
        >
          <Plus size={iconSize} />
        </button>
      </div>
    </div>
  )
}
