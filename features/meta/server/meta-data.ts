import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { getMetaCatalog, getSourcePosts, publicClient } from '@/lib/db/meta'
import { readAllMetaRows } from '@/lib/meta/pagination'
import { DEFAULT_META_PERIOD, DEFAULT_META_SOURCE, type MetaData, type MetaFilters, type MetaGift, type MetaSkill, type MetaSource, type MetaPeriod, type MetaTheme } from '@/lib/meta/types'
import { aggregateMeta } from '../lib/aggregate'

type SkillRow = { identity_id: string; skill_order: number; uptie_level: number | null; variant_order: number | null; name: string; name_en: string | null; name_jp: string | null; sin_affinity: string | null; image_id: string | null }

/** S1–S3 of every identity at its highest uptie (the first variant), for the skill exchange icons. Read from skills_max_uptie: 876 rows instead of all 3,001. */
async function getSkillCatalog(): Promise<Record<string, MetaSkill[]>> {
  'use cache'
  cacheLife('page-1h')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.meta)
  const db = publicClient()
  const rows = await readAllMetaRows<SkillRow>((from, to) => db.from('skills_max_uptie')
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
  // keyword_meta has no sin column (it never held a value), so no keyword maps to a sin here.
  const keywordSinMap: Record<string, string> = {}
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
