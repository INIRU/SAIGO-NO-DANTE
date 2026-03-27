import type { Metadata } from 'next'
import { getAllEGOsForBrowser, getSinners } from '@/lib/db/queries'
import EGOBrowserClient from './EGOBrowserClient'
import JsonLd, { itemListJsonLd } from '@/components/seo/JsonLd'

export const revalidate = 300 // 5분 캐시

const SITE_URL = 'https://saigo-no-dante.com'

export const metadata: Metadata = {
  title: 'E.G.O 전체 목록 — 림버스 컴퍼니',
  description: '림버스 컴퍼니 12인 수감자의 모든 E.G.O를 한 곳에서 검색하고 필터링하세요. 등급, 죄악, 키워드별 필터 지원.',
  alternates: { canonical: `${SITE_URL}/sinners/ego` },
  openGraph: {
    title: 'E.G.O 전체 목록 | 최애의 관리자',
    description: '모든 E.G.O를 등급, 죄악 속성으로 크로스 필터링하세요.',
  },
}

export default async function EGOBrowsePage() {
  const [egos, sinners] = await Promise.all([
    getAllEGOsForBrowser(),
    getSinners(),
  ])

  const egoListLd = itemListJsonLd({
    name: '림버스 컴퍼니 E.G.O 전체 목록',
    description: '12인 수감자의 모든 E.G.O — 등급, 죄악별 필터',
    url: `${SITE_URL}/sinners/ego`,
    items: egos.slice(0, 50).map((e, i) => ({
      name: e.name_kr || e.name,
      url: `${SITE_URL}/sinners/${e.sinner_slug}/ego/${e.id}`,
      position: i + 1,
    })),
  })

  return (
    <>
      <JsonLd data={egoListLd} />
      <EGOBrowserClient egos={egos} sinners={sinners} />
    </>
  )
}
