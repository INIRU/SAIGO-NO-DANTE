import { BoardShelfSkeleton } from '@/components/discovery/BoardSkeleton'
import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import BoardHeader from '@/components/discovery/BoardHeader'
import CommunityClient from './CommunityClient'
import StaticQueryAdapter from '@/components/providers/StaticQueryAdapter'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'planner.communityBoard.meta' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: localeAlternates(lang, '/planner/community'),
  }
}

export default async function CommunityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'planner.communityBoard.header' })
  const tActions = await getTranslations({ locale: lang, namespace: 'planner.actions' })

  return (
    <div className="community-board flex min-h-screen flex-col" style={{ background: 'var(--bg-deep)' }}>
      <BoardHeader kind="planner" lang={lang} title={t('title')} subtitle={t('subtitle')} action={t('newPlan')} assist={tActions('triggerMode')} />
      <Suspense fallback={<BoardShelfSkeleton kind="planner" />}>
        {/* No list is prerendered (it would regenerate the page on every vote, comment and plan); the client loads it when
            browsing or searching. URL filters apply after hydration (StaticQueryAdapter). */}
        <StaticQueryAdapter fallback={<BoardShelfSkeleton kind="planner" />}>
          <CommunityClient />
        </StaticQueryAdapter>
      </Suspense>
    </div>
  )
}
