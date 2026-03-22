import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = createAdminClient()

    const [sinners, identities, skills, ego, passives] = await Promise.all([
      supabase.schema('limbus').from('sinners').select('id, name_kr').order('order_num'),
      supabase.schema('limbus').from('identities').select('id, sinner_id'),
      supabase.schema('limbus').from('skills').select('*', { count: 'exact', head: true }),
      supabase.schema('limbus').from('ego').select('id, sinner_id'),
      supabase.schema('limbus').from('passives').select('*', { count: 'exact', head: true }),
    ])

    const sinnerData = (sinners.data ?? []).map(s => ({
      id: s.id,
      name_kr: s.name_kr,
      identity_count: (identities.data ?? []).filter(i => i.sinner_id === s.id).length,
      ego_count: (ego.data ?? []).filter(e => e.sinner_id === s.id).length,
    }))

    return NextResponse.json({
      sinners: sinnerData,
      totalIdentities: (identities.data ?? []).length,
      totalSkills: skills.count ?? 0,
      totalEgo: (ego.data ?? []).length,
      totalPassives: passives.count ?? 0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
