import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'

export const dynamic = 'force-dynamic'

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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(admin, session.user.email!, session.user.name, session.user.image)

    const body = await req.json()
    const { content, parent_id } = body

    if (!content?.trim()) return NextResponse.json({ error: '내용을 입력하세요' }, { status: 400 })

    const { data, error } = await admin
      .schema('limbus')
      .from('md_plan_comments')
      .insert({
        plan_id: id,
        user_id: userId,
        content: content.trim(),
        parent_id: parent_id ?? null,
      })
      .select('id, content, parent_id, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // comment_count 갱신
    const { count } = await admin.schema('limbus').from('md_plan_comments').select('id', { count: 'exact', head: true }).eq('plan_id', id)
    await admin.schema('limbus').from('md_plans').update({ comment_count: count ?? 0 }).eq('id', id)

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
