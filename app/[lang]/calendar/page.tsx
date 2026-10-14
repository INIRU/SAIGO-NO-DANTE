import { Suspense } from 'react'
import type { Metadata } from 'next'
import { metaText, pageMetadata } from '@/lib/seo/metadata'
import { isMonth, kstDay } from '@/lib/news/calendar'
import { loadNewsMonth } from '@/lib/news/data'
import { NEWS_FEEDS } from '@/lib/news/payload'
import NewsCalendar from '@/components/news/NewsCalendar'
import { PageHeaderSkeleton } from '@/components/ui/PageHeader'
import Skeleton from '@/components/ui/Skeleton'

type Query = Promise<{ month?: string; date?: string; feed?: string }>

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return pageMetadata({ lang, path: '/calendar', title: metaText('calendar.meta.title', lang), description: metaText('calendar.meta.description', lang) })
}

// The address picks the view: ?date= opens a day (and its month), ?month= a month, ?feed= one kind of news.
async function Calendar({ searchParams }: { searchParams: Query }) {
  const query = await searchParams
  const today = kstDay(new Date().toISOString())
  const date = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date) && isMonth(query.date.slice(0, 7)) ? query.date : null
  const month = date ? date.slice(0, 7) : isMonth(query.month) ? query.month : today.slice(0, 7)
  // A failed read still shows the calendar, with a notice in place of the news.
  const items = await loadNewsMonth(month).catch(() => null)
  const feed = NEWS_FEEDS.find(name => name === query.feed) ?? 'all'
  return <NewsCalendar month={month} today={today} date={date} feed={feed} items={items} />
}

export default function CalendarPage({ searchParams }: { searchParams: Query }) {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-[5.5rem] sm:px-6">
        <PageHeaderSkeleton titleWidth="9rem" />
        <Skeleton className="h-[28rem] w-full rounded-lg" />
      </div>
    }>
      <Calendar searchParams={searchParams} />
    </Suspense>
  )
}
