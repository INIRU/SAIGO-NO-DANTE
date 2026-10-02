import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { toNotification, type NotificationRow } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin'

const failed = () => NextResponse.json({ error: '알림을 불러오지 못했습니다.' }, { status: 500 })

/** Navbar list and dot: comments on the session user's posts and replies to their comments. One RPC, no account creation. */
export async function GET() {
  const auth = await requireUser()
  if (auth.error) return auth.response
  const { data, error } = await createAdminClient().schema('limbus').rpc('user_notifications', { user_email: auth.session.user!.email! })
  if (error) return failed()
  const items = ((data ?? []) as NotificationRow[]).map(toNotification)
  return NextResponse.json({ items, unread: items.filter(item => item.unread).length }, { headers: { 'Cache-Control': 'private, no-store' } })
}

/** The user opened the list: everything up to now is read. */
export async function POST() {
  const auth = await requireUser()
  if (auth.error) return auth.response
  const { error } = await createAdminClient().schema('limbus').rpc('mark_notifications_read', { user_email: auth.session.user!.email! })
  return error ? failed() : NextResponse.json({ ok: true })
}
