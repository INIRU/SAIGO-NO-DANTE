import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { createAdminClient } from '@/lib/supabase/admin'
import { LCB_IDS } from '@/lib/constants/game'
import { getFormations, getMetaCatalog } from '@/lib/db/meta'
import { byRise, rising, risingIdentities, type RisingRow } from '@/lib/discovery/rising'
import { DISCOVERY_COLUMNS, DISCOVERY_TABLE, formatDiscoveryPosts, type DiscoveryKind } from '@/lib/discovery/recommend'

// One row of the board: three post cards, nine identity cards.
const POSTS = 3
// Risers read past the row, so a deleted post's place goes to the next one instead of emptying the row.
const POST_CANDIDATES = POSTS * 4
const IDENTITIES = 9
// A section needs this many to be shown at all.
const MIN_SHOWN = 3
// Every deck and plan with a visitor in the windows, not only the busiest: an identity's visits add up over its posts.
const ALL_POSTS = { max_rows: 3000 }
const LCB_GAME_IDS = new Set(Object.values(LCB_IDS))

export type RisingIdentity = { id: string; sinner_id: string; name_kr: string; name_en: string | null; name_jp: string | null; rarity: number; folder_name: string | null; game_id: string | null; release_date?: string | null }
export type RisingFeed = {
  posts: { post: Record<string, unknown> & { id: string }; rise: number }[]
  identities: { identity: RisingIdentity; rise: number }[]
}

/**
 * The posts of one board that gained most share of the board's visitors lately (`rising`) and the identities that gained
 * most share of the visitors of the formations that field them (`risingIdentities`), each biggest multiplier first,
 * new posts and new identities included (only the LCB defaults are left out). A section with fewer than three is
 * left empty. Throws when the database function is missing or a read fails, so the caller can hide the shelf.
 */
export async function loadRising(kind: DiscoveryKind): Promise<RisingFeed> {
  'use cache'
  cacheLife('page-10m')
  cacheTag(kind === 'deck' ? CACHE_TAGS.decksList : CACHE_TAGS.plansList)
  const db = createAdminClient().schema('limbus')
  const [decks, plans, formations, catalog] = await Promise.all([
    db.rpc('discovery_rising_windows', { post_kind: 'deck', ...ALL_POSTS }), db.rpc('discovery_rising_windows', { post_kind: 'planner', ...ALL_POSTS }), getFormations(), getMetaCatalog(),
  ])
  const failed = decks.error ?? plans.error
  if (failed) throw failed
  // Like a live ranking: a post made this week rises like any other (its earlier window is simply empty).
  const postRise = rising((kind === 'deck' ? decks : plans).data as RisingRow[], POST_CANDIDATES)
  // The LCB defaults sit in almost every formation, so they would always lead; a new release rises like anything else.
  const skip = new Set(catalog.identities.filter(identity => identity.game_id && LCB_GAME_IDS.has(identity.game_id)).map(identity => identity.id))
  const identityRise = risingIdentities({ formations, visits: { deck: decks.data as RisingRow[], planner: plans.data as RisingRow[] }, skip }, IDENTITIES).sort(byRise)
  const [postRows, identityRows] = await Promise.all([
    postRise.length ? db.from(DISCOVERY_TABLE[kind]).select(DISCOVERY_COLUMNS[kind]).in('id', postRise.map(item => item.id)) : { data: [], error: null },
    identityRise.length ? db.from('identities').select('id,sinner_id,name_kr,name_en,name_jp,rarity,folder_name,game_id,release_date').in('id', identityRise.map(item => item.id)) : { data: [], error: null },
  ])
  if (postRows.error || identityRows.error) throw postRows.error ?? identityRows.error
  const postById = new Map((formatDiscoveryPosts(kind, postRows.data ?? []) as (Record<string, unknown> & { id: string })[]).map(post => [post.id, post]))
  const identityById = new Map((identityRows.data as unknown as RisingIdentity[]).map(identity => [identity.id, identity]))
  const posts = postRise.flatMap(item => { const post = postById.get(item.id); return post ? [{ post, rise: item.rise, recent: item.recent, id: item.id }] : [] })
    .slice(0, POSTS).sort(byRise).map(({ post, rise }) => ({ post, rise }))
  const identities = identityRise.flatMap(item => { const identity = identityById.get(item.id); return identity ? [{ identity, rise: item.rise }] : [] })
  return { posts: posts.length >= MIN_SHOWN ? posts : [], identities: identities.length >= MIN_SHOWN ? identities : [] }
}
