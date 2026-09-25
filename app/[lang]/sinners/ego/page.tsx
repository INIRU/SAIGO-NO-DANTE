import type { Metadata } from 'next'
import { localeAlternates, localeUrl } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getAllEGOsForBrowser, getSinners } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import EGOBrowserClient from './EGOBrowserClient'
import JsonLd, { itemListJsonLd } from '@/components/seo/JsonLd'

const TITLE = { ko: '림버스 컴퍼니 E.G.O 도감 — 전체 E.G.O 목록', en: 'Limbus Company E.G.O List', ja: 'リンバスカンパニー E.G.O一覧' }

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return {
    title: TITLE[lang as keyof typeof TITLE] ?? TITLE.ko,
    description: '림버스 컴퍼니 12인 수감자의 모든 E.G.O를 한 곳에서 검색하고 필터링하세요. 등급, 죄악, 키워드별 필터 지원.',
    alternates: localeAlternates(lang, '/sinners/ego'),
    openGraph: {
      title: 'E.G.O 전체 목록 | 최애의 관리자',
      description: '모든 E.G.O를 등급, 죄악 속성으로 크로스 필터링하세요.',
    },
  }
}

export default async function EGOBrowsePage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.ego, CACHE_TAGS.gameData)
  const { lang } = await params
  const [egos, sinners] = await Promise.all([
    getAllEGOsForBrowser(),
    getSinners(),
  ])

  const egoListLd = itemListJsonLd({
    name: '림버스 컴퍼니 E.G.O 전체 목록',
    description: '12인 수감자의 모든 E.G.O — 등급, 죄악별 필터',
    url: localeUrl(lang, '/sinners/ego'),
    items: egos.slice(0, 50).map((e, i) => ({
      name: e.name_kr || e.name,
      url: localeUrl(lang, `/sinners/${e.sinner_slug}/ego/${e.id}`),
      position: i + 1,
    })),
  })

  return (
    <>
      <JsonLd data={egoListLd} />
      <Suspense fallback={null}>
        <EGOBrowserClient egos={egos} sinners={sinners} />
      </Suspense>
    </>
  )
}
