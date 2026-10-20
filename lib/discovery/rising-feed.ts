import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { createAdminClient } from '@/lib/supabase/admin'
import { NEW_WITHIN_DAYS, rising, type RisingRow } from '@/lib/discovery/rising'
import { DISCOVERY_COLUMNS, DISCOVERY_TABLE, formatDiscoveryPosts, type DiscoveryKind } from '@/lib/discovery/recommend'

const POSTS = 5
const IDENTITIES = 12
// More candidates than shown: new posts and deleted ones drop out after the ranking.
const CANDIDATES = 24

export type RisingIdentity = { id: string; sinner_id: string; name_kr: string; name_en: string | null; name_jp: string | null; rarity: number; folder_name: string | null; game_id: string | null; release_date?: string | null }
export type RisingFeed = {
  posts: { post: Record<string, unknown> & { id: string }; rise: number }[]
  identities: { identity: RisingIdentity; rise: number }[]
}

const isNew = (date: unknown, now: number) => typeof date === 'string' && now - Date.parse(date) < NEW_WITHIN_DAYS * 86_400_000

/**
 * The posts of one board and the identities that gained most share of the board's visitors lately (`rising`), without
 * the posts and identities that are themselves new (those belong to "new"). Throws when the database function is missing
 * or a read fails, so the caller can hide the shelf.
 */
export async function loadRising(kind: DiscoveryKind): Promise<RisingFeed> {
  'use cache'
  cacheLife('page-10m')
  cacheTag(kind === 'deck' ? CACHE_TAGS.decksList : CACHE_TAGS.plansList)
  const db = createAdminClient().schema('limbus')
  const [posts, identities] = await Promise.all([db.rpc('discovery_rising_shares', { post_kind: kind }), db.rpc('discovery_rising_shares', { post_kind: 'identity' })])
  if (posts.error || identities.error) throw posts.error ?? identities.error
  const postRise = rising(posts.data as RisingRow[], CANDIDATES)
  const identityRise = rising(identities.data as RisingRow[], CANDIDATES)
  const [postRows, identityRows] = await Promise.all([
    postRise.length ? db.from(DISCOVERY_TABLE[kind]).select(DISCOVERY_COLUMNS[kind]).in('id', postRise.map(item => item.id)) : { data: [], error: null },
    identityRise.length ? db.from('identities').select('id,sinner_id,name_kr,name_en,name_jp,rarity,folder_name,game_id,release_date').in('id', identityRise.map(item => item.id)) : { data: [], error: null },
  ])
  if (postRows.error || identityRows.error) throw postRows.error ?? identityRows.error
  const now = Date.now()
  const postById = new Map((formatDiscoveryPosts(kind, postRows.data ?? []) as (Record<string, unknown> & { id: string })[]).map(post => [post.id, post]))
  const identityById = new Map((identityRows.data as unknown as RisingIdentity[]).map(identity => [identity.id, identity]))
  return {
    posts: postRise.flatMap(item => { const post = postById.get(item.id); return post && !isNew(post.created_at, now) ? [{ post, rise: item.rise }] : [] }).slice(0, POSTS),
    identities: identityRise.flatMap(item => { const identity = identityById.get(item.id); return identity && !isNew(identity.release_date, now) ? [{ identity, rise: item.rise }] : [] }).slice(0, IDENTITIES),
  }
}
