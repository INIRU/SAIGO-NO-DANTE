import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentLegalDocs, getUserLegalAcknowledgements, toLegalStatusPayload } from '@/lib/data/legal'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(
      admin,
      session.user.email,
      session.user.name,
      session.user.image,
    )
    if (!userId) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
    }

    const docs = await getCurrentLegalDocs('ko')
    const rows = docs.map(doc => ({
      user_id: userId,
      doc_type: doc.type,
      version: doc.version,
      acknowledged_at: new Date().toISOString(),
    }))

    if (rows.length === 0) {
      return NextResponse.json({ error: '확인할 법률 문서가 없습니다.' }, { status: 500 })
    }

    const { error } = await admin
      .schema('limbus')
      .from('legal_acknowledgements')
      .upsert(rows, { onConflict: 'user_id,doc_type,version' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const acknowledgements = await getUserLegalAcknowledgements(userId)
    return NextResponse.json({
      ok: true,
      legal: toLegalStatusPayload(docs, acknowledgements),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
