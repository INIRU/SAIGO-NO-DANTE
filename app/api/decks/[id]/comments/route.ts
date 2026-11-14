import { NextRequest, NextResponse, after } from 'next/server'
import { pushForComment } from '@/lib/push/send'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/find-or-create-user'
import { writeAuditLog } from '@/lib/audit'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function normalizeParentId(value: unknown): string | null | undefined {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!trimmed) return null
  if (!UUID_PATTERN.test(trimmed)) return undefined

  return trimmed
}

function revalidateDeckCommentCaches(deckId: string) {
  revalidateTag(CACHE_TAGS.deck(deckId), 'max')
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .schema('limbus')
      .from('deck_comments')
      .select('id, content, created_at, user_id, parent_id, profiles(username, avatar_url, role)')
      .eq('deck_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[deck comments] database error', error)
      return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    const comments = (data ?? []).map((c: Record<string, unknown>) => {
      const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
      return {
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user_id: c.user_id,
        parent_id: c.parent_id ?? null,
        username: (profile as Record<string, unknown> | null)?.username ?? null,
        avatar_url: (profile as Record<string, unknown> | null)?.avatar_url ?? null,
        role: (profile as Record<string, unknown> | null)?.role ?? 'user',
      }
    })

    return NextResponse.json(comments)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const activeUser = await requireActiveUser()
    if (activeUser.error) return activeUser.response
    const { session } = activeUser

    const rateLimit = checkRequestRateLimit(request, {
      bucket: 'comment',
      scope: 'deck-comments:create',
      authenticatedKey: session.user.email,
    })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const body = await request.json()
    const content = (body.content as string ?? '').trim()
    const parentId = normalizeParentId(body.parent_id)
    if (!content || content.length > 500) {
      return NextResponse.json({ error: '댓글은 1~500자여야 합니다.' }, { status: 400 })
    }
    if (parentId === undefined) {
      return NextResponse.json({ error: '유효하지 않은 부모 댓글입니다.' }, { status: 400 })
    }

    const admin = createAdminClient()
    if (parentId) {
      const { data: parentComment, error: parentError } = await admin
        .schema('limbus')
        .from('deck_comments')
        .select('id')
        .eq('id', parentId)
        .eq('deck_id', id)
        .maybeSingle()

      if (parentError) {
        console.error('[deck comments] database error', parentError)
        return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
      }
      if (!parentComment) {
        return NextResponse.json({ error: '유효하지 않은 부모 댓글입니다.' }, { status: 400 })
      }
    }

    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email!,
      session.user.name,
      session.user.image,
    )
    if (!userId) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
    }

    const { data, error } = await admin
      .schema('limbus')
      .from('deck_comments')
      .insert({ deck_id: id, user_id: userId, content, parent_id: parentId })
      .select('id, content, created_at, user_id, parent_id')
      .single()

    if (error) {
      console.error('[deck comments] database error', error)
      return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    // 프로필에서 username, role 조회
    const { data: profile } = await admin
      .schema('limbus')
      .from('profiles')
      .select('username, avatar_url, role')
      .eq('id', userId)
      .single()

    revalidateDeckCommentCaches(id)
    after(() => pushForComment('deck', data.id))
    return NextResponse.json({
      ...data,
      username: profile?.username ?? session.user.name,
      avatar_url: profile?.avatar_url ?? null,
      role: profile?.role ?? 'user',
    })
  } catch (err: unknown) {
    console.error('[deck comments] unexpected failure', err)
    return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const commentId = url.searchParams.get('commentId')
    if (!commentId) {
      return NextResponse.json({ error: 'commentId가 필요합니다.' }, { status: 400 })
    }

    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const rateLimit = checkRequestRateLimit(request, {
      bucket: 'comment',
      scope: 'deck-comments:delete',
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

    // 본인 댓글인지 확인
    const { data: comment } = await admin
      .schema('limbus')
      .from('deck_comments')
      .select('user_id')
      .eq('id', commentId)
      .eq('deck_id', id)
      .single()

    if (!comment || comment.user_id !== userId) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
    }

    const { error } = await admin
      .schema('limbus')
      .from('deck_comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      console.error('[deck comments] database error', error)
      return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    writeAuditLog({ actorId: userId, action: 'comment_delete', targetType: 'comment', targetId: commentId, details: { deck_id: id } })

    revalidateDeckCommentCaches(id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[deck comments] unexpected failure', err)
    return NextResponse.json({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
  }
}
