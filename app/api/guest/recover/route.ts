import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guestKeyFrom, guestKeyHash, guestPinHash, type GuestPinKind } from '@/features/account/server'
import { isGuestPin } from '@/features/account'
import { FRIEND_CODE_RE } from '@/features/friends'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { isUuid } from '@/lib/utils/uuid'

const refuse = (code: string, status: number) => NextResponse.json({ code }, { status })
/** What limbus.guest_pin_recover answers when it does not hand the post over. */
const REFUSALS: Record<string, [code: string, status: number]> = { wrong: ['wrong_pin', 403], locked: ['pin_locked', 429], none: ['no_pin', 404] }
const AUDIT_TARGET = { deck: 'deck', plan: 'planner', friend: 'friend_post' } as const

/**
 * POST /api/guest/recover — a guest whose browser lost the key that wrote a post proves the post is theirs with its
 * password; the post then belongs to the key of this request.
 * Body: { kind: 'deck' | 'plan', id, pin } or { kind: 'support' | 'want', code, pin } (a friend post, by its friend code).
 * Refusals carry a code: wrong_pin, pin_locked (five wrong tries, 24 hours), no_pin, not_found, has_post.
 */
export async function POST(request: Request) {
  const key = guestKeyFrom(request)
  if (!key) return refuse('invalid_request', 400)
  // By address: a first line only (kept per server instance). The tries of a post are counted in the database.
  const limit = checkRequestRateLimit(request, { bucket: 'report', scope: 'guest:recover' })
  if (!limit.allowed) return rateLimitResponse(limit)
  const body = await request.json().catch(() => null) as { kind?: unknown; id?: unknown; code?: unknown; pin?: unknown } | null
  const pin = typeof body?.pin === 'string' && isGuestPin(body.pin) ? body.pin : null
  const friendKind = body?.kind === 'support' || body?.kind === 'want' ? body.kind : null
  const pinKind: GuestPinKind | null = friendKind ? 'friend' : body?.kind === 'deck' || body?.kind === 'plan' ? body.kind : null
  const target = friendKind ? body?.code : body?.id
  if (!pin || !pinKind || typeof target !== 'string' || !(friendKind ? FRIEND_CODE_RE.test(target) : isUuid(target))) return refuse('invalid_request', 400)

  try {
    const db = createAdminClient().schema('limbus')
    // Hashed as the database writes ids (lower case): an address typed in capitals names the same post.
    let id = target.toLowerCase()
    if (friendKind) {
      const found = await db.from('friend_posts').select('id').eq('kind', friendKind).eq('code', target).not('key_hash', 'is', null).maybeSingle()
      if (found.error) throw found.error
      if (!found.data) return refuse('not_found', 404)
      id = found.data.id
    }
    const keyHash = guestKeyHash(key)
    const { data, error } = await db.rpc('guest_pin_recover', { p_kind: pinKind, p_id: id, p_pin_hash: guestPinHash(pinKind, id, pin), p_key_hash: keyHash })
    // friend_posts allows one post of a kind per key: this browser already wrote one.
    if (error?.code === '23505') return refuse('has_post', 409)
    if (error) throw error
    if (data !== 'ok') { const [code, status] = REFUSALS[data as string] ?? REFUSALS.none; return refuse(code, status) }
    // Who took it: the tag this key's posts are shown with.
    await writeAuditLog({ actorId: null, action: 'guest_recover', targetType: AUDIT_TARGET[pinKind], targetId: id, details: { tag: keyHash.slice(0, 4) } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('guest recover', error)
    return NextResponse.json({ error: '불러오지 못했습니다.' }, { status: 500 })
  }
}
