import type { Metadata } from 'next'
import { localeAlternates, localeUrl } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getAllIdentitiesForBrowser, getSinners } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import IdentityBrowserClient from './IdentityBrowserClient'
import JsonLd, { itemListJsonLd } from '@/components/seo/JsonLd'
import { getTranslations } from 'next-intl/server'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

const TITLE = { ko: '림버스 컴퍼니 인격 도감 — 전체 인격 목록', en: 'Limbus Company Identity List', ja: 'リンバスカンパニー 人格一覧' }

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'browser.meta' })
  return {
    title: TITLE[lang as keyof typeof TITLE] ?? TITLE.ko,
    description: t('identitiesDescription'),
    alternates: localeAlternates(lang, '/sinners/identities'),
    openGraph: {
      title: t('identitiesOgTitle'),
      description: t('identitiesOgDescription'),
    },
  }
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
        <IdentityBrowserClient identities={identities} sinners={sinners} />
      </Suspense>
    </>
  )
}
