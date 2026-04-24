import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'


export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const sort = searchParams.get('sort') || 'latest'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const identityId = searchParams.get('identity_id')

    const orderColumn = sort === 'popular' ? 'vote_count' : 'created_at'

    let query = supabase
      .schema('limbus')
      .from('decks')
      .select(`
        id, title, description, tags, content_type, vote_count, view_count, comment_count, created_at,
        profiles!decks_user_id_fkey(username),
        deck_identities(slot_order, gacksung, s1_count, s2_count, s3_count, identities(id, sinner_id, folder_name, game_id, keywords, name_kr)),
        deck_egos(ego_id)
      `)
      .order(orderColumn, { ascending: false })

    // identity_id 필터: 해당 인격이 포함된 덱 ID를 먼저 조회 후 in() 필터
    if (identityId) {
      const { data: matches } = await supabase
        .schema('limbus')
        .from('deck_identities')
        .select('deck_id')
        .eq('identity_id', identityId)

      if (!matches || matches.length === 0) {
        return NextResponse.json([])
      }

      const deckIds = [...new Set(matches.map(m => m.deck_id))]
      query = query.in('id', deckIds)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const body = await request.json()
    const { title, description, tags, identitySlots, egoSlots, content_type } = body
    // identitySlots: [{ identity_id, gacksung, slot_order }]
    // egoSlots: [{ ego_id, grade }]

    if (!title?.trim()) {
      return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })
    }

    const admin = createAdminClient()

    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email!,
      session.user.name,
      session.user.image,
    )

    const { data: deck, error: deckError } = await admin
      .schema('limbus')
      .from('decks')
      .insert({ user_id: userId, title, description, tags: tags || [], content_type: content_type || '없음' })
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
      const { error: identityInsertError } = await admin.schema('limbus').from('deck_identities').insert(rows)
      if (identityInsertError) {
        // Rollback: delete the parent deck
        await admin.schema('limbus').from('decks').delete().eq('id', deck.id)
        return NextResponse.json({ error: identityInsertError.message }, { status: 500 })
      }
    }

    if (egoSlots?.length > 0) {
      const rows = egoSlots.map((slot: { ego_id: string; grade: string }) => ({
        deck_id: deck.id,
        ego_id: slot.ego_id,
        grade: slot.grade,
      }))
      const { error: egoInsertError } = await admin.schema('limbus').from('deck_egos').insert(rows)
      if (egoInsertError) {
        // Rollback: delete the parent deck (cascades to deck_identities)
        await admin.schema('limbus').from('decks').delete().eq('id', deck.id)
        return NextResponse.json({ error: egoInsertError.message }, { status: 500 })
      }
    }

    revalidatePath('/decks')
    updateTag(CACHE_TAGS.decksList)
    return NextResponse.json(deck, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
