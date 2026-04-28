import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomBytes } from 'crypto'
import { authOptions } from '@/lib/auth'
import { getRequestMetadata, hashDeviceToken } from '@/lib/request-meta'
import { createAdminClient } from '@/lib/supabase/admin'

const DEVICE_COOKIE_NAME = 'sdd_device_token'
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function createDeviceToken() {
  return randomBytes(32).toString('base64url')
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { ipHash, ipMasked, userAgentHash, country } = getRequestMetadata(request)
    const existingDeviceToken = request.cookies.get(DEVICE_COOKIE_NAME)?.value ?? null
    const deviceToken = existingDeviceToken || createDeviceToken()
    const deviceHash = hashDeviceToken(deviceToken)
    const admin = createAdminClient()
    const { error } = await admin
      .schema('limbus')
      .rpc('record_profile_activity', {
        user_email: session.user.email,
        request_ip_hash: ipHash,
        request_ip_masked: ipMasked,
        request_user_agent_hash: userAgentHash,
        request_country: country,
        request_device_hash: deviceHash,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const response = NextResponse.json({ ok: true })
    if (!existingDeviceToken) {
      response.cookies.set(DEVICE_COOKIE_NAME, deviceToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: DEVICE_COOKIE_MAX_AGE,
      })
    }

    return response
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
