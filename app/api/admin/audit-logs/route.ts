import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '50')
    const offset = Number(request.nextUrl.searchParams.get('offset') ?? '0')
    const action = request.nextUrl.searchParams.get('action')

    const admin = createAdminClient()
    let query = admin
      .schema('limbus')
      .from('audit_logs')
      .select('id, actor_id, action, target_type, target_id, details, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (action) {
      query = query.eq('action', action)
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 액터 이름 일괄 조회
    const actorIds = [...new Set((data ?? []).map(d => d.actor_id).filter(Boolean))]
    let actorMap: Record<string, string> = {}
    if (actorIds.length > 0) {
      const { data: profiles } = await admin
        .schema('limbus')
        .from('profiles')
        .select('id, username')
        .in('id', actorIds)
      if (profiles) {
        actorMap = Object.fromEntries(profiles.map(p => [p.id, p.username ?? '(없음)']))
      }
    }

    const enriched = (data ?? []).map(log => ({
      ...log,
      actor_name: log.actor_id ? (actorMap[log.actor_id] ?? '(삭제됨)') : '시스템',
    }))

    return NextResponse.json(enriched)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
