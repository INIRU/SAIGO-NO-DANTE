import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { getSinners } from '@/lib/db/queries'
import SinnersInteractive from './SinnersInteractive'
import SinnerCard from '@/components/sinners/SinnerCard'
import JsonLd, { itemListJsonLd } from '@/components/seo/JsonLd'
import { getServerLang } from '@/lib/i18n/server'

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

async function getCachedSinners() {
  'use cache'
  cacheLife('page-5m')
  return getSinners()
}

export default async function SinnersPage() {
  const lang = await getServerLang()
  const sinners = await getCachedSinners()

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
      <Suspense fallback={null}>
        <SinnersInteractive>
          {/* 카드 그리드 — 서버에서 HTML로 렌더링되어 LCP 개선 */}
          <div
            className="sinners-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 relative"
            style={{ zIndex: 1 }}
          >
            {sinners.map((sinner, i) => (
              <div key={sinner.id} className="sinner-card-item">
                <SinnerCard sinner={sinner} index={i} priority={i < 6} lang={lang} />
              </div>
            ))}
          </div>
        </SinnersInteractive>
      </Suspense>
    </>
  )
}
