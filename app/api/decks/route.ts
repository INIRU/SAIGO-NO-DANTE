import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

function parsePositiveIntegerParam(value: string | null, fallback: number, name: string) {
  if (value === null) return { value: fallback }
  if (!/^\d+$/.test(value)) {
    return { error: `${name} must be a positive integer` }
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return { error: `${name} must be a positive integer` }
  }

  return { value: Math.min(parsed, MAX_PAGE_SIZE) }
}

function parseOffsetParam(value: string | null) {
  if (value === null) return { value: 0 }
  if (!/^\d+$/.test(value)) {
    return { error: 'offset must be a non-negative integer' }
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return { error: 'offset must be a non-negative integer' }
  }

  return { value: parsed }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const sort = searchParams.get('sort') || 'latest'
    const identityId = searchParams.get('identity_id')

    const limitResult = parsePositiveIntegerParam(searchParams.get('limit'), DEFAULT_PAGE_SIZE, 'limit')
    if ('error' in limitResult) {
      return NextResponse.json({ error: limitResult.error }, { status: 400 })
    }

    const offsetResult = parseOffsetParam(searchParams.get('offset'))
    if ('error' in offsetResult) {
      return NextResponse.json({ error: offsetResult.error }, { status: 400 })
    }

    const { value: limit } = limitResult
    const { value: offset } = offsetResult

    let query = supabase
      .schema('limbus')
      .from('decks')
      .select(`
        id, title, description, tags, content_type, vote_count, view_count, comment_count, created_at,
        profiles!decks_user_id_fkey(username),
        deck_identities(slot_order, gacksung, s1_count, s2_count, s3_count, identities(id, sinner_id, folder_name, game_id, keywords, name_kr)),
        deck_egos(ego_id)
      `)

    query = sort === 'popular'
      ? query
        .order('vote_count', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
      : query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })

    // identity_id 필터: 해당 인격이 포함된 덱 ID를 먼저 조회 후 in() 필터
    if (identityId) {
      const { data: matches, error: matchesError } = await supabase
        .schema('limbus')
        .from('deck_identities')
        .select('deck_id')
        .eq('identity_id', identityId)

      if (matchesError) {
        return NextResponse.json({ error: matchesError.message }, { status: 500 })
      }

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

    const rateLimit = checkRequestRateLimit(request, {
      bucket: 'create',
      scope: 'decks:create',
      authenticatedKey: session.user.email,
    })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

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

    await writeAuditLog({
      actorId: userId,
      action: 'deck_create',
      targetType: 'deck',
      targetId: deck.id,
      details: {
        contentType: deck.content_type,
        tagCount: Array.isArray(deck.tags) ? deck.tags.length : 0,
        identityCount: Array.isArray(identitySlots) ? identitySlots.length : 0,
        egoCount: Array.isArray(egoSlots) ? egoSlots.length : 0,
      },
    })

    revalidatePath('/decks')
    updateTag(CACHE_TAGS.decksList)
    return NextResponse.json(deck, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
