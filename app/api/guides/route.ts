import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { writeAuditLog } from '@/lib/audit'

// GET — 운용법 조회 (공개)
export async function GET(request: NextRequest) {
  const identityId = request.nextUrl.searchParams.get('identity_id')
  if (!identityId) {
    return NextResponse.json({ error: 'identity_id required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('limbus')
    .from('identity_guides')
    .select('id, identity_id, author_id, content, updated_at, created_at')
    .eq('identity_id', identityId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data) return NextResponse.json(null)

  // 작성자 이름 조회
  const { data: profile } = await admin
    .schema('limbus')
    .from('profiles')
    .select('username')
    .eq('id', data.author_id)
    .single()

  return NextResponse.json({
    ...data,
    author_name: profile?.username ?? null,
  })
}

// POST — 운용법 저장 (완장/관리자)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isWanjang) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { identity_id, content } = await request.json()
  if (!identity_id || typeof content !== 'string') {
    return NextResponse.json({ error: 'identity_id and content required' }, { status: 400 })
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

  // 기존 가이드 확인 (create vs update 판별)
  const { data: existing } = await admin
    .schema('limbus')
    .from('identity_guides')
    .select('id')
    .eq('identity_id', identity_id)
    .maybeSingle()

  const isUpdate = !!existing

  // upsert: 이미 있으면 업데이트, 없으면 생성
  const { data, error } = await admin
    .schema('limbus')
    .from('identity_guides')
    .upsert(
      { identity_id, author_id: userId, content },
      { onConflict: 'identity_id' }
    )
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
    action: isUpdate ? 'guide_update' : 'guide_create',
    targetType: 'guide',
    targetId: data.id,
    details: { identity_id, identity_name: ident?.name_kr },
  })

  return NextResponse.json(data)
}
