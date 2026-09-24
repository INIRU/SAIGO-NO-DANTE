import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { INQUIRY_FIELDS, sortInbox, type Inquiry } from '@/lib/support'
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('inquiries')
    .select(INQUIRY_FIELDS)
    .order('created_at', { ascending: false })
    .limit(200)
  return error
    ? NextResponse.json({ error: '문의를 불러오지 못했습니다.' }, { status: 500 })
    : NextResponse.json(sortInbox((data ?? []) as unknown as Inquiry[]), {
        headers: { 'Cache-Control': 'private, no-store' },
      })
}
