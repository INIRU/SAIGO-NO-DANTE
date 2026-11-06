import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cacheLife, cacheTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { z } from 'zod'
import { pageMetadata } from '@/lib/seo/metadata'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { adjacentAnnouncements, announcementPreview } from '@/lib/announcements'
import { getCachedAnnouncements } from '@/lib/db/announcements'
import AnnouncementBody from '@/features/admin/components/AnnouncementBody'
import AdSlot from '@/components/ads/AdSlot'
import { AnnouncementMeta } from '@/features/admin/components/AnnouncementList'
import BackLink from '@/components/navigation/BackLink'
import { HtmlFlag } from '@/hooks/useHtmlFlag'

type Props = { params: Promise<{ lang: string; id: string }> }
const localeOf = (lang: string) => (lang === 'en' || lang === 'ja' ? lang : 'ko')

/** The published announcement of that language with its neighbours, or null (unknown, draft or another language). */
async function findAnnouncement(lang: 'ko' | 'en' | 'ja', id: string) {
  if (!z.string().uuid().safeParse(id).success) return null
  const items = await getCachedAnnouncements(lang)
  const item = items.find(entry => entry.id === id)
  return item ? { item, ...adjacentAnnouncements(items, id) } : null
}

// Published announcements are prerendered; ids published later render on first visit and stay cached.
export async function generateStaticParams({ params }: { params: { lang: string } }) {
  const items = await getCachedAnnouncements(localeOf(params.lang))
  return items.map(item => ({ id: item.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.announcements)
  const { lang: rawLang, id } = await params
  const lang = localeOf(rawLang)
  const found = await findAnnouncement(lang, id)
  if (!found) return {}
  const preview = announcementPreview(found.item)
  return pageMetadata({ lang, path: `/announcements/${id}`, title: preview.title, description: preview.excerpt, type: 'article' })
}

const neighbour = 'group flex min-h-20 flex-col justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition-colors hover:border-[var(--border-gold)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]'
const neighbourTitle = 'mt-1.5 line-clamp-2 break-keep font-[family-name:var(--font-heading)] text-[0.9375rem] leading-snug text-[var(--text-primary)] transition-colors group-hover:text-[var(--gold-light)]'

// Cached whole (until an announcement is saved), so an unknown id answers 404 before anything streams.
// Links carry the locale themselves: locale-aware helpers would read the request inside the cache.
export default async function AnnouncementPage({ params }: Props) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.announcements)
  const { lang: rawLang, id } = await params
  const lang = localeOf(rawLang)
  const found = await findAnnouncement(lang, id)
  if (!found) notFound()
  const { item, older, newer } = found
  const t = await getTranslations({ locale: lang, namespace: 'announcements' })
  return (
    <div className="mx-auto min-h-[65dvh] max-w-[46rem] px-4 pb-20 pt-[5.5rem] sm:px-6">
      <HtmlFlag name="with-compact-footer" />
      <BackLink href="/announcements" className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-sm text-[0.9375rem] text-[var(--text-secondary)] transition-colors hover:text-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
        <ArrowLeft size={16} aria-hidden="true" />{t('back')}
      </BackLink>
      <article className="announcement-rise">
        <header className="border-b border-[var(--border)] pb-7">
          <AnnouncementMeta item={item} pinnedLabel={t('pinned')} />
          <h1 className="mt-4 text-balance break-keep font-[family-name:var(--font-heading)] text-[1.75rem] leading-[1.3] tracking-[-0.02em] text-[var(--text-primary)] sm:text-[2.125rem]">{item.title}</h1>
        </header>
        {/* the page-start banner, where the side ads do not fit (DESIGN.md "광고") */}
        <div style={{ '--ad-top-gap': '1.75rem' } as React.CSSProperties}><AdSlot place="top" /></div>
        <div className="pt-4"><AnnouncementBody doc={item.content_doc} text={item.content} /></div>
      </article>
      {(older || newer) && (
        <nav aria-label={t('title')} className="mt-16 grid gap-3 border-t border-[var(--border)] pt-8 sm:grid-cols-2">
          {older ? (
            <Link href={`/${lang}/announcements/${older.id}`} className={neighbour}>
              <span className="flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--text-tertiary)]"><ArrowLeft size={13} aria-hidden="true" />{t('older')}</span>
              <span className={neighbourTitle}>{older.title}</span>
            </Link>
          ) : <span className="hidden sm:block" />}
          {newer && (
            <Link href={`/${lang}/announcements/${newer.id}`} className={`${neighbour} sm:items-end sm:text-right`}>
              <span className="flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--text-tertiary)]">{t('newer')}<ArrowRight size={13} aria-hidden="true" /></span>
              <span className={neighbourTitle}>{newer.title}</span>
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}
