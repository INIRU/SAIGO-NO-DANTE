'use client'

import { useEffect, useState, useRef } from 'react'
import { useAnimate } from 'motion/react'

function setCookie(name: string, days: number) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=1;expires=${d.toUTCString()};path=/;SameSite=Lax`
}

const BOOT_MESSAGES = [
  '수감자 데이터 로딩...',
  '거울 던전 초기화...',
  'EGO 시스템 점검...',
  '엔케팔린 수치 정상화...',
  '카론 인증 완료',
  '시스템 준비 완료!',
]

// ── Boot Screen ───────────────────────────────────────────
export function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [scope, animate] = useAnimate()
  const progressRef = useRef<HTMLDivElement>(null)
  const [bootMsg, setBootMsg] = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'

    const run = async () => {
      if (!scope.current) return

      // CRT power-on
      await animate(scope.current, {
        opacity: [0, 1],
        scaleY: [0.005, 1],
        filter: ['brightness(4)', 'brightness(1)'],
      }, { duration: 0.45, ease: 'easeOut' })

      // Boot flicker 1
      setTimeout(async () => {
        if (!scope.current) return
        await animate(scope.current, { opacity: 0.6 }, { duration: 0.04 })
        await animate(scope.current, { opacity: 1 }, { duration: 0.04 })
      }, 1400)

      // Boot flicker 2
      setTimeout(async () => {
        if (!scope.current) return
        await animate(scope.current, { opacity: 0.7 }, { duration: 0.03 })
        await animate(scope.current, { opacity: 1 }, { duration: 0.03 })
      }, 2300)

      // Progress bar fill over 2.8s (starts after 0.6s delay from CRT on)
      await new Promise<void>(resolve => {
        let startTime: number | null = null
        const duration = 2800
        const delay = 600

        const tick = (now: number) => {
          if (startTime === null) startTime = now
          const elapsed = now - startTime - delay
          if (elapsed < 0) {
            requestAnimationFrame(tick)
            return
          }
          // power1.inOut approximation
          const t = Math.min(elapsed / duration, 1)
          const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
          const pct = eased * 100

          if (progressRef.current) {
            progressRef.current.style.width = `${pct}%`
          }
          const idx = Math.min(
            Math.floor((pct / 100) * BOOT_MESSAGES.length),
            BOOT_MESSAGES.length - 1,
          )
          setBootMsg(BOOT_MESSAGES[idx])

          if (t < 1) {
            requestAnimationFrame(tick)
          } else {
            resolve()
          }
        }
        requestAnimationFrame(tick)
      })

      // CRT off: collapse + fade
      await animate(scope.current, {
        scaleY: 0.005,
        filter: 'brightness(3)',
      }, { duration: 0.25, delay: 0.4, ease: 'easeIn' })

      await animate(scope.current, { opacity: 0 }, { duration: 0.15 })

      setCookie('af-bsod', 2)
      onComplete()
    }

    run()

    return () => {
      document.body.style.overflow = ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: '#000' }} />
      <div
        ref={scope}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#000', color: '#c0c0c0',
          fontFamily: "var(--font-mono), 'Courier New', monospace",
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '1.5rem', fontSize: '0.875rem',
          transformOrigin: 'center center',
          opacity: 0,
        }}
      >
        {/* Scanlines */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, transparent, transparent 0.125rem, rgba(0,0,0,0.2) 0.125rem, rgba(0,0,0,0.2) 0.25rem)',
        }} />

        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', letterSpacing: '0.15em', color: '#fff', position: 'relative' }}>
          LIMBUS_COMPANY_OS
        </div>
        <div style={{ color: '#808080', fontSize: '0.75rem' }}>
          v6.26 — 최애의 관리자 에디션
        </div>

        {/* Progress bar */}
        <div style={{
          width: '20rem', maxWidth: '80vw', height: '1.25rem',
          border: '0.125rem solid #808080', background: '#1a1a1a',
        }}>
          <div ref={progressRef} style={{
            height: '100%', width: '0%',
            background: 'linear-gradient(90deg, #000080, #1084d0)',
          }} />
        </div>

        <div style={{ color: '#808080', fontSize: '0.75rem', height: '1rem' }}>
          {bootMsg}
        </div>
      </div>
    </>
  )
}
