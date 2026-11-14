import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { isUuid } from '@/lib/utils/uuid'

/**
 * An admin's answer to a reported post: ?action=remove takes the post down, ?action=block also bars its author (account or
 * guest key) from the board, ?action=dismiss drops the reports and keeps the post.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const { id } = await params
  const action = request.nextUrl.searchParams.get('action')
  if (!isUuid(id) || !['remove', 'block', 'dismiss'].includes(action ?? '')) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  const db = createAdminClient().schema('limbus')
  try {
    if (action === 'dismiss') {
      const dropped = await db.from('friend_reports').delete().eq('post_id', id)
      if (dropped.error) throw dropped.error
    } else {
      const post = await db.from('friend_posts').select('id,kind,user_id,key_hash').eq('id', id).maybeSingle()
      if (post.error) throw post.error
      if (!post.data) return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 })
      if (action === 'block') {
        const blocked = await db.from('friend_blocks').insert(post.data.user_id ? { user_id: post.data.user_id } : { key_hash: post.data.key_hash })
        // 23505: already barred.
        if (blocked.error && blocked.error.code !== '23505') throw blocked.error
        // Every post of the barred author goes, not only the reported one.
        const rest = await db.from('friend_posts').delete().eq(post.data.user_id ? 'user_id' : 'key_hash', (post.data.user_id ?? post.data.key_hash) as string)
        if (rest.error) throw rest.error
      } else {
        const removed = await db.from('friend_posts').delete().eq('id', id)
        if (removed.error) throw removed.error
      }
    }
    await writeAuditLog({ actorId: null, action: `friend_codes.${action}`, targetType: 'friend_post', targetId: id, details: { admin: auth.session.user.email }, severity: action === 'dismiss' ? 'info' : 'warning' })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('admin friend-codes', error)
    return NextResponse.json({ error: '처리하지 못했습니다.' }, { status: 500 })
  }
}
