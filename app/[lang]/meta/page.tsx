import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { getMetaData } from '@/lib/db/meta'
import MetaClient from './MetaClient'
import styles from '@/styles/components/MetaAnalysis.module.css'

export const metadata: Metadata = {
  title: '인격 메타 분석 | SAIGO NO DANTE',
  description: '덱 게시판과 거울 던전 플래너의 공개 편성 기반 인격별 편성 순서·덱 용도·EGO 사용률 분석',
}

export default async function MetaPage() {
  const t = await getTranslations('meta')
  const initialData = await getMetaData().catch(() => null)

  return (
    <div className={styles.page}>
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
      <div className={styles.heading}>
        <p style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>
          IDENTITY ANALYSIS
        </p>
        <h1 >
          {t('title')}
        </h1>
        <p className="text-xs md:text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('description')}
        </p>
      </div>

      {/* Query-state controls require a Suspense boundary. */}
      <Suspense fallback={null}>
        <MetaClient initialData={initialData} />
      </Suspense>
    </div>
  )
}
