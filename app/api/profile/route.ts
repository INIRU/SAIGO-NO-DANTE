import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'

export const dynamic = 'force-dynamic'

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

    const [profileRes, decksRes, bookmarksRes] = await Promise.all([
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
          id, title, description, tags, vote_count, view_count, comment_count, created_at,
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
            id, title, description, tags, vote_count, view_count, comment_count, created_at,
            profiles!decks_user_id_fkey(username),
            deck_identities(slot_order, gacksung, identities(sinner_id, folder_name, game_id, keywords))
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
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

    return NextResponse.json({
      profile: profileRes.data ?? { username: session.user.name, bio: null, avatar_url: null, created_at: null, collection_code: null },
      decks: decksRes.data ?? [],
      bookmarkedDecks,
      email: session.user.email,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { username, bio, collection_code, avatar_url } = body as { username?: string; bio?: string; collection_code?: string; avatar_url?: string | null }

    // username 유효성 검사
    if (username !== undefined) {
      const trimmed = username.trim()
      if (trimmed.length === 0 || trimmed.length > 20) {
        return NextResponse.json({ error: '닉네임은 1~20자여야 합니다.' }, { status: 400 })
      }
      if (!/^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ_\- ]+$/.test(trimmed)) {
        return NextResponse.json({ error: '닉네임에 허용되지 않는 문자가 포함되어 있습니다.' }, { status: 400 })
      }
    }

    // bio 유효성 검사
    if (bio !== undefined && bio.length > 300) {
      return NextResponse.json({ error: '소개는 최대 300자까지 입력할 수 있습니다.' }, { status: 400 })
    }

    // avatar_url 유효성 검사
    if (avatar_url !== undefined && avatar_url !== null) {
      const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'
      if (!avatar_url.startsWith(STORAGE_BASE)) {
        return NextResponse.json({ error: '유효하지 않은 이미지 URL입니다.' }, { status: 400 })
      }
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

    // 닉네임 중복 확인
    if (username !== undefined) {
      const { data: existing } = await admin
        .schema('limbus')
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .neq('id', userId)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: '이미 사용 중인 닉네임입니다.' }, { status: 409 })
      }
    }

    const updates: Record<string, string | null> = {}
    if (username !== undefined) updates.username = username.trim()
    if (bio !== undefined) updates.bio = bio
    if (collection_code !== undefined) updates.collection_code = collection_code || null
    if (avatar_url !== undefined) updates.avatar_url = avatar_url

    const { error } = await admin
      .schema('limbus')
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
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

    // 유저의 덱 삭제 (CASCADE로 deck_identities, deck_votes 자동 삭제)
    await admin.schema('limbus').from('decks').delete().eq('user_id', userId)

    // 프로필 삭제
    await admin.schema('limbus').from('profiles').delete().eq('id', userId)

    // Supabase auth 유저 삭제
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
