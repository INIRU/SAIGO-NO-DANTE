import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guestKeyFrom, guestKeyHash } from '@/features/account/server'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const headers = { 'Cache-Control': 'private, no-store' }

/** GET /api/guest/posts — decks and plans written with the guest key in the x-guest-key header. */
export async function GET(request: Request) {
  const key = guestKeyFrom(request)
  if (!key) return NextResponse.json({ error: '익명 키가 올바르지 않습니다.' }, { status: 400, headers })
  const limit = checkRequestRateLimit(request, { bucket: 'readonly', scope: 'guest:posts', authenticatedKey: key.slice(0, 12) })
  if (!limit.allowed) return rateLimitResponse(limit)
  const admin = createAdminClient()
  const { data, error } = await admin.schema('limbus').from('guest_authorship')
    .select('deck_id, plan_id, decks(id, title, created_at), md_plans(id, title, created_at)')
    .eq('key_hash', guestKeyHash(key))
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: '익명 글을 불러오지 못했습니다.' }, { status: 500, headers })
  type Post = { id: string; title: string; created_at: string }
  const one = (value: Post | Post[] | null) => Array.isArray(value) ? value[0] ?? null : value
  const rows = (data ?? []) as unknown as { decks: Post | Post[] | null; md_plans: Post | Post[] | null }[]
  return NextResponse.json({
    decks: rows.map(row => one(row.decks)).filter((post): post is Post => post !== null),
    plans: rows.map(row => one(row.md_plans)).filter((post): post is Post => post !== null),
  }, { headers })
}
