import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''

  const supabase = createAdminClient()
  let query = supabase
    .schema('limbus')
    .from('decks')
    .select('id, title, description, vote_count, view_count, created_at, profiles!decks_user_id_fkey(username)')
    .order('created_at', { ascending: false })

  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
