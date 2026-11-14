import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushMessage, shouldPushPost, type PushLang, type PushNote } from './message'

export type { PushNote }
type Db = ReturnType<typeof createAdminClient>
type Subscription = {
  endpoint: string; p256dh: string; auth: string; lang: string; user_id: string
  profiles: { notify_comments: boolean; notify_follows: boolean; notify_posts: boolean; suspended: boolean } | null
}
const SETTING = { comment: 'notify_comments', reply: 'notify_comments', follow: 'notify_follows', post: 'notify_posts' } as const

/** The VAPID key pair and contact from the environment; without all three nothing is pushed. */
export function pushKeys() {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = process.env
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null
}

/**
 * Pushes each note to every browser its recipient subscribed, in that browser's language, unless the recipient turned
 * that kind off or is suspended. Subscriptions the push service no longer knows (404, 410) are deleted.
 */
export async function sendPushes(db: Db, notes: PushNote[]) {
  const keys = pushKeys()
  if (!keys || !notes.length) return
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey)
  const { data, error } = await db.schema('limbus').from('push_subscriptions')
    .select('endpoint,p256dh,auth,lang,user_id,profiles!inner(notify_comments,notify_follows,notify_posts,suspended)')
    .in('user_id', [...new Set(notes.map(note => note.to))])
  if (error || !data) return
  const subscriptions = data as unknown as Subscription[]
  const gone: string[] = []
  await Promise.all(notes.flatMap(note => subscriptions
    .filter(sub => sub.user_id === note.to && sub.profiles && !sub.profiles.suspended && sub.profiles[SETTING[note.kind]])
    .map(async sub => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(pushMessage(note, sub.lang as PushLang)), { TTL: 24 * 60 * 60 })
      } catch (sendError) {
        const status = (sendError as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) gone.push(sub.endpoint)
        else console.error('[push] send failed:', status ?? sendError)
      }
    })))
  if (gone.length) await db.schema('limbus').from('push_subscriptions').delete().in('endpoint', gone)
}

const nameOf = async (db: Db, id: string) =>
  ((await db.schema('limbus').from('profiles').select('username').eq('id', id).maybeSingle()).data?.username as string | undefined) ?? null

/** Runs after the response (`after`): a failed push must never surface to the person who acted. */
const quietly = (task: () => Promise<void>) => task().catch(error => console.error('[push]', error))

/** A new comment: its post's owner (comment) and the parent comment's author (reply), never the commenter. */
export function pushForComment(postType: 'deck' | 'plan', commentId: string) {
  return quietly(async () => {
    const db = createAdminClient()
    const [table, posts, key] = postType === 'deck' ? ['deck_comments', 'decks', 'deck_id'] as const : ['md_plan_comments', 'md_plans', 'plan_id'] as const
    const { data: comment } = await db.schema('limbus').from(table).select(`user_id,parent_id,content,${key}`).eq('id', commentId).maybeSingle()
    if (!comment?.user_id) return
    const postId = String((comment as Record<string, unknown>)[key])
    const [{ data: post }, parent, actor] = await Promise.all([
      db.schema('limbus').from(posts).select('user_id,title').eq('id', postId).maybeSingle(),
      comment.parent_id ? db.schema('limbus').from(table).select('user_id').eq('id', comment.parent_id).maybeSingle().then(result => result.data) : null,
      nameOf(db, comment.user_id),
    ])
    const base = { actor, target: postType, targetId: postId, title: post?.title ?? '', excerpt: String(comment.content ?? '').slice(0, 120) }
    const notes: PushNote[] = []
    if (parent?.user_id && parent.user_id !== comment.user_id) notes.push({ ...base, to: parent.user_id, kind: 'reply' })
    if (post?.user_id && post.user_id !== comment.user_id && post.user_id !== parent?.user_id) notes.push({ ...base, to: post.user_id, kind: 'comment' })
    await sendPushes(db, notes)
  })
}

/** Someone followed `targetId`; following, unfollowing and following again pushes once an hour at most. */
export function pushForFollow(actorId: string, targetId: string) {
  return quietly(async () => {
    if (!shouldPushPost(lastFollowPush, `${actorId}:${targetId}`, Date.now())) return
    const db = createAdminClient()
    await sendPushes(db, [{ to: targetId, kind: 'follow', actor: await nameOf(db, actorId), target: 'user', targetId: actorId }])
  })
}

// In-memory, per server process; a restart forgets it (at worst one extra push). Move to a column if we scale out.
const lastPostPush = new Map<string, number>()
const lastFollowPush = new Map<string, number>()

/** A new deck or plan: everyone following its author, if the author is public and not suspended. */
export function pushForPost(postType: 'deck' | 'plan', postId: string) {
  return quietly(async () => {
    const db = createAdminClient()
    const { data: post } = await db.schema('limbus').from(postType === 'deck' ? 'decks' : 'md_plans').select('user_id,title').eq('id', postId).maybeSingle()
    if (!post?.user_id) return
    const { data: author } = await db.schema('limbus').from('profiles').select('username,public_profile,suspended').eq('id', post.user_id).maybeSingle()
    if (!author?.public_profile || author.suspended || !shouldPushPost(lastPostPush, post.user_id, Date.now())) return
    const { data: followers } = await db.schema('limbus').from('follows').select('follower_id').eq('following_id', post.user_id)
    await sendPushes(db, (followers ?? []).map(row => ({ to: row.follower_id, kind: 'post' as const, actor: author.username, target: postType, targetId: postId, title: post.title })))
  })
}
