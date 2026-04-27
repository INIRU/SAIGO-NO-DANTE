import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestMetadata } from '@/lib/request-meta'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { ipHash, ipMasked, userAgentHash, country } = getRequestMetadata(request)
    const admin = createAdminClient()
    const { error } = await admin
      .schema('limbus')
      .rpc('record_profile_activity', {
        user_email: session.user.email,
        request_ip_hash: ipHash,
        request_ip_masked: ipMasked,
        request_user_agent_hash: userAgentHash,
        request_country: country,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
