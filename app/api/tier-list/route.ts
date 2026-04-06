import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cacheLife } from 'next/cache'

async function getCachedTierList() {
  'use cache'
  cacheLife('page-5m')

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .schema('limbus')
    .from('tier_list')
    .select(`
      tier, sort_order,
      identity:identities(id, name_kr, rarity, sinner_id, game_id, folder_name, acquisition_info, release_date)
    `)
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
