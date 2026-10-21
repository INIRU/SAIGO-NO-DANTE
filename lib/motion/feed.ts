import { cacheLife, cacheTag } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { getIdentities } from '@/lib/db/queries'
import { getLocalizedName } from '@/lib/i18n/localize'
import { readAllMetaRows } from '@/lib/meta/pagination'
import type { SupportedLang } from '@/lib/i18n/types'
import { MOTION_ASSET_BASE, buildMotionCatalog, type MotionEntry, type MotionIdentityInfo, type MotionSinner } from '@/lib/motion/catalog'

/** The R2 `index.json` (about 0.6 MB): read once per ten minutes for every visitor, never copied into the database. */
async function loadMotionIndex(): Promise<MotionEntry[]> {
  'use cache'
  cacheLife('page-10m')
  cacheTag(CACHE_TAGS.motion)
  const response = await fetch(MOTION_ASSET_BASE + 'index.json')
  if (!response.ok) throw new Error(`motion index: ${response.status}`)
  const rows: unknown = await response.json()
  if (!Array.isArray(rows)) throw new Error('motion index: not a list')
  return rows as MotionEntry[]
}

/** The site's skill names in English or Japanese by game skill id (the uptie 4 row writes `<id>_4`), the highest uptie's. */
async function loadSkillNames(lang: 'en' | 'ja'): Promise<Map<number, string>> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
  type Row = { image_id: string; name_en: string | null; name_jp: string | null; uptie_level: number | null }
  const rows = await readAllMetaRows<Row>((from, to) => db.schema('limbus').from('skills')
    .select('image_id, name_en, name_jp, uptie_level').not('image_id', 'is', null).order('id').range(from, to), 1000)
  const best = new Map<number, { name: string; uptie: number }>()
  for (const row of rows) {
    const name = (lang === 'en' ? row.name_en : row.name_jp)?.trim()
    if (!name) continue
    const id = Number(row.image_id.replace(/_4$/, '')), uptie = row.uptie_level ?? 0
    if ((best.get(id)?.uptie ?? -1) < uptie) best.set(id, { name, uptie })
  }
  return new Map([...best].map(([id, { name }]) => [id, name]))
}

/** The motion list in one language: sinners → identities → skills → states (lib/motion/catalog.ts). */
export async function loadMotionCatalog(lang: SupportedLang): Promise<MotionSinner[]> {
  'use cache'
  cacheLife('page-10m')
  cacheTag(CACHE_TAGS.motion, CACHE_TAGS.identities)
  const [rows, identities, skillNames] = await Promise.all([loadMotionIndex(), getIdentities(), lang === 'ko' ? new Map<number, string>() : loadSkillNames(lang)])
  const byGameId = new Map<string, MotionIdentityInfo>()
  for (const identity of identities) {
    if (!identity.game_id) continue
    byGameId.set(identity.game_id, { id: identity.id, name: getLocalizedName(identity, lang), sinner_id: identity.sinner_id, game_id: identity.game_id, folder_name: identity.folder_name ?? null, release_date: identity.release_date ?? null })
  }
  return buildMotionCatalog(rows, byGameId, lang, skillNames)
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
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
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
