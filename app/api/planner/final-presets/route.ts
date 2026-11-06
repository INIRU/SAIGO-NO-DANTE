import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { isAllowedRequestOrigin } from '@/lib/request-origin'
import { MAX_PRESET_GIFTS, MAX_PRESET_NAME, USER_SLOTS, isFinalGiftKey } from '@/lib/planner/final-presets'
import { discoveryUserId } from '@/features/community/server'

const headers = { 'Cache-Control': 'private, no-store' }
const slotSchema = z.coerce.number().int().min(1).max(USER_SLOTS)
const bodySchema = z.object({
  slot: slotSchema,
  name: z.string().trim().min(1).max(MAX_PRESET_NAME),
  gift_keys: z.array(z.string().refine(isFinalGiftKey)).max(MAX_PRESET_GIFTS),
})
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

/** GET never creates an account: a session without a profile simply has no presets. */
async function actor(request: NextRequest, create: boolean) {
  const auth = await requireActiveUser()
  if (auth.error) return auth.response as Response
  if (create) {
    if (!isAllowedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin, request.headers.get('host'), [])) return fail('Forbidden', 403)
    const limit = checkRequestRateLimit(request, { scope: 'planner:final-presets', authenticatedKey: auth.session.user.email })
    if (!limit.allowed) return rateLimitResponse(limit)
  }
  const admin = createAdminClient()
  const email = auth.session.user.email!
  let id: string | null
  try {
    id = create
      ? await findOrCreateSupabaseUser(admin, email, auth.session.user.name, auth.session.user.image)
      : await discoveryUserId(admin.schema('limbus'), email)
  } catch (error) {
    // A failed lookup is not "no presets": the list would look empty although the presets are stored.
    console.error('[final-presets] account lookup failed:', error instanceof Error ? error.message : error)
    return fail('Presets unavailable', 503)
  }
  return { db: admin.schema('limbus'), id } as const
}

const toPreset = (row: { slot: number; name: string; gift_keys: string[]; updated_at: string }) =>
  ({ slot: row.slot, name: row.name, giftKeys: row.gift_keys, updatedAt: row.updated_at })

export async function GET(request: NextRequest) {
  const who = await actor(request, false)
  if (who instanceof Response) return who
  if (!who.id) return NextResponse.json({ presets: [], slots: USER_SLOTS }, { headers })
  const { data, error } = await who.db.from('final_gift_presets').select('slot, name, gift_keys, updated_at').eq('user_id', who.id).order('slot')
  if (error) return fail('Presets unavailable', 503)
  return NextResponse.json({ presets: data.map(toPreset), slots: USER_SLOTS }, { headers })
}

export async function PUT(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail('Invalid preset', 400)
  const who = await actor(request, true)
  if (who instanceof Response) return who
  if (!who.id) return fail('Account unavailable', 503)
  const { slot, name, gift_keys } = parsed.data
  const { data, error } = await who.db.from('final_gift_presets')
    .upsert({ user_id: who.id, slot, name, gift_keys, updated_at: new Date().toISOString() }, { onConflict: 'user_id,slot' })
    .select('slot, name, gift_keys, updated_at').single()
  if (error) return fail('Presets unavailable', 503)
  return NextResponse.json({ preset: toPreset(data) }, { headers })
}

export async function DELETE(request: NextRequest) {
  const slot = slotSchema.safeParse(request.nextUrl.searchParams.get('slot'))
  if (!slot.success) return fail('Invalid slot', 400)
  const who = await actor(request, true)
  if (who instanceof Response) return who
  if (!who.id) return fail('Account unavailable', 503)
  const { error } = await who.db.from('final_gift_presets').delete().eq('user_id', who.id).eq('slot', slot.data)
  if (error) return fail('Presets unavailable', 503)
  return NextResponse.json({ ok: true }, { headers })
}
