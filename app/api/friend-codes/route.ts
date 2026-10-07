import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorRateKey, resolveAuthor } from '@/lib/guest/server'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { codeForViewer, nextBumpedAt, parseSupportPost, slotAssetIds } from '@/lib/friends/codes'
import { isAuthorOf, ownerFilter, viewerOf, type FriendPostRow } from '@/lib/friends/server'

const COLUMNS = 'id,code,visibility,slots,identity_ids,user_id,key_hash,guest_tag,bumped_at,seen_at'
const LIST_LIMIT = 60
const HIDE_AFTER_MS = 30 * 24 * 60 * 60 * 1000
const SEEN_INTERVAL_MS = 10 * 60 * 1000
const UUID_RE = /^[0-9a-f-]{36}$/i

/** Support posts, newest first. A post's code is in the response only for viewers its visibility allows (REQ-COMMUNITY-020). */
export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient(), db = admin.schema('limbus')
    const viewer = await viewerOf(request, admin)
    const identity = request.nextUrl.searchParams.get('identity')
    if (identity && !UUID_RE.test(identity)) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    let query = db.from('friend_posts').select(COLUMNS).eq('kind', 'support')
      .gte('bumped_at', new Date(Date.now() - HIDE_AFTER_MS).toISOString()).order('bumped_at', { ascending: false }).limit(LIST_LIMIT)
    if (identity) query = query.contains('identity_ids', [identity])
    const { data, error } = await query
    if (error) throw error
    const rows = data as FriendPostRow[]

    const userIds = [...new Set(rows.map(row => row.user_id).filter((id): id is string => !!id))]
    const names = new Map<string, string>()
    if (userIds.length) {
      const profiles = await db.from('profiles').select('id,username').in('id', userIds)
      if (profiles.error) throw profiles.error
      for (const profile of profiles.data) names.set(profile.id, profile.username)
    }

    // Exchange posts: which ones this viewer already gave a code to, and the codes others gave to the viewer's own post.
    const exchanged = new Set<string>(), received = new Map<string, string[]>()
    const exchangeIds = rows.filter(row => row.visibility === 'exchange').map(row => row.id)
    if (viewer && exchangeIds.length) {
      const owner = ownerFilter(viewer, 'viewer_user_id', 'viewer_key_hash')
      const given = await db.from('friend_exchanges').select('post_id').in('post_id', exchangeIds).eq(owner.column, owner.value)
      if (given.error) throw given.error
      for (const row of given.data) exchanged.add(row.post_id)
      const mine = rows.filter(row => row.visibility === 'exchange' && isAuthorOf(row, viewer)).map(row => row.id)
      if (mine.length) {
        const got = await db.from('friend_exchanges').select('post_id,viewer_code').in('post_id', mine).order('created_at', { ascending: false }).limit(200)
        if (got.error) throw got.error
        for (const row of got.data) received.set(row.post_id, [...(received.get(row.post_id) ?? []), row.viewer_code])
      }
    }

    // The author is here: their post shows it, written at most every 10 minutes (REQ-COMMUNITY-023).
    const now = Date.now()
    const stale = rows.filter(row => isAuthorOf(row, viewer) && now - new Date(row.seen_at).getTime() > SEEN_INTERVAL_MS)
    if (stale.length) {
      const seenAt = new Date(now).toISOString()
      const touched = await db.from('friend_posts').update({ seen_at: seenAt }).in('id', stale.map(row => row.id))
      if (!touched.error) for (const row of stale) row.seen_at = seenAt
    }

    return NextResponse.json({
      signedIn: viewer?.kind === 'user',
      posts: rows.map(row => {
        const mine = isAuthorOf(row, viewer)
        return {
          id: row.id, visibility: row.visibility, slots: row.slots, mine, bumpedAt: row.bumped_at, seenAt: row.seen_at,
          author: row.user_id ? names.get(row.user_id) ?? null : null, guestTag: row.guest_tag,
          code: codeForViewer(row, { signedIn: viewer?.kind === 'user', mine, exchanged: exchanged.has(row.id) }),
          ...(mine && row.visibility === 'exchange' ? { received: received.get(row.id) ?? [] } : {}),
        }
      }),
    })
  } catch (error) {
    console.error('friend-codes GET', error)
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}

/** Saves the author's support post: one per author, so a second save replaces the first (REQ-COMMUNITY-019). */
export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient(), db = admin.schema('limbus')
    const resolved = await resolveAuthor(request, admin)
    if ('response' in resolved) return resolved.response
    const { author } = resolved
    const rateLimit = checkRequestRateLimit(request, { bucket: 'create', scope: author.kind === 'guest' ? 'friends:create:guest' : 'friends:create', authenticatedKey: authorRateKey(author) })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const body = await request.json().catch(() => null)
    const ids = slotAssetIds(body)
    const [identityRows, egoRows] = await Promise.all([
      ids.identities.length ? db.from('identities').select('id,sinner_id').in('id', ids.identities) : { data: [], error: null },
      ids.egos.length ? db.from('ego').select('id,sinner_id,grade').in('id', ids.egos) : { data: [], error: null },
    ])
    if (identityRows.error || egoRows.error) throw identityRows.error ?? egoRows.error
    const post = parseSupportPost(body,
      new Map((identityRows.data ?? []).map(row => [row.id as string, row.sinner_id as string])),
      new Map((egoRows.data ?? []).map(row => [row.id as string, { sinner: row.sinner_id as string, grade: String(row.grade) }])))
    if ('error' in post) return NextResponse.json({ error: post.error }, { status: 400 })

    const owner = ownerFilter(author)
    const existing = await db.from('friend_posts').select('id,bumped_at').eq('kind', 'support').eq(owner.column, owner.value).maybeSingle()
    if (existing.error) throw existing.error
    const now = new Date()
    const values = { code: post.code, visibility: post.visibility, slots: post.slots, identity_ids: post.identityIds, seen_at: now.toISOString() }
    const saved = existing.data
      ? await db.from('friend_posts').update({ ...values, bumped_at: nextBumpedAt(existing.data.bumped_at, now) }).eq('id', existing.data.id).select('id').single()
      : await db.from('friend_posts').insert({ ...values, kind: 'support',
          ...(author.kind === 'user' ? { user_id: author.userId } : { key_hash: author.keyHash, guest_tag: author.tag }) }).select('id').single()
    // The same code on another post: someone else's code, or the author's own post under another login.
    if (saved.error?.code === '23505') return NextResponse.json({ error: '이미 올라와 있는 친구 코드입니다.' }, { status: 409 })
    if (saved.error) throw saved.error
    return NextResponse.json({ id: saved.data.id }, { status: existing.data ? 200 : 201 })
  } catch (error) {
    console.error('friend-codes POST', error)
    return NextResponse.json({ error: '저장하지 못했습니다.' }, { status: 500 })
  }
}

/** Removes the author's own support post. */
export async function DELETE(request: NextRequest) {
  try {
    const admin = createAdminClient()
    const resolved = await resolveAuthor(request, admin)
    if ('response' in resolved) return resolved.response
    const owner = ownerFilter(resolved.author)
    const { error } = await admin.schema('limbus').from('friend_posts').delete().eq('kind', 'support').eq(owner.column, owner.value)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('friend-codes DELETE', error)
    return NextResponse.json({ error: '지우지 못했습니다.' }, { status: 500 })
  }
}
