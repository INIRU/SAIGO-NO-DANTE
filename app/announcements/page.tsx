import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { cacheLife } from 'next/cache'
import AnnouncementsClient from './AnnouncementsClient'

export const metadata: Metadata = {
  title: '공지사항 | SAIGO NO DANTE',
  description: '사이트 업데이트 및 안내사항을 확인하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/announcements' },
}

export default async function AnnouncementsPage() {
  'use cache'
  cacheLife('page-5m')
  return (
    <div style={{ background: 'var(--bg-deep)', minHeight: '100dvh', position: 'relative', overflow: 'hidden' }}>
      {/* Background atmospheric glow */}
      <div style={{
        position: 'fixed',
        top: '-10rem',
        right: '-5rem',
        width: '35rem',
        height: '35rem',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,144,10,0.04) 0%, rgba(200,144,10,0.015) 40%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20" style={{ position: 'relative', zIndex: 1 }}>
        {/* Server-rendered header — instant paint */}
        <div className="mb-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 mb-4 transition-colors hover:opacity-70"
            style={{ color: '#888888', fontSize: '0.8125rem' }}
          >
            <ArrowLeft size={14} />
            홈으로
          </Link>
          <p style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>ANNOUNCEMENTS</p>
          <h1 className="font-serif text-3xl font-bold" style={{ color: 'var(--gold)' }}>
            공지사항
          </h1>
          <p style={{ color: '#888888', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            사이트 업데이트 및 안내사항을 확인하세요.
          </p>
          <div style={{ width: '8rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '1rem' }} />
        </div>

        <div className="divider-gold mb-8" />

        {/* Client component — streams in */}
        <Suspense fallback={
          <div className="flex items-center gap-2" style={{ color: '#888888', fontSize: '0.8125rem' }}>
            <Loader2 size={14} className="animate-spin" /> 로딩 중...
          </div>
        }>
          <AnnouncementsClient />
        </Suspense>
      </div>
    </div>
  )
}
