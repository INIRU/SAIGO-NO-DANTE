import { BoardShelfSkeleton } from '@/features/community/components/BoardShelfSkeleton'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import BoardHeader from '@/features/community/components/BoardHeader'
import { loadInitialShelf } from '@/features/community/server'
import type { InitialShelf } from '@/features/community/components/DiscoveryShelf'
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
  const tShelf = await getTranslations({ locale: lang, namespace: 'discoveryShelf' })

  const initialShelf = (await loadInitialShelf('planner')) as InitialShelf | undefined

  return (
    <div className="community-board flex min-h-screen flex-col" style={{ background: 'var(--bg-deep)' }}>
      <BoardHeader kind="planner" title={t('title')} action={t('newPlan')} viewAll={tShelf('viewAllPlans')} back={tShelf('back', { title: t('title') })} assist={tActions('triggerMode')} />
      <Suspense fallback={<BoardShelfSkeleton plan />}>
        {/* The default view is the discovery shelf, rendered with its first page (initialShelf, a minutes-long cache
            entry); the client loads the full list when browsing or searching. URL filters apply after hydration (StaticQueryAdapter). */}
        <StaticQueryAdapter fallback={<BoardShelfSkeleton plan />}>
          <CommunityClient initialShelf={initialShelf} />
        </StaticQueryAdapter>
      </Suspense>
    </div>
  )
}
