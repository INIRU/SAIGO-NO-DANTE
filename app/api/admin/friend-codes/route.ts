import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/** Reported friend code posts, most reported first, with the code and the author an admin needs to judge them. */
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const db = createAdminClient().schema('limbus')
  const reports = await db.from('friend_reports').select('post_id,created_at').order('created_at', { ascending: false }).limit(1000)
  if (reports.error) return NextResponse.json({ error: '신고 목록을 불러오지 못했습니다.' }, { status: 500 })
  const counts = new Map<string, { count: number; latest: string }>()
  for (const row of reports.data) {
    const entry = counts.get(row.post_id)
    if (entry) entry.count++
    else counts.set(row.post_id, { count: 1, latest: row.created_at })
  }
  if (!counts.size) return NextResponse.json({ items: [] }, { headers: { 'Cache-Control': 'private, no-store' } })
  const posts = await db.from('friend_posts').select('id,kind,code,visibility,slots,identity_ids,user_id,guest_tag,created_at').in('id', [...counts.keys()])
  if (posts.error) return NextResponse.json({ error: '신고 목록을 불러오지 못했습니다.' }, { status: 500 })
  const userIds = posts.data.map(row => row.user_id).filter((id): id is string => !!id)
  const profiles = userIds.length ? await db.from('profiles').select('id,username').in('id', userIds) : { data: [], error: null }
  const names = new Map((profiles.data ?? []).map(row => [row.id as string, row.username as string]))
  const items = posts.data.map(row => ({
    id: row.id, kind: row.kind, code: row.code, visibility: row.visibility, slots: row.slots, identityIds: row.identity_ids, createdAt: row.created_at,
    author: row.user_id ? names.get(row.user_id) ?? null : null, guestTag: row.guest_tag, reports: counts.get(row.id)!.count, reportedAt: counts.get(row.id)!.latest,
  })).sort((a, b) => b.reports - a.reports || b.reportedAt.localeCompare(a.reportedAt))
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } })
}
