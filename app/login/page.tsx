'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      border: '0.0625rem solid rgba(200,144,10,0.15)',
      borderRadius: '0.375rem',
      overflow: 'hidden',
      background: open ? 'rgba(200,144,10,0.03)' : 'transparent',
      transition: 'background 300ms ease',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between transition-colors"
        style={{
          padding: '0.75rem 1rem',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          border: 'none',
        }}
      >
        <span style={{
          color: open ? '#c8a450' : '#777788',
          fontSize: '0.75rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          transition: 'color 300ms ease',
        }}>{title}</span>
        <span style={{
          color: open ? '#c8900a' : '#555566',
          fontSize: '0.625rem',
          transition: 'transform 300ms ease, color 300ms ease',
          transform: open ? 'rotate(180deg)' : 'none',
        }}>&#9662;</span>
      </button>
      <div style={{
        maxHeight: open ? '16.25rem' : '0',
        overflow: 'hidden',
        transition: 'max-height 400ms cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{
          borderTop: '0.0625rem solid rgba(200,144,10,0.1)',
          padding: '1rem',
          overflowY: 'auto',
          maxHeight: '15rem',
          background: 'rgba(13,11,8,0.6)',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/* 배경 파티클 */
function Particles() {
  return (
    <div className="login-particles" style={{
      position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
    }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: `${0.125 + Math.random() * 0.125}rem`,
          height: `${0.125 + Math.random() * 0.125}rem`,
          borderRadius: '50%',
          background: `rgba(200,144,10,${0.15 + Math.random() * 0.25})`,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animation: `loginFloat ${6 + Math.random() * 8}s ease-in-out infinite`,
          animationDelay: `${-Math.random() * 10}s`,
          filter: 'blur(0.5px)',
        }} />
      ))}
    </div>
  )
}

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') router.replace('/')
  }, [status, router])

  const animRef = useRef(false)
  useEffect(() => {
    if (status !== 'loading' && !session && !animRef.current) {
      animRef.current = true
      import('gsap').then(({ gsap }) => {
        /* 배경 광원 */
        gsap.fromTo('.login-bg-glow',
          { opacity: 0, scale: 0.8 },
          { opacity: 1, scale: 1, duration: 1.5, ease: 'power2.out' }
        )
        /* 구분선 */
        gsap.fromTo('.login-divider',
          { scaleX: 0 },
          { scaleX: 1, duration: 0.8, delay: 0.3, ease: 'power3.inOut' }
        )
        /* 로고 */
        gsap.fromTo('.login-logo',
          { opacity: 0, y: -30 },
          { opacity: 1, y: 0, duration: 0.8, delay: 0.1, ease: 'power3.out' }
        )
        /* 카드 */
        gsap.fromTo('.login-card',
          { opacity: 0, y: 40, scale: 0.95 },
          { opacity: 1, y: 0, scale: 1, duration: 0.7, delay: 0.35, ease: 'power2.out' }
        )
        /* 하단 링크 */
        gsap.fromTo('.login-footer',
          { opacity: 0 },
          { opacity: 1, duration: 0.5, delay: 0.7, ease: 'power2.out' }
        )
      })
    }
  }, [status, session])

  if (status === 'loading' || session) return null

  return (
    <>
      <style>{`
        @keyframes loginFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25% { transform: translateY(-1.5rem) translateX(0.5rem); opacity: 0.6; }
          50% { transform: translateY(-0.5rem) translateX(-0.75rem); opacity: 0.2; }
          75% { transform: translateY(-2rem) translateX(0.25rem); opacity: 0.5; }
        }
        @keyframes loginPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .login-google-btn:hover {
          box-shadow: 0 0 1.5rem rgba(200,144,10,0.3), inset 0 0 1rem rgba(200,144,10,0.05) !important;
          border-color: rgba(200,144,10,0.6) !important;
        }
        .login-google-btn:active {
          transform: scale(0.97);
        }
      `}</style>

      <div
        className="min-h-screen flex flex-col items-center justify-center relative"
        style={{ background: '#0d0b08', padding: '1rem' }}
      >
        {/* 배경 레이어 */}
        <Particles />

        {/* 중앙 광원 글로우 */}
        <div className="login-bg-glow" style={{
          position: 'fixed',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '40rem',
          height: '40rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,144,10,0.06) 0%, rgba(200,144,10,0.02) 40%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0,
        }} />

        {/* 로고 영역 */}
        <div className="login-logo flex flex-col items-center relative" style={{
          opacity: 0,
          marginBottom: '2rem',
          zIndex: 1,
        }}>
          {/* 로고 뒤 글로우 */}
          <div style={{
            position: 'absolute',
            top: '-1rem',
            width: '6rem',
            height: '6rem',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200,144,10,0.25) 0%, transparent 70%)',
            animation: 'loginPulse 4s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          <Image
            src="/images/logo.webp" alt="" width={40} height={58}
            style={{
              width: '2.5rem', height: 'auto',
              filter: 'drop-shadow(0 0 1rem rgba(200,144,10,0.6))',
              position: 'relative',
            }}
          />

          <h1 className="font-serif font-bold" style={{
            color: '#c8900a',
            fontSize: '1.625rem',
            letterSpacing: '0.2em',
            marginTop: '0.875rem',
            textShadow: '0 0 2rem rgba(200,144,10,0.3)',
          }}>
            최애의 관리자
          </h1>
          <p style={{
            color: '#888888',
            fontSize: '0.75rem',
            letterSpacing: '0.15em',
            marginTop: '0.5rem',
          }}>
            수감자 DB &middot; 덱 공유 &middot; 메타 분석
          </p>

          {/* 구분선 */}
          <div className="login-divider" style={{
            width: '4rem',
            height: '0.0625rem',
            background: 'linear-gradient(90deg, transparent, #c8900a, transparent)',
            marginTop: '1.25rem',
            transformOrigin: 'center',
            transform: 'scaleX(0)',
          }} />
        </div>

        {/* 로그인 카드 */}
        <div
          className="login-card"
          style={{
            opacity: 0,
            width: '100%',
            maxWidth: '26rem',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* 카드 외곽 글로우 */}
          <div style={{
            position: 'absolute',
            inset: '-0.0625rem',
            borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, rgba(200,144,10,0.2), transparent 40%, transparent 60%, rgba(200,144,10,0.1))',
            pointerEvents: 'none',
          }} />

          <div style={{
            position: 'relative',
            background: 'linear-gradient(180deg, #14120e 0%, #0f0d0a 100%)',
            border: '0.0625rem solid rgba(200,144,10,0.12)',
            borderRadius: '0.75rem',
            padding: '2rem 1.75rem',
            boxShadow: '0 1.5rem 4rem rgba(0,0,0,0.5), inset 0 0.0625rem 0 rgba(200,144,10,0.08)',
          }}>
            <h2 className="font-serif font-bold text-center" style={{
              color: '#c8a450',
              fontSize: '1rem',
              letterSpacing: '0.15em',
              marginBottom: '1.5rem',
            }}>
              로그인
            </h2>

            {/* 약관 아코디언 */}
            <div className="space-y-2" style={{ marginBottom: '1.25rem' }}>
              <Accordion title="이용약관">
                <div style={{ color: '#666677', fontSize: '0.6875rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {`최애의 관리자는 Limbus Company 팬 사이트입니다.
Project Moon과 공식 제휴 관계에 있지 않으며 상업적 목적 없이 운영됩니다.

• 이용자 콘텐츠(덱 등)의 저작권은 작성자에게 있습니다.
• 타인을 비방하거나 서비스 운영을 방해하는 행위는 금지됩니다.
• 서비스는 예고 없이 변경되거나 종료될 수 있습니다.`}
                </div>
                <Link href="/terms" target="_blank"
                  style={{ display: 'block', marginTop: '0.625rem', color: 'var(--gold-dim)', fontSize: '0.6875rem', textDecoration: 'underline' }}>
                  전문 보기 &rarr;
                </Link>
              </Accordion>

              <Accordion title="개인정보 처리방침">
                <div style={{ color: '#666677', fontSize: '0.6875rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {`Google OAuth를 통해 다음 정보를 수집합니다.
• 이메일 주소 (계정 식별)
• 프로필 이름 · 프로필 사진

수집된 정보는 로그인 및 덱 게시판 운영 목적으로만 사용되며
제3자에게 제공되지 않습니다.
회원 탈퇴 시 즉시 삭제됩니다.`}
                </div>
                <Link href="/privacy" target="_blank"
                  style={{ display: 'block', marginTop: '0.625rem', color: 'var(--gold-dim)', fontSize: '0.6875rem', textDecoration: 'underline' }}>
                  전문 보기 &rarr;
                </Link>
              </Accordion>
            </div>

            {/* 동의 문구 */}
            <p style={{
              color: '#5a5a70',
              fontSize: '0.6875rem',
              textAlign: 'center',
              marginBottom: '1.25rem',
              lineHeight: 1.7,
            }}>
              로그인 시 이용약관 및 개인정보 처리방침에<br />동의한 것으로 간주됩니다.
            </p>

            {/* Google 로그인 버튼 */}
            <button
              onClick={() => signIn('google', { callbackUrl: '/' })}
              className="login-google-btn w-full flex items-center justify-center"
              style={{
                gap: '0.625rem',
                padding: '0.8125rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, rgba(200,144,10,0.12) 0%, rgba(200,144,10,0.06) 100%)',
                color: '#e8c860',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: '0.0625rem solid rgba(200,144,10,0.3)',
                cursor: 'pointer',
                transition: 'all 300ms ease',
                letterSpacing: '0.03em',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.174 0 7.548 0 9s.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Google로 계속하기
            </button>
          </div>
        </div>

        {/* 하단 링크 */}
        <div className="login-footer" style={{ opacity: 0, marginTop: '1.5rem', zIndex: 1 }}>
          <Link href="/" style={{
            color: '#444458',
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            transition: 'color 300ms ease',
          }}
            className="hover:text-yellow-300">
            &larr; 로그인 없이 둘러보기
          </Link>
        </div>
      </div>
    </>
  )
}
