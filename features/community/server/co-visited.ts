import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { getFormations } from './rec-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { similarTo } from '@/features/community/lib/co-occurrence'
import { popularSince } from '@/lib/discovery/update-window'
import { DISCOVERY_COLUMNS, DISCOVERY_TABLE, formatDiscoveryPosts, type DiscoveryKind } from '@/features/community/lib/recommend'

const LANE = 3

/**
 * Posts the same visitors looked at (database function, last four update weeks), filled up with posts of a similar
 * formation when fewer than three qualify. `exclude` is what the page already shows elsewhere. Throws when the function
 * is missing or a read fails, so the caller can hide the lane.
 */
export async function getCoVisited(kind: DiscoveryKind, id: string, exclude: string[]): Promise<(Record<string, unknown> & { id: string })[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(kind === 'deck' ? CACHE_TAGS.decksList : CACHE_TAGS.plansList)
  const db = createAdminClient().schema('limbus')
  const counts = await db.rpc('discovery_covisited', { entity: id, post_kind: kind, since: popularSince('month'), max_rows: 12 })
  if (counts.error) throw counts.error
  const skip = new Set([id, ...exclude])
  const ids = (counts.data as { entity_id: string }[]).map(row => row.entity_id).filter(entity => !skip.has(entity))
  if (ids.length < LANE) {
    // A failed formation read only loses the fill.
    const similar = await getFormations().then(formations => similarTo(formations, kind, id).map(post => post.id), () => [])
    ids.push(...similar.filter(entity => !skip.has(entity) && !ids.includes(entity)))
  }
  // A few more than shown, so a post deleted since the last count does not leave a gap.
  const wanted = ids.slice(0, LANE * 2)
  if (!wanted.length) return []
  const { data, error } = await db.from(DISCOVERY_TABLE[kind]).select(DISCOVERY_COLUMNS[kind]).in('id', wanted)
  if (error) throw error
  const byId = new Map((formatDiscoveryPosts(kind, data ?? []) as (Record<string, unknown> & { id: string })[]).map(post => [post.id, post]))
  return wanted.flatMap(entity => byId.get(entity) ?? []).slice(0, LANE)
}
