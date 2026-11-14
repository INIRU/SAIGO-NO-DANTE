import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/find-or-create-user'
import { EASTER_EGGS, type EasterEgg } from '@/lib/easter-eggs'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const headers = { 'Cache-Control': 'private, no-store' }

async function owner() {
  const auth = await requireUser()
  if (auth.error) return { response: auth.response } as const
  const admin = createAdminClient()
  const id = await findOrCreateSupabaseUser(admin, auth.session.user!.email!, auth.session.user!.name, auth.session.user!.image)
  return id ? { admin, id, email: auth.session.user!.email! } as const : { response: NextResponse.json({ error: '계정을 확인하지 못했습니다.' }, { status: 500 }) } as const
}

/** GET /api/profile/eggs — easter eggs this account has found. */
export async function GET() {
  const me = await owner()
  if ('response' in me) return me.response
  const { data, error } = await me.admin.schema('limbus').from('profile_easter_eggs').select('egg').eq('user_id', me.id)
  if (error) return NextResponse.json({ error: '불러오지 못했습니다.' }, { status: 500, headers })
  return NextResponse.json({ eggs: (data ?? []).map(row => row.egg) }, { headers })
}

/** POST /api/profile/eggs { eggs } — adds eggs found in this browser to the account; returns the merged list. */
export async function POST(request: Request) {
  const me = await owner()
  if ('response' in me) return me.response
  const limit = checkRequestRateLimit(request, { bucket: 'write', scope: 'profile:eggs', authenticatedKey: me.email })
  if (!limit.allowed) return rateLimitResponse(limit)
  const body = await request.json().catch(() => null) as { eggs?: unknown } | null
  const eggs = Array.isArray(body?.eggs) ? EASTER_EGGS.filter(egg => (body.eggs as unknown[]).includes(egg)) : []
  if (eggs.length) {
    const { error } = await me.admin.schema('limbus').from('profile_easter_eggs')
      .upsert(eggs.map((egg: EasterEgg) => ({ user_id: me.id, egg })), { onConflict: 'user_id,egg', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: '저장하지 못했습니다.' }, { status: 500, headers })
  }
  return GET()
}
