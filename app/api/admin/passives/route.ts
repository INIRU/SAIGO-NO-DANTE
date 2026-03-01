import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json()
  const { identity_id, name, passive_type, sin_affinity, sin_count, active_cond, description, passive_order } = body

  if (!identity_id || !name) {
    return NextResponse.json({ error: 'identity_id and name are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('passives')
    .insert({ identity_id, name, passive_type, sin_affinity, sin_count, active_cond, description, passive_order })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
