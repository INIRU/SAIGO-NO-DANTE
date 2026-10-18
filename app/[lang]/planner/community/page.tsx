import { BoardShelfSkeleton } from '@/components/discovery/BoardSkeleton'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import BoardHeader from '@/components/discovery/BoardHeader'
import { loadInitialShelf } from '@/lib/discovery/initial-shelf'
import type { InitialShelf } from '@/components/discovery/DiscoveryShelf'
import CommunityClient from './CommunityClient'
import StaticQueryAdapter from '@/components/providers/StaticQueryAdapter'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'planner.communityBoard.meta' })
  return pageMetadata({ lang, path: '/planner/community', title: t('title'), description: t('description') })
}

export default async function CommunityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'planner.communityBoard.header' })
  const tActions = await getTranslations({ locale: lang, namespace: 'planner.actions' })

  const initialShelf = (await loadInitialShelf('planner')) as InitialShelf | undefined

  return (
    <div className="community-board flex min-h-screen flex-col" style={{ background: 'var(--bg-deep)' }}>
      <BoardHeader kind="planner" lang={lang} title={t('title')} subtitle={t('subtitle')} action={t('newPlan')} assist={tActions('triggerMode')} />
      <Suspense fallback={<BoardShelfSkeleton kind="planner" />}>
        {/* The default view is the discovery shelf, rendered with its first page (initialShelf, a minutes-long cache
            entry); the client loads the full list when browsing or searching. URL filters apply after hydration (StaticQueryAdapter). */}
        <StaticQueryAdapter fallback={<BoardShelfSkeleton kind="planner" />}>
          <CommunityClient initialShelf={initialShelf} />
        </StaticQueryAdapter>
      </Suspense>
    </div>
  )
}
