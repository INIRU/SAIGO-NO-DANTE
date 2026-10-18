import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cacheLife, cacheTag } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import DeckCard from '@/components/decks/DeckCard'
import PlanCard from '@/components/planner/PlanCard'
import PostAuthorName from '@/components/community/PostAuthorName'
import SeriesOwnerTools from '@/components/series/SeriesOwnerTools'
import SeriesPageSkeleton from '@/components/series/SeriesPageSkeleton'
import { withPostAuthors } from '@/lib/community/post-authors'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { orderSeriesItems } from '@/lib/series/order'
import { loadSeriesCards } from '@/lib/series/cards'
import { loadSeries } from '@/lib/series/server'

type Props = { params: Promise<{ lang: string; id: string }> }

async function getCachedSeriesPage(id: string) {
  'use cache'
  cacheLife('max')
  // Any deck or plan of the series may change (title, votes), so the board tags refresh it too.
  cacheTag(CACHE_TAGS.series(id), CACHE_TAGS.decksList, CACHE_TAGS.plansList)
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
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
  return (
    <div className="min-h-screen bg-[#0d0b08] pt-24 pb-20">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-3 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="break-keep font-[family-name:var(--font-heading)] text-[1.375rem] leading-tight text-[var(--gold)] md:text-[1.75rem]">{series.title}</h1>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-[0.9375rem] text-[#9c8b73]">
              {owner && <PostAuthorName userId={series.user_id} username={owner.username} profilePublic={owner.public_profile} className="truncate font-semibold text-[#e8dcc8] hover:text-[#e8b030]" />}
              <span className="font-[family-name:var(--font-title)] text-[1.125rem] text-[var(--gold-light)]">{cards.length}</span>
            </div>
          </div>
          <SeriesOwnerTools id={series.id} title={series.title} items={series.items} />
        </header>
        {cards.length ? (
          <ol className="grid list-none gap-4 p-0 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
            {cards.map((card, index) => (
              <li key={`${card.kind}:${card.id}`} className="relative flex flex-col [&>:first-child]:flex-1">
                {card.kind === 'deck' ? <DeckCard deck={card.deck} /> : <PlanCard plan={card.plan} />}
                <span className="pointer-events-none absolute left-2 top-2 grid h-7 min-w-7 place-items-center rounded bg-[#0d0b08]/85 px-1.5 font-[family-name:var(--font-title)] text-[1.0625rem] leading-none text-[var(--gold-light)]">{index + 1}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[0.9375rem] text-[#9c8b73]">{t('empty')}</p>
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
