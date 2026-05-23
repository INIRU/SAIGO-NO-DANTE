import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'

const REROLL_CATEGORY = 'reroll'
const REROLL_TIERS = ['S+', 'S', 'A', 'B', 'C'] as const

async function getCachedTierList() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.tierList, CACHE_TAGS.gameData)

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .schema('limbus')
    .from('tier_list')
    .select(`
      category, tier, sort_order,
      identity:identities(id, name_kr, rarity, sinner_id, game_id, folder_name, acquisition_info, release_date)
    `)
    .eq('category', REROLL_CATEGORY)
    .in('tier', [...REROLL_TIERS])
    .order('sort_order')

  if (error) throw new Error(error.message)
  return data
}

export async function GET() {
  try {
    const data = await getCachedTierList()
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
