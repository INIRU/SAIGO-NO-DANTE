'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid #2a2520', borderRadius: '6px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
        style={{ background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ color: '#888899', fontSize: '0.75rem', letterSpacing: '0.05em' }}>{title}</span>
        <span style={{ color: '#555566', fontSize: '0.75rem', transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            borderTop: '1px solid #2a2520',
            padding: '16px',
            maxHeight: '260px',
            overflowY: 'auto',
            background: '#0d0b08',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') router.replace('/')
  }, [status, router])

  if (status === 'loading' || session) return null

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#0d0b08' }}
    >
      {/* 로고 */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <Image src="/images/logo.webp" alt="" width={36} height={52}
          style={{ filter: 'drop-shadow(0 0 12px rgba(200,144,10,0.5))' }} />
        <h1 className="font-serif text-2xl font-bold tracking-widest" style={{ color: 'var(--gold)' }}>
          최애의 관리자
        </h1>
        <p style={{ color: '#555566', fontSize: '0.8125rem' }}>
          수감자 DB · 덱 공유 · 메타 분석
        </p>
      </div>

      {/* 로그인 카드 */}
      <div
        style={{
          width: '100%', maxWidth: '420px',
          background: '#12100d',
          border: '1px solid #2a2520',
          borderRadius: '10px',
          padding: '32px',
        }}
      >
        <h2 className="font-serif font-bold text-center mb-6" style={{ color: '#c8a450', fontSize: '1.125rem' }}>
          로그인
        </h2>

        {/* 약관 아코디언 */}
        <div className="space-y-2 mb-5">
          <Accordion title="이용약관">
            <div style={{ color: '#666677', fontSize: '0.6875rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {`최애의 관리자는 Limbus Company 팬 사이트입니다.
Project Moon과 공식 제휴 관계에 있지 않으며 상업적 목적 없이 운영됩니다.

• 이용자 콘텐츠(덱 등)의 저작권은 작성자에게 있습니다.
• 타인을 비방하거나 서비스 운영을 방해하는 행위는 금지됩니다.
• 서비스는 예고 없이 변경되거나 종료될 수 있습니다.`}
            </div>
            <Link href="/terms" target="_blank"
              style={{ display: 'block', marginTop: '10px', color: 'var(--gold-dim)', fontSize: '0.6875rem', textDecoration: 'underline' }}>
              전문 보기 →
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
              style={{ display: 'block', marginTop: '10px', color: 'var(--gold-dim)', fontSize: '0.6875rem', textDecoration: 'underline' }}>
              전문 보기 →
            </Link>
          </Accordion>
        </div>

        {/* 동의 문구 */}
        <p style={{ color: '#6a6a80', fontSize: '0.6875rem', textAlign: 'center', marginBottom: '16px', lineHeight: 1.6 }}>
          로그인 시 이용약관 및 개인정보 처리방침에<br />동의한 것으로 간주됩니다.
        </p>

        {/* Google 로그인 버튼 */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-3 py-3 rounded transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{
            background: '#fff',
            color: '#1a1a1a',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            borderRadius: '6px',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.174 0 7.548 0 9s.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Google로 계속하기
        </button>

        <div className="mt-6 text-center">
          <Link href="/" style={{ color: '#555570', fontSize: '0.75rem' }}
            className="hover:text-yellow-300 transition-colors">
            ← 로그인 없이 둘러보기
          </Link>
        </div>
      </div>
    </div>
  )
}
