import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/metadata'
import { getTranslations } from 'next-intl/server'
import BoardHeader from '@/components/discovery/BoardHeader'
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

  return (
    <div className="community-board flex min-h-screen flex-col" style={{ background: 'var(--bg-deep)' }}>
      <BoardHeader kind="deck" lang={routeLang} title={headerCopy.title} subtitle={headerCopy.subtitle} action={headerCopy.newDeck} />
      <StaticQueryAdapter fallback={<BoardShelfSkeleton kind="deck" />}>
        {/* No list is prerendered: the default view is the discovery shelf, and a list in the page would regenerate it on
            every vote, comment and post (decksList tag). The client loads the list when browsing or filtering. */}
        <DecksClient />
      </StaticQueryAdapter>
    </div>
  )
}
