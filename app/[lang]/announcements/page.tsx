import type { Metadata } from 'next'
import { cacheLife, cacheTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { pageMetadata } from '@/lib/seo/metadata'
import { announcementPreview } from '@/lib/announcements'
import { getCachedAnnouncements } from '@/lib/db/announcements'
import AnnouncementList from '@/features/admin/components/AnnouncementList'
import PageHeader from '@/components/ui/PageHeader'
import { HtmlFlag } from '@/hooks/useHtmlFlag'

const localeOf = (lang: string) => (lang === 'en' || lang === 'ja' ? lang : 'ko')

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = localeOf((await params).lang)
  const t = await getTranslations({ locale: lang, namespace: 'announcements' })
  return pageMetadata({ lang, path: '/announcements', title: t('title'), description: t('description') })
}

export default async function AnnouncementsPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.announcements)
  const lang = localeOf((await params).lang)
  const [items, t] = await Promise.all([getCachedAnnouncements(lang), getTranslations({ locale: lang, namespace: 'announcements' })])
  return (
    <div className="mx-auto min-h-[65dvh] max-w-5xl px-4 pb-16 pt-[5.5rem] sm:px-6">
      <HtmlFlag name="with-compact-footer" />
      <PageHeader title={t('title')} className="mb-8" />
      <AnnouncementList lang={lang} items={items.map(item => announcementPreview(item))} labels={{ pinned: t('pinned'), readMore: t('readMore'), empty: t('empty') }} />
    </div>
  )
}
