import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
/** Navbar dot: one RPC, no account creation. */
export async function GET() {
  const auth = await requireActiveUser()
  if (auth.error) return auth.response
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .rpc('support_unread', { user_email: auth.session.user!.email! })
  return error
    ? NextResponse.json({ error: '문의 상태를 불러오지 못했습니다.' }, { status: 500 })
    : NextResponse.json({ unread: data === true }, { headers: { 'Cache-Control': 'private, no-store' } })
}
