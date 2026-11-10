import { invalidateProfileDecks } from '@/features/community/server'
import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { authOptions, requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { STORAGE_BASE } from '@/lib/constants/game'
import { z } from 'zod'

const TAKEN = '이미 사용 중인 닉네임입니다.'
const BAD = '잘못된 요청입니다.'
// A nickname is trimmed first; the messages are what the settings page has always shown for each rule.
const patchSchema = z.object({
  username: z.string(BAD).trim().min(1, '닉네임은 1~20자여야 합니다.').max(20, '닉네임은 1~20자여야 합니다.')
    .regex(/^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ_\- ]+$/, '닉네임에 허용되지 않는 문자가 포함되어 있습니다.').optional(),
  bio: z.string(BAD).max(300, '소개는 최대 300자까지 입력할 수 있습니다.').optional(),
  // A gzipped bit set of the owned identities and E.G.O, base64: about a kilobyte.
  collection_code: z.string(BAD).max(4000, BAD).optional(),
  avatar_url: z.string(BAD).startsWith(STORAGE_BASE + '/', '유효하지 않은 이미지 URL입니다.').nullable().optional(),
}, BAD)


export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email,
      session.user.name,
      session.user.image,
    )
    if (!userId) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
    }

    const [profileRes, decksRes, bookmarksRes, planCountRes, planVoteSumRes] = await Promise.all([
      admin
        .schema('limbus')
        .from('profiles')
        .select('username, bio, avatar_url, created_at, collection_code')
        .eq('id', userId)
        .single(),
      admin
        .schema('limbus')
        .from('decks')
        .select(`
          id, title, description, tags, main_keywords, content_type, vote_count, view_count, comment_count, created_at,
          deck_identities(slot_order, gacksung, identities(sinner_id, folder_name, game_id, keywords))
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      admin
        .schema('limbus')
        .from('deck_bookmarks')
        .select(`
          deck_id,
          decks!deck_id(
            id, title, description, tags, main_keywords, content_type, vote_count, view_count, comment_count, created_at,
            profiles!decks_user_id_fkey(username),
            deck_identities(slot_order, gacksung, identities(sinner_id, folder_name, game_id, keywords))
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      // Design Ref: §4.1 — 활동 통계용 플랜 카운트
      admin
        .schema('limbus')
        .from('md_plans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      // Design Ref: §4.1 — 내 플랜이 받은 총 추천 수
      admin
        .schema('limbus')
        .from('md_plans')
        .select('vote_count')
        .eq('user_id', userId),
    ])

    const bookmarkedDecks = (bookmarksRes.data ?? [])
      .map((b: Record<string, unknown>) => {
        const d = Array.isArray(b.decks) ? b.decks[0] : b.decks
        if (!d) return null
        const deck = d as Record<string, unknown>
        const prof = Array.isArray(deck.profiles) ? deck.profiles[0] : deck.profiles
        return {
          ...deck,
          username: (prof as Record<string, string> | null)?.username ?? null,
        }
      })
      .filter(Boolean)

    // Design Ref: §4.1 — 활동 통계 계산
    const deckVoteSum = (decksRes.data ?? []).reduce((sum: number, d: Record<string, unknown>) => sum + ((d.vote_count as number) ?? 0), 0)
    const planVoteSum = (planVoteSumRes.data ?? []).reduce((sum: number, p: Record<string, unknown>) => sum + ((p.vote_count as number) ?? 0), 0)

    return NextResponse.json({
      profile: profileRes.data ?? { username: session.user.name, bio: null, avatar_url: null, created_at: null, collection_code: null },
      decks: decksRes.data ?? [],
      bookmarkedDecks,
      email: session.user.email,
      stats: {
        deckCount: decksRes.data?.length ?? 0,
        planCount: planCountRes.count ?? 0,
        bookmarkCount: bookmarksRes.data?.length ?? 0,
        totalVotesReceived: deckVoteSum + planVoteSum,
      },
    })
  } catch (err: unknown) {
    console.error('[api/profile]', err)
    return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const { username, bio, collection_code, avatar_url } = parsed.data

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

    // 닉네임 중복 확인
    if (username !== undefined) {
      const { data: existing, error: lookupError } = await admin
        .schema('limbus')
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .neq('id', userId)
        .maybeSingle()

      if (lookupError) {
        console.error('[api/profile]', lookupError)
        return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
      }
      if (existing) {
        return NextResponse.json({ error: TAKEN }, { status: 409 })
      }
    }

    const updates: Record<string, string | null> = {}
    if (username !== undefined) updates.username = username
    if (bio !== undefined) updates.bio = bio
    if (collection_code !== undefined) updates.collection_code = collection_code || null
    if (avatar_url !== undefined) updates.avatar_url = avatar_url

    const { error } = await admin
      .schema('limbus')
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) {
      // A second request can take the nickname between the check above and this write.
      if (error.code === '23505') return NextResponse.json({ error: TAKEN }, { status: 409 })
      console.error('[api/profile]', error)
      return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
    }

    await invalidateProfileDecks(admin, userId)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[api/profile]', err)
    return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
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

    // Delete app data atomically
    const { error: deleteDataError } = await admin
      .schema('limbus')
      .rpc('delete_user_account', { p_user_id: userId })

    if (deleteDataError) {
      console.error('[api/profile]', deleteDataError)
      return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
    }

    // Delete auth user (must be separate — admin API only)
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      // App data is already deleted but auth user remains
      // Log this for manual cleanup
      Sentry.captureException(error, { tags: { location: 'api/profile/route:DELETE' }, extra: { msg: 'Auth user deletion failed after app data cleanup' } })
      console.error('[api/profile]', error)
      return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[api/profile]', err)
    return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
  }
}
