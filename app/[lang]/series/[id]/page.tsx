import { Suspense, type CSSProperties } from 'react'
import Image from 'next/image'
import { ArrowLeft, Layers, Map as MapIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cacheLife, cacheTag } from 'next/cache'
import { publicSupabase } from '@/lib/supabase/public'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import DeckCard from '@/features/decks/components/DeckCard'
import AdSlot from '@/components/ads/AdSlot'
import PlanCard from '@/features/planner/components/PlanCard'
import PostAuthorName from '@/features/community/components/PostAuthorName'
import BackLink from '@/components/navigation/BackLink'
import styles from '@/styles/components/SeriesPage.module.css'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import SeriesOwnerTools from '@/features/community/components/SeriesOwnerTools'
import SeriesPageSkeleton from '@/features/community/components/SeriesPageSkeleton'
import { withPostAuthors, loadSeriesCards, loadSeries, orderSeriesItems } from '@/features/community/server'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'

type Props = { params: Promise<{ lang: string; id: string }> }

async function getCachedSeriesPage(id: string) {
  'use cache'
  cacheLife('max')
  // Any deck or plan of the series may change (title, votes), so the board tags refresh it too.
  cacheTag(CACHE_TAGS.series(id), CACHE_TAGS.decksList, CACHE_TAGS.plansList)
  const db = publicSupabase()
  const series = await loadSeries(db, id)
  if (!series) return null
  const [cards, [owner]] = await Promise.all([
    loadSeriesCards(db, series.items),
    withPostAuthors([{ user_id: series.user_id, profiles: null as { username: string; avatar_url: string | null; public_profile: boolean } | null }]),
  ])
  return { series: { ...series, items: orderSeriesItems(series.items) }, cards, owner: owner.profiles }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id } = await params
  if (!z.string().uuid().safeParse(id).success) return {}
  const t = await getTranslations({ locale: lang, namespace: 'series' })
  const page = await getCachedSeriesPage(id)
  return { title: page ? t('metaTitle', { title: page.series.title }) : t('notFound') }
}

async function SeriesContent({ params }: Props) {
  const { lang, id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const t = await getTranslations({ locale: lang, namespace: 'series' })
  const page = await getCachedSeriesPage(id)
  if (!page) notFound()
  const { series, cards, owner } = page
  const deckCount = cards.filter(card => card.kind === 'deck').length
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] pt-24 pb-20">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
        <BackLink
          href={owner?.public_profile !== false ? `/users/${series.user_id}` : '/planner/community'}
          className="mb-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm px-1 text-[0.9375rem] font-medium text-[#9c8b73] transition-colors hover:text-[var(--gold-light)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('back')}
        </BackLink>
        <header className={styles.head}>
          <div className="min-w-0">
            <h1 className={styles.title}>{series.title}</h1>
            {owner && (
              <div className={styles.author}>
                <Image src={owner.avatar_url ?? DEFAULT_AVATAR_URL} alt="" width={36} height={36} className={styles.avatar} />
                <PostAuthorName userId={series.user_id} username={owner.username} profilePublic={owner.public_profile} className="truncate" />
              </div>
            )}
          </div>
          <div className={styles.side}>
            <dl className={styles.facts}>
              <div className={styles.fact}><dt>{t('deck')}</dt><dd>{deckCount}</dd></div>
              <div className={styles.fact}><dt>{t('plan')}</dt><dd>{cards.length - deckCount}</dd></div>
            </dl>
            <SeriesOwnerTools id={series.id} title={series.title} items={series.items} />
          </div>
        </header>
        {/* the page-start banner, where the side ads do not fit (DESIGN.md "광고") */}
        <AdSlot place="top" />
        {cards.length ? (
          <ol className={styles.list}>
            {cards.map((card, index) => (
              <li key={`${card.kind}:${card.id}`} className={styles.item} style={{ '--i': index } as CSSProperties}>
                <div className={styles.mark} aria-hidden="true">
                  <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
                  <span className={styles.kind}>{card.kind === 'deck' ? <Layers size={14} /> : <MapIcon size={14} />}{t(card.kind)}</span>
                  <span className={styles.rule} />
                </div>
                {card.kind === 'deck' ? <DeckCard deck={card.deck} /> : <PlanCard plan={card.plan} />}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-6 text-[0.9375rem] text-[#9c8b73]">{t('empty')}</p>
        )}
      </div>
    </div>
  )
}

export default function SeriesPage({ params }: Props) {
  return (
    <Suspense fallback={<SeriesPageSkeleton />}>
      <SeriesContent params={params} />
    </Suspense>
  )
}
