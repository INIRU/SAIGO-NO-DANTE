import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const sinner_id = searchParams.get('sinner_id')

  let query = supabase.schema('limbus').from('identities').select('*').order('name')

  if (sinner_id) {
    query = query.eq('sinner_id', sinner_id)
  }

  const { data: identities, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: identities })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const supabase = createAdminClient()
  const body = await request.json()

  const { sinner_id, name, rarity } = body
  if (!sinner_id || !name || !rarity) {
    return NextResponse.json({ error: 'Missing required fields: sinner_id, name, rarity' }, { status: 400 })
  }

  const { data: identity, error } = await supabase
    .schema('limbus')
    .from('identities')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(identity, { status: 201 })
}
