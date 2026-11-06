import type { Metadata } from 'next'
import { localeUrl, metaText, pageMetadata } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getSinners } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import SinnersInteractive from './SinnersInteractive'
import SinnerLineup from '@/components/sinners/SinnerLineup'
import JsonLd, { itemListJsonLd } from '@/components/seo/JsonLd'
import { setRequestLocale } from 'next-intl/server'
import type { SupportedLang } from '@/lib/i18n/types'
import { translations } from '@/lib/i18n/translations'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return pageMetadata({
    lang,
    path: '/sinners',
    title: metaText('sinners.meta.title', lang),
    description: metaText('sinners.meta.description', lang),
    ogTitle: metaText('sinners.meta.ogTitle', lang),
    ogDescription: metaText('sinners.meta.ogDescription', lang),
  })
}

async function getCachedSinners() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.sinners, CACHE_TAGS.gameData)
  return getSinners()
}

export default async function SinnersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: locale } = await params
  setRequestLocale(locale)
  const lang = locale as SupportedLang
  const sinners = await getCachedSinners()

  const sinnerListLd = itemListJsonLd({
    name: translations['sinners.meta.ogTitle'][lang],
    description: translations['sinners.meta.ogDescription'][lang],
    url: localeUrl(lang, '/sinners'),
    items: sinners.map((s, i) => ({
      name: translations[`sinner.${s.id}` as keyof typeof translations]?.[lang] ?? s.name_kr ?? s.name,
      url: localeUrl(lang, `/sinners/${s.id}`),
      position: i + 1,
    })),
  })

  return (
    <>
      <JsonLd data={sinnerListLd} />
      <Suspense fallback={null}>
        <SinnersInteractive>
          <SinnerLineup sinners={sinners} />
        </SinnersInteractive>
      </Suspense>
    </>
  )
}
