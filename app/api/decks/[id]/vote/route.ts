import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { authOptions } from '@/lib/auth'
import { requireAccount } from '@/lib/auth-account'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-meta'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'

function logVoteError(message: string, error: unknown) {
  console.error(`[deck vote] ${message}`, error)
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
    const ip = getClientIp(_request.headers) ?? 'unknown'
    const rl = checkRateLimit(ip, 'write')
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } })
    }

    const { id } = await params
    const auth = await requireAccount({ activeOnly: true })
    if (auth.error) return auth.response
    const { admin, userId } = auth

    const { data: voted, error: voteError } = await admin
      .schema('limbus')
      .rpc('toggle_deck_vote', { p_deck_id: id, p_user_id: userId })

    if (voteError) {
      logVoteError('Failed to toggle vote', voteError)
      return NextResponse.json({ error: '투표 처리 중 오류가 발생했습니다.' }, { status: 500 })
    }

    revalidatePath(`/decks/${id}`)
    // Only this deck's pages: the lists that show its count have minutes-long lifetimes of their own.
    revalidateTag(CACHE_TAGS.deck(id), 'max')
    return NextResponse.json({ voted })
  } catch (err: unknown) {
    logVoteError('Unexpected vote POST failure', err)
    return NextResponse.json({ error: '투표 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
