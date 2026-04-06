import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { getAllIdentitiesForBrowser, getSinners } from '@/lib/db/queries'
import IdentityBrowserClient from './IdentityBrowserClient'
import JsonLd, { itemListJsonLd } from '@/components/seo/JsonLd'

const SITE_URL = 'https://saigo-no-dante.com'

export const metadata: Metadata = {
  title: '인격 전체 목록 — 림버스 컴퍼니',
  description: '림버스 컴퍼니 12인 수감자의 모든 인격을 한 곳에서 검색하고 필터링하세요. 키워드, 죄악, 공격유형, 등급별 필터 지원.',
  alternates: { canonical: `${SITE_URL}/sinners/identities` },
  openGraph: {
    title: '인격 전체 목록 | 최애의 관리자',
    description: '200+ 인격을 키워드, 죄악, 공격유형으로 크로스 필터링하세요.',
  },
}

export default async function IdentitiesPage() {
  'use cache'
  cacheLife('page-5m')
  const [identities, sinners] = await Promise.all([
    getAllIdentitiesForBrowser(),
    getSinners(),
  ])

  const identityListLd = itemListJsonLd({
    name: '림버스 컴퍼니 인격 전체 목록',
    description: '12인 수감자의 모든 인격 — 키워드, 죄악, 공격유형별 필터',
    url: `${SITE_URL}/sinners/identities`,
    items: identities.slice(0, 50).map((id, i) => ({
      name: id.name_kr || id.name,
      url: `${SITE_URL}/sinners/${id.sinner_slug}/identities/${id.id}`,
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
