import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { getFormations, getRecCatalog } from './rec-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { popularWith } from '@/features/community/lib/co-occurrence'
import { buildIdentityModel, companionsOfIdentity } from '@/features/community/lib/identity-recs'
import { popularSince } from '@/lib/discovery/update-window'
import { DISCOVERY_COLUMNS, DISCOVERY_TABLE, formatDiscoveryPosts, type DiscoveryKind } from '@/features/community/lib/recommend'

export type IdentityCompanion = {
  id: string; sinner_id: string; rarity: number; game_id: string | null; folder_name: string | null
  name_kr: string; name_en: string | null; name_jp: string | null; count: number
}
export type IdentityPost = { kind: DiscoveryKind; post: Record<string, unknown> & { id: string } }
export type IdentityRecommendations = { companions: IdentityCompanion[]; posts: IdentityPost[] }

const POSTS = 4

/** Companions and popular posts of one identity, counted from the public formations. Throws on a failed read, so nothing wrong is kept. */
export async function getIdentityRecommendations(identityId: string): Promise<IdentityRecommendations> {
  'use cache'
  cacheLife('hours')
  cacheTag(CACHE_TAGS.decksList, CACHE_TAGS.plansList, CACHE_TAGS.identities)
  const [formations, catalog] = await Promise.all([getFormations(), getRecCatalog()])
  const companions = companionsOfIdentity(buildIdentityModel(formations, catalog), identityId)
  if (!formations.some(formation => formation.identities.includes(identityId))) return { companions: [], posts: [] }
  const db = createAdminClient().schema('limbus')
  // the RPC returns each board's 12 most visited posts, so a post fielding this identity ranks by visits only when it is among them; the rest fall back to votes. A per-identity count would need a new function.
  const counts = await db.rpc('discovery_counts_since', { since: popularSince('month') })
  if (counts.error) throw counts.error
  const visitors = new Map((counts.data as { kind: string; entity_id: string; visitors: number }[]).map(row => [`${row.kind}:${row.entity_id}`, Number(row.visitors)]))
  // A few more than shown, so a post deleted since the last count does not leave a gap.
  const ranked = popularWith(formations, identityId, visitors, POSTS * 2)
  const idsOf = (kind: DiscoveryKind) => ranked.filter(formation => formation.kind === kind).map(formation => formation.id)

  const [identityRows, ...postRows] = await Promise.all([
    companions.length
      ? db.from('identities').select('id, sinner_id, rarity, game_id, folder_name, name_kr, name_en, name_jp').in('id', companions.map(row => row.identity_id))
      : { data: [], error: null },
    ...(['deck', 'planner'] as const).map(async kind => {
      const ids = idsOf(kind)
      if (!ids.length) return { kind, rows: [] as unknown[], error: null }
      const { data, error } = await db.from(DISCOVERY_TABLE[kind]).select(DISCOVERY_COLUMNS[kind]).in('id', ids)
      return { kind, rows: formatDiscoveryPosts(kind, data ?? []), error }
    }),
  ])
  if (identityRows.error || postRows.some(result => result.error)) throw identityRows.error ?? postRows.find(result => result.error)?.error

  const byId = new Map((identityRows.data as unknown as Omit<IdentityCompanion, 'count'>[]).map(row => [row.id, row]))
  const existing = new Map(postRows.flatMap(result => (result.rows as IdentityPost['post'][]).map(post => [`${result.kind}:${post.id}`, { kind: result.kind, post }] as const)))
  return {
    companions: companions.flatMap(row => byId.has(row.identity_id) ? [{ ...byId.get(row.identity_id)!, count: row.count }] : []),
    posts: ranked.flatMap(formation => existing.get(`${formation.kind}:${formation.id}`) ?? []).slice(0, POSTS),
  }
}
