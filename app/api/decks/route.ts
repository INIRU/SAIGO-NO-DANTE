import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const sort = searchParams.get('sort') || 'latest'
  const limit = parseInt(searchParams.get('limit') || '20')

  const orderColumn = sort === 'popular' ? 'vote_count' : 'created_at'

  const { data, error } = await supabase
    .schema('limbus')
    .from('decks')
    .select(`
      id, title, description, tags, vote_count, view_count, created_at,
      profiles!decks_user_id_fkey(username),
      deck_identities(slot_order, gacksung, s1_count, s2_count, s3_count, identities(id, sinner_id, folder_name, game_id, keywords)),
      deck_egos(ego_id)
    `)
    .order(orderColumn, { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, tags, identitySlots, egoSlots } = body
  // identitySlots: [{ identity_id, gacksung, slot_order }]
  // egoSlots: [{ ego_id, grade }]

  if (!title?.trim()) {
    return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const userId = await findOrCreateSupabaseUser(
    admin,
    session.user.email,
    session.user.name,
    session.user.image,
  )

  const { data: deck, error: deckError } = await admin
    .schema('limbus')
    .from('decks')
    .insert({ user_id: userId, title, description, tags: tags || [] })
    .select()
    .single()

  if (deckError) {
    return NextResponse.json({ error: deckError.message }, { status: 500 })
  }

  if (identitySlots?.length > 0) {
    const rows = identitySlots.map((slot: { identity_id: string; gacksung: boolean; slot_order: number; s1_count?: number; s2_count?: number; s3_count?: number }) => ({
      deck_id: deck.id,
      identity_id: slot.identity_id,
      slot_order: slot.slot_order,
      gacksung: slot.gacksung ?? false,
      s1_count: slot.s1_count ?? 3,
      s2_count: slot.s2_count ?? 2,
      s3_count: slot.s3_count ?? 1,
    }))
    await admin.schema('limbus').from('deck_identities').insert(rows)
  }

  if (egoSlots?.length > 0) {
    const rows = egoSlots.map((slot: { ego_id: string; grade: string }) => ({
      deck_id: deck.id,
      ego_id: slot.ego_id,
      grade: slot.grade,
    }))
    await admin.schema('limbus').from('deck_egos').insert(rows)
  }

  return NextResponse.json(deck, { status: 201 })
}
