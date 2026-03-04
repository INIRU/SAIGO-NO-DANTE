import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 300

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .schema('limbus')
    .from('tier_list')
    .select(`
      tier, sort_order,
      identity:identities(id, name_kr, rarity, sinner_id, game_id, folder_name, acquisition_info)
    `)
    .order('sort_order')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
