import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { lastDays, tallyByDay } from '@/features/admin'

const DAYS = 14

/** Everything the admin dashboard shows, in one read: the work queue, 14 days of activity and the latest inquiries. */
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const db = createAdminClient().schema('limbus')
  const now = Date.now()
  const days = lastDays(DAYS, now)
  const since = new Date(now - DAYS * 864e5).toISOString()
  const ago = (hours: number) => new Date(now - hours * 36e5).toISOString()
  const count = (table: string) => db.from(table).select('*', { count: 'exact', head: true })

  const [open, reports, drafts, maintenance, users, seenDay, seenWeek, decks, plans, joined, newDecks, newPlans, recent, ...visits] = await Promise.all([
    count('inquiries').eq('status', 'open'),
    db.from('friend_reports').select('post_id'),
    count('announcements').eq('published', false),
    count('site_maintenance').eq('is_active', true),
    count('profiles'),
    count('profiles').gte('last_seen_at', ago(24)),
    count('profiles').gte('last_seen_at', ago(24 * 7)),
    count('decks'),
    count('md_plans'),
    db.from('profiles').select('created_at').gte('created_at', since).limit(5000),
    db.from('decks').select('created_at').gte('created_at', since).limit(5000),
    db.from('md_plans').select('created_at').gte('created_at', since).limit(5000),
    db.from('inquiries').select('id, title, status, category, last_message_at, created_at').order('last_message_at', { ascending: false, nullsFirst: false }).limit(6),
    ...days.map(day => count('discovery_visits').eq('day', day)),
  ])
  if ([open, reports, drafts, maintenance, users, seenDay, seenWeek, decks, plans, joined, newDecks, newPlans, recent, ...visits].some(r => r.error))
    return NextResponse.json({ error: 'unavailable' }, { status: 500 })

  const perDay = (rows: { created_at: string }[] | null) => tallyByDay(days, rows ?? [])
  const posts = perDay([...(newDecks.data ?? []), ...(newPlans.data ?? [])])
  return NextResponse.json({
    queue: {
      inquiries: open.count ?? 0,
      reports: new Set((reports.data ?? []).map(r => r.post_id)).size,
      drafts: drafts.count ?? 0,
      maintenance: maintenance.count ?? 0,
    },
    totals: { users: users.count ?? 0, seenDay: seenDay.count ?? 0, seenWeek: seenWeek.count ?? 0, decks: decks.count ?? 0, plans: plans.count ?? 0 },
    days,
    series: { visits: visits.map(v => v.count ?? 0), joined: perDay(joined.data), posts },
    inquiries: (recent.data ?? []).map(i => ({ id: i.id, title: i.title, status: i.status, category: i.category, at: i.last_message_at ?? i.created_at })),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
