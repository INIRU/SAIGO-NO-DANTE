import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { writeAuditLog } from '@/lib/audit'
import { validateBody, updateUserRoleSchema, updateUserSuspensionSchema } from '@/lib/schemas/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const raw = await request.json()
    const update: Record<string, unknown> = {}

    if ('role' in raw) {
      const parsed = validateBody(updateUserRoleSchema, { role: raw.role })
      if (!parsed.success) return parsed.response
      if (!['user', 'wanjang', 'admin'].includes(parsed.data.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      update.role = parsed.data.role
    }

    if ('suspended' in raw) {
      const parsed = validateBody(updateUserSuspensionSchema, { suspended: raw.suspended })
      if (!parsed.success) return parsed.response
      update.suspended = parsed.data.suspended
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
