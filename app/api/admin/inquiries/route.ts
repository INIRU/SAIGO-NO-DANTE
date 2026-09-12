import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('inquiries')
    .select(
      'id,title,content,category,status,reply,created_at,updated_at,replied_at,contribution_accepted',
    )
    .order('created_at', { ascending: false })
    .limit(200)
  return error
    ? NextResponse.json(
        { error: '문의를 불러오지 못했습니다.' },
        { status: 500 },
      )
    : NextResponse.json(data, {
        headers: { 'Cache-Control': 'private, no-store' },
      })
}
