import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorRateKey, resolveAuthor } from '@/lib/guest/server'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { FRIEND_CODE_RE } from '@/lib/friends/codes'
import { isAuthorOf } from '@/lib/friends/server'

/** A viewer gives their own friend code to an 'exchange' post (support or want) and gets the author's code back (REQ-COMMUNITY-021). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    const admin = createAdminClient(), db = admin.schema('limbus')
    const resolved = await resolveAuthor(request, admin)
    if ('response' in resolved) return resolved.response
    const { author } = resolved
    // Signed-in viewers are limited by account, guests by IP: a new guest key does not buy more exchanges.
    const rateLimit = checkRequestRateLimit(request, { bucket: 'create', scope: author.kind === 'guest' ? 'friends:exchange:guest' : 'friends:exchange', authenticatedKey: authorRateKey(author) })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const body = await request.json().catch(() => null)
    const code = typeof body?.code === 'string' ? body.code : ''
    if (!FRIEND_CODE_RE.test(code)) return NextResponse.json({ error: '친구 코드는 영문 대문자 1자와 숫자 9자입니다.' }, { status: 400 })
    const post = await db.from('friend_posts').select('id,code,visibility,user_id,key_hash').eq('id', id).maybeSingle()
    if (post.error) throw post.error
    if (!post.data || post.data.visibility !== 'exchange') return NextResponse.json({ error: '코드 교환 글이 아닙니다.' }, { status: 404 })
    if (isAuthorOf(post.data, author)) return NextResponse.json({ code: post.data.code })
    if (code === post.data.code) return NextResponse.json({ error: '자기 친구 코드를 넣어 주세요.' }, { status: 400 })

    const given = await db.from('friend_exchanges').insert({
      post_id: id, viewer_code: code, ...(author.kind === 'user' ? { viewer_user_id: author.userId } : { viewer_key_hash: author.keyHash }),
    })
    // 23505: this viewer already exchanged with the post; the first code stays.
    if (given.error && given.error.code !== '23505') throw given.error
    return NextResponse.json({ code: post.data.code })
  } catch (error) {
    console.error('friend-codes exchange', error)
    return NextResponse.json({ error: '교환하지 못했습니다.' }, { status: 500 })
  }
}
