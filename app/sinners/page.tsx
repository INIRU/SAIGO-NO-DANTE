import type { Metadata } from 'next'
import { getSinners } from '@/lib/db/queries'
import SinnersClient from './SinnersClient'
import JsonLd, { itemListJsonLd } from '@/components/seo/JsonLd'

const SITE_URL = 'https://saigo-no-dante.com'

export const metadata: Metadata = {
  title: '수감자 목록 — 림버스 컴퍼니 12인',
  description: 'Limbus Company 12인 수감자 — 이상, 파우스트, 돈키호테, 료슈, 뫼르소, 홍루, 히스클리프, 이스마엘, 로쟈, 싱클레어, 오티스, 그레고르의 모든 인격과 EGO 정보.',
  alternates: { canonical: `${SITE_URL}/sinners` },
  openGraph: {
    title: '수감자 목록 | 최애의 관리자',
    description: '12인 수감자의 인격, EGO, 스킬 데이터를 한 곳에서 확인하세요.',
  },
}

export default async function SinnersPage() {
  const sinners = await getSinners()

  const sinnerListLd = itemListJsonLd({
    name: '림버스 컴퍼니 수감자 목록',
    description: 'Limbus Company 12인 수감자 — 인격, EGO, 스킬 데이터',
    url: `${SITE_URL}/sinners`,
    items: sinners.map((s, i) => ({
      name: s.name_kr ?? s.name,
      url: `${SITE_URL}/sinners/${s.id}`,
      position: i + 1,
    })),
  })

  return (
    <>
      <JsonLd data={sinnerListLd} />
      <SinnersClient sinners={sinners} />
    </>
  )
}
