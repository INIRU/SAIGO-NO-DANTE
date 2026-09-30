import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { authOptions, requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { checkRateLimit } from '@/lib/rate-limit'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'

type SupabaseRouteError = {
  code?: string
  message?: string
}

function logVoteError(message: string, error: unknown) {
  console.error(`[deck vote] ${message}`, error)
}

async function toggleVote(
  admin: ReturnType<typeof createAdminClient>,
  deckId: string,
  userId: string,
): Promise<{ voted: boolean; error?: SupabaseRouteError }> {
  const { data: existingVote, error: selectError } = await admin
    .schema('limbus')
    .from('deck_votes')
    .select('deck_id')
    .eq('deck_id', deckId)
    .eq('user_id', userId)
    .maybeSingle()

  if (selectError) return { voted: false, error: selectError }

  if (existingVote) {
    const { data: deletedVote, error: deleteError } = await admin
      .schema('limbus')
      .from('deck_votes')
      .delete()
      .eq('deck_id', deckId)
      .eq('user_id', userId)
      .select('deck_id')
      .maybeSingle()

    if (deleteError) return { voted: true, error: deleteError }

    if (deletedVote) {
      const { error: decrementError } = await admin
        .schema('limbus')
        .rpc('decrement_vote', { deck_id: deckId })

      if (decrementError) return { voted: false, error: decrementError }
    }

    return { voted: false }
  }

  const { data: insertedVote, error: insertError } = await admin
    .schema('limbus')
    .from('deck_votes')
    .insert({ deck_id: deckId, user_id: userId })
    .select('deck_id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return { voted: true }
    }

    return { voted: false, error: insertError }
  }

  if (insertedVote) {
    const { error: incrementError } = await admin
      .schema('limbus')
      .rpc('increment_vote', { deck_id: deckId })

    if (incrementError) return { voted: true, error: incrementError }
  }

  return { voted: true }
}


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ voted: false })
  }

  try {
    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email,
      session.user.name,
      session.user.image,
    )
    if (!userId) return NextResponse.json({ voted: false })

    const { data, error } = await admin
      .schema('limbus')
      .from('deck_votes')
      .select('deck_id')
      .eq('deck_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      logVoteError('Failed to read vote state', error)
      return NextResponse.json({ voted: false })
    }

    return NextResponse.json({ voted: !!data })
  } catch (err: unknown) {
    logVoteError('Unexpected vote GET failure', err)
    return NextResponse.json({ voted: false })
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ip = _request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? _request.headers.get('x-real-ip') ?? 'unknown'
    const rl = checkRateLimit(ip, 'write')
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } })
    }

    const { id } = await params
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email!,
      session.user.name,
      session.user.image,
    )
    if (!userId) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
    }

    const { voted, error: voteError } = await toggleVote(admin, id, userId)

    if (voteError) {
      logVoteError('Failed to toggle vote', voteError)
      return NextResponse.json({ error: '투표 처리 중 오류가 발생했습니다.' }, { status: 500 })
    }

    revalidatePath(`/decks/${id}`)
    revalidateTag(CACHE_TAGS.decksList, 'max')
    revalidateTag(CACHE_TAGS.deck(id), 'max')
    return NextResponse.json({ voted })
  } catch (err: unknown) {
    logVoteError('Unexpected vote POST failure', err)
    return NextResponse.json({ error: '투표 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
