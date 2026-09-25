import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo/metadata'
import { getLocalizedName } from '@/lib/i18n/localize'
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
  if (!UUID_RE.test(egoId)) return { title: 'EGO를 찾을 수 없습니다', robots: { index: false } }
  cacheTag(CACHE_TAGS.egoEntry(egoId), CACHE_TAGS.ego, CACHE_TAGS.gameData, CACHE_TAGS.sinner(slug))
  const [sinner, ego] = await Promise.all([getSinnerById(slug), getEGOById(egoId)])
  if (!sinner || !ego) return { title: 'EGO를 찾을 수 없습니다', robots: { index: false } }

  const sinStr = ego.sin_affinity ?? ''
  const description = `${sinner.name_kr} ${ego.name_kr ?? ego.name} — ${ego.grade} 등급${sinStr ? `, ${sinStr} 속성` : ''} EGO. 스킬, 패시브, 내성 정보.`
  const canonical = absoluteUrl(`/${lang}/sinners/${slug}/ego/${egoId}`)
  const ogImage = absoluteUrl(`/${lang}/sinners/${slug}/ego/${egoId}/opengraph-image`)
  const egoName = getLocalizedName({ ...ego, name_kr: ego.name_kr ?? ego.name }, lang)
  const sinnerName = getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)

  return {
    title: `${egoName} — ${sinnerName} E.G.O`,
    description,
    alternates: localeAlternates(lang, `/sinners/${slug}/ego/${egoId}`),
    openGraph: {
      title: `${ego.name_kr ?? ego.name} — ${sinner.name_kr} | 최애의 관리자`,
      description,
      url: canonical,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${ego.name_kr ?? ego.name} — ${sinner.name_kr}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${ego.name_kr ?? ego.name} — ${sinner.name_kr} | 최애의 관리자`,
      description,
      images: [ogImage],
    },
  }
}

export default async function EGODetailPage({ params }: { params: Promise<{ slug: string; egoId: string }> }) {
  'use cache'
  cacheLife('max')
  const { slug, egoId } = await params
  cacheTag(CACHE_TAGS.egoEntry(egoId), CACHE_TAGS.ego, CACHE_TAGS.gameData)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(egoId)) notFound()
  const [sinner, ego] = await Promise.all([getSinnerById(slug), getEGOById(egoId)])
  if (!sinner || !ego) notFound()
  return (
    <Suspense fallback={null}>
      <EGODetailClient sinner={sinner} ego={ego} />
    </Suspense>
  )
}
