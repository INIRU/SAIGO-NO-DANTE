import type { Metadata } from 'next'
import { localeAlternates, localeUrl } from '@/lib/seo/metadata'
import { getLocalizedName } from '@/lib/i18n/localize'
import { translations } from '@/lib/i18n/translations'
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
import { setRequestLocale } from 'next-intl/server'
import type { SupportedLang } from '@/lib/i18n/types'

export function generateStaticParams() {
  return SINNER_SLUGS.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  'use cache'
  cacheLife('max')
  const { lang: rawLang, slug } = await params
  const lang: SupportedLang = rawLang === 'en' || rawLang === 'ja' ? rawLang : 'ko'
  cacheTag(CACHE_TAGS.sinner(slug), CACHE_TAGS.sinners, CACHE_TAGS.gameData)
  const sinner = await getSinnerById(slug)
  if (!sinner) return { title: { ko: '수감자를 찾을 수 없습니다', en: 'Sinner not found', ja: '囚人が見つかりません' }[lang], robots: { index: false } }
  const name = getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)
  const desc = translations[`sinnerDetail.desc.${slug}` as keyof typeof translations]?.[lang] ?? sinner.description
  const copy = {
    ko: {
      title: `${sinner.name_kr} 인격·E.G.O 목록 — 림버스 컴퍼니 수감자`,
      description: `${sinner.name_kr}의 모든 인격과 EGO — ${sinner.description ?? `Limbus Company ${sinner.name_kr} 수감자 정보`}`,
      ogTitle: `${sinner.name_kr} | 최애의 관리자`,
      ogDescription: `${sinner.name_kr}의 인격, EGO, 스킬 데이터를 확인하세요.`,
    },
    en: {
      title: `${name} Identities & E.G.O`,
      description: `Every Identity and E.G.O for ${name} in Limbus Company. ${desc ?? ''}`.trim(),
      ogTitle: `${name} | SAIGO NO DANTE`,
      ogDescription: `${name}'s Identities, E.G.O and skill data.`,
    },
    ja: {
      title: `${name} 人格・E.G.O一覧`,
      description: `リンバスカンパニー ${name}の全人格とE.G.O。${desc ?? ''}`,
      ogTitle: `${name} | SAIGO NO DANTE`,
      ogDescription: `${name}の人格、E.G.O、スキルデータ。`,
    },
  }[lang]
  return {
    title: copy.title,
    description: copy.description,
    alternates: localeAlternates(lang, `/sinners/${slug}`),
    openGraph: {
      title: copy.ogTitle,
      description: copy.ogDescription,
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
      .select('id, sinner_id, name, name_kr, name_en, name_jp, rarity, hp, speed_min, speed_max, def_level, keywords, affiliation, association_list, folder_name, game_id')
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

  const identities = ((identitiesRes.data ?? []) as unknown as Identity[]).map(identity => {
    const associations = identity.association_list?.map(item => item.trim()).filter(Boolean) ?? []
    if (associations.length === 0) return identity
    return {
      ...identity,
      affiliation: [identity.affiliation, ...associations].filter(Boolean).join(' '),
    }
  })

  return { sinner, identities, egos: (egosRes.data ?? []) as unknown as EGO[] }
}

export default async function SinnerPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang: locale, slug } = await params
  setRequestLocale(locale)
  const lang = locale as SupportedLang
  const { sinner, identities, egos } = await getCachedSinnerData(slug)
  if (!sinner) notFound()

  const siteUrl = localeUrl(lang)
  const profileUrl = getSinnerProfileUrl(sinner.id)

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([
        { name: translations['nav.home'][lang], url: siteUrl },
        { name: translations['nav.sinners'][lang], url: localeUrl(lang, '/sinners') },
        { name: getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang), url: localeUrl(lang, `/sinners/${slug}`) },
      ])} />
      {profileUrl && (
        <JsonLd data={gameCharacterJsonLd({
          name: `${sinner.name_kr} (${sinner.name})`,
          description: sinner.description ?? `Limbus Company 수감자 ${sinner.name_kr}`,
          image: profileUrl,
          url: localeUrl(lang, `/sinners/${slug}`),
          siteUrl,
        })} />
      )}
      <Suspense fallback={null}>
        <SinnerDetailClient sinner={sinner} identities={identities} egos={egos} />
      </Suspense>
    </>
  )
}
