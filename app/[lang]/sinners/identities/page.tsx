import type { Metadata } from 'next'
import { localeUrl, pageMetadata, seoLang } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getAllIdentitiesForBrowser, getSinners } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import IdentityBrowserClient from '@/app/[lang]/sinners/identities/_components/IdentityBrowserClient'
import JsonLd, { itemListJsonLd } from '@/components/seo/JsonLd'
import { getTranslations } from 'next-intl/server'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import StaticQueryAdapter from '@/components/providers/StaticQueryAdapter'
import BrowserSkeleton from '@/features/catalog/components/BrowserSkeleton'

const TITLE = { ko: '림버스 인격 도감 — 전체 인격 목록·스킬·키워드', en: 'Limbus Company Identity List — Skills & Keywords', ja: 'リンバスカンパニー 人格一覧 — スキル・キーワード' }

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'browser.meta' })
  return pageMetadata({
    lang,
    path: '/sinners/identities',
    title: TITLE[seoLang(lang)],
    description: t('identitiesDescription'),
    ogTitle: t('identitiesOgTitle'),
    ogDescription: t('identitiesOgDescription'),
  })
}

export default async function IdentitiesPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.identities, CACHE_TAGS.gameData)
  const { lang } = await params
  const [identities, sinners, t] = await Promise.all([
    getAllIdentitiesForBrowser(),
    getSinners(),
    getTranslations({ locale: lang, namespace: 'browser' }),
  ])

  const identityListLd = itemListJsonLd({
    name: t('meta.identitiesListName'),
    description: t('meta.identitiesOgDescription'),
    url: localeUrl(lang, '/sinners/identities'),
    items: identities.slice(0, 50).map((id, i) => ({
      name: getLocalizedName({ name_kr: id.name_kr || id.name, name_en: id.name_en, name_jp: id.name_jp }, lang as SupportedLang),
      url: localeUrl(lang, `/sinners/${id.sinner_slug}/identities/${id.id}`),
      position: i + 1,
    })),
  })

  return (
    <>
      <JsonLd data={identityListLd} />
      <Suspense fallback={null}>
        <StaticQueryAdapter fallback={<BrowserSkeleton />}>
          <IdentityBrowserClient identities={identities} sinners={sinners} />
        </StaticQueryAdapter>
      </Suspense>
    </>
  )
}
