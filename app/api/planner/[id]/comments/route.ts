import { NextRequest, NextResponse, after } from 'next/server'
import { pushForComment } from '@/lib/push/send'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
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

function revalidatePlannerCommentCaches(planId: string) {
  revalidateTag(CACHE_TAGS.plan(planId), 'max')
  revalidateTag(CACHE_TAGS.plansList, 'max')
}

// GET /api/planner/[id]/comments — 댓글 목록
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = createAdminClient()

    const { data, error } = await admin
      .schema('limbus')
      .from('md_plan_comments')
      .select('id, content, parent_id, created_at, user_id, profiles:user_id(username, avatar_url)')
      .eq('plan_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[planner/[id]/comments]', error.message)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ comments: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/planner/[id]/comments — 댓글 작성
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const rateLimit = checkRequestRateLimit(req, {
      bucket: 'comment',
      scope: 'planner-comments:create',
      authenticatedKey: session.user.email,
    })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const body = await req.json()
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    const parentId = normalizeParentId(body.parent_id)

    if (!content) return NextResponse.json({ error: '내용을 입력하세요' }, { status: 400 })
    if (parentId === undefined) {
      return NextResponse.json({ error: '유효하지 않은 부모 댓글입니다.' }, { status: 400 })
    }

    const admin = createAdminClient()
    if (parentId) {
      const { data: parentComment, error: parentError } = await admin
        .schema('limbus')
        .from('md_plan_comments')
        .select('id')
        .eq('id', parentId)
        .eq('plan_id', id)
        .maybeSingle()

      if (parentError) {
        console.error('[planner/[id]/comments]', parentError.message)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
      if (!parentComment) {
        return NextResponse.json({ error: '유효하지 않은 부모 댓글입니다.' }, { status: 400 })
      }
    }

    const userId = await findOrCreateSupabaseUser(admin, session.user.email!, session.user.name, session.user.image)

    const { data, error } = await admin
      .schema('limbus')
      .from('md_plan_comments')
      .insert({
        plan_id: id,
        user_id: userId,
        content,
        parent_id: parentId,
      })
      .select('id, content, parent_id, created_at')
      .single()

    if (error) {
      console.error('[planner/[id]/comments]', error.message)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // comment_count 갱신
    const { count, error: countError } = await admin.schema('limbus').from('md_plan_comments').select('id', { count: 'exact', head: true }).eq('plan_id', id)
    if (countError) {
      revalidatePlannerCommentCaches(id)
      console.error('[planner/[id]/comments]', countError.message)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { error: updateError } = await admin.schema('limbus').from('md_plans').update({ comment_count: count ?? 0 }).eq('id', id)
    if (updateError) {
      revalidatePlannerCommentCaches(id)
      console.error('[planner/[id]/comments]', updateError.message)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    revalidatePlannerCommentCaches(id)
    after(() => pushForComment('plan', data.id))
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
