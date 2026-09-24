import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import {
  INQUIRY_FIELDS,
  inquiryAdminPatchSchema,
  sortMessages,
  statusAfterMessage,
  statusOnReopen,
  supportMessageSchema,
  type Inquiry,
} from '@/lib/support'
type Params = { params: Promise<{ id: string }> }
async function adminThread({ params }: Params) {
  const auth = await requireAdmin()
  if (auth.error) return { response: auth.response }
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success)
    return { response: NextResponse.json({ error: '잘못된 문의입니다.' }, { status: 400 }) }
  const db = createAdminClient()
  const { data, error } = await db.schema('limbus').from('inquiries').select(INQUIRY_FIELDS).eq('id', id).maybeSingle()
  if (error) return { response: NextResponse.json({ error: '문의를 불러오지 못했습니다.' }, { status: 500 }) }
  if (!data) return { response: NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 }) }
  return { auth, db, thread: data as unknown as Inquiry }
}
export async function GET(_request: Request, ctx: Params) {
  const r = await adminThread(ctx)
  if (!r.thread) return r.response
  return NextResponse.json(
    { ...r.thread, support_messages: sortMessages(r.thread.support_messages) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
/** Admin answer. reply/replied_* mirror the latest answer for the contribution review. */
export async function POST(request: Request, ctx: Params) {
  const r = await adminThread(ctx)
  if (!r.thread) return r.response
  if (r.thread.status === 'closed')
    return NextResponse.json({ error: '종료된 문의입니다. 다시 연 후 답변해주세요.' }, { status: 409 })
  const parsed = supportMessageSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '답변을 입력해주세요.' }, { status: 400 })
  const actor = await findOrCreateSupabaseUser(r.db, r.auth.session.user!.email!)
  if (!actor) return NextResponse.json({ error: '관리자를 확인하지 못했습니다.' }, { status: 500 })
  const now = new Date().toISOString()
  const db = r.db.schema('limbus')
  const { error } = await db
    .from('support_messages')
    .insert({ inquiry_id: r.thread.id, author_role: 'admin', author_id: actor, body: parsed.data.body, created_at: now })
  if (error) return NextResponse.json({ error: '답변을 저장하지 못했습니다.' }, { status: 500 })
  const update = await db
    .from('inquiries')
    .update({
      status: statusAfterMessage('admin'),
      reply: parsed.data.body,
      replied_by: actor,
      replied_at: now,
      last_message_at: now,
      last_admin_message_at: now,
      updated_at: now,
    })
    .eq('id', r.thread.id)
  if (update.error) return NextResponse.json({ error: '문의 상태를 갱신하지 못했습니다.' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
/** Close, reopen, or toggle the data contribution award. */
export async function PATCH(request: Request, ctx: Params) {
  const r = await adminThread(ctx)
  if (!r.thread) return r.response
  const parsed = inquiryAdminPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '변경할 내용을 확인해주세요.' }, { status: 400 })
  const { closed, contribution_accepted } = parsed.data
  if (contribution_accepted && (r.thread.category !== 'data' || !r.thread.reply.trim()))
    return NextResponse.json({ error: '데이터 수정 문의에 답변한 후 승인할 수 있습니다.' }, { status: 400 })
  const now = new Date().toISOString()
  const { error } = await r.db
    .schema('limbus')
    .from('inquiries')
    .update({
      ...(closed === undefined
        ? {}
        : closed
          ? { status: 'closed', closed_at: now }
          : { status: statusOnReopen(r.thread), closed_at: null }),
      ...(contribution_accepted === undefined ? {} : { contribution_accepted }),
      updated_at: now,
    })
    .eq('id', r.thread.id)
  return error
    ? NextResponse.json({ error: '문의를 저장하지 못했습니다.' }, { status: 500 })
    : NextResponse.json({ ok: true })
}
