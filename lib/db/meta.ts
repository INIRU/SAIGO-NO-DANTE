import { createClient } from '@supabase/supabase-js'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { aggregateMeta, metaPeriodStart, planGiftIds, planThemeIds } from '@/lib/meta/aggregate'
import { readAllMetaRows } from '@/lib/meta/pagination'
import { DEFAULT_META_PERIOD, DEFAULT_META_SOURCE, type MetaData, type MetaFilters, type MetaIdentity, type MetaEGO, type MetaGift, type MetaPost, type MetaSkill, type MetaSource, type MetaPeriod, type MetaTheme } from '@/lib/meta/types'

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

type Reception = { vote_count: number | null; view_count: number | null; comment_count: number | null }
type DeckRow = Reception & { title: string; main_keywords: string[] | null; content_type: string | null; id: string; created_at: string; deck_identities: unknown; deck_egos: unknown }
type PlanRow = Reception & { title: string; tags: string[] | null; id: string; created_at: string; deck: unknown; egos: unknown; difficulty: string | null; floor_plan: unknown; gift_inventory: unknown }
const reception = (row: Reception) => ({ votes: row.vote_count, views: row.view_count, comments: row.comment_count })

async function getSourcePosts(source: Exclude<MetaSource, 'all'>, period: MetaPeriod): Promise<MetaPost[]> {
  'use cache'
  cacheLife('page-5m')
  cacheTag(source === 'decks' ? CACHE_TAGS.decksList : CACHE_TAGS.plansList, CACHE_TAGS.meta)
  const db = publicClient()
  const now = Date.now()
  const since = metaPeriodStart(period, now)
  if (source === 'decks') {
    const rows = await readAllMetaRows<DeckRow>((from, to) => {
      let query = db.from('decks').select('id, title, main_keywords, content_type, created_at, vote_count, view_count, comment_count, deck_identities(identity_id, slot_order, s1_count, s2_count, s3_count), deck_egos(ego_id)')
        .order('id').lte('created_at', new Date(now).toISOString())
      if (since) query = query.gte('created_at', since)
      return query.range(from, to)
    })
    return rows.map(row => ({ id: row.id, source, created_at: row.created_at, title: row.title, keywords: row.main_keywords, content_type: row.content_type, ...reception(row), identities: row.deck_identities, egos: row.deck_egos }))
  }
  const rows = await readAllMetaRows<PlanRow>((from, to) => {
    let query = db.from('md_plans').select('id, title, tags, created_at, vote_count, view_count, comment_count, deck, egos, difficulty, floor_plan, gift_inventory')
      .order('id').lte('created_at', new Date(now).toISOString())
    if (since) query = query.gte('created_at', since)
    return query.range(from, to)
  })
  return rows.map(row => ({ id: row.id, source, created_at: row.created_at, title: row.title, keywords: row.tags, ...reception(row), identities: row.deck, egos: row.egos,
    difficulty: row.difficulty, gifts: planGiftIds(row.gift_inventory), themes: planThemeIds(row.floor_plan), floorPlan: row.floor_plan, inventory: row.gift_inventory }))
}

type SkillRow = { identity_id: string; skill_order: number; uptie_level: number | null; variant_order: number | null; name: string; name_en: string | null; name_jp: string | null; sin_affinity: string | null; image_id: string | null }

/** S1–S3 of every identity at its highest uptie (the first variant), for the skill exchange icons. */
async function getSkillCatalog(): Promise<Record<string, MetaSkill[]>> {
  'use cache'
  cacheLife('page-1h')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.meta)
  const db = publicClient()
  const rows = await readAllMetaRows<SkillRow>((from, to) => db.from('skills')
    .select('identity_id, skill_order, uptie_level, variant_order, name, name_en, name_jp, sin_affinity, image_id')
    .in('skill_order', [1, 2, 3])
    .order('identity_id').order('skill_order').order('uptie_level', { ascending: false }).order('variant_order').order('id').range(from, to))
  const catalog: Record<string, MetaSkill[]> = {}
  for (const row of rows) {
    const skills = catalog[row.identity_id] ??= []
    if (skills.some(skill => skill.order === row.skill_order)) continue
    skills.push({ order: row.skill_order as MetaSkill['order'], name: row.name, name_en: row.name_en, name_jp: row.name_jp, sin_affinity: row.sin_affinity, image_id: row.image_id })
  }
  return catalog
}

/** Every gift and theme pack, by game id and pack id. */
async function getPlanCatalog() {
  'use cache'
  cacheLife('page-1h')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.meta)
  const db = publicClient()
  const [gifts, themes] = await Promise.all([
    readAllMetaRows<MetaGift>((from, to) => db.from('ego_gifts').select('game_id, name, name_en, name_jp, grade, keyword, image_url').order('game_id').range(from, to)),
    readAllMetaRows<MetaTheme>((from, to) => db.from('ego_gift_themes').select('id, name, name_en, name_jp, image_url, name_color, name_segments').order('id').range(from, to)),
  ])
  return {
    gifts: Object.fromEntries(gifts.map(gift => [String(gift.game_id), gift])),
    themes: Object.fromEntries(themes.map(theme => [String(theme.id), theme])),
  }
}

const pick = <T>(catalog: Record<string, T>, keys: string[]): Record<string, T> => Object.fromEntries([...new Set(keys)].flatMap(key => catalog[key] ? [[key, catalog[key]]] : []))

/** Counts one scope from the cached posts and catalogs: no query of its own. */
async function buildMetaData(source: MetaSource, period: MetaPeriod, filters: MetaFilters): Promise<MetaData> {
  const [catalog, skills, planCatalog, decks, plans] = await Promise.all([
    getMetaCatalog(),
    getSkillCatalog(),
    getPlanCatalog(),
    source === 'planner' ? Promise.resolve([]) : getSourcePosts('decks', period),
    source === 'decks' ? Promise.resolve([]) : getSourcePosts('planner', period),
  ])
  const keywordSinMap: Record<string, string> = {}
  for (const keyword of catalog.keywords) if (keyword.sin_affinity) keywordSinMap[keyword.name] = keyword.sin_affinity
  const data = aggregateMeta({ posts: [...decks, ...plans], identities: catalog.identities, egos: catalog.egos, keywordSinMap, source, period, filters, now: Date.now() })
  const summaries = [data.planStats, ...Object.values(data.identityInsights).flatMap(insight => insight.plan ? [insight.plan] : [])]
  const { dungeon } = data
  const giftIds = [...summaries.flatMap(summary => summary.gifts), ...dungeon.routes, ...dungeon.start, ...dungeon.observe, ...dungeon.enhanced].map(row => row.key)
  const themeIds = [...summaries.flatMap(summary => summary.themes), ...dungeon.floors.flatMap(floor => floor.themes)].map(row => row.key)
  return { ...data, giftCatalog: pick(planCatalog.gifts, giftIds), themeCatalog: pick(planCatalog.themes, themeIds), skillCatalog: pick(skills, Object.keys(data.identityInsights)) }
}

/** One of the twelve unfiltered scopes (source × period): what most visits ask for, kept whole. */
async function getUnfilteredMetaData(source: MetaSource, period: MetaPeriod): Promise<MetaData> {
  'use cache'
  cacheLife('page-5m')
  cacheTag(CACHE_TAGS.meta, CACHE_TAGS.gameData, CACHE_TAGS.decksList, CACHE_TAGS.plansList)
  return buildMetaData(source, period, {})
}

/** Filters combine without bound, so a filtered result is not kept: it is counted again from the cached posts and catalogs. */
export async function getMetaData(source: MetaSource = DEFAULT_META_SOURCE, period: MetaPeriod = DEFAULT_META_PERIOD, filters: MetaFilters = {}): Promise<MetaData> {
  return Object.keys(filters).length ? buildMetaData(source, period, filters) : getUnfilteredMetaData(source, period)
}
