/** One home shelf: the three most visited posts of the week, or the newest three when fewer than three were visited. */
export type CommunityShelf<T> = { popular: boolean; posts: T[] }

/** The /api/discovery response fields a shelf reads. */
export type DiscoveryFeed<T> = {
  counts: { kind: string; entity_id: string; visitors: number }[]
  popular: T[]
  recent: T[]
}

export function pickShelf<T extends { id: string | number }>(feed: DiscoveryFeed<T>, kind: 'deck' | 'planner'): CommunityShelf<T> {
  const visitors = new Map(feed.counts.filter(r => r.kind === kind).map(r => [r.entity_id, r.visitors]))
  const popular = [...feed.popular].sort((x, y) => (visitors.get(String(y.id)) ?? 0) - (visitors.get(String(x.id)) ?? 0))
  const posts = popular.length >= 3 ? popular : feed.recent
  return { popular: popular.length >= 3, posts: posts.slice(0, 3) }
}
