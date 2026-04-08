import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Identity } from '@/lib/types'
import TierListInteractive from './TierListInteractive'
import TierGrid from './TierGrid'
import type { TierIdentity } from './TierCardInteractive'
import { getServerLang, serverT } from '@/lib/i18n/server'
import type { TranslationKey } from '@/lib/i18n/translations'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang()
  const title = serverT('tierList.title' as TranslationKey, lang)
  const description = serverT('tierList.description' as TranslationKey, lang)
  return {
    title,
    description,
    alternates: { canonical: 'https://saigo-no-dante.com/tier-list' },
    openGraph: {
      title,
      description,
    },
  }
}
const TIERS = ['S+', 'S', 'A', 'B', 'C', 'F'] as const
type Tier = typeof TIERS[number]

async function getTierData(): Promise<Record<Tier, TierIdentity[]>> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .schema('limbus')
    .from('tier_list')
    .select(`
      tier, sort_order,
      identity:identities(id, name_kr, rarity, sinner_id, game_id, folder_name, acquisition_info, release_date)
    `)
    .order('sort_order')

  if (error || !data) return { 'S+': [], 'S': [], 'A': [], 'B': [], 'C': [], 'F': [] }

  const tiers: Record<Tier, TierIdentity[]> = {
    'S+': [], 'S': [], 'A': [], 'B': [], 'C': [], 'F': [],
  }

  type TierRow = { tier: string; sort_order: number; identity: TierIdentity | TierIdentity[] | null }
  for (const row of data as TierRow[]) {
    const tier = row.tier as Tier
    const ident = Array.isArray(row.identity) ? row.identity[0] : row.identity
    if (tiers[tier] && ident) {
      tiers[tier].push(ident)
    }
  }

  return tiers
}

async function getCurrentSeason(): Promise<number> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('app_config')
    .select('value')
    .eq('key', 'current_season')
    .single()
  if (error) console.error('Failed to fetch current season:', error)
  return data?.value?.season ?? 7
}

function TierListSkeleton() {
  return (
    <div className="animate-pulse" style={{ minHeight: '60vh', padding: '1rem 0' }}>
      {['S+', 'S', 'A', 'B', 'C', 'F'].map((tier) => (
        <div key={tier} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
          <div style={{ background: '#1a1510', borderRadius: '0.25rem', width: '3.5rem', height: '5rem', flexShrink: 0 }} />
          <div style={{ flex: 1, background: '#1a1510', borderRadius: '0.25rem', height: '5rem' }} />
        </div>
      ))}
    </div>
  )
}

export default async function TierListPage() {
  'use cache'
  cacheLife('page-5m')
  const [tiers, currentSeason] = await Promise.all([getTierData(), getCurrentSeason()])

  return (
    <div style={{ background: 'var(--bg-deep)', minHeight: '100dvh' }}>
      {/* Server-rendered header — instant paint */}
      <div className="max-w-5xl mx-auto text-center" style={{ padding: '7rem 1.5rem 2rem' }}>
        <p style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>TIER LIST</p>
        <h1 className="font-serif text-3xl font-bold" style={{ color: 'var(--gold)' }}>
          리세마라 티어표
        </h1>
        <p style={{ color: '#888888', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
          커뮤니티 투표 기반 인격 등급표 — S+/S/A/B/C/F
        </p>
        <div className="mx-auto" style={{ width: '8rem', height: '0.0625rem', background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', marginTop: '1rem' }} />
      </div>
      {/* Client component — streams in */}
      <Suspense fallback={
        <div className="max-w-5xl mx-auto" style={{ padding: '0 1.5rem 4rem' }}>
          <TierListSkeleton />
        </div>
      }>
        <TierListInteractive tiers={tiers}>
          <TierGrid tiers={tiers} currentSeason={currentSeason} />
        </TierListInteractive>
      </Suspense>
    </div>
  )
}
