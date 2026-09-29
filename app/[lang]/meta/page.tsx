import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo/metadata'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { getMetaData } from '@/lib/db/meta'
import MetaClient from './MetaClient'
import styles from '@/styles/components/MetaAnalysis.module.css'
import PageHeader from '@/components/ui/PageHeader'
import StaticQueryAdapter from '@/components/providers/StaticQueryAdapter'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'meta' })
  return {
    title: lang === 'ko' ? '림버스 인격 메타 분석 — 편성 채용률' : t('title'),
    description: lang === 'ko' ? '덱 게시판과 거울 던전 플래너의 공개 편성 기반 인격별 편성 순서·덱 용도·E.G.O 사용률 분석' : t('description'),
    alternates: localeAlternates(lang, '/meta'),
  }
}

export default async function MetaPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'meta' })
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
      <PageHeader title={t('title')} description={t('description')} />

      {/* Prerendered with the default tab; the URL's tab and filters apply after hydration (StaticQueryAdapter). */}
      <Suspense fallback={null}>
        <StaticQueryAdapter>
          <MetaClient initialData={initialData} />
        </StaticQueryAdapter>
      </Suspense>
    </div>
  )
}
