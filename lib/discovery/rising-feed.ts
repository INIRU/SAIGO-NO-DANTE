import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { createAdminClient } from '@/lib/supabase/admin'
import { rising, type RisingRow } from '@/lib/discovery/rising'
import { DISCOVERY_COLUMNS, DISCOVERY_TABLE, formatDiscoveryPosts, type DiscoveryKind } from '@/lib/discovery/recommend'

const POSTS = 3
const IDENTITIES = 6

export type RisingIdentity = { id: string; sinner_id: string; name_kr: string; name_en: string | null; name_jp: string | null; rarity: number; folder_name: string | null; game_id: string | null }
export type RisingFeed = {
  posts: { post: Record<string, unknown> & { id: string }; rise: number }[]
  identities: { identity: RisingIdentity; rise: number }[]
}

/**
 * The posts of one board and the identities whose visitors rose most (last 3 days against the 14 before, `rising`).
 * Throws when the database function is missing or a read fails, so the caller can hide the shelf.
 */
export async function loadRising(kind: DiscoveryKind): Promise<RisingFeed> {
  'use cache'
  cacheLife('page-10m')
  cacheTag(kind === 'deck' ? CACHE_TAGS.decksList : CACHE_TAGS.plansList)
  const db = createAdminClient().schema('limbus')
  const [posts, identities] = await Promise.all([db.rpc('discovery_rising', { post_kind: kind }), db.rpc('discovery_rising', { post_kind: 'identity' })])
  if (posts.error || identities.error) throw posts.error ?? identities.error
  // A few more posts than shown, so one deleted since the count does not leave a gap.
  const postRise = rising(posts.data as RisingRow[], POSTS * 2)
  const identityRise = rising(identities.data as RisingRow[], IDENTITIES)
  const [postRows, identityRows] = await Promise.all([
    postRise.length ? db.from(DISCOVERY_TABLE[kind]).select(DISCOVERY_COLUMNS[kind]).in('id', postRise.map(item => item.id)) : { data: [], error: null },
    identityRise.length ? db.from('identities').select('id,sinner_id,name_kr,name_en,name_jp,rarity,folder_name,game_id').in('id', identityRise.map(item => item.id)) : { data: [], error: null },
  ])
  if (postRows.error || identityRows.error) throw postRows.error ?? identityRows.error
  const postById = new Map((formatDiscoveryPosts(kind, postRows.data ?? []) as (Record<string, unknown> & { id: string })[]).map(post => [post.id, post]))
  const identityById = new Map((identityRows.data as unknown as RisingIdentity[]).map(identity => [identity.id, identity]))
  return {
    posts: postRise.flatMap(item => postById.has(item.id) ? [{ post: postById.get(item.id)!, rise: item.rise }] : []).slice(0, POSTS),
    identities: identityRise.flatMap(item => identityById.has(item.id) ? [{ identity: identityById.get(item.id)!, rise: item.rise }] : []),
  }
}
