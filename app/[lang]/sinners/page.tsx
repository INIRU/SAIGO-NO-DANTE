import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getSinners } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import SinnersInteractive from './SinnersInteractive'
import SinnerCard from '@/components/sinners/SinnerCard'
import JsonLd, { itemListJsonLd } from '@/components/seo/JsonLd'
import { getLocale, setRequestLocale } from 'next-intl/server'
import type { SupportedLang } from '@/lib/i18n/types'
import { translations } from '@/lib/i18n/translations'

const SITE_URL = 'https://saigo-no-dante.com'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang as SupportedLang] ?? entry['ko'] ?? key
  }
  return {
    title: t('sinners.meta.title'),
    description: t('sinners.meta.description'),
    alternates: { canonical: `${SITE_URL}/sinners` },
    openGraph: {
      title: t('sinners.meta.ogTitle'),
      description: t('sinners.meta.ogDescription'),
    },
  }
}

async function getCachedSinners() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.sinners, CACHE_TAGS.gameData)
  return getSinners()
}

export default async function SinnersPage() {
  const locale = await getLocale()
  setRequestLocale(locale)
  const lang = locale as SupportedLang
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
                <SinnerCard sinner={sinner} index={i} priority={i < 6} />
              </div>
            ))}
          </div>
        </SinnersInteractive>
      </Suspense>
    </>
  )
}
