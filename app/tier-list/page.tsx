import { createClient } from '@/lib/supabase/server'
import type { Identity } from '@/lib/data/sinners'
import TierListClient from './TierListClient'

export const metadata = { title: '리세마라 티어표 | SAIGO NO DANTE' }
export const revalidate = 300

const TIERS = ['S+', 'S', 'A', 'B', 'C', 'F'] as const
type Tier = typeof TIERS[number]

type AcquisitionInfo = {
  type: string
  gacha: string
  [key: string]: unknown
}

type TierIdentity = Pick<Identity, 'id' | 'name_kr' | 'rarity' | 'sinner_id' | 'game_id' | 'folder_name'> & {
  acquisition_info?: AcquisitionInfo | null
}

async function getTierData(): Promise<Record<Tier, TierIdentity[]>> {
  const supabase = await createClient()

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of data as any[]) {
    const tier = row.tier as Tier
    const ident = Array.isArray(row.identity) ? row.identity[0] : row.identity
    if (tiers[tier] && ident) {
      tiers[tier].push(ident)
    }
  }

  return tiers
}

async function getCurrentSeason(): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema('limbus')
    .from('app_config')
    .select('value')
    .eq('key', 'current_season')
    .single()
  return data?.value?.season ?? 7
}

export default async function TierListPage() {
  const [tiers, currentSeason] = await Promise.all([getTierData(), getCurrentSeason()])
  return <TierListClient tiers={tiers} currentSeason={currentSeason} />
}
