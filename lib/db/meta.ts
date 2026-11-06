import { publicSupabase } from '@/lib/supabase/public'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { metaPeriodStart, planGiftIds, planThemeIds } from '@/lib/meta/posts'
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
