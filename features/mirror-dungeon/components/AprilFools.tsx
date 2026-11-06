'use client'

import { useEffect, useState, useRef } from 'react'
import { AnimatePresence, useAnimate } from 'motion/react'
import * as m from 'motion/react-m'
import { X } from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────
function setCookie(name: string, days: number) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=1;expires=${d.toUTCString()};path=/;SameSite=Lax`
}
function hasCookie(name: string) {
  return typeof document !== 'undefined' && document.cookie.includes(`${name}=1`)
}

function isAprilFools(): boolean {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('af') === '1') return true
  const now = new Date()
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return koreaTime.getMonth() === 3 && koreaTime.getDate() === 1
}

// ── Constants ────────────────────────────────────────────
type Phase = 'idle' | 'bsod' | 'boot' | 'active'

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

const BOOT_MESSAGES = [
  '수감자 데이터 로딩...',
  '거울 던전 초기화...',
  'EGO 시스템 점검...',
  '엔케팔린 수치 정상화...',
  '카론 인증 완료',
  '시스템 준비 완료!',
]

const DISMISS_MSGS = [
  '카론이 허락하지 않았습니다. 🚫',
  '...정말 돌아가고 싶어요? 😢',
  '카론, 슬퍼. 울 것 같아.',
  '메피한테 이를 거야!!!',
]

// ── BSOD Screen ──────────────────────────────────────────
function BsodScreen({ onAdvance }: { onAdvance: () => void }) {
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
            const isLastVisible = i === BSOD_LINES.length - 1
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

// ── Boot Screen ───────────────────────────────────────────
function BootScreen({ onComplete }: { onComplete: () => void }) {
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

// ── Component ────────────────────────────────────────────
export default function AprilFools() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [dismissed, setDismissed] = useState(false)
  const [dismissCount, setDismissCount] = useState(0)
  const [dismissMsg, setDismissMsg] = useState('')

  // ── Phase init ──
  useEffect(() => {
    if (!isAprilFools()) return
    const isPreview = new URLSearchParams(window.location.search).get('af') === '1'
    if (!isPreview && sessionStorage.getItem('april-fools-dismissed')) return
    setPhase(!isPreview && hasCookie('af-bsod') ? 'active' : 'bsod')
  }, [])

  // ── Active phase: apply Win98 class ──
  useEffect(() => {
    if (phase !== 'active') return
    document.documentElement.classList.add('april-fools')
    return () => { document.documentElement.classList.remove('april-fools') }
  }, [phase])

  // ── Dismiss handler ──
  const handleDismiss = () => {
    if (dismissCount < DISMISS_MSGS.length) {
      setDismissMsg(DISMISS_MSGS[dismissCount])
      setDismissCount(prev => prev + 1)
      setTimeout(() => setDismissMsg(''), 2500)
    } else {
      setDismissed(true)
      document.documentElement.classList.remove('april-fools')
      sessionStorage.setItem('april-fools-dismissed', '1')
    }
  }

  if (phase === 'idle' || dismissed) return null

  return (
    <>
      {/* ════════ BSOD Screen ════════ */}
      {phase === 'bsod' && (
        <BsodScreen onAdvance={() => setPhase('boot')} />
      )}

      {/* ════════ Boot Screen ════════ */}
      {phase === 'boot' && (
        <BootScreen onComplete={() => setPhase('active')} />
      )}

      {/* ════════ Active: Win98 Theme ════════ */}
      {phase === 'active' && (
        <>
          <style>{`
            /* ── 만우절 그림판 모드 ── */
            .april-fools {
              --af-bg: #c0c0c0;
              cursor: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='8' cy='8' r='6' fill='red' stroke='black' stroke-width='1'/></svg>") 8 8, auto;
            }

            /* 이미지 → 픽셀아트 */
            .april-fools img:not(.af-exclude) {
              image-rendering: pixelated !important;
              filter: contrast(1.3) saturate(1.6) brightness(1.05) !important;
              border-radius: 0 !important;
            }

            /* 카드 → 그림판 스타일 */
            .april-fools .game-card,
            .april-fools .gift-frame,
            .april-fools .kw-card {
              border: 0.1875rem solid #000 !important;
              border-radius: 0 !important;
              box-shadow: 0.25rem 0.25rem 0 #808080 !important;
              background: #c0c0c0 !important;
            }

            /* Comic Sans + 궁서 */
            .april-fools h1, .april-fools h2, .april-fools h3,
            .april-fools p, .april-fools span, .april-fools button,
            .april-fools a, .april-fools code, .april-fools label {
              font-family: 'Comic Sans MS', '궁서', 'Gungsuh', cursive !important;
            }

            /* 제목 → 무지개 */
            .april-fools h1 {
              background: linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet) !important;
              -webkit-background-clip: text !important;
              -webkit-text-fill-color: transparent !important;
              background-clip: text !important;
            }

            /* 배경 → 틸(teal) */
            .april-fools body {
              background: #008080 !important;
            }

            /* 네비게이션 → 윈도우 타이틀바 */
            .april-fools nav {
              background: linear-gradient(90deg, #000080, #1084d0) !important;
              border-bottom: 0.1875rem solid #000 !important;
              box-shadow: inset 0 0.0625rem 0 #fff !important;
            }
            .april-fools nav a, .april-fools nav button, .april-fools nav span {
              color: #fff !important;
              text-shadow: 0.0625rem 0.0625rem 0 #000 !important;
            }

            /* 버튼 → Win98 */
            .april-fools button:not(.af-dismiss) {
              border: 0.125rem outset #ddd !important;
              border-radius: 0 !important;
              background: #c0c0c0 !important;
              color: #000 !important;
              text-shadow: none !important;
              font-weight: bold !important;
            }
            .april-fools button:not(.af-dismiss):active {
              border-style: inset !important;
            }

            /* 입력 필드 → Win98 */
            .april-fools input, .april-fools textarea {
              border: 0.125rem inset #888 !important;
              border-radius: 0 !important;
              background: #fff !important;
              color: #000 !important;
              font-family: 'Comic Sans MS', '궁서', cursive !important;
            }

            /* 푸터 → 작업 표시줄 */
            .april-fools footer {
              background: #c0c0c0 !important;
              border-top: 0.125rem outset #fff !important;
            }
            .april-fools footer * {
              color: #000 !important;
            }

            /* 카드 흔들림 */
            @keyframes af-wobble {
              0%, 100% { transform: rotate(-1deg); }
              50% { transform: rotate(1deg); }
            }
            .april-fools .gift-card,
            .april-fools .kw-card {
              animation: af-wobble 3s ease-in-out infinite !important;
            }
            .april-fools .gift-card:nth-child(even),
            .april-fools .kw-card:nth-child(even) {
              animation-delay: 1.5s !important;
            }

            /* 만우절 배너 */
            .af-banner {
              position: fixed;
              top: 3.5rem;
              left: 0; right: 0;
              z-index: 30;
              background: #ffff00;
              border-top: 0.1875rem solid #000;
              border-bottom: 0.1875rem solid #000;
              padding: 0.5rem 1rem;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.75rem;
              font-family: 'Comic Sans MS', '궁서', cursive;
              color: #000;
              font-size: 0.875rem;
              font-weight: bold;
            }
            .af-banner .af-marquee {
              overflow: hidden;
              flex: 1;
            }
            .af-banner .af-marquee span {
              display: inline-block;
              animation: af-scroll 15s linear infinite;
              white-space: nowrap;
            }
            @keyframes af-scroll {
              0% { transform: translateX(100%); }
              100% { transform: translateX(-100%); }
            }
          `}</style>

          {/* 배너 */}
          <div className="af-banner">
            <span style={{ fontSize: '1.25rem' }}>🎨</span>
            <div className="af-marquee">
              <span>
                ⚠️ [긴급 공지] 사이트 디자인이 Microsoft Paint™ 에디션으로 업그레이드되었습니다!
                이제 모든 일러스트가 그림판으로 제작됩니다. 이것은 버그가 아닙니다.
                기능입니다. 카론이 승인했습니다. 🖌️
              </span>
            </div>
            <button
              className="af-dismiss"
              onClick={handleDismiss}
              style={{
                background: '#c0c0c0',
                border: '0.125rem outset #ddd',
                padding: '0.125rem 0.5rem',
                cursor: 'pointer',
                fontFamily: "'Comic Sans MS', cursive",
                fontWeight: 'bold',
                fontSize: '0.75rem',
              }}
            >
              <X size={14} />
            </button>
            {dismissMsg && (
              <span style={{
                position: 'absolute', right: '1rem', top: '100%', marginTop: '0.25rem',
                background: '#fff', color: '#000', padding: '0.375rem 0.75rem',
                border: '0.125rem solid #000', fontSize: '0.75rem', whiteSpace: 'nowrap',
                fontFamily: "'Comic Sans MS', '궁서', cursive",
                animation: 'af-wobble 0.3s ease-in-out',
              }}>
                {dismissMsg}
              </span>
            )}
          </div>
        </>
      )}
    </>
  )
}
