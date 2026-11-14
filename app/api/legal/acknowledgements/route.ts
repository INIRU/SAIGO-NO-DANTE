import { NextResponse } from 'next/server'
import { requireAccount } from '@/lib/auth-account'
import { getCurrentLegalDocs, getUserLegalAcknowledgements, toLegalStatusPayload } from '@/lib/data/legal'

export async function POST() {
  try {
    const auth = await requireAccount()
    if (auth.error) return auth.response
    const { admin, userId } = auth

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
      console.error('[api/legal/acknowledgements]', error)
      return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
    }

    const acknowledgements = await getUserLegalAcknowledgements(userId)
    return NextResponse.json({
      ok: true,
      legal: toLegalStatusPayload(docs, acknowledgements),
    })
  } catch (err: unknown) {
    console.error('[api/legal/acknowledgements]', err)
    return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
  }
}
