import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentLegalDocs, getLegalDoc, getUserLegalAcknowledgements, toLegalStatusPayload, type LegalDoc } from '@/lib/data/legal'
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

function buildSuspensionPayload(profile: ProfileSuspensionRow | null) {
  const active = isSuspensionActive(profile)
  return {
    active,
    reason: active ? profile?.suspension_reason ?? null : null,
    suspended_until: active ? profile?.suspended_until ?? null : null,
    suspendedUntil: active ? profile?.suspended_until ?? null : null,
    appeal_url: SUSPENSION_APPEAL_URL,
    appealUrl: SUSPENSION_APPEAL_URL,
    discord_url: process.env.NEXT_PUBLIC_DISCORD_URL ?? null,
    discordUrl: process.env.NEXT_PUBLIC_DISCORD_URL ?? null,
  }
}

// Full text in the reader's language (Korean when missing), so the update modal can require reading it before agreeing.
async function legalTexts(lang: string) {
  const docType = async (type: LegalDoc['type']) => (await getLegalDoc(type, lang)) ?? (lang === 'ko' ? null : getLegalDoc(type, 'ko'))
  return (await Promise.all([docType('terms'), docType('privacy')])).filter((doc): doc is LegalDoc => doc !== null)
}

export async function GET(request: Request) {
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

    const [docs, acknowledgements, profileRes] = await Promise.all([
      getCurrentLegalDocs('ko'),
      getUserLegalAcknowledgements(userId),
      admin
        .schema('limbus')
        .from('profiles')
        .select('suspended, suspension_reason, suspended_until')
        .eq('id', userId)
        .maybeSingle(),
    ])

    if (profileRes.error) {
      console.error('[api/legal/status]', profileRes.error)
      return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
    }

    const legal = toLegalStatusPayload(docs, acknowledgements)
    const lang = new URL(request.url).searchParams.get('lang')
    return NextResponse.json({
      legal,
      texts: legal.required && lang ? await legalTexts(['ko', 'en', 'ja'].includes(lang) ? lang : 'ko') : undefined,
      suspension: buildSuspensionPayload(profileRes.data as ProfileSuspensionRow | null),
    })
  } catch (err: unknown) {
    console.error('[api/legal/status]', err)
    return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
  }
}
