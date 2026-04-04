import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions, requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

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
      return NextResponse.json({ error: error.message }, { status: 500 })
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

    const body = await request.json()
    const content = (body.content as string ?? '').trim()
    const parentId = (body.parent_id as string) || null
    if (!content || content.length > 500) {
      return NextResponse.json({ error: '댓글은 1~500자여야 합니다.' }, { status: 400 })
    }

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

    const { data, error } = await admin
      .schema('limbus')
      .from('deck_comments')
      .insert({ deck_id: id, user_id: userId, content, parent_id: parentId })
      .select('id, content, created_at, user_id, parent_id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await admin.schema('limbus').rpc('increment_comment', { deck_id: id })

    // 프로필에서 username, role 조회
    const { data: profile } = await admin
      .schema('limbus')
      .from('profiles')
      .select('username, avatar_url, role')
      .eq('id', userId)
      .single()

    return NextResponse.json({
      ...data,
      username: profile?.username ?? session.user.name,
      avatar_url: profile?.avatar_url ?? null,
      role: profile?.role ?? 'user',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
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
    const session = auth.session

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

    // 답글 수 조회 (CASCADE 삭제 전)
    const { count: replyCount } = await admin
      .schema('limbus')
      .from('deck_comments')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', commentId)

    const { error } = await admin
      .schema('limbus')
      .from('deck_comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 본 댓글 + 답글 수만큼 감소
    const totalToDecrement = 1 + (replyCount ?? 0)
    for (let i = 0; i < totalToDecrement; i++) {
      await admin.schema('limbus').rpc('decrement_comment', { deck_id: id })
    }

    writeAuditLog({ actorId: userId, action: 'comment_delete', targetType: 'comment', targetId: commentId, details: { deck_id: id } })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
