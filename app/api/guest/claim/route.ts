import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireActiveUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/find-or-create-user'
import { guestKeyHash } from '@/features/account/server'
import { isGuestKey } from '@/features/account'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

/**
 * POST /api/guest/claim { key } — moves every deck and plan written with the guest key to the signed-in account.
 * Activity points are recorded as the account's (daily limits still apply). The key stops working afterwards.
 */
export async function POST(request: Request) {
  const auth = await requireActiveUser()
  if (auth.error) return auth.response
  const email = auth.session.user!.email!
  const limit = checkRequestRateLimit(request, { bucket: 'write', scope: 'guest:claim', authenticatedKey: email })
  if (!limit.allowed) return rateLimitResponse(limit)
  const body = await request.json().catch(() => null) as { key?: unknown } | null
  const key = typeof body?.key === 'string' ? body.key.trim() : ''
  if (!isGuestKey(key)) return NextResponse.json({ error: '익명 키가 올바르지 않습니다.' }, { status: 400 })

  const admin = createAdminClient()
  const userId = await findOrCreateSupabaseUser(admin, email, auth.session.user!.name, auth.session.user!.image)
  if (!userId) return NextResponse.json({ error: '계정을 확인하지 못했습니다.' }, { status: 500 })
  const keyHash = guestKeyHash(key)
  const { data: rows, error } = await admin.schema('limbus').from('guest_authorship').select('deck_id, plan_id').eq('key_hash', keyHash)
  if (error) return NextResponse.json({ error: '익명 글을 불러오지 못했습니다.' }, { status: 500 })
  const deckIds = (rows ?? []).map(row => row.deck_id).filter((id): id is string => Boolean(id))
  const planIds = (rows ?? []).map(row => row.plan_id).filter((id): id is string => Boolean(id))
  if (!deckIds.length && !planIds.length) return NextResponse.json({ decks: 0, plans: 0 })

  // Owner first, then drop the key rows: if a step fails the posts stay editable with the key.
  const moved = await Promise.all([
    deckIds.length ? admin.schema('limbus').from('decks').update({ user_id: userId, guest_tag: null }).in('id', deckIds).is('user_id', null) : { error: null },
    planIds.length ? admin.schema('limbus').from('md_plans').update({ user_id: userId, guest_tag: null }).in('id', planIds).is('user_id', null) : { error: null },
  ])
  if (moved.some(result => result.error)) return NextResponse.json({ error: '옮기지 못했습니다. 다시 시도해주세요.' }, { status: 500 })
  await admin.schema('limbus').from('guest_authorship').delete().eq('key_hash', keyHash)
  await Promise.all([
    ...deckIds.map(id => admin.schema('limbus').rpc('community_record_deck', { p_deck_id: id, p_user_id: userId })),
    ...planIds.map(id => admin.schema('limbus').rpc('community_record_plan', { p_plan_id: id, p_user_id: userId })),
  ])
  await writeAuditLog({ actorId: userId, action: 'guest_claim', targetType: 'profile', targetId: userId, details: { decks: deckIds.length, plans: planIds.length } })
  for (const id of deckIds) revalidateTag(CACHE_TAGS.deck(id), 'max')
  for (const id of planIds) revalidateTag(CACHE_TAGS.plan(id), 'max')
  revalidateTag(CACHE_TAGS.decksList, 'max')
  revalidateTag(CACHE_TAGS.plansList, 'max')
  return NextResponse.json({ decks: deckIds.length, plans: planIds.length })
}
