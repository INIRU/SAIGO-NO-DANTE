import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { writeAuditLog } from '@/lib/audit'


// GET — 운영법 목록 조회 (공개)
export async function GET(request: NextRequest) {
  try {
    const identityId = request.nextUrl.searchParams.get('identity_id')
    if (!identityId) {
      return NextResponse.json({ error: 'identity_id required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .schema('limbus')
      .from('identity_guides')
      .select('id, identity_id, author_id, title, content, updated_at, created_at')
      .eq('identity_id', identityId)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!data || data.length === 0) return NextResponse.json([])

    // 작성자 이름 일괄 조회
    const authorIds = [...new Set(data.map(g => g.author_id))]
    const { data: profiles } = await admin
      .schema('limbus')
      .from('profiles')
      .select('id, username')
      .in('id', authorIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p.username]) ?? [])

    return NextResponse.json(
      data.map(g => ({
        ...g,
        author_name: profileMap.get(g.author_id) ?? null,
      }))
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST — 운영법 생성 (완장/관리자)
export async function POST(request: Request) {
  try {
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    if (!session.user?.isWanjang) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { identity_id, title, content } = await request.json()
    if (!identity_id || typeof content !== 'string' || typeof title !== 'string') {
      return NextResponse.json({ error: 'identity_id, title, and content required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email!,
      session.user.name,
      session.user.image,
    )
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 500 })
    }

    const { data, error } = await admin
      .schema('limbus')
      .from('identity_guides')
      .insert({ identity_id, author_id: userId, title, content })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 인격 이름 조회 (감사 로그용)
    const { data: ident } = await admin
      .schema('limbus')
      .from('identities')
      .select('name_kr')
      .eq('id', identity_id)
      .single()

    writeAuditLog({
      actorId: userId,
      action: 'guide_create',
      targetType: 'guide',
      targetId: data.id,
      details: { identity_id, identity_name: ident?.name_kr, title },
    })

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
