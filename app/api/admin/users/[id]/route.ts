import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { writeAuditLog } from '@/lib/audit'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const update: Record<string, unknown> = {}

  if ('role' in body) {
    if (!['user', 'wanjang', 'admin'].includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    update.role = body.role
  }

  if ('suspended' in body) {
    update.suspended = !!body.suspended
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 변경 전 상태 조회 (감사 로그용)
  const { data: before } = await supabase
    .schema('limbus')
    .from('profiles')
    .select('role, suspended, username')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .schema('limbus')
    .from('profiles')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 감사 로그 기록
  const actorId = await findOrCreateSupabaseUser(
    supabase, session.user.email!, session.user.name, session.user.image,
  )

  if ('role' in update) {
    writeAuditLog({
      actorId,
      action: 'role_change',
      targetType: 'user',
      targetId: id,
      details: { from: before?.role, to: update.role, username: before?.username },
    })
  }

  if ('suspended' in update) {
    writeAuditLog({
      actorId,
      action: update.suspended ? 'suspend' : 'unsuspend',
      targetType: 'user',
      targetId: id,
      details: { username: before?.username },
    })
  }

  return NextResponse.json({ ok: true })
}
