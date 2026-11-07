import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { isAllowedRequestOrigin } from '@/lib/request-origin'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { pushSubscriptionSchema } from '@/lib/push/schema'
import { pushKeys } from '@/lib/push/send'

const headers = { 'Cache-Control': 'private, no-store' }

/** The VAPID public key a browser subscribes with; null while the server has no keys (the switch then shows unsupported). */
export async function GET() {
  return NextResponse.json({ publicKey: pushKeys()?.publicKey ?? null }, { headers })
}

/** The signed-in, active account changing its own browser subscriptions, from this site only. */
async function account(request: Request) {
  if (request.headers.get('origin') && !isAllowedRequestOrigin(request.headers.get('origin'), new URL(request.url).origin, request.headers.get('host'), []))
    return { response: new Response(null, { status: 403, headers }) } as const
  const auth = await requireActiveUser()
  if (auth.error) return { response: auth.response } as const
  const user = auth.session.user!
  const limit = checkRequestRateLimit(request, { scope: 'push-subscribe', bucket: 'create', authenticatedKey: user.email })
  if (!limit.allowed) return { response: rateLimitResponse(limit) } as const
  const db = createAdminClient()
  const id = await findOrCreateSupabaseUser(db, user.email!, user.name, user.image)
  if (!id) return { response: NextResponse.json({ error: 'Account unavailable' }, { status: 503, headers }) } as const
  return { db, id } as const
}

/** Saves this browser's subscription for the account (a browser used by another account before now belongs to this one). */
export async function POST(request: Request) {
  const who = await account(request)
  if ('response' in who) return who.response
  const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400, headers })
  const { endpoint, keys, lang } = parsed.data
  const { error } = await who.db.schema('limbus').from('push_subscriptions')
    .upsert({ endpoint, user_id: who.id, p256dh: keys.p256dh, auth: keys.auth, lang }, { onConflict: 'endpoint' })
  return error ? NextResponse.json({ error: 'Unable to save' }, { status: 503, headers }) : NextResponse.json({ ok: true }, { headers })
}

/** Forgets this browser's subscription (switch turned off, or signing out). */
export async function DELETE(request: Request) {
  const who = await account(request)
  if ('response' in who) return who.response
  const parsed = z.object({ endpoint: z.string().max(1000) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400, headers })
  const { error } = await who.db.schema('limbus').from('push_subscriptions').delete().eq('endpoint', parsed.data.endpoint).eq('user_id', who.id)
  return error ? NextResponse.json({ error: 'Unable to delete' }, { status: 503, headers }) : NextResponse.json({ ok: true }, { headers })
}
