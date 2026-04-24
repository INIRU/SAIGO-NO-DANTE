import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getSinnerById } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { createAdminClient } from '@/lib/supabase/admin'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
const SinnerDetailClient = dynamic(() => import('./SinnerDetailClient'))
import JsonLd, { breadcrumbJsonLd, gameCharacterJsonLd } from '@/components/seo/JsonLd'
import { getSinnerProfileUrl } from '@/lib/utils/images'
import type { Identity, EGO } from '@/lib/types'
import { getLocale, setRequestLocale } from 'next-intl/server'
import type { SupportedLang } from '@/lib/i18n/types'

export function generateStaticParams() {
  return SINNER_SLUGS.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const sinner = await getSinnerById(slug)
  if (!sinner) return { title: '수감자를 찾을 수 없습니다', robots: { index: false } }
  const siteUrl = 'https://saigo-no-dante.com'
  return {
    title: `${sinner.name_kr} (${sinner.name})`,
    description: `${sinner.name_kr}의 모든 인격과 EGO — ${sinner.description ?? `Limbus Company ${sinner.name_kr} 수감자 정보`}`,
    alternates: { canonical: `${siteUrl}/sinners/${slug}` },
    openGraph: {
      title: `${sinner.name_kr} | 최애의 관리자`,
      description: `${sinner.name_kr}의 인격, EGO, 스킬 데이터를 확인하세요.`,
    },
  }
}

async function getCachedSinnerData(slug: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.sinner(slug), CACHE_TAGS.sinners, CACHE_TAGS.gameData)
  const supabase = createAdminClient()

  const [sinner, identitiesRes, egosRes] = await Promise.all([
    getSinnerById(slug),
    supabase
      .schema('limbus')
      .from('identities')
      .select('id, sinner_id, name, name_kr, name_en, name_jp, rarity, hp, speed_min, speed_max, def_level, keywords, affiliation, folder_name, game_id')
      .eq('sinner_id', slug)
      .order('rarity')
      .order('name'),
    supabase
      .schema('limbus')
      .from('ego')
      .select('id, sinner_id, name, name_kr, name_en, name_jp, grade, sin_affinity, image_url')
      .eq('sinner_id', slug)
      .order('grade')
      .order('name'),
  ])

  return { sinner, identities: (identitiesRes.data ?? []) as unknown as Identity[], egos: (egosRes.data ?? []) as unknown as EGO[] }
}

export default async function SinnerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const locale = await getLocale()
  setRequestLocale(locale)
  const lang = locale as SupportedLang
  const { sinner, identities, egos } = await getCachedSinnerData(slug)
  if (!sinner) notFound()

  const siteUrl = 'https://saigo-no-dante.com'
  const profileUrl = getSinnerProfileUrl(sinner.id)

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([
        { name: '홈', url: siteUrl },
        { name: '수감자', url: `${siteUrl}/sinners` },
        { name: sinner.name_kr, url: `${siteUrl}/sinners/${slug}` },
      ])} />
      {profileUrl && (
        <JsonLd data={gameCharacterJsonLd({
          name: `${sinner.name_kr} (${sinner.name})`,
          description: sinner.description ?? `Limbus Company 수감자 ${sinner.name_kr}`,
          image: profileUrl,
          url: `${siteUrl}/sinners/${slug}`,
          siteUrl,
        })} />
      )}
      <Suspense fallback={null}>
        <SinnerDetailClient sinner={sinner} identities={identities} egos={egos} />
      </Suspense>
    </>
  )
}
