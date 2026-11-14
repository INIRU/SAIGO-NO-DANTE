import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/find-or-create-user'
import { INQUIRY_FIELDS, inquirySchema } from '@/lib/support'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
export async function GET() {
  const auth = await requireUser()
  if (auth.error) return auth.response
  const db = createAdminClient()
  const userId = await findOrCreateSupabaseUser(db, auth.session.user!.email!)
  if (!userId)
    return NextResponse.json({ error: '계정을 확인하지 못했습니다.' }, { status: 500 })
  // Whole threads feed the list preview; fine for short support threads, page it if threads grow long.
  const { data, error } = await db
    .schema('limbus')
    .from('inquiries')
    .select(INQUIRY_FIELDS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  return error
    ? NextResponse.json({ error: '문의를 불러오지 못했습니다.' }, { status: 500 })
    : NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.error) return auth.response
  const limit = checkRequestRateLimit(request, {
    bucket: 'create',
    scope: 'inquiries',
    authenticatedKey: auth.session.user!.email,
  })
  if (!limit.allowed) return rateLimitResponse(limit)
  const parsed = inquirySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json({ error: '제목과 문의 내용을 확인해주세요.' }, { status: 400 })
  const db = createAdminClient()
  const userId = await findOrCreateSupabaseUser(db, auth.session.user!.email!)
  if (!userId)
    return NextResponse.json({ error: '계정을 확인하지 못했습니다.' }, { status: 500 })
  const now = new Date().toISOString()
  const { data, error } = await db
    .schema('limbus')
    .from('inquiries')
    .insert({ ...parsed.data, user_id: userId, last_message_at: now })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: '문의를 저장하지 못했습니다.' }, { status: 500 })
  const first = await db
    .schema('limbus')
    .from('support_messages')
    .insert({ inquiry_id: data.id, author_role: 'user', author_id: userId, body: parsed.data.content, created_at: now })
  if (first.error) {
    await db.schema('limbus').from('inquiries').delete().eq('id', data.id)
    return NextResponse.json({ error: '문의를 저장하지 못했습니다.' }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
