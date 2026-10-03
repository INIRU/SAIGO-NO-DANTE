/**
 * A row of limbus.user_notifications (a comment by someone else on the account's deck or plan, or a reply to its comment)
 * or of limbus.admin_inquiry_notifications (an inquiry waiting for an answer: `comment_id` is its last user message).
 */
export type NotificationRow = {
  kind: string; target_type: string; target_id: string; target_title: string | null; comment_id: string
  actor_name: string | null; actor_avatar: string | null; excerpt: string | null; created_at: string | null; unread: boolean | null
}

export type Notification = {
  id: string; kind: 'comment' | 'reply' | 'inquiry'; target: 'deck' | 'plan' | 'inquiry'
  /** The post's comment section, or the inquiry in the admin inbox (locale prefix added by the link). */
  href: string
  title: string; actor: string | null; avatar: string | null; excerpt: string; at: string | null; unread: boolean
}

const HREF: Record<Notification['target'], (id: string) => string> = {
  deck: id => `/decks/${id}#deck-comments-title`,
  plan: id => `/planner/community/${id}#plan-comments-title`,
  inquiry: id => `/admin/inquiries?id=${id}`,
}

export function toNotification(row: NotificationRow): Notification {
  const target = row.target_type === 'plan' || row.target_type === 'inquiry' ? row.target_type : 'deck'
  return {
    id: row.comment_id,
    kind: row.kind === 'reply' || row.kind === 'inquiry' ? row.kind : 'comment',
    target,
    href: HREF[target](row.target_id),
    title: row.target_title ?? '',
    actor: row.actor_name,
    avatar: row.actor_avatar,
    excerpt: row.excerpt ?? '',
    at: row.created_at,
    unread: row.unread === true,
  }
}

/** Comment and inquiry rows as one list, newest first; undated ones last. */
export function newestFirst(items: Notification[]): Notification[] {
  const time = (item: Notification) => (item.at ? Date.parse(item.at) : 0)
  return [...items].sort((a, b) => time(b) - time(a))
}

/**
 * The unread notifications to announce with a toast, newest first: those newer than the last announced one
 * (`toastedAt`, an ISO time, null on a first visit), at most `max`. `items` is the feed, newest first.
 */
export function freshForToast(items: Notification[], toastedAt: string | null, max = 3): Notification[] {
  const since = toastedAt ? Date.parse(toastedAt) : -Infinity
  return items.filter(item => item.unread && item.at !== null && Date.parse(item.at) > since).slice(0, max)
}
