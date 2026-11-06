import { cacheLife, cacheTag } from 'next/cache'
import { publicSupabase } from '@/lib/supabase/public'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { getIdentities } from '@/lib/db/queries'
import { getLocalizedName } from '@/lib/i18n/localize'
import { readAllMetaRows } from '@/lib/meta/pagination'
import { getGameTextRefNamesOrNull } from '@/lib/db/game-text-refs'
import { skillSlot } from '@/lib/identity/skill-model'
import type { SupportedLang } from '@/lib/i18n/types'
import { MOTION_INDEX_URL, motionCatalogFrom, type MotionEgoInfo, type MotionEntry, type MotionSinner, type MotionSiteData, type MotionSkillFrame } from '@/features/motion/lib/catalog'

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
type SkillOwner = { game_id: string | null } | { game_id: string | null }[] | null | undefined
/**
 * The rows of a game skill id: a skill can borrow another identity's sprite id (경멸, 경외 uses 1011303), so the rows of the
 * identity the id belongs to, its first five digits, come first; all of them when it has none.
 */
export function ownSkillRows<T extends { identity?: SkillOwner }>(rows: readonly T[], skillId: number): T[] {
  const owner = String(skillId).slice(0, 5)
  const own = rows.filter(row => ownerOf(row) === owner)
  return own.length ? own : [...rows]
}
const ownerOf = (row: { identity?: SkillOwner }) => (Array.isArray(row.identity) ? row.identity[0] : row.identity)?.game_id ?? null

/**
 * The other way round: an identity's skill saved under another identity's sprite id (경멸, 경외's 1041206 is saved as
 * 1011303), so its own id has no row. The rows of the identity with a sprite id not its own, when they are one skill.
 */
export function borrowedRows<T extends { image_id: string | null; identity?: SkillOwner }>(rows: readonly T[], owner: string): T[] {
  const lent = rows.filter(row => ownerOf(row) === owner && row.image_id && !row.image_id.startsWith(owner))
  return new Set(lent.map(row => row.image_id!.replace(/_4$/, ''))).size === 1 ? lent : []
}

type SkillSummary = { name?: string; frame: MotionSkillFrame }

async function loadSkillData(lang: SupportedLang): Promise<{ names: Map<number, string>; frames: Map<number, MotionSkillFrame>; borrowed: Map<string, SkillSummary> }> {
  const db = publicSupabase()
  type Row = { image_id: string; name: string | null; name_en: string | null; name_jp: string | null; uptie_level: number | null; skill_order: number; atk_type: string | null; sin_affinity: string | null; identity?: SkillOwner }
  const rows = await readAllMetaRows<Row>((from, to) => db.schema('limbus').from('skills')
    .select('image_id, name, name_en, name_jp, uptie_level, skill_order, atk_type, sin_affinity, identity:identities(game_id)').not('image_id', 'is', null).order('id').range(from, to), 1000)
  // The frame of the highest uptie; a row without a name in the page language leaves the name to the highest uptie that has one.
  const summary = (group: readonly Row[]): SkillSummary | null => {
    let best: Row | null = null, named: (Row & { text: string }) | null = null
    for (const row of group) {
      const uptie = row.uptie_level ?? 0
      if ((best?.uptie_level ?? -1) < uptie) best = row
      const text = (lang === 'en' ? row.name_en : lang === 'ja' ? row.name_jp : row.name)?.trim()
      if (text && (named?.uptie_level ?? -1) < uptie) named = { ...row, text }
    }
    if (!best) return null
    const attack = best.atk_type === 'slash' || best.atk_type === 'pierce' || best.atk_type === 'blunt' ? best.atk_type : null
    return { ...(named && { name: named.text }), frame: { sin: best.sin_affinity ?? 'neutral', slot: skillSlot(best), attack } }
  }
  const names = new Map<number, string>(), frames = new Map<number, MotionSkillFrame>(), borrowed = new Map<string, SkillSummary>()
  for (const [id, group] of Map.groupBy(rows, row => Number(row.image_id.replace(/_4$/, '')))) {
    const found = summary(ownSkillRows(group, id))
    if (!found) continue
    if (found.name) names.set(id, found.name)
    frames.set(id, found.frame)
  }
  for (const [owner, group] of Map.groupBy(rows, row => ownerOf(row) ?? '')) {
    const lent = owner ? borrowedRows(group, owner) : []
    const found = summary(lent)
    if (found) borrowed.set(owner, { ...found, frame: { ...found.frame, sprite: Number(lent[0].image_id.replace(/_4$/, '')) } })
  }
  // The E.G.O skills: their own table, one row per construe level, always in the third skill's frame.
  type EgoRow = { game_skill_id: number | null; name: string | null; name_en: string | null; name_jp: string | null; skill_type: string | null; sin_affinity: string | null }
  const egoRows = await readAllMetaRows<EgoRow>((from, to) => db.schema('limbus').from('ego_skills')
    .select('game_skill_id, name, name_en, name_jp, skill_type, sin_affinity').not('game_skill_id', 'is', null).order('id').range(from, to), 1000)
  for (const row of egoRows) {
    const id = row.game_skill_id!, text = (lang === 'en' ? row.name_en : lang === 'ja' ? row.name_jp : null)?.trim() || row.name
    if (text) names.set(id, text)
    const attack = row.skill_type === 'slash' || row.skill_type === 'pierce' || row.skill_type === 'blunt' ? row.skill_type : null
    frames.set(id, { sin: row.sin_affinity ?? 'neutral', slot: 3, attack })
  }
  return { names, frames, borrowed }
}

/** The sinners' names in the page language, by sinner id (a link button names its identity with the sinner). */
async function loadSinnerNames(lang: SupportedLang): Promise<Map<string, string>> {
  const db = publicSupabase()
  const { data, error } = await db.schema('limbus').from('sinners').select('id, name_kr, name_en, name_jp')
  if (error) throw error
  return new Map((data ?? []).map(row => [row.id as string, ((lang === 'en' ? row.name_en : lang === 'ja' ? row.name_jp : row.name_kr) ?? row.name_kr) as string]))
}

/** The site's E.G.O by game id, their names in the page language (the E.G.O cards of the motion list). */
async function loadEgos(lang: SupportedLang): Promise<MotionEgoInfo[]> {
  const db = publicSupabase()
  const { data, error } = await db.schema('limbus').from('ego').select('game_id, sinner_id, name_kr, name_en, name_jp, grade, sin_affinity, image_url').not('game_id', 'is', null)
  if (error) throw error
  return (data ?? []).map(row => ({ game_id: String(row.game_id), name: getLocalizedName(row, lang), image_url: row.image_url ?? null, grade: row.grade as string, sinner_id: row.sinner_id as string, sin_affinity: row.sin_affinity ?? null }))
}

/** The site's names and sprites for the motion list in one language (the R2 index is read apart, see MOTION_INDEX_URL). */
export async function loadMotionSiteData(lang: SupportedLang): Promise<MotionSiteData> {
  'use cache'
  cacheLife('page-1h')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.identities)
  const [identities, skills, refs, sinnerNames, egos] = await Promise.all([getIdentities(), loadSkillData(lang), getGameTextRefNamesOrNull(lang), loadSinnerNames(lang), loadEgos(lang)])
  return {
    identities: identities.flatMap(identity => identity.game_id ? [{ id: identity.id, name: getLocalizedName(identity, lang), sinner_id: identity.sinner_id,
      sinner_name: sinnerNames.get(identity.sinner_id), game_id: identity.game_id, folder_name: identity.folder_name ?? null, rarity: identity.rarity ?? null, release_date: identity.release_date ?? null }] : []),
    egos,
    skillNames: [...skills.names],
    skillFrames: [...skills.frames],
    skillBorrowed: [...skills.borrowed],
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

const EGO_SKILL_COLUMNS = 'id, name, name_en, name_jp, skill_type, sin_affinity, coins, base_power, coin_power, description, description_en, description_jp, skill_order, atk_weight, offense_level, construe_level, coin_list, ego:ego(sinner_id, game_id)'
type EgoSkillRow = { id: string; name: string; name_en: string | null; name_jp: string | null; skill_type: string; sin_affinity: string | null; coins: number; base_power: number; coin_power: number; description: string | null; description_en: string | null; description_jp: string | null; skill_order: number; atk_weight: number | null; offense_level: number | null; construe_level: number | null; coin_list?: unknown; ego: { sinner_id: string; game_id: string | null } | { sinner_id: string; game_id: string | null }[] | null }

/** An E.G.O skill as the skill card reads it: the highest construe level, its texts in one language, in the third skill's frame as the game draws it. */
export function egoSkillRow(rows: readonly EgoSkillRow[], lang: SupportedLang): MotionSkillRow | null {
  const row = [...rows].sort((a, b) => (b.construe_level ?? 0) - (a.construe_level ?? 0))[0]
  if (!row) return null
  const ego = Array.isArray(row.ego) ? row.ego[0] : row.ego
  const { name_en, name_jp, description_en, description_jp, construe_level, ego: _, ...rest } = row
  return {
    ...rest, atk_type: row.skill_type, skill_order: 3, image_id: null, variant_order: null, uptie_level: construe_level,
    name: (lang === 'en' ? name_en : lang === 'ja' ? name_jp : null) || row.name,
    description: (lang === 'en' ? description_en : lang === 'ja' ? description_jp : null) || row.description,
    identity: ego ? { sinner_id: ego.sinner_id, game_id: ego.game_id, keywords: null } : null,
  } as MotionSkillRow
}

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
  let row = pickMotionSkillRow(ownSkillRows((data ?? []) as unknown as Row[], skillId))
  if (!row) {
    // Saved under another identity's sprite id: the identity's one borrowed skill (see borrowedRows).
    const owner = String(skillId).slice(0, 5)
    const identity = await db.schema('limbus').from('identities').select('id').eq('game_id', owner)
    if (identity.error) throw identity.error
    if (identity.data?.length) {
      const own = await db.schema('limbus').from('skills').select(SKILL_COLUMNS).eq('identity_id', identity.data[0].id)
      if (own.error) throw own.error
      row = pickMotionSkillRow(borrowedRows((own.data ?? []) as unknown as Row[], owner))
    }
  }
  if (!row) {
    const ego = await db.schema('limbus').from('ego_skills').select(EGO_SKILL_COLUMNS).eq('game_skill_id', skillId)
    if (ego.error) throw ego.error
    return egoSkillRow((ego.data ?? []) as unknown as EgoSkillRow[], lang)
  }
  const { name_en, name_jp, description_en, description_jp, identity, ...rest } = row
  return {
    ...rest,
    name: (lang === 'en' ? name_en : lang === 'ja' ? name_jp : null) || rest.name,
    description: (lang === 'en' ? description_en : lang === 'ja' ? description_jp : null) || rest.description,
    identity: Array.isArray(identity) ? identity[0] ?? null : identity,
  }
}
