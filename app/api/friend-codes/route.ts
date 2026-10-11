import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorRateKey, guestPinOf, resolveAuthor, type Author } from '@/lib/guest/server'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { codeForViewer, fail, newlyWanted, seenIsStale, nextBumpedAt, parseSupportPost, parseWantPost, slotAssetIds, wantExpiresAt, wantIdentityIds } from '@/lib/friends/codes'
import { friendAuthorColumns, isAuthorOf, isBlocked, ownerFilter, viewerOf, type FriendPostRow } from '@/lib/friends/server'

const COLUMNS = 'id,code,visibility,slots,identity_ids,user_id,key_hash,guest_tag,created_at,bumped_at,seen_at'
const LIST_LIMIT = 60
const HIDE_AFTER_MS = 30 * 24 * 60 * 60 * 1000
const WANT_LIFE_MS = 24 * 60 * 60 * 1000
type Db = ReturnType<ReturnType<typeof createAdminClient>['schema']>
const kindOf = (value: unknown) => value === 'want' ? 'want' : 'support'

/** Want posts live one day (REQ-COMMUNITY-022): the expired ones are deleted whenever want posts are read or written. */
const dropExpiredWants = (db: Db) => db.from('friend_posts').delete().eq('kind', 'want').lt('created_at', new Date(Date.now() - WANT_LIFE_MS).toISOString())
const UUID_RE = /^[0-9a-f-]{36}$/i

/**
 * Posts of a kind (?kind=want, support by default), newest first, optionally only those with ?identity=<id>. A post's code
 * is in the response only for viewers its visibility allows (REQ-COMMUNITY-020). own: the viewer's post of this kind, also
 * when the filter or its age keeps it out of the list.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient(), db = admin.schema('limbus')
    const viewer = await viewerOf(request, admin)
    const identity = request.nextUrl.searchParams.get('identity')
    if (identity && !UUID_RE.test(identity)) return NextResponse.json(fail('invalid_request'), { status: 400 })
    const kind = kindOf(request.nextUrl.searchParams.get('kind'))
    if (kind === 'want') await dropExpiredWants(db)
    let query = db.from('friend_posts').select(COLUMNS).eq('kind', kind).order('bumped_at', { ascending: false }).limit(LIST_LIMIT)
    query = kind === 'want' ? query.gte('created_at', new Date(Date.now() - WANT_LIFE_MS).toISOString()) : query.gte('bumped_at', new Date(Date.now() - HIDE_AFTER_MS).toISOString())
    if (identity) query = query.contains('identity_ids', [identity])
    const { data, error } = await query
    if (error) throw error
    const rows = data as FriendPostRow[]

    let ownRow = rows.find(row => isAuthorOf(row, viewer)) ?? null
    if (viewer && !ownRow) {
      const owner = ownerFilter(viewer)
      const found = await db.from('friend_posts').select(COLUMNS).eq('kind', kind).eq(owner.column, owner.value).maybeSingle()
      if (found.error) throw found.error
      ownRow = found.data as FriendPostRow | null
    }
    const all = ownRow && !rows.includes(ownRow) ? [...rows, ownRow] : rows

    const userIds = [...new Set(all.map(row => row.user_id).filter((id): id is string => !!id))]
    const names = new Map<string, string>()
    if (userIds.length) {
      const profiles = await db.from('profiles').select('id,username').in('id', userIds)
      if (profiles.error) throw profiles.error
      for (const profile of profiles.data) names.set(profile.id, profile.username)
    }

    // Exchange posts: which ones this viewer already gave a code to, and the codes others gave to the viewer's own post.
    const exchanged = new Set<string>(), received = new Map<string, string[]>()
    const exchangeIds = all.filter(row => row.visibility === 'exchange').map(row => row.id)
    if (viewer && exchangeIds.length) {
      const owner = ownerFilter(viewer, 'viewer_user_id', 'viewer_key_hash')
      const given = await db.from('friend_exchanges').select('post_id').in('post_id', exchangeIds).eq(owner.column, owner.value)
      if (given.error) throw given.error
      for (const row of given.data) exchanged.add(row.post_id)
      if (ownRow?.visibility === 'exchange') {
        const got = await db.from('friend_exchanges').select('post_id,viewer_code').eq('post_id', ownRow.id).order('created_at', { ascending: false }).limit(200)
        if (got.error) throw got.error
        received.set(ownRow.id, got.data.map(row => row.viewer_code))
      }
    }

    // Approval posts (REQ-COMMUNITY-028): this viewer's request on each, and everyone's requests on the viewer's own post.
    // The table comes with a later migration than the board: until it is applied there are simply no requests.
    const requestOf = new Map<string, string>()
    let requests: { id: string; name: string | null; userId: string | null; guestTag: string | null; status: string; createdAt: string }[] = []
    const approvalIds = all.filter(row => row.visibility === 'approval').map(row => row.id)
    const noTable = (error: { code?: string } | null) => error?.code === '42P01' || error?.code === 'PGRST205'
    if (viewer && approvalIds.length) {
      const owner = ownerFilter(viewer, 'viewer_user_id', 'viewer_key_hash')
      const asked = await db.from('friend_requests').select('post_id,status').in('post_id', approvalIds).eq(owner.column, owner.value)
      if (asked.error && !noTable(asked.error)) throw asked.error
      for (const row of asked.data ?? []) requestOf.set(row.post_id, row.status)
      if (ownRow?.visibility === 'approval') {
        const got = await db.from('friend_requests').select('id,viewer_user_id,viewer_tag,status,created_at').eq('post_id', ownRow.id).order('created_at', { ascending: false }).limit(200)
        if (got.error && !noTable(got.error)) throw got.error
        const askers = [...new Set((got.data ?? []).map(row => row.viewer_user_id).filter((id): id is string => !!id && !names.has(id)))]
        if (askers.length) {
          const profiles = await db.from('profiles').select('id,username').in('id', askers)
          if (profiles.error) throw profiles.error
          for (const profile of profiles.data) names.set(profile.id, profile.username)
        }
        requests = (got.data ?? []).map(row => ({ id: row.id, name: row.viewer_user_id ? names.get(row.viewer_user_id) ?? null : null, userId: row.viewer_user_id, guestTag: row.viewer_tag, status: row.status, createdAt: row.created_at }))
      }
    }

    // The author is here: their post shows it, written at most every 10 minutes (REQ-COMMUNITY-023).
    const now = Date.now()
    if (ownRow && seenIsStale(ownRow.seen_at, now)) {
      const seenAt = new Date(now).toISOString()
      const touched = await db.from('friend_posts').update({ seen_at: seenAt }).eq('id', ownRow.id)
      if (!touched.error) ownRow.seen_at = seenAt
    }

    // Want posts come with the identities asked for most in the last seven days (the counts outlive the posts).
    let wanted: { identityId: string; count: number }[] | undefined
    if (kind === 'want') {
      const stats = await db.from('friend_want_stats').select('identity_id,count').gte('day', new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).limit(5000)
      if (stats.error) throw stats.error
      const totals = new Map<string, number>()
      for (const row of stats.data) totals.set(row.identity_id, (totals.get(row.identity_id) ?? 0) + row.count)
      wanted = [...totals].map(([identityId, count]) => ({ identityId, count })).sort((a, b) => b.count - a.count || a.identityId.localeCompare(b.identityId)).slice(0, 5)
    }

    const view = (row: FriendPostRow) => {
      const mine = row === ownRow
      return {
        id: row.id, visibility: row.visibility, slots: row.slots, identityIds: row.identity_ids, mine, bumpedAt: row.bumped_at, seenAt: row.seen_at,
        ...(kind === 'want' ? { expiresAt: wantExpiresAt(row.created_at) } : {}),
        // authorId opens the public profile (/users/<id>), as on the deck board.
        author: row.user_id ? names.get(row.user_id) ?? null : null, authorId: row.user_id, guestTag: row.guest_tag,
        code: codeForViewer(row, { signedIn: viewer?.kind === 'user', mine, exchanged: exchanged.has(row.id), approved: requestOf.get(row.id) === 'approved' }),
        ...(mine && row.visibility === 'exchange' ? { received: received.get(row.id) ?? [] } : {}),
        ...(row.visibility === 'approval' ? mine ? { requests } : { request: requestOf.get(row.id) ?? null } : {}),
      }
    }
    return NextResponse.json({ signedIn: viewer?.kind === 'user', posts: rows.map(view), own: ownRow ? view(ownRow) : null, ...(wanted ? { wanted } : {}) })
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
    if (await isBlocked(admin, author)) return NextResponse.json(fail('blocked'), { status: 403 })

    const body = await request.json().catch(() => null)
    // A guest's password for a new post (REQ-COMMUNITY-029); screens from before it existed send none.
    const pin = author.kind === 'guest' ? guestPinOf(body?.pin) : null
    if (pin === false) return NextResponse.json(fail('invalid_request'), { status: 400 })
    if (kindOf(body?.kind) === 'want') return await saveWant(db, author, body, pin)
    const ids = slotAssetIds(body)
    const [identityRows, egoRows] = await Promise.all([
      ids.identities.length ? db.from('identities').select('id,sinner_id').in('id', ids.identities) : { data: [], error: null },
      ids.egos.length ? db.from('ego').select('id,sinner_id,grade').in('id', ids.egos) : { data: [], error: null },
    ])
    if (identityRows.error || egoRows.error) throw identityRows.error ?? egoRows.error
    const post = parseSupportPost(body,
      new Map((identityRows.data ?? []).map(row => [row.id as string, row.sinner_id as string])),
      new Map((egoRows.data ?? []).map(row => [row.id as string, { sinner: row.sinner_id as string, grade: String(row.grade) }])))
    if ('error' in post) return NextResponse.json(post, { status: 400 })

    const owner = ownerFilter(author)
    const existing = await db.from('friend_posts').select('id,bumped_at').eq('kind', 'support').eq(owner.column, owner.value).maybeSingle()
    if (existing.error) throw existing.error
    const now = new Date()
    const values = { code: post.code, visibility: post.visibility, slots: post.slots, identity_ids: post.identityIds, seen_at: now.toISOString() }
    const saved = existing.data
      ? await db.from('friend_posts').update({ ...values, bumped_at: nextBumpedAt(existing.data.bumped_at, now) }).eq('id', existing.data.id).select('id').single()
      : await db.from('friend_posts').insert({ ...values, kind: 'support', ...friendAuthorColumns(author, pin) }).select('id').single()
    // The same code on another post: someone else's code, or the author's own post under another login.
    if (saved.error?.code === '23505') return NextResponse.json(fail('duplicate_code'), { status: 409 })
    if (saved.error) throw saved.error
    return NextResponse.json({ id: saved.data.id }, { status: existing.data ? 200 : 201 })
  } catch (error) {
    console.error('friend-codes POST', error)
    return NextResponse.json({ error: '저장하지 못했습니다.' }, { status: 500 })
  }
}

/**
 * Saves the author's "wanted identity" post. It keeps the time it was first written, so saving again does not extend its
 * day; identities a save adds are counted in friend_want_stats, which outlives the post (REQ-COMMUNITY-022).
 */
async function saveWant(db: Db, author: Author, body: unknown, pin: string | null) {
  const ids = wantIdentityIds(body)
  const identityRows = ids.length ? await db.from('identities').select('id,sinner_id').in('id', ids) : { data: [], error: null }
  if (identityRows.error) throw identityRows.error
  const post = parseWantPost(body, new Map((identityRows.data ?? []).map(row => [row.id as string, row.sinner_id as string])))
  if ('error' in post) return NextResponse.json(post, { status: 400 })

  const expired = await dropExpiredWants(db)
  if (expired.error) throw expired.error
  const owner = ownerFilter(author)
  const existing = await db.from('friend_posts').select('id,identity_ids').eq('kind', 'want').eq(owner.column, owner.value).maybeSingle()
  if (existing.error) throw existing.error
  const values = { code: post.code, visibility: post.visibility, identity_ids: post.identityIds, seen_at: new Date().toISOString() }
  const saved = existing.data
    ? await db.from('friend_posts').update(values).eq('id', existing.data.id).select('id').single()
    : await db.from('friend_posts').insert({ ...values, kind: 'want', slots: [], ...friendAuthorColumns(author, pin) }).select('id').single()
  if (saved.error?.code === '23505') return NextResponse.json(fail('duplicate_code'), { status: 409 })
  if (saved.error) throw saved.error

  // read-then-write, so two saves in the same instant can lose a count; use an SQL function if the numbers must be exact.
  const added = newlyWanted(existing.data?.identity_ids ?? [], post.identityIds)
  if (added.length) {
    const day = new Date().toISOString().slice(0, 10)
    const counts = await db.from('friend_want_stats').select('identity_id,count').eq('day', day).in('identity_id', added)
    const before = new Map((counts.data ?? []).map(row => [row.identity_id as string, row.count as number]))
    const counted = counts.error ? counts : await db.from('friend_want_stats').upsert(added.map(id => ({ day, identity_id: id, count: (before.get(id) ?? 0) + 1 })), { onConflict: 'day,identity_id' })
    // The post is saved; a failed count is logged, not shown to the author.
    if (counted.error) console.error('friend-codes want stats', counted.error)
  }
  return NextResponse.json({ id: saved.data.id }, { status: existing.data ? 200 : 201 })
}

/** Removes the author's own post of a kind (?kind=want, support by default). */
export async function DELETE(request: NextRequest) {
  try {
    const admin = createAdminClient()
    const resolved = await resolveAuthor(request, admin)
    if ('response' in resolved) return resolved.response
    const owner = ownerFilter(resolved.author)
    const { error } = await admin.schema('limbus').from('friend_posts').delete().eq('kind', kindOf(request.nextUrl.searchParams.get('kind'))).eq(owner.column, owner.value)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('friend-codes DELETE', error)
    return NextResponse.json({ error: '지우지 못했습니다.' }, { status: 500 })
  }
}
