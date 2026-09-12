import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { inquiryReplySchema } from '@/lib/support'
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: '잘못된 문의입니다.' }, { status: 400 })
  const parsed = inquiryReplySchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success)
    return NextResponse.json(
      { error: '답변과 처리 상태를 확인해주세요.' },
      { status: 400 },
    )
  const db = createAdminClient()
  const actor = await findOrCreateSupabaseUser(db, auth.session.user!.email!)
  if (!actor)
    return NextResponse.json(
      { error: '관리자를 확인하지 못했습니다.' },
      { status: 500 },
    )
  const now = new Date().toISOString()
  const { data, error } = await db
    .schema('limbus')
    .from('inquiries')
    .update({
      ...parsed.data,
      replied_by: actor,
      replied_at: parsed.data.reply ? now : null,
      updated_at: now,
    })
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error)
    return NextResponse.json(
      { error: '답변을 저장하지 못했습니다.' },
      { status: 500 },
    )
  return data
    ? NextResponse.json(data)
    : NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 })
}
