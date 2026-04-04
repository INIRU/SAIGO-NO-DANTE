import type { Metadata } from 'next'
import { getSinners } from '@/lib/db/queries'
import { getMetaData } from '@/lib/db/meta'
import MetaClient from './MetaClient'

export const metadata: Metadata = {
  title: '메타 분석 | SAIGO NO DANTE',
  description: '덱 데이터 기반 인격·키워드·시너지·EGO 채용률 통계',
}

export default async function MetaPage() {
  const [sinners, initialData] = await Promise.all([
    getSinners(),
    getMetaData().catch(() => null),
  ])

  return (
    <div className="min-h-screen pt-24 pb-16 px-3 md:px-6 max-w-7xl mx-auto" style={{ position: 'relative', overflow: 'hidden' }}>
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

      {/* Server-rendered header — always in HTML for LCP */}
      <div className="mb-6 md:mb-8">
        <p style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>
          USAGE ANALYTICS
        </p>
        <h1 className="font-serif text-3xl md:text-5xl font-bold mb-1" style={{ color: 'var(--gold)' }}>
          메타 분석
        </h1>
        <p className="text-xs md:text-sm" style={{ color: '#666688' }}>
          전체{' '}
          <span className="font-mono" style={{ color: 'var(--gold)' }}>
            {initialData?.totalDecks ?? 0}
          </span>
          개 덱 기반 통계
        </p>
        <div style={{ width: '8rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '1rem' }} />
      </div>

      <MetaClient sinners={sinners} initialData={initialData} />
    </div>
  )
}
