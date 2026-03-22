import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 300

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .schema('limbus')
      .from('tier_list')
      .select(`
        tier, sort_order,
        identity:identities(id, name_kr, rarity, sinner_id, game_id, folder_name, acquisition_info, release_date)
      `)
      .order('sort_order')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
