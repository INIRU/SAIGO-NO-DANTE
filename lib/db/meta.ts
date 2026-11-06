import { publicSupabase } from '@/lib/supabase/public'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { isDeployedSlot } from '@/lib/constants/game'
import type { Formation } from '@/lib/discovery/co-occurrence'
import { buildRecCatalog, type RawCatalog, type RecCatalog } from '@/lib/discovery/rec-catalog'
import { fieldedSlots, metaPeriodStart, planGiftIds, planThemeIds } from '@/lib/meta/posts'
import { readAllMetaRows } from '@/lib/meta/pagination'
import type { MetaIdentity, MetaEGO, MetaPost, MetaSource, MetaPeriod } from '@/lib/meta/types'

export function publicClient() {
  // Aggregated results are shared publicly: never derive them from a user's session
  // or use an administrator key that could include rows hidden by RLS.
  return publicSupabase().schema('limbus')
}

export async function getMetaCatalog() {
  'use cache'
  cacheLife('page-1h')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.meta, CACHE_TAGS.keywords)
  const db = publicClient()
  const [identities, egos] = await Promise.all([
    readAllMetaRows<MetaIdentity>((from, to) => db.from('identities')
      .select('id, sinner_id, name_kr, name_en, name_jp, keywords, skill_keyword_list, rarity, folder_name, game_id').order('id').range(from, to)),
    readAllMetaRows<MetaEGO>((from, to) => db.from('ego')
      .select('id, sinner_id, name_kr, name_en, name_jp, grade, sin_affinity, image_url, game_id').order('id').range(from, to)),
  ])
  return { identities, egos }
}

type Reception = { vote_count: number | null; view_count: number | null; comment_count: number | null }
type DeckRow = Reception & { title: string; main_keywords: string[] | null; content_type: string | null; id: string; created_at: string; content_edited_at: string | null; deck_identities: unknown; deck_egos: unknown }
type PlanRow = Reception & { title: string; tags: string[] | null; id: string; created_at: string; content_edited_at: string | null; deck: unknown; egos: unknown; difficulty: string | null; floor_plan: unknown; gift_inventory: unknown }
const reception = (row: Reception) => ({ votes: row.vote_count, views: row.view_count, comments: row.comment_count })

export async function getSourcePosts(source: Exclude<MetaSource, 'all'>, period: MetaPeriod): Promise<MetaPost[]> {
  'use cache'
  cacheLife('page-5m')
  cacheTag(source === 'decks' ? CACHE_TAGS.decksList : CACHE_TAGS.plansList, CACHE_TAGS.meta)
  const db = publicClient()
  const now = Date.now()
  const since = metaPeriodStart(period, now)
  if (source === 'decks') {
    const rows = await readAllMetaRows<DeckRow>((from, to) => {
      let query = db.from('decks').select('id, title, main_keywords, content_type, created_at, content_edited_at, vote_count, view_count, comment_count, deck_identities(identity_id, slot_order, s1_count, s2_count, s3_count), deck_egos(ego_id)')
        .order('id').lte('created_at', new Date(now).toISOString())
      if (since) query = query.or(`created_at.gte."${since}",content_edited_at.gte."${since}"`)
      return query.range(from, to)
    })
    return rows.map(row => ({ id: row.id, source, created_at: row.created_at, edited_at: row.content_edited_at, title: row.title, keywords: row.main_keywords, content_type: row.content_type, ...reception(row), identities: row.deck_identities, egos: row.deck_egos }))
  }
  const rows = await readAllMetaRows<PlanRow>((from, to) => {
    let query = db.from('md_plans').select('id, title, tags, created_at, content_edited_at, vote_count, view_count, comment_count, deck, egos, difficulty, floor_plan, gift_inventory')
      .order('id').lte('created_at', new Date(now).toISOString())
    if (since) query = query.or(`created_at.gte."${since}",content_edited_at.gte."${since}"`)
    return query.range(from, to)
  })
  return rows.map(row => ({ id: row.id, source, created_at: row.created_at, edited_at: row.content_edited_at, title: row.title, keywords: row.tags, ...reception(row), identities: row.deck, egos: row.egos,
    difficulty: row.difficulty, gifts: planGiftIds(row.gift_inventory), themes: planThemeIds(row.floor_plan), floorPlan: row.floor_plan, inventory: row.gift_inventory }))
}

/**
 * Every public deck and plan as its battle formation, for counting who is fielded with whom: the identities, when it was posted, its
 * views, the E.G.O it equips and, for a plan, what each floor took. Recounted when a deck or plan changes.
 */
export async function getFormations(): Promise<Formation[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(CACHE_TAGS.decksList, CACHE_TAGS.plansList, CACHE_TAGS.meta, CACHE_TAGS.gameData)
  const [{ identities, egos }, decks, plans] = await Promise.all([getMetaCatalog(), getSourcePosts('decks', 'all'), getSourcePosts('planner', 'all')])
  const egoIds = new Set(egos.map(ego => ego.id))
  return [...decks, ...plans].flatMap(post => {
    const fielded = fieldedSlots(post, identities).filter(slot => slot.order < 99)
    const ids = fielded.map(slot => slot.identity.id)
    if (!ids.length) return []
    const deployed = fielded.filter(slot => isDeployedSlot(slot.order)).map(slot => slot.identity.id)
    const equipped = [...new Set((Array.isArray(post.egos) ? post.egos as { ego_id?: unknown }[] : []).flatMap(row => typeof row?.ego_id === 'string' && egoIds.has(row.ego_id) ? [row.ego_id] : []))]
    const floors: NonNullable<Formation['floors']> = []
    for (const row of Array.isArray(post.floorPlan) ? post.floorPlan as { floor?: unknown; theme_id?: unknown; gift_ids?: unknown; difficulty?: unknown }[] : []) {
      const floor = Number(row?.floor)
      if (!Number.isInteger(floor) || floor < 1 || floor > 15 || floors.some(entry => entry.floor === floor)) continue
      floors.push({
        floor, difficulty: typeof row.difficulty === 'string' ? row.difficulty : 'hard',
        theme: typeof row.theme_id === 'string' || typeof row.theme_id === 'number' ? String(row.theme_id) : null,
        gifts: Array.isArray(row.gift_ids) ? row.gift_ids.map(String).filter(id => /^\d+$/.test(id)) : [],
      })
    }
    return [{
      kind: post.source === 'decks' ? 'deck' as const : 'planner' as const, id: post.id, identities: ids, deployed, votes: post.votes ?? 0, views: post.views ?? 0,
      createdAt: Date.parse(post.created_at), ...(post.edited_at ? { editedAt: Date.parse(post.edited_at) } : {}), egos: equipped, ...(post.source === 'planner' ? { floors } : {}),
    }]
  })
}

type RecSkillRow = RawCatalog['skills'][number] & { uptie_level: number | null; variant_order: number | null }
type RecPassiveRow = RawCatalog['passives'][number] & { uptie_level: number | null }

/** What the recommenders read about every identity, E.G.O, pack and gift, reduced to plain features (see lib/discovery/rec-catalog.ts). */
export async function getRecCatalog(): Promise<RecCatalog> {
  'use cache'
  cacheLife('page-1h')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.meta)
  const db = publicClient()
  const [identities, egos, skills, passives, gifts, themes] = await Promise.all([
    readAllMetaRows<RawCatalog['identities'][number]>((from, to) => db.from('identities')
      .select('id, sinner_id, name_kr, rarity, release_date, keywords, skill_keyword_list, association_list, affiliation').order('id').range(from, to)),
    readAllMetaRows<RawCatalog['egos'][number]>((from, to) => db.from('ego')
      .select('id, sinner_id, grade, sin_affinity, keywords, release_date, cost').order('id').range(from, to)),
    readAllMetaRows<RecSkillRow>((from, to) => db.from('skills_max_uptie')
      .select('identity_id, skill_order, sin_affinity, description, uptie_level, variant_order').in('skill_order', [1, 2, 3])
      .order('identity_id').order('skill_order').order('uptie_level', { ascending: false }).order('variant_order').order('id').range(from, to)),
    readAllMetaRows<RecPassiveRow>((from, to) => db.from('passives_max_uptie')
      .select('identity_id, passive_type, passive_order, sin_affinity, sin_count, active_cond, sin_requirements, description, uptie_level')
      .order('identity_id').order('passive_type').order('passive_order').order('uptie_level', { ascending: false }).order('id').range(from, to)),
    readAllMetaRows<RawCatalog['gifts'][number]>((from, to) => db.from('ego_gifts').select('game_id, keyword, grade').order('game_id').range(from, to)),
    readAllMetaRows<RawCatalog['themes'][number]>((from, to) => db.from('ego_gift_themes').select('id, difficulty, ego_gift_ids, specific_ego_gift_ids, floor_info').order('id').range(from, to)),
  ])
  // The catalog shows the highest uptie of the base variant: the views already keep only each slot's highest uptie, the first row of each slot is its base variant.
  const first = <T extends { identity_id: string }>(rows: T[], key: (row: T) => string) => {
    const seen = new Set<string>()
    return rows.filter(row => { const k = `${row.identity_id}:${key(row)}`; if (seen.has(k)) return false; seen.add(k); return true })
  }
  return buildRecCatalog({ identities, egos, gifts, themes, skills: first(skills, row => String(row.skill_order)), passives: first(passives, row => `${row.passive_type}:${row.passive_order}`) })
}
