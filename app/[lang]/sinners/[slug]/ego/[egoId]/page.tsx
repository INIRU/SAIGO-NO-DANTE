import type { Metadata } from 'next'
import { localeUrl, pageMetadata } from '@/lib/seo/metadata'
import { getLocalizedName } from '@/lib/i18n/localize'
import { translations } from '@/lib/i18n/translations'
import JsonLd, { breadcrumbJsonLd } from '@/components/seo/JsonLd'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getSinnerById, getEGOById } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
const EGODetailClient = dynamic(() => import('./EGODetailClient'))

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigo-no-dante.com'
function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString()
}

function isSupportedLang(lang: string): lang is 'ko' | 'en' | 'ja' {
  return lang === 'ko' || lang === 'en' || lang === 'ja'
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string; egoId: string }>
}): Promise<Metadata> {
  'use cache'
  cacheLife('max')
  const { lang: rawLang, slug, egoId } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const notFoundTitle = { ko: 'EGO를 찾을 수 없습니다', en: 'E.G.O not found', ja: 'E.G.Oが見つかりません' }[lang]
  if (!UUID_RE.test(egoId)) return { title: notFoundTitle, robots: { index: false } }
  cacheTag(CACHE_TAGS.egoEntry(egoId), CACHE_TAGS.ego, CACHE_TAGS.gameData, CACHE_TAGS.sinner(slug))
  const [sinner, ego] = await Promise.all([getSinnerById(slug), getEGOById(egoId)])
  if (!sinner || !ego) return { title: notFoundTitle, robots: { index: false } }

  const path = `/sinners/${slug}/ego/${egoId}`
  const egoName = getLocalizedName({ ...ego, name_kr: ego.name_kr }, lang)
  const sinnerName = getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)
  const sinStr = ego.sin_affinity ?? ''
  const description = {
    ko: `${sinner.name_kr} ${ego.name_kr} — ${ego.grade} 등급${sinStr ? `, ${sinStr} 속성` : ''} EGO. 스킬, 패시브, 내성 정보.`,
    en: `${sinnerName} ${egoName} — ${ego.grade} E.G.O${sinStr ? `, ${sinStr} affinity` : ''}. Skills, passives and sin resistances.`,
    ja: `${sinnerName} ${egoName} — ${ego.grade}等級${sinStr ? `・${sinStr}属性` : ''}のE.G.O。スキル、パッシブ、耐性情報。`,
  }[lang]
  const ogTitle = lang === 'ko' ? `${ego.name_kr} — ${sinner.name_kr} | 최애의 관리자` : `${egoName} — ${sinnerName} | SAIGO NO DANTE`

  return pageMetadata({
    lang,
    path,
    title: `${egoName} ${sinnerName} E.G.O — ${{ ko: '림버스 컴퍼니 스킬·내성', en: 'Limbus Company Skills & Resistances', ja: 'リンバスカンパニー スキル・耐性' }[lang]}`,
    description,
    ogTitle,
    image: { url: absoluteUrl(`/${lang}${path}/opengraph-image`), width: 1200, height: 630, alt: `${egoName} — ${sinnerName}` },
  })
}

export default async function EGODetailPage({ params }: { params: Promise<{ lang: string; slug: string; egoId: string }> }) {
  'use cache'
  cacheLife('max')
  const { lang: rawLang, slug, egoId } = await params
  const lang = isSupportedLang(rawLang) ? rawLang : 'ko'
  cacheTag(CACHE_TAGS.egoEntry(egoId), CACHE_TAGS.ego, CACHE_TAGS.gameData)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(egoId)) notFound()
  const [sinner, ego] = await Promise.all([getSinnerById(slug), getEGOById(egoId)])
  if (!sinner || !ego) notFound()
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([
        { name: translations['nav.home'][lang], url: localeUrl(lang) },
        { name: translations['nav.sinners'][lang], url: localeUrl(lang, '/sinners') },
        { name: getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang), url: localeUrl(lang, `/sinners/${slug}`) },
        { name: getLocalizedName({ ...ego, name_kr: ego.name_kr }, lang), url: localeUrl(lang, `/sinners/${slug}/ego/${egoId}`) },
      ])} />
      <Suspense fallback={null}>
        <EGODetailClient sinner={sinner} ego={ego} />
      </Suspense>
    </>
  )
}
