import { cacheLife, cacheTag } from 'next/cache'
import { publicSupabase } from '@/lib/supabase/public'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { getIdentities } from '@/lib/db/queries'
import { getLocalizedName } from '@/lib/i18n/localize'
import { readAllMetaRows } from '@/lib/meta/pagination'
import { getGameTextRefNamesOrNull } from '@/lib/db/game-text-refs'
import type { SupportedLang } from '@/lib/i18n/types'
import { MOTION_INDEX_URL, motionCatalogFrom, type MotionEntry, type MotionSinner, type MotionSiteData, type MotionSkillFrame } from '@/lib/motion/catalog'

/** The R2 `index.json` (about 0.9 MB) for the sitemap and skill metadata: read once per ten minutes, never copied into the database. */
async function loadMotionIndex(): Promise<MotionEntry[]> {
  'use cache'
  cacheLife('page-10m')
  cacheTag(CACHE_TAGS.motion)
  const response = await fetch(MOTION_INDEX_URL)
  if (!response.ok) throw new Error(`motion index: ${response.status}`)
  const rows: unknown = await response.json()
  if (!Array.isArray(rows)) throw new Error('motion index: not a list')
  return rows as MotionEntry[]
}

/**
 * The site's skills by game skill id, in the page language: their names, and the frame their sprite sits in (sin, slot,
 * attack type). The uptie 4 row writes its image id with `_4`; the highest uptie of an id wins.
 */
async function loadSkillData(lang: SupportedLang): Promise<{ names: Map<number, string>; frames: Map<number, MotionSkillFrame> }> {
  const db = publicSupabase()
  type Row = { image_id: string; name: string | null; name_en: string | null; name_jp: string | null; uptie_level: number | null; skill_order: number; atk_type: string | null; sin_affinity: string | null }
  const rows = await readAllMetaRows<Row>((from, to) => db.schema('limbus').from('skills')
    .select('image_id, name, name_en, name_jp, uptie_level, skill_order, atk_type, sin_affinity').not('image_id', 'is', null).order('id').range(from, to), 1000)
  // A row without a name in the page language leaves the name to the highest uptie that has one.
  const best = new Map<number, Row>(), named = new Map<number, Row & { text: string }>()
  for (const row of rows) {
    const id = Number(row.image_id.replace(/_4$/, '')), uptie = row.uptie_level ?? 0
    if ((best.get(id)?.uptie_level ?? -1) < uptie) best.set(id, row)
    const text = (lang === 'en' ? row.name_en : lang === 'ja' ? row.name_jp : row.name)?.trim()
    if (text && (named.get(id)?.uptie_level ?? -1) < uptie) named.set(id, { ...row, text })
  }
  const names = new Map([...named].map(([id, row]) => [id, row.text]))
  const frames = new Map<number, MotionSkillFrame>()
  for (const [id, row] of best) {
    const attack = row.atk_type === 'slash' || row.atk_type === 'pierce' || row.atk_type === 'blunt' ? row.atk_type : null
    frames.set(id, { sin: row.sin_affinity ?? 'neutral', slot: row.skill_order >= 5 ? 3 : row.skill_order, attack })
  }
  return { names, frames }
}

/** The sinners' names in the page language, by sinner id (a link button names its identity with the sinner). */
async function loadSinnerNames(lang: SupportedLang): Promise<Map<string, string>> {
  const db = publicSupabase()
  const { data, error } = await db.schema('limbus').from('sinners').select('id, name_kr, name_en, name_jp')
  if (error) throw error
  return new Map((data ?? []).map(row => [row.id as string, ((lang === 'en' ? row.name_en : lang === 'ja' ? row.name_jp : row.name_kr) ?? row.name_kr) as string]))
}

/** The site's names and sprites for the motion list in one language (the R2 index is read apart, see MOTION_INDEX_URL). */
export async function loadMotionSiteData(lang: SupportedLang): Promise<MotionSiteData> {
  'use cache'
  cacheLife('page-1h')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.identities)
  const [identities, skills, refs, sinnerNames] = await Promise.all([getIdentities(), loadSkillData(lang), getGameTextRefNamesOrNull(lang), loadSinnerNames(lang)])
  return {
    identities: identities.flatMap(identity => identity.game_id ? [{ id: identity.id, name: getLocalizedName(identity, lang), sinner_id: identity.sinner_id,
      sinner_name: sinnerNames.get(identity.sinner_id), game_id: identity.game_id, folder_name: identity.folder_name ?? null, release_date: identity.release_date ?? null }] : []),
    skillNames: [...skills.names],
    skillFrames: [...skills.frames],
    refs,
  }
}

/**
 * The motion list in one language on the server, for the sitemap and each skill's metadata (the player builds its own from
 * the index it reads, so a list ten minutes old here only delays a new skill's search page).
 */
export async function loadMotionCatalog(lang: SupportedLang): Promise<MotionSinner[]> {
  'use cache'
  cacheLife('page-10m')
  cacheTag(CACHE_TAGS.motion, CACHE_TAGS.identities)
  const [rows, site] = await Promise.all([loadMotionIndex(), loadMotionSiteData(lang)])
  return motionCatalogFrom(rows, site, lang, new Date())
}

export type MotionSkillRow = {
  id: string; name: string; skill_type: string; atk_type: string | null; sin_affinity: string | null
  coins: number; base_power: number; coin_power: number; description: string | null; skill_order: number
  image_id: string | null; atk_weight: number | null; offense_level: number | null; variant_order: number | null; uptie_level: number | null
  identity: { sinner_id: string; game_id: string | null; keywords: string[] | null } | null
}

/** The row a motion's panel shows for a game skill id: the highest uptie, then the first variant. */
export function pickMotionSkillRow<T extends { uptie_level: number | null; variant_order: number | null }>(rows: readonly T[]): T | null {
  return [...rows].sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0) || (a.variant_order ?? 0) - (b.variant_order ?? 0))[0] ?? null
}

const SKILL_COLUMNS = 'id, name, name_en, name_jp, skill_type, atk_type, sin_affinity, coins, base_power, coin_power, description, description_en, description_jp, skill_order, image_id, atk_weight, offense_level, variant_order, uptie_level, identity:identities(sinner_id, game_id, keywords)'

/**
 * The site's data of a game skill, its texts in one language; null when the site has none. The uptie 4 row writes its
 * image id with `_4` (`1091608_4`), so both ids are read and pickMotionSkillRow takes the highest uptie.
 */
export async function loadMotionSkill(skillId: number, lang: SupportedLang): Promise<MotionSkillRow | null> {
  'use cache'
  cacheLife('page-1h')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.identities)
  const db = publicSupabase()
  const { data, error } = await db.schema('limbus').from('skills').select(SKILL_COLUMNS).in('image_id', [String(skillId), `${skillId}_4`])
  if (error) throw error
  type Row = MotionSkillRow & { name_en: string | null; name_jp: string | null; description_en: string | null; description_jp: string | null; identity: MotionSkillRow['identity'] | MotionSkillRow['identity'][] }
  const row = pickMotionSkillRow((data ?? []) as unknown as Row[])
  if (!row) return null
  const { name_en, name_jp, description_en, description_jp, identity, ...rest } = row
  return {
    ...rest,
    name: (lang === 'en' ? name_en : lang === 'ja' ? name_jp : null) || rest.name,
    description: (lang === 'en' ? description_en : lang === 'ja' ? description_jp : null) || rest.description,
    identity: Array.isArray(identity) ? identity[0] ?? null : identity,
  }
}
