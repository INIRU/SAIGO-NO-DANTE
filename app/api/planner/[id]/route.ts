import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'

export const dynamic = 'force-dynamic'

// GET /api/planner/[id] — 플랜 상세
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .schema('limbus')
    .from('md_plans')
    .select('*, profiles:user_id(username, avatar_url)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: '플랜을 찾을 수 없습니다' }, { status: 404 })

  // 조회수 증가
  await admin.schema('limbus').from('md_plans').update({ view_count: (data.view_count ?? 0) + 1 }).eq('id', id)

  return NextResponse.json(data)
}

// PATCH /api/planner/[id] — 플랜 수정
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const admin = createAdminClient()
  const userId = await findOrCreateSupabaseUser(admin, session.user.email, session.user.name, session.user.image)

  const { data: plan } = await admin.schema('limbus').from('md_plans').select('user_id').eq('id', id).single()
  if (!plan || plan.user_id !== userId) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  const body = await req.json()
  const allowed = ['title', 'description', 'difficulty', 'deck', 'egos', 'floor_plan', 'gift_inventory', 'tags']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { error } = await admin.schema('limbus').from('md_plans').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE /api/planner/[id] — 플랜 삭제
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const admin = createAdminClient()
  const userId = await findOrCreateSupabaseUser(admin, session.user.email, session.user.name, session.user.image)

  const { data: plan } = await admin.schema('limbus').from('md_plans').select('user_id').eq('id', id).single()
  if (!plan || plan.user_id !== userId) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  const { error } = await admin.schema('limbus').from('md_plans').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
