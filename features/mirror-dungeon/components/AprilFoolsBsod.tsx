'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, useAnimate } from 'motion/react'
import * as m from 'motion/react-m'

const BSOD_LINES = [
  { text: 'LIMBUS_COMPANY_OS  v6.26', cls: 'header' as const },
  { text: '' },
  { text: '치명적 오류가 발생했습니다.' },
  { text: '' },
  { text: '*** STOP: 0x00000C07 (CANTO_VII_FATAL_EXCEPTION)', cls: 'error' as const },
  { text: '*** SAIGO_NO_DANTE.exe — Address 0xDEAD1337', cls: 'error' as const },
  { text: '' },
  { text: 'ENKEPHALIN_OVERFLOW: 엔케팔린 수치가 허용 범위를 초과했습니다.' },
  { text: '거울 던전 시뮬레이터가 응답하지 않습니다.' },
  { text: '수감자 12명의 정신 오염도가 임계치를 넘었습니다.' },
  { text: '' },
  { text: '카론이 시스템을 재시작합니다...' },
  { text: '' },
  { text: '아무 곳이나 클릭하면 재시작합니다...', cls: 'prompt' as const },
]

// ── BSOD Screen ──────────────────────────────────────────
export function BsodScreen({ onAdvance }: { onAdvance: () => void }) {
  const [scope, animate] = useAnimate()
  const [showLines, setShowLines] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'

    // CRT power-on then reveal lines
    const run = async () => {
      // CRT power-on: thin line expands
      await animate(scope.current, {
        opacity: [0, 1],
        scaleY: [0.008, 1],
        filter: ['brightness(3)', 'brightness(1)'],
      }, { duration: 0.4, ease: 'easeOut' })

      setShowLines(true)

      // Random glitch flickers (scheduled independently)
      const glitchTimes = [2.2, 3.8, 4.5]
      for (const t of glitchTimes) {
        setTimeout(async () => {
          if (!scope.current) return
          await animate(scope.current, { opacity: 0.6 }, { duration: 0.04 })
          await animate(scope.current, { opacity: 1 }, { duration: 0.04 })
        }, t * 1000)
      }
    }

    run()

    // Auto-advance after 6s
    const autoTimer = setTimeout(() => onAdvance(), 6000)

    return () => {
      clearTimeout(autoTimer)
      document.body.style.overflow = ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: '#000' }} />
      <div
        ref={scope}
        onClick={onAdvance}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#000080', color: '#fff',
          fontFamily: "var(--font-mono), 'Courier New', monospace",
          padding: '3rem 2rem',
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          fontSize: '0.875rem', lineHeight: 1.8,
          overflow: 'hidden', transformOrigin: 'center center',
          opacity: 0,
        }}
      >
        {/* Scanlines */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, transparent, transparent 0.125rem, rgba(0,0,0,0.12) 0.125rem, rgba(0,0,0,0.12) 0.25rem)',
        }} />
        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)',
        }} />

        <div style={{ maxWidth: '50rem', margin: '0 auto', position: 'relative', width: '100%' }}>
          {BSOD_LINES.map((line, i) => {
            const isPrompt = line.cls === 'prompt'
            return (
              <AnimatePresence key={i}>
                {showLines && (
                  <m.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={
                      isPrompt
                        // Blinking cursor effect after it appears
                        ? { opacity: [0, 1], x: [- 6, 0] }
                        : { opacity: 1, x: 0 }
                    }
                    transition={{
                      duration: isPrompt ? 0.12 : 0.12,
                      delay: 0.5 + i * 0.2,
                      ease: 'easeOut',
                    }}
                    style={{
                      whiteSpace: 'pre-wrap',
                      minHeight: line.text ? undefined : '1.2rem',
                      ...(line.cls === 'header' ? { fontSize: '1.125rem', fontWeight: 'bold', letterSpacing: '0.1em' } : {}),
                      ...(line.cls === 'error' ? { color: '#ffff66' } : {}),
                      ...(line.cls === 'prompt' ? { color: '#aaaaaa', marginTop: '0.5rem' } : {}),
                    }}
                  >
                    {/* Blinking cursor on last line */}
                    {isPrompt ? (
                      <BlinkingText text={line.text} delay={0.5 + i * 0.2 + 0.5} />
                    ) : (
                      line.text
                    )}
                  </m.div>
                )}
              </AnimatePresence>
            )
          })}
        </div>
      </div>
    </>
  )
}

// Blinking text component for the prompt line
function BlinkingText({ text, delay }: { text: string; delay: number }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const start = setTimeout(() => {
      const interval = setInterval(() => setVisible(v => !v), 500)
      return () => clearInterval(interval)
    }, delay * 1000)
    return () => clearTimeout(start)
  }, [delay])

  return <span style={{ opacity: visible ? 1 : 0.3 }}>{text}</span>
}
