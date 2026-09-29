import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import AnnouncementsClient from './AnnouncementsClient'
import { getAnnouncementsForLang } from '@/lib/db/announcements'
import PageHeader from '@/components/ui/PageHeader'
import { HtmlFlag } from '@/hooks/useHtmlFlag'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params
  const lang = rawLang === 'en' || rawLang === 'ja' ? rawLang : 'ko'
  const title = lang === 'en' ? 'Announcements' : lang === 'ja' ? 'お知らせ' : '공지사항'
  const description = lang === 'en'
    ? 'Check site updates and notices.'
    : lang === 'ja'
      ? 'サイトの更新とお知らせを確認できます。'
      : '사이트 업데이트 및 안내사항을 확인하세요.'
  return {
    title,
    description,
    alternates: localeAlternates(lang, '/announcements'),
  }
}

export default async function AnnouncementsPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.announcements)
  const { lang: rawLang } = await params
  const locale = rawLang === 'en' || rawLang === 'ja' ? rawLang : 'ko'
  // Rendered into the cached page (invalidated with the announcements tag when one is saved) instead of fetched after
  // hydration; a failed read leaves the list to the client, which fetches it and offers a retry.
  const items = await getAnnouncementsForLang(locale).catch(() => null)
  const copy = locale === 'en'
    ? {
        title: 'Announcements',
        loading: 'Loading...',
      }
    : locale === 'ja'
      ? {
          title: 'お知らせ',
          loading: '読み込み中...',
        }
      : {
          title: '공지사항',
          loading: '로딩 중...',
        }
  return (
    <div data-announcements className="mx-auto min-h-[65dvh] max-w-6xl px-6 pb-12 pt-[5.5rem]">
      <HtmlFlag name="with-compact-footer" />
      <div>
        <PageHeader title={copy.title} />

        {/* Client component — streams in */}
        <Suspense fallback={
          <div className="flex items-center gap-2" style={{ color: '#888888', fontSize: '0.8125rem' }}>
            <Loader2 size={14} className="animate-spin" /> {copy.loading}
          </div>
        }>
          <AnnouncementsClient initialItems={items} />
        </Suspense>
      </div>
    </div>
  )
}
