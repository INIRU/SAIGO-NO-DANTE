import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { TIERS, createEmptyTiers, deriveTier, MIN_RATINGS_FOR_TIER, type Tier } from '@/lib/tier-list/tierModel'
import TierListInteractive from './TierListInteractive'
import type { TierIdentity } from './TierCardInteractive'
import type { RatingPeriod, TierRatingViewer } from './TierRatingModal'

export const metadata: Metadata = {
  title: '인격 티어표 | SAIGO NO DANTE',
  description: '림버스 컴퍼니 인격 티어표에서 종합, 리세, 굿스터프, 거울 던전 기준의 커뮤니티 평가와 S+/S/A/B/C/N/A 등급을 확인하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/tier-list' },
  openGraph: {
    title: '인격 티어표 | 최애의 관리자',
    description: '림버스 컴퍼니 인격 티어표에서 종합, 리세, 굿스터프, 거울 던전 기준의 커뮤니티 평가와 등급을 확인하세요.',
  },
}
const CATEGORIES = ['overall', 'reroll', 'goodstuff', 'mirror_dungeon'] as const
type TierCategory = typeof CATEGORIES[number]
const RATING_PERIODS = ['7d', '30d', '1y', 'all'] as const
const TIER_DATA_MODEL_VERSION = 'identity-rating-v12-ai-tier-ratings'
const OVERALL_SOURCE_CATEGORIES = ['reroll', 'goodstuff', 'mirror_dungeon'] as const
const MIN_ACCOUNT_AGE_DAYS = 14
type SupportedLocale = 'ko' | 'en' | 'ja'
type TierIdentitySummaryTier = NonNullable<TierIdentity['tier_rating_summary']>['derivedTier']

const HEADER_COPY: Record<SupportedLocale, {
  title: string
  subtitle: string
}> = {
  ko: {
    title: '인격 티어표',
    subtitle: '종합, 리세, 굿스터프, 거울 던전 기준으로 커뮤니티 평가 흐름을 확인하세요.',
  },
  en: {
    title: 'Identity Tier List',
    subtitle: 'Compare community ratings across Overall, Reroll, Goodstuff, and Mirror Dungeon.',
  },
  ja: {
    title: '人格ティア表',
    subtitle: '総合、リセマラ、グッドスタッフ、鏡ダンジョン別にコミュニティ評価を確認できます。',
  },
}

function normalizeLocale(value: string | undefined): SupportedLocale {
  return value === 'en' || value === 'ja' ? value : 'ko'
}

const IDENTITY_SELECT = `
  id,
  sinner_id,
  name,
  name_kr,
  name_en,
  name_jp,
  tier,
  hp,
  speed_min,
  speed_max,
  def_level,
  keywords,
  rarity,
  affiliation,
  quote,
  slash_res,
  pierce_res,
  blunt_res,
  release_date,
  acquisition,
  game_id,
  folder_name,
  panic_type,
  break_section,
  base_hp,
  hp_per_level,
  bg_image_url,
  acquisition_info,
  sinner:sinners(
    id,
    name,
    name_kr,
    name_en,
    name_jp,
    order_num
  )
`

function normalizeCategory(value: string | string[] | undefined): TierCategory {
  const candidate = Array.isArray(value) ? value[0] : value
  return CATEGORIES.includes(candidate as TierCategory) ? candidate as TierCategory : 'overall'
}

function normalizePeriod(value: string | string[] | undefined): RatingPeriod {
  const candidate = Array.isArray(value) ? value[0] : value
  return RATING_PERIODS.includes(candidate as RatingPeriod) ? candidate as RatingPeriod : 'all'
}

function getPeriodStart(period: RatingPeriod): string | null {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '1y' ? 365 : null
  if (!days) return null
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function getPeriodCacheKey(period: RatingPeriod): string {
  if (period === 'all') return 'all'
  return `${period}:${new Date().toISOString().slice(0, 13)}`
}

async function getTierData(category: TierCategory, period: RatingPeriod, locale: SupportedLocale): Promise<Record<Tier, TierIdentity[]>> {
  const supabase = createAdminClient()

  const { data: identities, error: identitiesError } = await supabase
    .schema('limbus')
    .from('identities')
    .select(IDENTITY_SELECT)
    .order('name_kr')

  if (identitiesError) {
    console.error('[TierListPage] identities fetch error:', identitiesError)
    return createEmptyTiers<TierIdentity>()
  }
  if (!identities) return createEmptyTiers<TierIdentity>()

  let ratingsQuery = supabase
    .schema('limbus')
    .from('tier_ratings')
    .select(`
      identity_id,
      category,
      score,
      created_at
    `)
    .in('category', category === 'overall' ? [...OVERALL_SOURCE_CATEGORIES] : [category])
  const periodStart = getPeriodStart(period)
  if (periodStart) {
    ratingsQuery = ratingsQuery.gte('created_at', periodStart)
  }
  const { data: ratingRows, error: ratingsError } = await ratingsQuery

  if (ratingsError) {
    console.error('[TierListPage] ratings fetch error:', ratingsError)
  }

  let aiRatingsQuery = supabase
    .schema('limbus')
    .from('ai_tier_ratings')
    .select(`
      identity_id,
      category,
      score,
      weight,
      created_at
    `)
    .in('category', category === 'overall' ? [...OVERALL_SOURCE_CATEGORIES] : [category])
  if (periodStart) {
    aiRatingsQuery = aiRatingsQuery.gte('created_at', periodStart)
  }
  const { data: aiRatingRows, error: aiRatingsError } = await aiRatingsQuery

  if (aiRatingsError && aiRatingsError.code !== '42P01' && aiRatingsError.code !== 'PGRST205') {
    console.error('[TierListPage] ai ratings fetch error:', aiRatingsError)
  }

  const rows = ratingsError || !ratingRows ? [] : ratingRows as TierRatingRow[]
  const aiRows = aiRatingsError || !aiRatingRows ? [] : aiRatingRows as TierRatingRow[]
  const combinedRows = [...rows, ...aiRows]
  const normalizedIdentities = normalizeIdentities(identities as unknown as RawTierIdentity[])
  return category === 'overall'
    ? groupIdentitiesByOverall(normalizedIdentities, combinedRows, locale)
    : groupIdentitiesByRatings(normalizedIdentities, combinedRows, category, locale)
}

async function getCachedTierData(
  category: TierCategory,
  period: RatingPeriod,
  locale: SupportedLocale,
  periodWindowKey: string,
  dataVersion: string,
): Promise<Record<Tier, TierIdentity[]>> {
  'use cache'
  void periodWindowKey
  void dataVersion
  cacheLife('max')
  cacheTag(CACHE_TAGS.tierList, CACHE_TAGS.gameData)
  return getTierData(category, period, locale)
}

function getAccountAgeDays(createdAt: string | null | undefined): number | null {
  if (!createdAt) return null
  const createdTime = new Date(createdAt).getTime()
  if (!Number.isFinite(createdTime)) return null
  return Math.floor((Date.now() - createdTime) / 86_400_000)
}

async function getInitialTierViewer(): Promise<TierRatingViewer> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return {
      authenticated: false,
      canRate: false,
      reason: 'login_required',
      accountAgeDays: null,
    }
  }

  if (session.user.isSuspended) {
    return {
      authenticated: true,
      canRate: false,
      reason: 'suspended',
      accountAgeDays: null,
    }
  }

  const admin = createAdminClient()
  const userId = await findOrCreateSupabaseUser(admin, session.user.email, session.user.name, session.user.image)
  if (!userId) {
    return {
      authenticated: true,
      canRate: false,
      reason: 'login_required',
      accountAgeDays: null,
    }
  }

  const { data: profile, error } = await admin
    .schema('limbus')
    .from('profiles')
    .select('created_at, suspended')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[TierListPage] viewer profile fetch error:', error)
    return {
      authenticated: true,
      canRate: false,
      reason: 'login_required',
      accountAgeDays: null,
    }
  }

  const accountAgeDays = getAccountAgeDays(profile?.created_at)
  const canRate = profile?.suspended !== true
    && accountAgeDays !== null
    && accountAgeDays >= MIN_ACCOUNT_AGE_DAYS

  return {
    authenticated: true,
    canRate,
    reason: profile?.suspended === true
      ? 'suspended'
      : canRate
        ? 'eligible'
        : 'account_too_new',
    accountAgeDays,
  }
}

type TierRatingRow = {
  identity_id: string
  category: TierCategory
  score: number
  weight?: number
  created_at?: string
}

type RawTierIdentity = Omit<TierIdentity, 'sinner'> & {
  sinner?: TierIdentity['sinner'] | NonNullable<TierIdentity['sinner']>[] | null
}

function normalizeIdentities(identities: RawTierIdentity[]): TierIdentity[] {
  return identities.map(identity => ({
    ...identity,
    name: identity.name ?? identity.name_kr ?? identity.name_en ?? identity.name_jp ?? identity.id,
    name_kr: identity.name_kr ?? identity.name ?? identity.name_en ?? identity.name_jp ?? identity.id,
    name_en: identity.name_en ?? identity.name ?? identity.name_kr ?? identity.name_jp ?? identity.id,
    name_jp: identity.name_jp ?? identity.name ?? identity.name_kr ?? identity.name_en ?? identity.id,
    rarity: identity.rarity === 1 || identity.rarity === 2 || identity.rarity === 3 ? identity.rarity : 1,
    tier: Number.isFinite(identity.tier) ? identity.tier : 0,
    hp: Number.isFinite(identity.hp) ? identity.hp : 0,
    speed_min: Number.isFinite(identity.speed_min) ? identity.speed_min : 0,
    speed_max: Number.isFinite(identity.speed_max) ? identity.speed_max : 0,
    def_level: Number.isFinite(identity.def_level) ? identity.def_level : 0,
    keywords: Array.isArray(identity.keywords) ? identity.keywords.filter((keyword): keyword is string => typeof keyword === 'string') : [],
    break_section: Array.isArray(identity.break_section) ? identity.break_section : [],
    sinner: Array.isArray(identity.sinner) ? identity.sinner[0] ?? null : identity.sinner ?? null,
  }))
}

function getLocalizedIdentityName(identity: TierIdentity, locale: SupportedLocale): string {
  if (locale === 'en') return identity.name_en ?? identity.name ?? identity.name_kr ?? identity.id
  if (locale === 'ja') return identity.name_jp ?? identity.name_kr ?? identity.name ?? identity.id
  return identity.name_kr ?? identity.name ?? identity.name_en ?? identity.name_jp ?? identity.id
}

function sortTierIdentities(tiers: Record<Tier, TierIdentity[]>, locale: SupportedLocale): void {
  for (const tier of TIERS) {
    tiers[tier].sort((a, b) => {
      if (tier !== 'N/A') {
        const scoreDelta = (b.tier_rating_summary?.averageScore ?? -1) - (a.tier_rating_summary?.averageScore ?? -1)
        if (scoreDelta !== 0) return scoreDelta

        const countDelta = (b.tier_rating_summary?.ratingCount ?? 0) - (a.tier_rating_summary?.ratingCount ?? 0)
        if (countDelta !== 0) return countDelta
      }

      return getLocalizedIdentityName(a, locale).localeCompare(getLocalizedIdentityName(b, locale), locale)
    })
  }
}

function groupIdentitiesByRatings(
  identities: TierIdentity[],
  ratingRows: TierRatingRow[],
  category: TierCategory,
  locale: SupportedLocale,
): Record<Tier, TierIdentity[]> {
  const ratingMap = new Map<string, { weightedTotal: number; weightTotal: number; count: number; distribution: Record<number, number> }>()

  for (const row of ratingRows.filter(item => item.category === category)) {
    const parsedWeight = Number(row.weight)
    const weight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1
    const current = ratingMap.get(row.identity_id)
    if (current) {
      current.weightedTotal += row.score * weight
      current.weightTotal += weight
      current.count += 1
      current.distribution[row.score] = (current.distribution[row.score] ?? 0) + 1
    } else {
      ratingMap.set(row.identity_id, {
        weightedTotal: row.score * weight,
        weightTotal: weight,
        count: 1,
        distribution: { [row.score]: 1 },
      })
    }
  }

  const tiers = createEmptyTiers<TierIdentity>()
  const seen = new Set<string>()

  for (const identity of identities) {
    if (seen.has(identity.id)) continue
    seen.add(identity.id)

    const rating = ratingMap.get(identity.id)
    const averageScore = rating && rating.weightTotal > 0 ? rating.weightedTotal / rating.weightTotal : null
    const tier = rating && averageScore !== null ? deriveTier(averageScore, rating.count) : 'N/A'
    tiers[tier].push({
      ...identity,
      tier_rating_summary: {
        averageScore,
        ratingCount: rating?.count ?? 0,
        derivedTier: tier as TierIdentitySummaryTier,
        distribution: rating?.distribution ?? {},
      },
    })
  }

  sortTierIdentities(tiers, locale)

  return tiers
}

function groupIdentitiesByOverall(
  identities: TierIdentity[],
  ratingRows: TierRatingRow[],
  locale: SupportedLocale,
): Record<Tier, TierIdentity[]> {
  const ratingMap = new Map<string, Map<typeof OVERALL_SOURCE_CATEGORIES[number], { weightedTotal: number; weightTotal: number; count: number }>>()

  for (const row of ratingRows) {
    if (!OVERALL_SOURCE_CATEGORIES.includes(row.category as typeof OVERALL_SOURCE_CATEGORIES[number])) continue
    const category = row.category as typeof OVERALL_SOURCE_CATEGORIES[number]
    const parsedWeight = Number(row.weight)
    const weight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1
    const identityRatings = ratingMap.get(row.identity_id) ?? new Map<typeof OVERALL_SOURCE_CATEGORIES[number], { weightedTotal: number; weightTotal: number; count: number }>()
    const current = identityRatings.get(category)
    if (current) {
      current.weightedTotal += row.score * weight
      current.weightTotal += weight
      current.count += 1
    } else {
      identityRatings.set(category, { weightedTotal: row.score * weight, weightTotal: weight, count: 1 })
    }
    ratingMap.set(row.identity_id, identityRatings)
  }

  const tiers = createEmptyTiers<TierIdentity>()
  const seen = new Set<string>()

  for (const identity of identities) {
    if (seen.has(identity.id)) continue
    seen.add(identity.id)

    const categoryRatings = ratingMap.get(identity.id)
    const usable = OVERALL_SOURCE_CATEGORIES.flatMap(sourceCategory => {
      const rating = categoryRatings?.get(sourceCategory)
      return rating && rating.count >= MIN_RATINGS_FOR_TIER
        ? [{ category: sourceCategory, average: rating.weightedTotal / rating.weightTotal, count: rating.count }]
        : []
    })
    const averageScore = usable.length > 0
      ? usable.reduce((sum, item) => sum + item.average, 0) / usable.length
      : null
    const ratingCount = usable.reduce((sum, item) => sum + item.count, 0)
    const tier = averageScore === null ? 'N/A' : deriveTier(averageScore, ratingCount)

    tiers[tier].push({
      ...identity,
      tier_rating_summary: {
        averageScore,
        ratingCount,
        derivedTier: tier as TierIdentitySummaryTier,
        distribution: {},
        sourceCategories: usable.map(item => item.category),
      },
    })
  }

  sortTierIdentities(tiers, locale)

  return tiers
}

function TierListSkeleton() {
  return (
    <div className="animate-pulse" style={{ minHeight: '50vh', padding: '0.5rem 0' }}>
      {TIERS.slice(0, 4).map((tier) => (
        <div key={tier} style={{ display: 'grid', gridTemplateColumns: '4rem 1fr', gap: '0.875rem', marginBottom: '0.875rem', alignItems: 'start' }}>
          <div style={{ background: '#1a1510', borderRadius: '0.375rem', width: '4rem', height: '4.75rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(8rem, 1fr))', gap: '1rem' }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} style={{ background: '#1a1510', borderRadius: '0.375rem', height: '12rem' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default async function TierListPage({
  params,
  searchParams,
}: {
  params?: Promise<{ lang?: string }>
  searchParams?: Promise<{ category?: string | string[]; period?: string | string[] }>
}) {
  const routeParams = await params
  const resolvedSearchParams = await searchParams
  const category = normalizeCategory(resolvedSearchParams?.category)
  const period = normalizePeriod(resolvedSearchParams?.period)
  const locale = normalizeLocale(routeParams?.lang)
  const [tiers, viewer] = await Promise.all([
    getCachedTierData(category, period, locale, getPeriodCacheKey(period), TIER_DATA_MODEL_VERSION),
    getInitialTierViewer(),
  ])
  return <TierListContent category={category} locale={locale} period={period} tiers={tiers as Record<TierIdentitySummaryTier, TierIdentity[]>} viewer={viewer} />
}

function TierListContent({
  category,
  locale,
  period,
  tiers,
  viewer,
}: {
  category: TierCategory
  locale: SupportedLocale
  period: RatingPeriod
  tiers: Record<TierIdentitySummaryTier, TierIdentity[]>
  viewer: TierRatingViewer
}) {
  const copy = HEADER_COPY[locale]

  return (
    <div style={{ background: 'var(--bg-deep)', minHeight: '100dvh' }}>
      <style>{`
        @media (max-width: 47.999rem) {
          .tier-page-header {
            padding: 6.75rem 1rem 1.75rem !important;
          }
          .tier-page-title {
            font-size: 1.875rem !important;
            line-height: 1.08 !important;
          }
          .tier-page-subtitle {
            max-width: 100% !important;
            font-size: 0.8125rem !important;
            line-height: 1.5 !important;
          }
          .tier-page-header-line {
            width: 7rem !important;
          }
        }
      `}</style>
      <div className="tier-page-header max-w-6xl mx-auto" style={{ padding: '7rem 1.5rem 2rem' }}>
        <p
          className="tier-page-header-tag"
          style={{
            color: 'var(--gold-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.625rem',
            letterSpacing: '0.3em',
            marginBottom: '0.5rem',
          }}
        >
          TIER LIST
        </p>
        <h1 className="tier-page-title font-serif text-3xl font-bold" style={{ color: 'var(--gold)' }}>
          {copy.title}
        </h1>
        <p
          className="tier-page-subtitle"
          style={{
            color: '#888888',
            fontSize: '0.8125rem',
            lineHeight: 1.55,
            marginTop: '0.25rem',
            maxWidth: '36rem',
          }}
        >
          {copy.subtitle}
        </p>
        <div
          className="tier-page-header-line"
          style={{
            width: '8rem',
            height: '0.0625rem',
            background: 'linear-gradient(90deg, var(--gold), transparent)',
            marginTop: '1rem',
            transformOrigin: 'left',
          }}
        />
      </div>
      <Suspense fallback={
        <div className="max-w-6xl mx-auto" style={{ padding: '0 1rem 4rem' }}>
          <TierListSkeleton />
        </div>
      }>
        <TierListInteractive tiers={tiers} category={category} period={period} viewer={viewer} />
      </Suspense>
    </div>
  )
}
