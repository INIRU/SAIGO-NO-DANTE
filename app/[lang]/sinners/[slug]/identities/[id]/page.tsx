import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getSinnerById, getIdentityById, getSkills, getPassives, getIdentities, getEGOs, getSinners, getEgoGiftsForNotes, getSanityConditions, getPanicInfo } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIdentityInfoUrl, getIdentityProfileUrl } from '@/lib/utils/images'
import dynamic from 'next/dynamic'
const IdentityDetailClient = dynamic(() => import('./IdentityDetailClient'))
import JsonLd, { breadcrumbJsonLd, gameCharacterJsonLd } from '@/components/seo/JsonLd'
import { getLocalizedName } from '@/lib/i18n/localize'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { SupportedLang } from '@/lib/i18n/types'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigo-no-dante.com'
function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string; id: string }>
}): Promise<Metadata> {
  'use cache'
  cacheLife('max')
  const { lang: rawLang, slug, id } = await params
  const lang = (['ko', 'en', 'ja'].includes(rawLang) ? rawLang : 'ko') as SupportedLang
  cacheTag(CACHE_TAGS.sinner(slug), CACHE_TAGS.identities, CACHE_TAGS.gameData)
  const [sinner, identity, t] = await Promise.all([
    getSinnerById(slug),
    getIdentityById(id),
    getTranslations({ locale: lang }),
  ])
  if (!sinner || !identity) return { title: t('identity.notFound'), robots: { index: false } }

  const sinnerName = getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)
  const identityName = getLocalizedName(identity, lang)
  const rarityStr = identity.rarity === 3 ? t('identity.rarity.3') : identity.rarity === 2 ? t('identity.rarity.2') : t('identity.rarity.1')
  const keywordsStr = identity.keywords?.length ? identity.keywords.slice(0, 3).join(', ') : ''
  const descSuffix = t('identity.meta.description')
  const description = `${sinnerName} ${identityName} — ${rarityStr}${keywordsStr ? `, ${keywordsStr}` : ''}. ${descSuffix}.`
  const canonical = `${SITE_URL}/${lang}/sinners/${slug}/identities/${id}`
  const ogImage = absoluteUrl(`/${lang}/sinners/${slug}/identities/${id}/opengraph-image`)
  const pageTitle = `${identityName} | ${sinnerName} | SAIGO NO DANTE`

  return {
    title: { absolute: pageTitle },
    description,
    alternates: { canonical },
    openGraph: {
      title: pageTitle,
      description,
      url: canonical,
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${identityName} — ${sinnerName}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: [ogImage],
    },
  }
}

export default async function IdentityPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; id: string }>
}) {
  const { lang: rawLang, slug, id } = await params
  const lang = (['ko', 'en', 'ja'].includes(rawLang) ? rawLang : 'ko') as SupportedLang
  const [sinner, identity] = await Promise.all([
    getSinnerById(slug),
    getIdentityById(id),
  ])
  if (!sinner || !identity) notFound()

  const [skills, passives, session, allSinners, allIdentities, allEgos, egoGifts, currentSeason, sanityConditions, panicInfo] = await Promise.all([
    getSkills(identity.id),
    getPassives(identity.id),
    getServerSession(authOptions),
    getSinners(),
    getIdentities(),
    getEGOs(),
    getEgoGiftsForNotes(),
    (async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .schema('limbus').from('app_config').select('value')
        .eq('key', 'current_season').single()
      if (error) console.error('Failed to fetch current season:', error)
      return data?.value?.season ?? 7
    })(),
    getSanityConditions(identity.id),
    identity.panic_type ? getPanicInfo(identity.panic_type) : Promise.resolve(null),
  ])

  // 운영법 조회 (여러 개)
  let guides: { id: string; title: string; content: string; author_name: string | null; updated_at: string }[] = []
  try {
    const admin = createAdminClient()
    const { data, error: guidesError } = await admin
      .schema('limbus')
      .from('identity_guides')
      .select('id, title, content, updated_at, author_id')
      .eq('identity_id', identity.id)
      .eq('lang', lang)
      .order('created_at', { ascending: true })
    if (guidesError) console.error('Failed to fetch identity guides:', guidesError)
    if (data && data.length > 0) {
      const authorIds = [...new Set(data.map(g => g.author_id))]
      const { data: profiles } = await admin
        .schema('limbus')
        .from('profiles')
        .select('id, username')
        .in('id', authorIds)
      const profileMap = new Map(profiles?.map(p => [p.id, p.username]) ?? [])
      guides = data.map(g => ({
        id: g.id,
        title: g.title,
        content: g.content,
        author_name: profileMap.get(g.author_id) ?? null,
        updated_at: g.updated_at,
      }))
    }
  } catch { /* guide fetch failed, continue without it */ }

  setRequestLocale(lang)
  const t = await getTranslations()
  const canonical = `${SITE_URL}/${lang}/sinners/${slug}/identities/${id}`
  const identityImageUrl = getIdentityInfoUrl(identity) || getIdentityProfileUrl(identity)
  const sinnerName = getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)
  const identityName = getLocalizedName(identity, lang)

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([
        { name: t('nav.home'), url: SITE_URL },
        { name: t('nav.sinners'), url: `${SITE_URL}/${lang}/sinners` },
        { name: sinnerName, url: `${SITE_URL}/${lang}/sinners/${slug}` },
        { name: identityName, url: canonical },
      ])} />
      {identityImageUrl && (
        <JsonLd data={gameCharacterJsonLd({
          name: `${identityName} — ${sinnerName}`,
          description: `${sinnerName} ${identityName}. Limbus Company.`,
          image: identityImageUrl,
          url: canonical,
          siteUrl: SITE_URL,
        })} />
      )}
      <Suspense fallback={null}>
        <IdentityDetailClient
          sinner={sinner}
          identity={identity}
          skills={skills}
          passives={passives}
          sanityConditions={sanityConditions}
          panicInfo={panicInfo}
          guides={guides}
          allSinners={allSinners}
          allIdentities={allIdentities}
          allEgos={allEgos}
          egoGifts={egoGifts}
          canEditGuide={session?.user?.isWanjang === true || session?.user?.isAdmin === true}
          isAdmin={!!session?.user?.isAdmin}
          isLoggedIn={!!session}
          currentSeason={currentSeason}
        />
      </Suspense>
    </>
  )
}
