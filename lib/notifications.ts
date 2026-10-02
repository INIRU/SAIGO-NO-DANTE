/** A row of limbus.user_notifications: a comment by someone else on the account's deck or plan, or a reply to its comment. */
export type NotificationRow = {
  kind: string; target_type: string; target_id: string; target_title: string | null; comment_id: string
  actor_name: string | null; actor_avatar: string | null; excerpt: string | null; created_at: string | null; unread: boolean | null
}

export type Notification = {
  id: string; kind: 'comment' | 'reply'; target: 'deck' | 'plan'
  /** The post's comment section (locale prefix added by the link). */
  href: string
  title: string; actor: string | null; avatar: string | null; excerpt: string; at: string | null; unread: boolean
}

export function toNotification(row: NotificationRow): Notification {
  const target = row.target_type === 'plan' ? 'plan' : 'deck'
  return {
    id: row.comment_id,
    kind: row.kind === 'reply' ? 'reply' : 'comment',
    target,
    href: target === 'plan' ? `/planner/community/${row.target_id}#plan-comments-title` : `/decks/${row.target_id}#deck-comments-title`,
    title: row.target_title ?? '',
    actor: row.actor_name,
    avatar: row.actor_avatar,
    excerpt: row.excerpt ?? '',
    at: row.created_at,
    unread: row.unread === true,
  }
}

/**
 * The unread notifications to announce with a toast, newest first: those newer than the last announced one
 * (`toastedAt`, an ISO time, null on a first visit), at most `max`. `items` is the feed, newest first.
 */
export function freshForToast(items: Notification[], toastedAt: string | null, max = 3): Notification[] {
  const since = toastedAt ? Date.parse(toastedAt) : -Infinity
  return items.filter(item => item.unread && item.at !== null && Date.parse(item.at) > since).slice(0, max)
}
