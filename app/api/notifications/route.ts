import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { newestFirst, toNotification, type NotificationRow } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin'

const failed = () => NextResponse.json({ error: '알림을 불러오지 못했습니다.' }, { status: 500 })

/**
 * Navbar list and dot: comments on the session user's posts and replies to their comments; for an administrator also the
 * inquiries waiting for an answer. No account creation.
 */
export async function GET() {
  const auth = await requireUser()
  if (auth.error) return auth.response
  const user = auth.session.user!
  const db = createAdminClient().schema('limbus')
  const args = { user_email: user.email! }
  const [own, inbox] = await Promise.all([db.rpc('user_notifications', args), user.isAdmin && !user.isSuspended ? db.rpc('admin_inquiry_notifications', args) : null])
  if (own.error) return failed()
  // The inquiries are an addition: if they cannot be read, the comment notifications still arrive.
  if (inbox?.error) console.error('[notifications] inquiries failed:', inbox.error.message)
  const items = newestFirst(([...(own.data ?? []), ...(inbox?.data ?? [])] as NotificationRow[]).map(toNotification))
  return NextResponse.json({ items, unread: items.filter(item => item.unread).length }, { headers: { 'Cache-Control': 'private, no-store' } })
}

/** The user opened the list: everything up to now is read. */
export async function POST() {
  const auth = await requireUser()
  if (auth.error) return auth.response
  const { error } = await createAdminClient().schema('limbus').rpc('mark_notifications_read', { user_email: auth.session.user!.email! })
  return error ? failed() : NextResponse.json({ ok: true })
}
