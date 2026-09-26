import { createClient } from '@supabase/supabase-js'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { aggregateMeta, metaPeriodStart } from '@/lib/meta/aggregate'
import { readAllMetaRows } from '@/lib/meta/pagination'
import { DEFAULT_META_PERIOD, DEFAULT_META_SOURCE, type MetaData, type MetaIdentity, type MetaEGO, type MetaPost, type MetaSource, type MetaPeriod } from '@/lib/meta/types'

function publicClient() {
  // Aggregated results are shared publicly: never derive them from a user's session
  // or use an administrator key that could include rows hidden by RLS.
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).schema('limbus')
}

async function getMetaCatalog() {
  'use cache'
  cacheLife('page-1h')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.meta, CACHE_TAGS.keywords)
  const db = publicClient()
  const [identities, egos, keywords] = await Promise.all([
    readAllMetaRows<MetaIdentity>((from, to) => db.from('identities')
      .select('id, sinner_id, name_kr, name_en, name_jp, keywords, skill_keyword_list, rarity, folder_name, game_id').order('id').range(from, to)),
    readAllMetaRows<MetaEGO>((from, to) => db.from('ego')
      .select('id, sinner_id, name_kr, name_en, name_jp, grade, sin_affinity, image_url, game_id').order('id').range(from, to)),
    readAllMetaRows<{ name: string; sin_affinity: string | null }>((from, to) => db.from('keyword_meta')
      .select('name, sin_affinity').order('name').range(from, to)),
  ])
  return { identities, egos, keywords }
}

type DeckRow = { title: string; main_keywords: string[] | null; content_type: string | null; id: string; created_at: string; deck_identities: unknown; deck_egos: unknown }
type PlanRow = { title: string; tags: string[] | null; id: string; created_at: string; deck: unknown; egos: unknown }

async function getSourcePosts(source: Exclude<MetaSource, 'all'>, period: MetaPeriod): Promise<MetaPost[]> {
  'use cache'
  cacheLife('page-5m')
  cacheTag(source === 'decks' ? CACHE_TAGS.decksList : CACHE_TAGS.plansList, CACHE_TAGS.meta)
  const db = publicClient()
  const now = Date.now()
  const since = metaPeriodStart(period, now)
  if (source === 'decks') {
    const rows = await readAllMetaRows<DeckRow>((from, to) => {
      let query = db.from('decks').select('id, title, main_keywords, content_type, created_at, deck_identities(identity_id, slot_order), deck_egos(ego_id)')
        .order('id').lte('created_at', new Date(now).toISOString())
      if (since) query = query.gte('created_at', since)
      return query.range(from, to)
    })
    return rows.map(row => ({ id: row.id, source, created_at: row.created_at, title: row.title, keywords: row.main_keywords, content_type: row.content_type, identities: row.deck_identities, egos: row.deck_egos }))
  }
  const rows = await readAllMetaRows<PlanRow>((from, to) => {
    let query = db.from('md_plans').select('id, title, tags, created_at, deck, egos')
      .order('id').lte('created_at', new Date(now).toISOString())
    if (since) query = query.gte('created_at', since)
    return query.range(from, to)
  })
  return rows.map(row => ({ id: row.id, source, created_at: row.created_at, title: row.title, keywords: row.tags, identities: row.deck, egos: row.egos }))
}

export async function getMetaData(source: MetaSource = DEFAULT_META_SOURCE, period: MetaPeriod = DEFAULT_META_PERIOD): Promise<MetaData> {
  'use cache'
  cacheLife('page-5m')
  cacheTag(CACHE_TAGS.meta, CACHE_TAGS.gameData, CACHE_TAGS.decksList, CACHE_TAGS.plansList)
  const [catalog, decks, plans] = await Promise.all([
    getMetaCatalog(),
    source === 'planner' ? Promise.resolve([]) : getSourcePosts('decks', period),
    source === 'decks' ? Promise.resolve([]) : getSourcePosts('planner', period),
  ])
  const keywordSinMap: Record<string, string> = {}
  for (const keyword of catalog.keywords) if (keyword.sin_affinity) keywordSinMap[keyword.name] = keyword.sin_affinity
  return aggregateMeta({ posts: [...decks, ...plans], identities: catalog.identities, egos: catalog.egos, keywordSinMap, source, period, now: Date.now() })
}
