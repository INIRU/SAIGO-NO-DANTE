import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import type { Tier } from '@/lib/tier-list/tierModel'
import TierListInteractive from './TierListInteractive'
import type { TierIdentity } from './TierCardInteractive'
import { REROLL_TIERS, type RerollTier, isRerollTier } from './rerollTier'

export const metadata: Metadata = {
  title: '리세 인격 티어표 | SAIGO NO DANTE',
  description: '림버스 컴퍼니 리세 인격 티어표에서 관리자 수동 배치 기준의 S+/S/A/B/C 등급과 이륙 자가진단 점수를 확인하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/tier-list' },
  openGraph: {
    title: '리세 인격 티어표 | 최애의 관리자',
    description: '림버스 컴퍼니 리세 인격 티어표에서 수동 티어 배치와 이륙 자가진단 점수를 확인하세요.',
  },
}

type SupportedLocale = 'ko' | 'en' | 'ja'
type RerollTierData = Record<RerollTier, TierIdentity[]>

const TIER_DATA_MODEL_VERSION = 'manual-reroll-tier-v1'

const HEADER_COPY: Record<SupportedLocale, {
  title: string
  subtitle: string
  meta: string
}> = {
  ko: {
    title: '리세 인격 티어표',
    subtitle: '관리자가 정리한 리세 전용 수동 티어표와 같은 수감자 중복을 제외하는 이륙 자가진단입니다.',
    meta: 'S+부터 C까지, 출처 기준 점수로 계산',
  },
  en: {
    title: 'Reroll identity tier list',
    subtitle: 'A manual reroll-only board maintained by admins, with a launch check that ignores lower duplicate sinners.',
    meta: 'S+ through C, scored from the source guide',
  },
  ja: {
    title: 'リセマラ人格ティア表',
    subtitle: '管理者が整理したリセマラ専用の手動ティア表と、同一囚人の重複を除外する開始診断です。',
    meta: 'S+からCまで、出典基準の点数で計算',
  },
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

type RawTierIdentity = Omit<TierIdentity, 'sinner'> & {
  sinner?: TierIdentity['sinner'] | NonNullable<TierIdentity['sinner']>[] | null
}

type TierListRow = {
  tier: string
  sort_order: number | null
  identity: RawTierIdentity | RawTierIdentity[] | null
}

function normalizeLocale(value: string | undefined): SupportedLocale {
  return value === 'en' || value === 'ja' ? value : 'ko'
}

function createEmptyRerollTiers(): RerollTierData {
  return {
    'S+': [],
    S: [],
    A: [],
    B: [],
    C: [],
  }
}

function normalizeIdentity(identity: RawTierIdentity): TierIdentity {
  return {
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
  }
}

async function getRerollTierData(): Promise<RerollTierData> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('tier_list')
    .select(`
      tier,
      sort_order,
      identity:identities(${IDENTITY_SELECT})
    `)
    .eq('category', 'reroll')
    .in('tier', [...REROLL_TIERS])
    .order('sort_order')

  if (error) {
    console.error('[TierListPage] manual reroll tier fetch error:', error)
    return createEmptyRerollTiers()
  }

  const tiers = createEmptyRerollTiers()
  const seen = new Set<string>()
  for (const row of (data ?? []) as unknown as TierListRow[]) {
    if (!isRerollTier(row.tier)) continue
    const identity = Array.isArray(row.identity) ? row.identity[0] : row.identity
    if (!identity || seen.has(identity.id)) continue
    seen.add(identity.id)
    tiers[row.tier].push({
      ...normalizeIdentity(identity),
      tier_rating_summary: {
        averageScore: null,
        ratingCount: 0,
        derivedTier: row.tier as Tier,
        distribution: {},
      },
    })
  }

  return tiers
}

async function getCachedRerollTierData(dataVersion: string): Promise<RerollTierData> {
  'use cache'
  void dataVersion
  cacheLife('max')
  cacheTag(CACHE_TAGS.tierList, CACHE_TAGS.gameData)
  return getRerollTierData()
}

function TierListSkeleton() {
  return (
    <div className="animate-pulse" style={{ minHeight: '48vh', padding: '0.5rem 0' }}>
      {REROLL_TIERS.map((tier) => (
        <div key={tier} style={{ display: 'grid', gridTemplateColumns: '4rem 1fr', gap: '0.875rem', marginBottom: '0.875rem', alignItems: 'start' }}>
          <div style={{ background: '#1a1510', borderRadius: '0.375rem', width: '4rem', height: '4.5rem' }} />
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
}: {
  params?: Promise<{ lang?: string }>
}) {
  const routeParams = await params
  const locale = normalizeLocale(routeParams?.lang)
  const tiers = await getCachedRerollTierData(TIER_DATA_MODEL_VERSION)

  return <TierListContent locale={locale} tiers={tiers} />
}

function TierListContent({
  locale,
  tiers,
}: {
  locale: SupportedLocale
  tiers: RerollTierData
}) {
  const copy = HEADER_COPY[locale]

  return (
    <div style={{ background: 'var(--bg-deep)', minHeight: '100dvh' }}>
      <style>{`
        @media (max-width: 47.999rem) {
          .tier-page-header {
            padding: 6.75rem 1rem 1.5rem !important;
          }
          .tier-page-title {
            font-size: 1.875rem !important;
            line-height: 1.08 !important;
          }
          .tier-page-subtitle {
            max-width: 100% !important;
            font-size: 1rem !important;
            line-height: 1.5 !important;
          }
          .tier-page-meta {
            width: 100% !important;
          }
        }
      `}</style>
      <header className="tier-page-header mx-auto max-w-6xl" style={{ padding: '7rem 1.5rem 1.75rem' }}>
        <p
          style={{
            color: 'var(--gold-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.22em',
            marginBottom: '0.5rem',
          }}
        >
          REROLL TIER
        </p>
        <h1 className="tier-page-title font-serif text-3xl font-bold" style={{ color: 'var(--gold)' }}>
          {copy.title}
        </h1>
        <p
          className="tier-page-subtitle"
          style={{
            color: '#b8a77e',
            fontSize: '1rem',
            lineHeight: 1.55,
            marginTop: '0.375rem',
            maxWidth: '44rem',
          }}
        >
          {copy.subtitle}
        </p>
        <div
          className="tier-page-meta"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: '2.75rem',
            marginTop: '0.875rem',
            padding: '0 0.875rem',
            border: '1px solid rgba(200,144,10,0.2)',
            borderRadius: '0.5rem',
            background: 'rgba(20,16,12,0.72)',
            color: '#d8c99b',
            fontSize: '0.9375rem',
            fontWeight: 700,
          }}
        >
          {copy.meta}
        </div>
      </header>
      <Suspense fallback={
        <div className="mx-auto max-w-6xl" style={{ padding: '0 1rem 4rem' }}>
          <TierListSkeleton />
        </div>
      }>
        <TierListInteractive tiers={tiers} />
      </Suspense>
    </div>
  )
}
