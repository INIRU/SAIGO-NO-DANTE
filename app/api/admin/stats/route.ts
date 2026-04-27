import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'


export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const dayStartIso = dayStart.toISOString()

    const [decks, users, todayDecks, views, activeUsers, auditToday, suspendedProfiles] = await Promise.all([
      supabase.schema('limbus').from('decks').select('id', { count: 'exact', head: true }),
      supabase.schema('limbus').from('profiles').select('id', { count: 'exact', head: true }),
      supabase.schema('limbus').from('decks').select('*', { count: 'exact', head: true })
        .gte('created_at', dayStartIso),
      supabase.schema('limbus').from('decks').select('view_count'),
      supabase.schema('limbus').from('profiles').select('id', { count: 'exact', head: true })
        .gte('last_seen_at', dayStartIso),
      supabase.schema('limbus').from('audit_logs').select('id', { count: 'exact', head: true })
        .gte('created_at', dayStartIso),
      supabase
        .schema('limbus')
        .from('profiles')
        .select('id, suspended_until')
        .eq('suspended', true),
    ])

    for (const result of [decks, users, todayDecks, views, activeUsers, auditToday, suspendedProfiles]) {
      if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    const now = Date.now()
    const activeSuspensions = (suspendedProfiles.data ?? []).filter(profile =>
      profile.suspended_until === null || new Date(profile.suspended_until).getTime() > now
    ).length

    const totalViews = (views.data ?? []).reduce(
      (sum: number, d: { view_count: number }) => sum + (d.view_count ?? 0), 0
    )

    return NextResponse.json({
      totalDecks: decks.count ?? 0,
      totalUsers: users.count ?? 0,
      todayDecks: todayDecks.count ?? 0,
      totalViews,
      activeUsersToday: activeUsers.count ?? 0,
      auditLogsToday: auditToday.count ?? 0,
      activeSuspensions,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
