import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { authOptions, requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'

type SupabaseRouteError = {
  code?: string
  message?: string
}

function logBookmarkError(message: string, error: unknown) {
  console.error(`[deck bookmark] ${message}`, error)
}

async function toggleBookmark(
  admin: ReturnType<typeof createAdminClient>,
  deckId: string,
  userId: string,
): Promise<{ bookmarked: boolean; error?: SupabaseRouteError }> {
  const { data: existingBookmark, error: selectError } = await admin
    .schema('limbus')
    .from('deck_bookmarks')
    .select('deck_id')
    .eq('deck_id', deckId)
    .eq('user_id', userId)
    .maybeSingle()

  if (selectError) return { bookmarked: false, error: selectError }

  if (existingBookmark) {
    const { error: deleteError } = await admin
      .schema('limbus')
      .from('deck_bookmarks')
      .delete()
      .eq('deck_id', deckId)
      .eq('user_id', userId)

    if (deleteError) return { bookmarked: true, error: deleteError }

    return { bookmarked: false }
  }

  const { error: insertError } = await admin
    .schema('limbus')
    .from('deck_bookmarks')
    .insert({ deck_id: deckId, user_id: userId })

  if (insertError) {
    if (insertError.code === '23505') {
      const { error: deleteError } = await admin
        .schema('limbus')
        .from('deck_bookmarks')
        .delete()
        .eq('deck_id', deckId)
        .eq('user_id', userId)

      if (deleteError) return { bookmarked: true, error: deleteError }

      return { bookmarked: false }
    }

    return { bookmarked: false, error: insertError }
  }

  return { bookmarked: true }
}


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ bookmarked: false })
  }

  try {
    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email,
      session.user.name,
      session.user.image,
    )
    if (!userId) return NextResponse.json({ bookmarked: false })

    const { data, error } = await admin
      .schema('limbus')
      .from('deck_bookmarks')
      .select('deck_id')
      .eq('deck_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      logBookmarkError('Failed to read bookmark state', error)
      return NextResponse.json({ bookmarked: false })
    }

    return NextResponse.json({ bookmarked: !!data })
  } catch (err: unknown) {
    logBookmarkError('Unexpected bookmark GET failure', err)
    return NextResponse.json({ bookmarked: false })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const rateLimit = checkRequestRateLimit(request, {
      bucket: 'write',
      scope: 'deck-bookmark:toggle',
      authenticatedKey: session.user.email,
    })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

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

    const { bookmarked, error: bookmarkError } = await toggleBookmark(admin, id, userId)

    if (bookmarkError) {
      logBookmarkError('Failed to toggle bookmark', bookmarkError)
      return NextResponse.json({ error: '북마크 처리 중 오류가 발생했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ bookmarked })
  } catch (err: unknown) {
    logBookmarkError('Unexpected bookmark POST failure', err)
    return NextResponse.json({ error: '북마크 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
