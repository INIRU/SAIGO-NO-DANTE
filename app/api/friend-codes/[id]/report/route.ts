import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorRateKey, resolveAuthor } from '@/features/account/server'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { fail } from '@/features/friends'
import { isUuid } from '@/lib/utils/uuid'

/** Reports a post (someone else's code, a fake code): once per reporter, for the admin list (REQ-COMMUNITY-025). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json(fail('invalid_request'), { status: 400 })
    const admin = createAdminClient(), db = admin.schema('limbus')
    const resolved = await resolveAuthor(request, admin)
    if ('response' in resolved) return resolved.response
    const { author } = resolved
    const rateLimit = checkRequestRateLimit(request, { bucket: 'create', scope: author.kind === 'guest' ? 'friends:report:guest' : 'friends:report', authenticatedKey: authorRateKey(author) })
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const post = await db.from('friend_posts').select('id').eq('id', id).maybeSingle()
    if (post.error) throw post.error
    if (!post.data) return NextResponse.json(fail('not_found'), { status: 404 })
    const reported = await db.from('friend_reports').insert({ post_id: id, ...(author.kind === 'user' ? { reporter_user_id: author.userId } : { reporter_key_hash: author.keyHash }) })
    // 23505: this reporter already reported the post.
    if (reported.error && reported.error.code !== '23505') throw reported.error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('friend-codes report', error)
    return NextResponse.json({ error: '신고하지 못했습니다.' }, { status: 500 })
  }
}
