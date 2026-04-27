import { NextRequest, NextResponse } from 'next/server'
import { updateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireActiveUser } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { writeAuditLog } from '@/lib/audit'


// GET /api/planner/[id] — 플랜 상세
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = createAdminClient()

    const { data, error } = await admin
      .schema('limbus')
      .from('md_plans')
      .select('*, profiles:user_id(username, avatar_url)')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: '플랜을 찾을 수 없습니다' }, { status: 404 })

    // 조회수 증가는 POST /api/planner/[id]/view 전용 엔드포인트로 분리됨
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/planner/[id] — 플랜 수정
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(admin, session.user.email!, session.user.name, session.user.image)

    const { data: plan, error: planError } = await admin.schema('limbus').from('md_plans').select('user_id').eq('id', id).single()
    if (planError) return NextResponse.json({ error: planError.message }, { status: 500 })
    if (!plan || plan.user_id !== userId) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

    const body = await req.json()
    const allowed = ['title', 'description', 'difficulty', 'deck', 'egos', 'floor_plan', 'gift_inventory', 'tags']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const { error } = await admin.schema('limbus').from('md_plans').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog({
      actorId: userId,
      action: 'planner_update',
      targetType: 'planner',
      targetId: id,
      details: {
        fields: Object.keys(updates).filter(field => field !== 'updated_at'),
      },
    })

    updateTag(CACHE_TAGS.plan(id))
    updateTag(CACHE_TAGS.plansList)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/planner/[id] — 플랜 삭제
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(admin, session.user.email!, session.user.name, session.user.image)

    const { data: plan, error: planError } = await admin.schema('limbus').from('md_plans').select('user_id').eq('id', id).single()
    if (planError) return NextResponse.json({ error: planError.message }, { status: 500 })
    if (!plan || plan.user_id !== userId) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

    const { error } = await admin.schema('limbus').from('md_plans').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog({
      actorId: userId,
      action: 'planner_delete',
      targetType: 'planner',
      targetId: id,
    })

    updateTag(CACHE_TAGS.plan(id))
    updateTag(CACHE_TAGS.plansList)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
