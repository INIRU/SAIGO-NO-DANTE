import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = createAdminClient()

    const [profilesRes, decksRes, authRes] = await Promise.all([
      supabase
        .schema('limbus')
        .from('profiles')
        .select('id, username, avatar_url, role, suspended, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .schema('limbus')
        .from('decks')
        .select('user_id'),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
    ])

    if (profilesRes.error) {
      return NextResponse.json({ error: profilesRes.error.message }, { status: 500 })
    }

    // auth.users에서 이메일 매핑
    const emailMap = new Map<string, string>()
    for (const u of authRes.data?.users ?? []) {
      if (u.email) emailMap.set(u.id, u.email)
    }

    // 덱 수 카운트
    const countMap = new Map<string, number>()
    for (const d of decksRes.data ?? []) {
      countMap.set(d.user_id, (countMap.get(d.user_id) ?? 0) + 1)
    }

    const users = (profilesRes.data ?? []).map(p => ({
      ...p,
      email: emailMap.get(p.id) ?? null,
      role: p.role ?? 'user',
      suspended: p.suspended ?? false,
      deck_count: countMap.get(p.id) ?? 0,
    }))

    return NextResponse.json(users)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
