import { NextResponse } from 'next/server'
import { requireAccount } from '@/lib/auth-account'

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
    const auth = await requireAccount()
    if (auth.error) return auth.response
    const { admin, userId } = auth

    const { data, error } = await admin
      .schema('limbus')
      .from('profiles')
      .select('suspended, suspension_reason, suspended_until')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[api/profile/suspension]', error)
      return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
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
    console.error('[api/profile/suspension]', err)
    return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
  }
}
