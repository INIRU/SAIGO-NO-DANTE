import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'


export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const { ego_id, name, skill_type, sin_affinity, base_power, coin_power, coins, atk_weight, skill_order, offense_level, description } = body

    if (!ego_id || !name) {
      return NextResponse.json({ error: 'ego_id and name are required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .schema('limbus')
      .from('ego_skills')
      .insert({ ego_id, name, skill_type, sin_affinity, base_power, coin_power, coins, atk_weight, skill_order, offense_level, description })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
