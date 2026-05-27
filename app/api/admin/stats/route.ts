import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const FALLBACK_TIME_ZONE = 'Asia/Seoul'

function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format()
    return true
  } catch {
    return false
  }
}

function selectTimeZone(request: NextRequest): string {
  const candidates = [
    request.headers.get('x-user-timezone'),
    request.headers.get('x-vercel-ip-timezone'),
    FALLBACK_TIME_ZONE,
  ]

  for (const candidate of candidates) {
    const timeZone = candidate?.trim()
    if (timeZone && isValidTimeZone(timeZone)) return timeZone
  }

  return FALLBACK_TIME_ZONE
}

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  )

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone)
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )

  return zonedAsUtc - date.getTime()
}

function getLocalStartOfDayIso(timeZone: string, now = new Date()): string {
  const localDate = getZonedParts(now, timeZone)
  const localMidnightAsUtc = Date.UTC(localDate.year, localDate.month - 1, localDate.day, 0, 0, 0, 0)
  let utcTimestamp = localMidnightAsUtc

  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utcTimestamp), timeZone)
    const nextTimestamp = localMidnightAsUtc - offset
    if (nextTimestamp === utcTimestamp) break
    utcTimestamp = nextTimestamp
  }

  return new Date(utcTimestamp).toISOString()
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const dayStartIso = getLocalStartOfDayIso(selectTimeZone(request))

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
