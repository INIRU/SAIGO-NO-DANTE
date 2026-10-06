import { Suspense } from 'react'
import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo/metadata'
import { isMonth, kstDay } from '@/lib/news/calendar'
import { loadNewsMonth } from '@/lib/news/data'
import { NEWS_FEEDS, parseNews, type NewsItem } from '@/lib/news/payload'
import NewsCalendar from '@/components/news/NewsCalendar'
import { PageHeaderSkeleton } from '@/components/ui/PageHeader'
import Skeleton from '@/components/ui/Skeleton'
import { NEWS_EXAMPLES } from '../developers/api-reference'

const TITLE = { ko: '소식 캘린더', en: 'News calendar', ja: 'ニュースカレンダー' }
type Query = Promise<{ month?: string; date?: string; feed?: string; sample?: string; v?: string }>

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return { title: TITLE[lang as keyof typeof TITLE] ?? TITLE.ko, alternates: localeAlternates(lang, '/calendar') }
}

// 시안 검토용: 개발 서버에서 ?sample=1이면 문서 예시를 이번 달 여러 날에 뿌려 보여 준다. 시안을 고르면 지운다.
function sampleItems(month: string): NewsItem[] {
  const stills = ['header.jpg', 'capsule_616x353.jpg', 'library_hero.jpg', 'library_600x900.jpg'].map(name => `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1973530/${name}`)
  const days = [1, 3, 4, 6, 6, 6, 8, 10, 13, 15, 15, 17, 20, 22, 22, 24, 27, 29, 29, 29, 29, 31]
  return days.flatMap((day, index) => {
    const example = NEWS_EXAMPLES[index % NEWS_EXAMPLES.length]
    const parsed = parseNews(JSON.parse(JSON.stringify(example.body).replace(/https:\/\/(clan\.fastly\.steamstatic|pbs\.twimg|livecloud-thumb\.akamaized)[^"]+/g, stills[index % stills.length])))
    if (!parsed.ok) return []
    const { id, ...item } = parsed.value
    return [{ ...item, id: `00000000-0000-4000-8000-0000000000${String(index).padStart(2, '0')}`, partner: 'limpi', external_id: `${id}:${index}`, starts_at: null, ends_at: null, spoiler: index === 4,
      published_at: `${month}-${String(day).padStart(2, '0')}T${String(9 + (index % 10)).padStart(2, '0')}:00:00+09:00` }]
  })
}

async function Calendar({ searchParams }: { searchParams: Query }) {
  const query = await searchParams
  const today = kstDay(new Date().toISOString())
  const date = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date) && isMonth(query.date.slice(0, 7)) ? query.date : null
  const month = date ? date.slice(0, 7) : isMonth(query.month) ? query.month : today.slice(0, 7)
  const items = process.env.NODE_ENV !== 'production' && query.sample === '1'
    ? sampleItems(month)
    : await loadNewsMonth(month).catch(() => null)
  const feed = NEWS_FEEDS.find(name => name === query.feed) ?? 'all'
  return <NewsCalendar month={month} today={today} date={date} feed={feed} items={items} variant={query.v === '1' || query.v === '2' ? query.v : '3'} />
}

export default function CalendarPage({ searchParams }: { searchParams: Query }) {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-[5.5rem] sm:px-6">
        <PageHeaderSkeleton titleWidth="9rem" description={false} />
        <Skeleton className="h-[28rem] w-full rounded-lg" />
      </div>
    }>
      <Calendar searchParams={searchParams} />
    </Suspense>
  )
}
