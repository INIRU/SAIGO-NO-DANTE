import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import { toNotification, type Notification } from '@/lib/notifications'

export type PushLang = 'ko' | 'en' | 'ja'
/** One notification for one person, before it is written in a subscription's language. */
export type PushNote = {
  to: string
  kind: Extract<Notification['kind'], 'comment' | 'reply' | 'follow' | 'post'>
  actor: string | null
  target: Extract<Notification['target'], 'deck' | 'plan' | 'user'>
  targetId: string
  /** The post's title (comments and new posts). */
  title?: string
  /** The comment's first words. */
  excerpt?: string
}

const COPY = { ko: ko.notifications, en: en.notifications, ja: ja.notifications }

/** The bell's sentence for the note as plain text, its second line and the page it opens (with the locale). */
export function pushMessage(note: PushNote, lang: PushLang) {
  const copy = COPY[lang]
  const title = copy[note.kind]
    .replaceAll('{name}', note.actor ?? copy.someone)
    .replaceAll('{title}', note.title ?? '')
    .replace(/<\/?b>/g, '')
  const { href } = toNotification({
    kind: note.kind, target_type: note.target, target_id: note.targetId, target_title: note.title ?? null, comment_id: note.targetId,
    actor_name: note.actor, actor_avatar: null, excerpt: note.excerpt ?? null, created_at: null, unread: null,
  })
  return { title, body: (note.kind === 'post' ? note.title : note.excerpt) ?? '', url: `/${lang}${href}`, tag: `${note.kind}:${note.targetId}` }
}

const POST_GAP_MS = 60 * 60_000

/** Whether an author's new post may push now: at most once an hour per author (`seen` remembers the last push). */
export function shouldPushPost(seen: Map<string, number>, authorId: string, now: number): boolean {
  const last = seen.get(authorId)
  if (last !== undefined && now - last < POST_GAP_MS) return false
  seen.set(authorId, now)
  return true
}
