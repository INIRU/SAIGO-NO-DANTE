import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/metadata'
import { getTranslations } from 'next-intl/server'
import BoardHeader from '@/components/discovery/BoardHeader'
import { loadInitialShelf } from '@/lib/discovery/initial-shelf'
import type { InitialShelf } from '@/components/discovery/DiscoveryShelf'
import DecksClient from './DecksClient'
import StaticQueryAdapter from '@/components/providers/StaticQueryAdapter'
import { BoardShelfSkeleton } from '@/components/discovery/BoardSkeleton'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'decks.meta' })
  return pageMetadata({ lang, path: '/decks', title: t('title'), description: t('description') })
}

export default async function DecksPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: routeLang } = await params
  const t = await getTranslations({ locale: routeLang, namespace: 'decks.header' })
  const headerCopy = {
    title: t('title'),
    subtitle: t('subtitle'),
    newDeck: t('newDeck'),
  }

  const initialShelf = (await loadInitialShelf('deck')) as InitialShelf | undefined

  return (
    <div className="community-board flex min-h-screen flex-col" style={{ background: 'var(--bg-deep)' }}>
      <BoardHeader kind="deck" lang={routeLang} title={headerCopy.title} subtitle={headerCopy.subtitle} action={headerCopy.newDeck} />
      <StaticQueryAdapter fallback={<BoardShelfSkeleton kind="deck" />}>
        {/* The default view is the discovery shelf: its first page is in the HTML (initialShelf, a minutes-long cache entry);
            the full list is not prerendered, the client loads it when browsing or filtering. */}
        <DecksClient initialShelf={initialShelf} />
      </StaticQueryAdapter>
    </div>
  )
}
