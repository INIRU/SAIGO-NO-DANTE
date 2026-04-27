import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'

type ProfileSuspensionRow = {
  suspended: boolean | null
  suspension_reason: string | null
  suspended_until: string | null
}

const SUSPENSION_APPEAL_URL = 'https://discord.gg/efaGjQwsVB'

function isSuspensionActive(profile: ProfileSuspensionRow | null, now = Date.now()) {
  if (profile?.suspended !== true) return false
  if (!profile.suspended_until) return true
  const untilTime = new Date(profile.suspended_until).getTime()
  return Number.isFinite(untilTime) && untilTime > now
}

export async function GET() {
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

    const { data, error } = await admin
      .schema('limbus')
      .from('profiles')
      .select('suspended, suspension_reason, suspended_until')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const profile = data as ProfileSuspensionRow | null
    const active = isSuspensionActive(profile)

    return NextResponse.json({
      suspension: {
        active,
        reason: active ? profile?.suspension_reason ?? null : null,
        suspended_until: active ? profile?.suspended_until ?? null : null,
        suspendedUntil: active ? profile?.suspended_until ?? null : null,
        appeal_url: SUSPENSION_APPEAL_URL,
        appealUrl: SUSPENSION_APPEAL_URL,
        discord_url: process.env.NEXT_PUBLIC_DISCORD_URL ?? null,
        discordUrl: process.env.NEXT_PUBLIC_DISCORD_URL ?? null,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
