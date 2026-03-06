import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 300

export async function GET() {
  const admin = createAdminClient()

  const [sinnersRes, identitiesRes] = await Promise.all([
    admin
      .schema('limbus')
      .from('sinners')
      .select('id, name_kr, order_num')
      .order('order_num'),
    admin
      .schema('limbus')
      .from('identities')
      .select('sinner_id, name_kr, folder_name, game_id, rarity')
      .order('sinner_id')
      .order('rarity', { ascending: false }),
  ])

  return NextResponse.json({
    sinners: sinnersRes.data ?? [],
    identities: identitiesRes.data ?? [],
  })
}
