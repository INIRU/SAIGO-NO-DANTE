import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import AnnouncementsClient from './AnnouncementsClient'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params
  const lang = rawLang === 'en' || rawLang === 'ja' ? rawLang : 'ko'
  const title = lang === 'en'
    ? 'Announcements | SAIGO NO DANTE'
    : lang === 'ja'
      ? 'お知らせ | SAIGO NO DANTE'
      : '공지사항 | SAIGO NO DANTE'
  const description = lang === 'en'
    ? 'Check site updates and notices.'
    : lang === 'ja'
      ? 'サイトの更新とお知らせを確認できます。'
      : '사이트 업데이트 및 안내사항을 확인하세요.'
  return {
    title,
    description,
    alternates: { canonical: `https://saigo-no-dante.com/${lang}/announcements` },
  }
}

export default async function AnnouncementsPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.announcements)
  const { lang: rawLang } = await params
  const locale = rawLang === 'en' || rawLang === 'ja' ? rawLang : 'ko'
  const copy = locale === 'en'
    ? {
        home: 'Home',
        eyebrow: 'ANNOUNCEMENTS',
        title: 'Announcements',
        desc: 'Check site updates and notices.',
        loading: 'Loading...',
      }
    : locale === 'ja'
      ? {
          home: 'ホームへ',
          eyebrow: 'ANNOUNCEMENTS',
          title: 'お知らせ',
          desc: 'サイトの更新とお知らせを確認できます。',
          loading: '読み込み中...',
        }
      : {
          home: '홈으로',
          eyebrow: 'ANNOUNCEMENTS',
          title: '공지사항',
          desc: '사이트 업데이트 및 안내사항을 확인하세요.',
          loading: '로딩 중...',
        }
  return (
    <div data-announcements className="mx-auto min-h-[65dvh] max-w-6xl px-6 pb-12 pt-28">
      <div>
        {/* Server-rendered header — instant paint */}
        <div className="mb-8">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-1.5 mb-4 transition-colors hover:opacity-70"
            style={{ color: '#888888', fontSize: '0.8125rem' }}
          >
            <ArrowLeft size={14} />
            {copy.home}
          </Link>
          <h1 className="font-[family-name:var(--font-paperlogy)] text-[2rem] font-bold tracking-[-0.03em]" style={{ color: 'var(--gold)' }}>
            {copy.title}
          </h1>
          <p style={{ color: '#888888', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            {copy.desc}
          </p>
        </div>


        {/* Client component — streams in */}
        <Suspense fallback={
          <div className="flex items-center gap-2" style={{ color: '#888888', fontSize: '0.8125rem' }}>
            <Loader2 size={14} className="animate-spin" /> {copy.loading}
          </div>
        }>
          <AnnouncementsClient />
        </Suspense>
      </div>
    </div>
  )
}
