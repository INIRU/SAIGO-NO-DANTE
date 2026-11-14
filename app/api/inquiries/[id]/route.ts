import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/find-or-create-user'
import { INQUIRY_FIELDS, sortMessages, statusAfterMessage, supportMessageSchema, type Inquiry } from '@/lib/support'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
type Params = { params: Promise<{ id: string }> }
async function ownThread({ params }: Params) {
  const auth = await requireUser()
  if (auth.error) return { response: auth.response }
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success)
    return { response: NextResponse.json({ error: '잘못된 문의입니다.' }, { status: 400 }) }
  const db = createAdminClient()
  const userId = await findOrCreateSupabaseUser(db, auth.session.user!.email!)
  if (!userId) return { response: NextResponse.json({ error: '계정을 확인하지 못했습니다.' }, { status: 500 }) }
  const { data, error } = await db
    .schema('limbus')
    .from('inquiries')
    .select(INQUIRY_FIELDS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { response: NextResponse.json({ error: '문의를 불러오지 못했습니다.' }, { status: 500 }) }
  if (!data) return { response: NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 }) }
  return { auth, db, userId, thread: data as Inquiry }
}
/** Reading the thread marks every admin answer in it as seen. */
export async function GET(_request: Request, ctx: Params) {
  const r = await ownThread(ctx)
  if (!r.thread) return r.response
  const now = new Date().toISOString()
  const { error } = await r.db.schema('limbus').from('inquiries').update({ user_last_read_at: now }).eq('id', r.thread.id)
  const thread = { ...r.thread, support_messages: sortMessages(r.thread.support_messages) }
  if (!error) thread.user_last_read_at = now
  return NextResponse.json(thread, { headers: { 'Cache-Control': 'private, no-store' } })
}
/** Follow-up question; allowed until an administrator closes the thread. */
export async function POST(request: Request, ctx: Params) {
  const r = await ownThread(ctx)
  if (!r.thread) return r.response
  const limit = checkRequestRateLimit(request, {
    bucket: 'comment',
    scope: 'inquiry-messages',
    authenticatedKey: r.auth.session.user!.email,
  })
  if (!limit.allowed) return rateLimitResponse(limit)
  if (r.thread.status === 'closed')
    return NextResponse.json({ error: '종료된 문의입니다.' }, { status: 409 })
  const parsed = supportMessageSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '내용을 확인해주세요.' }, { status: 400 })
  const now = new Date().toISOString()
  const db = r.db.schema('limbus')
  const { error } = await db
    .from('support_messages')
    .insert({ inquiry_id: r.thread.id, author_role: 'user', author_id: r.userId, body: parsed.data.body, created_at: now })
  if (error) return NextResponse.json({ error: '메시지를 저장하지 못했습니다.' }, { status: 500 })
  const update = await db
    .from('inquiries')
    .update({ status: statusAfterMessage('user'), last_message_at: now, user_last_read_at: now, updated_at: now })
    .eq('id', r.thread.id)
  if (update.error) return NextResponse.json({ error: '문의 상태를 갱신하지 못했습니다.' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
