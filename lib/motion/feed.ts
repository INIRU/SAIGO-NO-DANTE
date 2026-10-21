import { cacheLife, cacheTag } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { getIdentities } from '@/lib/db/queries'
import { getLocalizedName } from '@/lib/i18n/localize'
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

/** The motion list in one language: sinners → identities → skills → states (lib/motion/catalog.ts). */
export async function loadMotionCatalog(lang: SupportedLang): Promise<MotionSinner[]> {
  'use cache'
  cacheLife('page-10m')
  cacheTag(CACHE_TAGS.motion, CACHE_TAGS.identities)
  const [rows, identities] = await Promise.all([loadMotionIndex(), getIdentities()])
  const byGameId = new Map<string, MotionIdentityInfo>()
  for (const identity of identities) {
    if (!identity.game_id) continue
    byGameId.set(identity.game_id, { id: identity.id, name: getLocalizedName(identity, lang), sinner_id: identity.sinner_id, game_id: identity.game_id, folder_name: identity.folder_name ?? null, release_date: identity.release_date ?? null })
  }
  return buildMotionCatalog(rows, byGameId, lang)
}

export type MotionSkillRow = {
  id: string; name: string; skill_type: string; atk_type: string | null; sin_affinity: string | null
  coins: number; base_power: number; coin_power: number; description: string | null; skill_order: number
  image_id: string | null; atk_weight: number | null; offense_level: number | null; variant_order: number | null; uptie_level: number | null
  identity: { sinner_id: string; game_id: string | null } | null
}

/** The row a motion's panel shows for a game skill id: the highest uptie, then the first variant. */
export function pickMotionSkillRow<T extends { uptie_level: number | null; variant_order: number | null }>(rows: readonly T[]): T | null {
  return [...rows].sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0) || (a.variant_order ?? 0) - (b.variant_order ?? 0))[0] ?? null
}

const SKILL_COLUMNS = 'id, name, name_en, name_jp, skill_type, atk_type, sin_affinity, coins, base_power, coin_power, description, description_en, description_jp, skill_order, image_id, atk_weight, offense_level, variant_order, uptie_level, identity:identities(sinner_id, game_id)'

/** The site's data of a game skill (`skills.image_id`), its texts in one language; null when the site has none. */
export async function loadMotionSkill(skillId: number, lang: SupportedLang): Promise<MotionSkillRow | null> {
  'use cache'
  cacheLife('page-1h')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.identities)
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
  const { data, error } = await db.schema('limbus').from('skills').select(SKILL_COLUMNS).eq('image_id', String(skillId))
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
