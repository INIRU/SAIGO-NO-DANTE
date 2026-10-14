import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { isAllowedRequestOrigin } from '@/lib/request-origin'
import { discoveryUserId } from '@/lib/discovery/user-id'
import { GIFT_PRESET_LIMIT } from '@/lib/mirror-dungeon/gift-presets'
import { giftPresetBodySchema } from '@/lib/mirror-dungeon/gift-preset-code'

const headers = { 'Cache-Control': 'private, no-store' }
const slotSchema = z.coerce.number().int().min(1).max(GIFT_PRESET_LIMIT)
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

/** GET never creates an account: a session without a profile simply has no presets. */
async function actor(request: NextRequest, create: boolean) {
  const auth = await requireActiveUser()
  if (auth.error) return auth.response as Response
  if (create) {
    if (!isAllowedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin, request.headers.get('host'), [])) return fail('Forbidden', 403)
    const limit = checkRequestRateLimit(request, { scope: 'mirror-dungeon:gift-presets', authenticatedKey: auth.session.user.email })
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
    // A failed lookup is not "no presets": the browser's presets would be uploaded over the stored ones.
    console.error('[gift-presets] account lookup failed:', error instanceof Error ? error.message : error)
    return fail('Presets unavailable', 503)
  }
  return { db: admin.schema('limbus'), id } as const
}

const toPreset = (row: { slot: number; name: string; groups: unknown; updated_at: string }) =>
  ({ slot: row.slot, name: row.name, groups: row.groups, updatedAt: row.updated_at })

export async function GET(request: NextRequest) {
  const who = await actor(request, false)
  if (who instanceof Response) return who
  if (!who.id) return NextResponse.json({ presets: [], slots: GIFT_PRESET_LIMIT }, { headers })
  const { data, error } = await who.db.from('gift_presets').select('slot, name, groups, updated_at').eq('user_id', who.id).order('slot')
  if (error) return fail('Presets unavailable', 503)
  return NextResponse.json({ presets: data.map(toPreset), slots: GIFT_PRESET_LIMIT }, { headers })
}

export async function PUT(request: NextRequest) {
  const raw: unknown = await request.json().catch(() => null)
  const slot = slotSchema.safeParse((raw as { slot?: unknown } | null)?.slot)
  const body = giftPresetBodySchema.safeParse(raw)
  if (!slot.success || !body.success) return fail('Invalid preset', 400)
  const who = await actor(request, true)
  if (who instanceof Response) return who
  if (!who.id) return fail('Account unavailable', 503)
  const { data, error } = await who.db.from('gift_presets')
    .upsert({ user_id: who.id, slot: slot.data, name: body.data.name, groups: body.data.groups, updated_at: new Date().toISOString() }, { onConflict: 'user_id,slot' })
    .select('slot, name, groups, updated_at').single()
  if (error) return fail('Presets unavailable', 503)
  return NextResponse.json({ preset: toPreset(data) }, { headers })
}

export async function DELETE(request: NextRequest) {
  const slot = slotSchema.safeParse(request.nextUrl.searchParams.get('slot'))
  if (!slot.success) return fail('Invalid slot', 400)
  const who = await actor(request, true)
  if (who instanceof Response) return who
  if (!who.id) return fail('Account unavailable', 503)
  const { error } = await who.db.from('gift_presets').delete().eq('user_id', who.id).eq('slot', slot.data)
  if (error) return fail('Presets unavailable', 503)
  return NextResponse.json({ ok: true }, { headers })
}
