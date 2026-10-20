import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getSinnerById, getIdentityById, getSkills, getPassives, getSanityConditions, getPanicInfo, isRowId } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { STORAGE_BASE } from '@/lib/constants/game'
import { identitySpine, type IdentitySpine, type SpineManifest, type SpinePack, type SpinePackKind } from '@/lib/spine/pack'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIdentityInfoUrl, getIdentityProfileUrl } from '@/lib/utils/images'
import dynamic from 'next/dynamic'
const IdentityDetailClient = dynamic(() => import('./IdentityDetailClient'))
import JsonLd, { breadcrumbJsonLd, gameCharacterJsonLd } from '@/components/seo/JsonLd'
import { getLocalizedName, getLocalizedKeywordName } from '@/lib/i18n/localize'
import { getIdentityRecommendations } from '@/lib/discovery/identity-recommendations'
import IdentityRecommendations from '@/components/identity/IdentityRecommendations'
import { IdentityRecommendationsSkeleton } from '@/components/deck-detail/RecommendationSkeleton'
import { getKeywordData } from '@/lib/keywords/server-data'
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
  const [sinner, identity, t, keywordData] = await Promise.all([
    getSinnerById(slug),
    getIdentityById(id),
    getTranslations({ locale: lang }),
    getKeywordData(),
  ])
  if (!sinner || !identity) return { title: t('identity.notFound'), robots: { index: false } }

  const sinnerName = getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)
  const identityName = getLocalizedName(identity, lang)
  const rarityStr = identity.rarity === 3 ? t('identity.rarity.3') : identity.rarity === 2 ? t('identity.rarity.2') : t('identity.rarity.1')
  const keywordsStr = identity.keywords?.length ? identity.keywords.slice(0, 3).map(kw => getLocalizedKeywordName(kw, keywordData[kw], lang)).join(', ') : ''
  const descSuffix = t('identity.meta.description')
  const description = `${sinnerName} ${identityName} — ${rarityStr}${keywordsStr ? `, ${keywordsStr}` : ''}. ${descSuffix}.`
  const path = `/sinners/${slug}/identities/${id}`

  return pageMetadata({
    lang,
    path,
    title: `${identityName} ${sinnerName} — ${{ ko: '림버스 컴퍼니 인격 스킬·패시브', en: 'Limbus Company Identity Skills & Passives', ja: 'リンバスカンパニー 人格スキル・パッシブ' }[lang]}`,
    description,
    type: 'article',
    image: { url: absoluteUrl(`/${lang}${path}/opengraph-image`), width: 1200, height: 630, alt: `${identityName} — ${sinnerName}` },
  })
}

/**
 * Everything the page shows for one identity, cached until a game data sync (the tags) replaces it. Reads that do not
 * depend on each other run together; only the panic type waits for the identity.
 */
async function getIdentityPageData(slug: string, id: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.sinner(slug), CACHE_TAGS.identities, CACHE_TAGS.gameData)
  if (!isRowId(id)) return null
  const [sinner, identity, skills, passives, sanityConditions] = await Promise.all([
    getSinnerById(slug),
    getIdentityById(id),
    getSkills(id),
    getPassives(id),
    getSanityConditions(id),
  ])
  if (!sinner || !identity) return null
  const panicInfo = identity.panic_type ? await getPanicInfo(identity.panic_type) : null
  return { sinner, identity, skills, passives, sanityConditions, panicInfo }
}

/**
 * One Spine pack from Storage. spine/manifest.json names the current pack file; the extractor replaces it after an
 * upload and clears the game data tag. A failed read throws, so it is not cached.
 */
async function getSpinePack(kind: SpinePackKind): Promise<SpinePack | null> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData)
  const read = async <T,>(path: string): Promise<T> => {
    const response = await fetch(`${STORAGE_BASE}/spine/${path}`)
    if (!response.ok) throw new Error(`spine/${path}: ${response.status}`)
    return response.json()
  }
  const file = (await read<SpineManifest>('manifest.json')).packs[kind]
  return file ? read<SpinePack>(file) : null
}

/** What one identity has in a pack (its SD figure, or its uptie illustration), cut out so the page does not carry the whole pack. */
async function getIdentitySpine(kind: SpinePackKind, gameId: string | null | undefined): Promise<IdentitySpine | null> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData)
  return identitySpine(await getSpinePack(kind), gameId)
}

/** The season set in app_config (not game data, so it is re-read hourly rather than on sync). */
async function getCurrentSeason(): Promise<number> {
  'use cache'
  cacheLife('page-1h')
  const { data, error } = await createAdminClient()
    .schema('limbus').from('app_config').select('value')
    .eq('key', 'current_season').maybeSingle()
  if (error) throw error
  return data?.value?.season ?? 7
}

/** Companions and popular posts, streamed after the page: a failed or sparse count leaves the section out. */
async function Recommendations({ id }: { id: string }) {
  const recommendations = await getIdentityRecommendations(id).catch(error => {
    console.error('Failed to fetch identity recommendations:', error)
    return null
  })
  return recommendations && <IdentityRecommendations {...recommendations} />
}

export default async function IdentityPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; id: string }>
}) {
  const { lang: rawLang, slug, id } = await params
  const lang = (['ko', 'en', 'ja'].includes(rawLang) ? rawLang : 'ko') as SupportedLang
  setRequestLocale(lang)
  const [data, currentSeason, t] = await Promise.all([
    getIdentityPageData(slug, id),
    getCurrentSeason().catch(error => {
      console.error('Failed to fetch current season:', error)
      return 7
    }),
    getTranslations({ locale: lang }),
  ])
  if (!data) notFound()
  const { sinner, identity, skills, passives, sanityConditions, panicInfo } = data
  // The skeletons are extras: when Storage cannot be read the page still renders, without them.
  const [sd, illust] = await Promise.all((['idle', 'illust'] as const).map(kind => getIdentitySpine(kind, identity.game_id).catch(error => {
    console.error(`Failed to fetch ${kind} spine:`, error)
    return null
  })))

  const canonical = `${SITE_URL}/${lang}/sinners/${slug}/identities/${id}`
  const identityImageUrl = getIdentityInfoUrl(identity) || getIdentityProfileUrl(identity)
  const sinnerName = getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)
  const identityName = getLocalizedName(identity, lang)

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([
        { name: t('nav.home'), url: `${SITE_URL}/${lang}` },
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
          siteUrl: `${SITE_URL}/${lang}`,
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
          currentSeason={currentSeason}
          sd={sd}
          illust={illust}
          recommendations={<Suspense key="recommendations" fallback={<IdentityRecommendationsSkeleton />}><Recommendations id={id} /></Suspense>}
        />
      </Suspense>
    </>
  )
}
