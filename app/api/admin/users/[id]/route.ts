import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { writeAuditLog } from '@/lib/audit'
import { getRequestMetadata } from '@/lib/request-meta'
import { validateBody, updateUserRoleSchema, updateUserSuspensionSchema } from '@/lib/schemas/admin'

type UserModerationState = {
  role: string | null
  suspended: boolean | null
  suspension_reason: string | null
  suspended_until: string | null
  suspended_at: string | null
  suspended_by: string | null
  username: string | null
}

function resolveSuspendedUntil(data: {
  suspended_until?: string | null
  suspendedUntil?: string | null
  duration_days?: number | null
  durationDays?: number | null
}) {
  const explicitUntil = data.suspended_until ?? data.suspendedUntil
  if (explicitUntil !== undefined) {
    if (!explicitUntil) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(explicitUntil)) {
      return new Date(`${explicitUntil}T23:59:59.999Z`).toISOString()
    }
    return new Date(explicitUntil).toISOString()
  }

  const durationDays = data.duration_days ?? data.durationDays
  if (!durationDays) return null

  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
}

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
    const auditActions: Array<'role_change' | 'suspend' | 'unsuspend'> = []

    if ('role' in raw) {
      const parsed = validateBody(updateUserRoleSchema, { role: raw.role })
      if (!parsed.success) return parsed.response
      update.role = parsed.data.role
      auditActions.push('role_change')
    }

    if ('suspended' in raw) {
      const parsed = validateBody(updateUserSuspensionSchema, raw)
      if (!parsed.success) return parsed.response
      update.suspended = parsed.data.suspended
      if (parsed.data.suspended) {
        update.suspension_reason = parsed.data.reason ?? parsed.data.suspension_reason
        update.suspended_until = resolveSuspendedUntil(parsed.data)
        update.suspended_at = new Date().toISOString()
        auditActions.push('suspend')
      } else {
        update.suspension_reason = null
        update.suspended_until = null
        update.suspended_at = null
        update.suspended_by = null
        auditActions.push('unsuspend')
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const actorId = await findOrCreateSupabaseUser(
      supabase, session.user.email!, session.user.name, session.user.image,
    )

    if ('suspended' in update && update.suspended === true) {
      update.suspended_by = actorId
    }

    // 변경 전 상태 조회 (감사 로그용)
    const { data: before, error: beforeError } = await supabase
      .schema('limbus')
      .from('profiles')
      .select('role, suspended, suspension_reason, suspended_until, suspended_at, suspended_by, username')
      .eq('id', id)
      .maybeSingle()

    if (beforeError) {
      return NextResponse.json({ error: beforeError.message }, { status: 500 })
    }
    if (!before) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: updated, error } = await supabase
      .schema('limbus')
      .from('profiles')
      .update(update)
      .eq('id', id)
      .select('id, username, role, suspended, suspension_reason, suspended_until, suspended_at, suspended_by, last_seen_at, last_ip_masked, last_country, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const metadata = getRequestMetadata(request)
    const beforeState = before as UserModerationState

    if (auditActions.includes('role_change')) {
      const audit = await writeAuditLog({
        actorId,
        action: 'role_change',
        targetType: 'user',
        targetId: id,
        details: { from: beforeState.role, to: update.role, username: beforeState.username },
        severity: 'warning',
        ip: metadata.ip,
        country: metadata.country,
      })
      if (audit.error) return NextResponse.json({ error: audit.error.message }, { status: 500 })
    }

    if (auditActions.includes('suspend') || auditActions.includes('unsuspend')) {
      const action = auditActions.includes('suspend') ? 'suspend' : 'unsuspend'
      const audit = await writeAuditLog({
        actorId,
        action,
        targetType: 'user',
        targetId: id,
        details: {
          username: beforeState.username,
          before: {
            suspended: beforeState.suspended ?? false,
            reason: beforeState.suspension_reason,
            until: beforeState.suspended_until,
            at: beforeState.suspended_at,
            by: beforeState.suspended_by,
          },
          after: {
            suspended: update.suspended,
            reason: update.suspension_reason,
            until: update.suspended_until,
            at: update.suspended_at,
            by: update.suspended_by,
          },
        },
        severity: action === 'suspend' ? 'danger' : 'success',
        ip: metadata.ip,
        country: metadata.country,
      })
      if (audit.error) return NextResponse.json({ error: audit.error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
