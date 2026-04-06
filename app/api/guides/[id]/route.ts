import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { writeAuditLog } from '@/lib/audit'


// PATCH — 운영법 수정 (완장/관리자)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isWanjang && !session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const { title, content } = await request.json()
    if (typeof content !== 'string' || typeof title !== 'string') {
      return NextResponse.json({ error: 'title and content required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email!,
      session.user.name,
      session.user.image,
    )

    // 인격 이름 조회 (감사 로그용)
    const { data: guide } = await admin
      .schema('limbus')
      .from('identity_guides')
      .select('identity_id')
      .eq('id', id)
      .single()

    const { error } = await admin
      .schema('limbus')
      .from('identity_guides')
      .update({ title, content, author_id: userId })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (guide) {
      const { data: ident } = await admin
        .schema('limbus')
        .from('identities')
        .select('name_kr')
        .eq('id', guide.identity_id)
        .single()

      writeAuditLog({
        actorId: userId,
        action: 'guide_update',
        targetType: 'guide',
        targetId: id,
        details: { identity_id: guide.identity_id, identity_name: ident?.name_kr },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE — 운영법 삭제 (관리자만)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const admin = createAdminClient()

    // 삭제 전 정보 조회 (감사 로그용)
    const { data: guide } = await admin
      .schema('limbus')
      .from('identity_guides')
      .select('identity_id')
      .eq('id', id)
      .single()

    const { error } = await admin
      .schema('limbus')
      .from('identity_guides')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 감사 로그
    const actorId = await findOrCreateSupabaseUser(
      admin, session.user.email!, session.user.name, session.user.image,
    )

    if (guide) {
      const { data: ident } = await admin
        .schema('limbus')
        .from('identities')
        .select('name_kr')
        .eq('id', guide.identity_id)
        .single()

      writeAuditLog({
        actorId,
        action: 'guide_delete',
        targetType: 'guide',
        targetId: id,
        details: { identity_id: guide.identity_id, identity_name: ident?.name_kr },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
