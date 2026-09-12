import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { inquirySchema } from '@/lib/support'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
export async function GET() {
  const auth = await requireActiveUser()
  if (auth.error) return auth.response
  const db = createAdminClient()
  const userId = await findOrCreateSupabaseUser(db, auth.session.user!.email!)
  if (!userId)
    return NextResponse.json(
      { error: '계정을 확인하지 못했습니다.' },
      { status: 500 },
    )
  const { data, error } = await db
    .schema('limbus')
    .from('inquiries')
    .select(
      'id,title,content,category,status,reply,created_at,updated_at,replied_at,contribution_accepted',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  return error
    ? NextResponse.json(
        { error: '문의를 불러오지 못했습니다.' },
        { status: 500 },
      )
    : NextResponse.json(data, {
        headers: { 'Cache-Control': 'private, no-store' },
      })
}
export async function POST(request: Request) {
  const auth = await requireActiveUser()
  if (auth.error) return auth.response
  const limit = checkRequestRateLimit(request, {
    bucket: 'create',
    scope: 'inquiries',
    authenticatedKey: auth.session.user!.email,
  })
  if (!limit.allowed) return rateLimitResponse(limit)
  const parsed = inquirySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      { error: '제목과 문의 내용을 확인해주세요.' },
      { status: 400 },
    )
  const db = createAdminClient()
  const userId = await findOrCreateSupabaseUser(db, auth.session.user!.email!)
  if (!userId)
    return NextResponse.json(
      { error: '계정을 확인하지 못했습니다.' },
      { status: 500 },
    )
  const { data, error } = await db
    .schema('limbus')
    .from('inquiries')
    .insert({ ...parsed.data, user_id: userId })
    .select('id')
    .single()
  return error
    ? NextResponse.json(
        { error: '문의를 저장하지 못했습니다.' },
        { status: 500 },
      )
    : NextResponse.json(data, { status: 201 })
}
