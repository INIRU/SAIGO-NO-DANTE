import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorRateKey, resolveAuthor } from '@/features/account/server'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { fail, isRequestDecision } from '@/features/friends'
import { isAuthorOf, isBlocked } from '@/features/friends/server'

const UUID_RE = /^[0-9a-f-]{36}$/i

/** A viewer asks the author of an 'approval' post for its code: one request per viewer, pending until the author answers (REQ-COMMUNITY-028). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) return NextResponse.json(fail('invalid_request'), { status: 400 })
    const admin = createAdminClient(), db = admin.schema('limbus')
    const resolved = await resolveAuthor(request, admin)
    if ('response' in resolved) return resolved.response
    const { author } = resolved
    const rateLimit = checkRequestRateLimit(request, { bucket: 'create', scope: author.kind === 'guest' ? 'friends:request:guest' : 'friends:request', authenticatedKey: authorRateKey(author) })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)
    if (await isBlocked(admin, author)) return NextResponse.json(fail('blocked'), { status: 403 })

    const post = await db.from('friend_posts').select('id,visibility,user_id,key_hash').eq('id', id).maybeSingle()
    if (post.error) throw post.error
    if (!post.data || post.data.visibility !== 'approval') return NextResponse.json(fail('not_approval'), { status: 404 })
    if (isAuthorOf(post.data, author)) return NextResponse.json({ status: 'approved' })
    const made = await db.from('friend_requests').insert({ post_id: id, ...(author.kind === 'user' ? { viewer_user_id: author.userId } : { viewer_key_hash: author.keyHash, viewer_tag: author.tag }) })
    // 23505: this viewer already asked; the earlier request and its answer stay.
    if (made.error && made.error.code !== '23505') throw made.error
    return NextResponse.json({ status: 'pending' })
  } catch (error) {
    console.error('friend-codes request', error)
    return NextResponse.json({ error: '요청하지 못했습니다.' }, { status: 500 })
  }
}

/** The author answers a request on their own post: { request: <id>, decision: 'approved' | 'declined' }. An answer can be changed later. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!UUID_RE.test(id) || typeof body?.request !== 'string' || !UUID_RE.test(body.request) || !isRequestDecision(body?.decision)) return NextResponse.json(fail('invalid_request'), { status: 400 })
    const admin = createAdminClient(), db = admin.schema('limbus')
    const resolved = await resolveAuthor(request, admin)
    if ('response' in resolved) return resolved.response
    const post = await db.from('friend_posts').select('id,user_id,key_hash').eq('id', id).maybeSingle()
    if (post.error) throw post.error
    // Someone else's post is answered like a missing one: only the author decides.
    if (!post.data || !isAuthorOf(post.data, resolved.author)) return NextResponse.json(fail('not_found'), { status: 404 })
    const decided = await db.from('friend_requests').update({ status: body.decision, decided_at: new Date().toISOString() }).eq('id', body.request).eq('post_id', id).select('id')
    if (decided.error) throw decided.error
    if (!decided.data.length) return NextResponse.json(fail('not_found'), { status: 404 })
    return NextResponse.json({ status: body.decision })
  } catch (error) {
    console.error('friend-codes request decision', error)
    return NextResponse.json({ error: '처리하지 못했습니다.' }, { status: 500 })
  }
}
