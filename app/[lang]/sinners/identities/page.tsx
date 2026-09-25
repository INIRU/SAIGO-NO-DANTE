import type { Metadata } from 'next'
import { localeAlternates, localeUrl } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getAllIdentitiesForBrowser, getSinners } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import IdentityBrowserClient from './IdentityBrowserClient'
import JsonLd, { itemListJsonLd } from '@/components/seo/JsonLd'

const TITLE = { ko: '림버스 컴퍼니 인격 도감 — 전체 인격 목록', en: 'Limbus Company Identity List', ja: 'リンバスカンパニー 人格一覧' }

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return {
    title: TITLE[lang as keyof typeof TITLE] ?? TITLE.ko,
    description: '림버스 컴퍼니 12인 수감자의 모든 인격을 한 곳에서 검색하고 필터링하세요. 키워드, 죄악, 공격유형, 등급별 필터 지원.',
    alternates: localeAlternates(lang, '/sinners/identities'),
    openGraph: {
      title: '인격 전체 목록 | 최애의 관리자',
      description: '200+ 인격을 키워드, 죄악, 공격유형으로 크로스 필터링하세요.',
    },
  }
}

export default async function IdentitiesPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.identities, CACHE_TAGS.gameData)
  const { lang } = await params
  const [identities, sinners] = await Promise.all([
    getAllIdentitiesForBrowser(),
    getSinners(),
  ])

  const identityListLd = itemListJsonLd({
    name: '림버스 컴퍼니 인격 전체 목록',
    description: '12인 수감자의 모든 인격 — 키워드, 죄악, 공격유형별 필터',
    url: localeUrl(lang, '/sinners/identities'),
    items: identities.slice(0, 50).map((id, i) => ({
      name: id.name_kr || id.name,
      url: localeUrl(lang, `/sinners/${id.sinner_slug}/identities/${id.id}`),
      position: i + 1,
    })),
  })

  return (
    <>
      <JsonLd data={identityListLd} />
      <Suspense fallback={null}>
        <IdentityBrowserClient identities={identities} sinners={sinners} />
      </Suspense>
    </>
  )
}
