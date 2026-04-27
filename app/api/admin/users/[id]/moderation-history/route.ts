import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const MODERATION_ACTIONS = [
  'suspend',
  'unsuspend',
  'role_change',
  'suspension_expired',
] as const

type AuditLogRow = {
  id: string
  actor_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  severity: string | null
  created_at: string
}

type ProfileSummary = {
  id: string
  username: string | null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function clampLimit(value: string | null) {
  const parsed = Number(value ?? '20')
  if (!Number.isFinite(parsed)) return 20
  return Math.min(Math.max(Math.trunc(parsed), 1), 50)
}

function extractReason(details: Record<string, unknown>) {
  if (typeof details.reason === 'string') return details.reason
  const after = details.after
  if (
    after &&
    typeof after === 'object' &&
    !Array.isArray(after) &&
    typeof (after as Record<string, unknown>).reason === 'string'
  ) {
    return (after as Record<string, unknown>).reason as string
  }
  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
    }

    const limit = clampLimit(new URL(request.url).searchParams.get('limit'))
    const admin = createAdminClient()

    const { data, error } = await admin
      .schema('limbus')
      .from('audit_logs')
      .select('id, actor_id, action, target_type, target_id, details, severity, created_at')
      .eq('target_type', 'user')
      .eq('target_id', id)
      .in('action', MODERATION_ACTIONS)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data ?? []) as AuditLogRow[]
    const actorIds = [...new Set(rows.map(row => row.actor_id).filter((actorId): actorId is string => Boolean(actorId)))]

    let actorMap: Record<string, string> = {}
    if (actorIds.length > 0) {
      const { data: profiles, error: profilesError } = await admin
        .schema('limbus')
        .from('profiles')
        .select('id, username')
        .in('id', actorIds)

      if (profilesError) {
        return NextResponse.json({ error: profilesError.message }, { status: 500 })
      }

      actorMap = Object.fromEntries(
        ((profiles ?? []) as ProfileSummary[]).map(profile => [
          profile.id,
          profile.username ?? '(이름 없음)',
        ])
      )
    }

    const history = rows.map(row => {
      const details = row.details ?? {}
      return {
        id: row.id,
        action: row.action,
        actor_id: row.actor_id,
        actor_name: row.actor_id ? (actorMap[row.actor_id] ?? '(삭제됨)') : '시스템',
        target_type: row.target_type,
        target_id: row.target_id,
        details,
        reason: extractReason(details),
        severity: row.severity ?? 'info',
        created_at: row.created_at,
      }
    })

    return NextResponse.json(history)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
