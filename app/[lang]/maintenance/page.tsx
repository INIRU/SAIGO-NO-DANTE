'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { Construction } from 'lucide-react'

const CHARON_LINES = [
  '카론, 기다리는 거 못해. 100초만 기다려 줄게.',
  '늦으면 메피랑 먼저 갈 거야.',
  '아야하는 승객들 있어. 울면 안 돼.',
  '승객들, 좌석에 앉아서 기다려. 카론이 째깍째깍 해줄게.',
  '알쏭달쏭해. 뭐가 나올지 모르겠어.',
  '카론, 빙글빙글.',
  '…멀미 봉투는 좌석 밑에 있어. 메피한테 토하지 마.',
  '그래서 카론이 안전벨트 잘 하라고 했잖아.',
]

function formatEndTime(iso: string) {
  const d = new Date(iso)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hour = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${month}월 ${day}일 ${hour}:${min}`
}

function MaintenanceContent() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const message = searchParams.get('message')
  const reason = searchParams.get('reason')
  const ends_at = searchParams.get('ends_at')

  const [line] = useState(() => CHARON_LINES[Math.floor(Math.random() * CHARON_LINES.length)])
  const [typed, setTyped] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Typewriter effect for Charon's quote
  useEffect(() => {
    if (!mounted) return
    let i = 0
    const interval = setInterval(() => {
      if (i <= line.length) {
        setTyped(line.slice(0, i))
        i++
      } else {
        clearInterval(interval)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [line, mounted])

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0d0b08', position: 'relative', overflow: 'hidden' }}>
      {/* CSS Animations */}
      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse-glow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes float-up {
          0% { transform: translateY(100vh) scale(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-10vh) scale(1); opacity: 0; }
        }
        @keyframes flicker { 0%, 95%, 100% { opacity: 1; } 96% { opacity: 0.4; } 97% { opacity: 0.9; } 98% { opacity: 0.3; } 99% { opacity: 0.8; } }
        @keyframes scan-line { 0% { top: -10%; } 100% { top: 110%; } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(1rem); } to { opacity: 1; transform: translateY(0); } }
        @keyframes border-glow {
          0%, 100% { border-color: rgba(200,144,10,0.15); box-shadow: 0 0 1.25rem rgba(200,144,10,0.05); }
          50% { border-color: rgba(200,144,10,0.35); box-shadow: 0 0 2.5rem rgba(200,144,10,0.12); }
        }
        @keyframes cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .particle {
          position: absolute;
          width: 0.125rem;
          height: 0.125rem;
          background: rgba(200,144,10,0.3);
          border-radius: 50%;
          animation: float-up linear infinite;
        }
      `}</style>

      {/* Scan line overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
        overflow: 'hidden', opacity: 0.03,
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '30%',
          background: 'linear-gradient(to bottom, transparent, rgba(200,144,10,0.5), transparent)',
          animation: 'scan-line 4s linear infinite',
        }} />
      </div>

      {/* Atmospheric particles */}
      {mounted && Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${6 + Math.random() * 8}s`,
            animationDelay: `${Math.random() * 8}s`,
            opacity: 0.1 + Math.random() * 0.3,
            width: `${0.0625 + Math.random() * 0.125}rem`,
            height: `${0.0625 + Math.random() * 0.125}rem`,
          }}
        />
      ))}

      {/* Background radial glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '50rem', height: '50rem', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,144,10,0.05) 0%, rgba(200,144,10,0.015) 35%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Outer ornamental ring */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '28rem', height: '28rem', borderRadius: '50%',
        border: '0.0625rem solid rgba(200,144,10,0.06)',
        animation: 'spin-slow 120s linear infinite',
        pointerEvents: 'none',
      }}>
        {/* Tick marks on the ring */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
          <div key={deg} style={{
            position: 'absolute', top: '50%', left: '50%',
            width: '0.0625rem', height: '0.75rem',
            background: 'rgba(200,144,10,0.15)',
            transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-14rem)`,
          }} />
        ))}
      </div>

      {/* Content */}
      <div className="text-center" style={{
        position: 'relative', zIndex: 5, maxWidth: '28rem',
        animation: mounted ? 'fade-in 1s ease-out' : 'none',
      }}>

        {/* Anchor icon with glow ring */}
        <div className="mx-auto" style={{
          width: '6rem', height: '6rem', marginBottom: '2rem',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '0.0625rem solid rgba(200,144,10,0.2)',
            animation: 'border-glow 3s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', inset: '0.375rem', borderRadius: '50%',
            background: 'rgba(200,144,10,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Construction style={{
              width: '2.25rem', height: '2.25rem', color: '#c8900a',
              animation: 'pulse-glow 3s ease-in-out infinite',
              filter: 'drop-shadow(0 0 0.5rem rgba(200,144,10,0.3))',
            }} />
          </div>
        </div>

        {/* Title */}
        <h1 className="font-serif" style={{
          fontSize: '1.75rem', fontWeight: 700,
          color: '#c8900a', letterSpacing: '0.15em',
          marginBottom: '0.25rem',
          animation: 'flicker 8s linear infinite',
          textShadow: '0 0 1.5rem rgba(200,144,10,0.3)',
        }}>
          점 검 중
        </h1>

        <p className="font-mono" style={{
          color: '#4a3d2a', fontSize: '0.625rem',
          letterSpacing: '0.3em', textTransform: 'uppercase',
          marginBottom: '1.5rem',
        }}>
          MAINTENANCE IN PROGRESS
        </p>

        {/* Ornamental divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '3rem', height: '0.0625rem', background: 'linear-gradient(90deg, transparent, rgba(200,144,10,0.3))' }} />
          <div style={{ width: '0.25rem', height: '0.25rem', background: '#c8900a', transform: 'rotate(45deg)', opacity: 0.5 }} />
          <div style={{ width: '3rem', height: '0.0625rem', background: 'linear-gradient(90deg, rgba(200,144,10,0.3), transparent)' }} />
        </div>

        {/* Charon quote box */}
        <div style={{
          background: 'rgba(26,21,16,0.8)',
          border: '0.0625rem solid rgba(200,144,10,0.12)',
          borderRadius: '0.5rem',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          backdropFilter: 'blur(0.5rem)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Corner ornaments */}
          <div style={{ position: 'absolute', top: '0.375rem', left: '0.375rem', width: '0.5rem', height: '0.5rem', borderTop: '0.0625rem solid rgba(200,144,10,0.25)', borderLeft: '0.0625rem solid rgba(200,144,10,0.25)' }} />
          <div style={{ position: 'absolute', top: '0.375rem', right: '0.375rem', width: '0.5rem', height: '0.5rem', borderTop: '0.0625rem solid rgba(200,144,10,0.25)', borderRight: '0.0625rem solid rgba(200,144,10,0.25)' }} />
          <div style={{ position: 'absolute', bottom: '0.375rem', left: '0.375rem', width: '0.5rem', height: '0.5rem', borderBottom: '0.0625rem solid rgba(200,144,10,0.25)', borderLeft: '0.0625rem solid rgba(200,144,10,0.25)' }} />
          <div style={{ position: 'absolute', bottom: '0.375rem', right: '0.375rem', width: '0.5rem', height: '0.5rem', borderBottom: '0.0625rem solid rgba(200,144,10,0.25)', borderRight: '0.0625rem solid rgba(200,144,10,0.25)' }} />

          <p style={{
            color: '#e8b030', fontSize: '0.6875rem', fontWeight: 600,
            letterSpacing: '0.08em', marginBottom: '0.5rem',
            fontFamily: 'var(--font-heading)',
          }}>
            — 카론
          </p>
          <p style={{
            color: '#a89070', fontSize: '0.9375rem', lineHeight: 1.8,
            fontStyle: 'italic', minHeight: '1.75rem',
          }}>
            &ldquo;{typed}&rdquo;
            <span style={{ animation: 'cursor-blink 1s step-end infinite', color: '#c8900a' }}>▎</span>
          </p>
        </div>

        {/* Maintenance info panel */}
        <div style={{
          background: 'rgba(13,11,8,0.6)',
          border: '0.0625rem solid rgba(200,144,10,0.08)',
          borderRadius: '0.375rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          textAlign: 'left',
        }}>
          {message && (
            <div style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '0.0625rem solid rgba(200,144,10,0.06)' }}>
              <p style={{ color: '#a89070', fontSize: '0.8125rem', lineHeight: 1.6 }}>{message}</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.375rem 1rem', fontSize: '0.75rem' }}>
            {reason && (
              <>
                <span className="font-mono" style={{ color: '#4a3d2a', letterSpacing: '0.05em' }}>사유</span>
                <span style={{ color: '#7a6845' }}>{reason}</span>
              </>
            )}
            <span className="font-mono" style={{ color: '#4a3d2a', letterSpacing: '0.05em' }}>종료</span>
            <span style={{ color: ends_at ? '#e8b030' : '#555566' }}>
              {ends_at ? formatEndTime(ends_at) : '미정'}
            </span>
            {from && (
              <>
                <span className="font-mono" style={{ color: '#4a3d2a', letterSpacing: '0.05em' }}>경로</span>
                <code style={{ color: '#888888', fontSize: '0.6875rem' }}>{from}</code>
              </>
            )}
          </div>
        </div>

        {/* Return button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 transition-all"
          style={{
            padding: '0.625rem 1.5rem',
            background: 'rgba(200,144,10,0.08)',
            color: '#c8900a',
            border: '0.0625rem solid rgba(200,144,10,0.2)',
            borderRadius: '0.375rem',
            fontSize: '0.8125rem',
            letterSpacing: '0.03em',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(200,144,10,0.15)'
            e.currentTarget.style.borderColor = 'rgba(200,144,10,0.4)'
            e.currentTarget.style.boxShadow = '0 0 1.5rem rgba(200,144,10,0.1)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(200,144,10,0.08)'
            e.currentTarget.style.borderColor = 'rgba(200,144,10,0.2)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          카론이 데려다줄게. 돌아가자.
        </Link>
      </div>
    </div>
  )
}

export default function MaintenancePage() {
  return (
    <div>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0b08' }}>
          <Construction style={{ width: '2rem', height: '2rem', color: '#c8900a', opacity: 0.3 }} />
        </div>
      }>
        <MaintenanceContent />
      </Suspense>
    </div>
  )
}
