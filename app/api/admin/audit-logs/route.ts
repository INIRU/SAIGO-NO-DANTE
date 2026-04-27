import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

type AuditLogRow = {
  id: string
  actor_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  severity: string | null
  ip: string | null
  country: string | null
  created_at: string
}

type ProfileSummary = {
  id: string
  username: string | null
}

function clampLimit(value: string | null) {
  const parsed = Number(value ?? '50')
  if (!Number.isFinite(parsed)) return 50
  return Math.min(Math.max(Math.trunc(parsed), 1), 500)
}

function parseOffset(value: string | null) {
  const parsed = Number(value ?? '0')
  if (!Number.isFinite(parsed)) return 0
  return Math.max(Math.trunc(parsed), 0)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const limit = clampLimit(request.nextUrl.searchParams.get('limit'))
    const offset = parseOffset(request.nextUrl.searchParams.get('offset'))
    const action = request.nextUrl.searchParams.get('action')
    const severity = request.nextUrl.searchParams.get('severity')
    const targetType = request.nextUrl.searchParams.get('target_type')
    const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase() ?? ''

    const admin = createAdminClient()
    let query = admin
      .schema('limbus')
      .from('audit_logs')
      .select('id, actor_id, action, target_type, target_id, details, severity, ip, country, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (action) {
      query = query.eq('action', action)
    }
    if (severity) {
      query = query.eq('severity', severity)
    }
    if (targetType) {
      query = query.eq('target_type', targetType)
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? []) as AuditLogRow[]
    const actorIds = [...new Set(rows.map(d => d.actor_id).filter((id): id is string => Boolean(id)))]
    const targetUserIds = [...new Set(rows
      .filter(d => d.target_type === 'user' && d.target_id)
      .map(d => d.target_id as string))]
    const profileIds = [...new Set([...actorIds, ...targetUserIds])]

    let actorMap: Record<string, string> = {}
    let targetMap: Record<string, string> = {}
    if (profileIds.length > 0) {
      const { data: profiles, error: profilesError } = await admin
        .schema('limbus')
        .from('profiles')
        .select('id, username')
        .in('id', profileIds)

      if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 })

      const profileMap = Object.fromEntries(
        ((profiles ?? []) as ProfileSummary[]).map(p => [p.id, p.username ?? '(없음)'])
      )
      actorMap = Object.fromEntries(actorIds.map(id => [id, profileMap[id] ?? '(삭제됨)']))
      targetMap = Object.fromEntries(targetUserIds.map(id => [id, profileMap[id] ?? '(삭제됨)']))
    }

    const enriched = rows
      .map(log => {
        const targetName = log.target_type === 'user' && log.target_id
          ? targetMap[log.target_id] ?? null
          : null
        return {
          ...log,
          details: log.details ?? {},
          severity: log.severity ?? 'info',
          actor_name: log.actor_id ? (actorMap[log.actor_id] ?? '(삭제됨)') : '시스템',
          target_name: targetName,
          target_label: targetName ?? log.target_id ?? null,
        }
      })
      .filter(log => {
        if (!search) return true
        const haystack = [
          log.action,
          log.severity,
          log.actor_name,
          log.target_type,
          log.target_id,
          log.target_name,
          JSON.stringify(log.details),
        ].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(search)
      })

    return NextResponse.json(enriched)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
