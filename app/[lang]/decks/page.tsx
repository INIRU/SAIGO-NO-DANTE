import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/metadata'
import { getTranslations } from 'next-intl/server'
import BoardHeader from '@/features/community/components/BoardHeader'
import { loadInitialShelf } from '@/features/community/server'
import type { InitialShelf } from '@/features/community/components/DiscoveryShelf'
import DecksClient from './DecksClient'
import StaticQueryAdapter from '@/components/providers/StaticQueryAdapter'
import { BoardShelfSkeleton } from '@/features/community/components/BoardShelfSkeleton'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'decks.meta' })
  return pageMetadata({ lang, path: '/decks', title: t('title'), description: t('description') })
}

export default async function DecksPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: routeLang } = await params
  const t = await getTranslations({ locale: routeLang, namespace: 'decks.header' })
  const tShelf = await getTranslations({ locale: routeLang, namespace: 'discoveryShelf' })

  const initialShelf = (await loadInitialShelf('deck')) as InitialShelf | undefined

  return (
    <div className="community-board flex min-h-screen flex-col" style={{ background: 'var(--bg-deep)' }}>
      <BoardHeader kind="deck" title={t('title')} action={t('newDeck')} viewAll={tShelf('viewAllDecks')} back={tShelf('back', { title: t('title') })} />
      <StaticQueryAdapter fallback={<BoardShelfSkeleton />}>
        {/* The default view is the discovery shelf: its first page is in the HTML (initialShelf, a minutes-long cache entry);
            the full list is not prerendered, the client loads it when browsing or filtering. */}
        <DecksClient initialShelf={initialShelf} />
      </StaticQueryAdapter>
    </div>
  )
}
