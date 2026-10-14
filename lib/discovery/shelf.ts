/** One home shelf: the three most visited posts of the week, or the newest three when fewer than three were visited. */
export type CommunityShelf<T> = { popular: boolean; posts: T[] }

/** The /api/discovery response fields a shelf reads. `popular` arrives ranked (rankPopular). */
export type DiscoveryFeed<T> = {
  popular: T[]
  recent: T[]
}

export function pickShelf<T>(feed: DiscoveryFeed<T>): CommunityShelf<T> {
  const popular = feed.popular.length >= 3
  return { popular, posts: (popular ? feed.popular : feed.recent).slice(0, 3) }
}

type Ranked = { id: string | number; user_id?: string | null; guest_tag?: string | null; vote_count?: number | null; created_at?: string | null }

/**
 * The "frequently visited" shelf: six posts by visitors, then votes, then newest, then id, at most two per author
 * (user_id, or guest_tag for anonymous posts; a post with neither is never limited). Only posts that exist are passed
 * in, so a deleted post takes no place and the next rank fills it.
 */
export function rankPopular<T extends Ranked>(posts: T[], visitors: Map<string, number>): T[] {
  const seen = (post: T) => visitors.get(String(post.id)) ?? 0
  const perAuthor = new Map<string, number>()
  return [...posts]
    .sort((a, b) =>
      seen(b) - seen(a)
      || (b.vote_count ?? 0) - (a.vote_count ?? 0)
      // NaN (no date) is falsy and falls through to the id.
      || Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? '')
      || String(a.id).localeCompare(String(b.id)))
    .filter(post => {
      const author = post.user_id ? `u:${post.user_id}` : post.guest_tag ? `g:${post.guest_tag}` : null
      if (!author) return true
      const count = (perAuthor.get(author) ?? 0) + 1
      perAuthor.set(author, count)
      return count <= 2
    })
    .slice(0, 6)
}

/** Board shelves top to bottom: the personal shelf follows the new posts, or leads when there are none. */
export function shelfOrder<K extends string>(sections: readonly K[]): (K | 'forYou')[] {
  const after = sections[0] === 'recent' ? 1 : 0
  return [...sections.slice(0, after), 'forYou', ...sections.slice(after)]
}
