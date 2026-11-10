'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { isAprilFools } from '../lib/april-fools'
import { BsodScreen } from './AprilFoolsBsod'
import { BootScreen } from './AprilFoolsBoot'

// ── Helpers ──────────────────────────────────────────────
function hasCookie(name: string) {
  return typeof document !== 'undefined' && document.cookie.includes(`${name}=1`)
}

// ── Constants ────────────────────────────────────────────
type Phase = 'idle' | 'bsod' | 'boot' | 'active'

const DISMISS_MSGS = [
  '카론이 허락하지 않았습니다. 🚫',
  '...정말 돌아가고 싶어요? 😢',
  '카론, 슬퍼. 울 것 같아.',
  '메피한테 이를 거야!!!',
]

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
