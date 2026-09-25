import type { Metadata } from 'next'
import { localeAlternates, localeUrl } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getAllEGOsForBrowser, getSinners } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import EGOBrowserClient from './EGOBrowserClient'
import JsonLd, { itemListJsonLd } from '@/components/seo/JsonLd'
import { getTranslations } from 'next-intl/server'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

const TITLE = { ko: '림버스 컴퍼니 E.G.O 도감 — 전체 E.G.O 목록', en: 'Limbus Company E.G.O List', ja: 'リンバスカンパニー E.G.O一覧' }

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'browser.meta' })
  return {
    title: TITLE[lang as keyof typeof TITLE] ?? TITLE.ko,
    description: t('egoDescription'),
    alternates: localeAlternates(lang, '/sinners/ego'),
    openGraph: {
      title: t('egoOgTitle'),
      description: t('egoOgDescription'),
    },
  }
}

export default async function EGOBrowsePage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.ego, CACHE_TAGS.gameData)
  const { lang } = await params
  const [egos, sinners, t] = await Promise.all([
    getAllEGOsForBrowser(),
    getSinners(),
    getTranslations({ locale: lang, namespace: 'browser' }),
  ])

  const egoListLd = itemListJsonLd({
    name: t('meta.egoListName'),
    description: t('meta.egoOgDescription'),
    url: localeUrl(lang, '/sinners/ego'),
    items: egos.slice(0, 50).map((e, i) => ({
      name: getLocalizedName({ name_kr: e.name_kr || e.name, name_en: e.name_en, name_jp: e.name_jp }, lang as SupportedLang),
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
