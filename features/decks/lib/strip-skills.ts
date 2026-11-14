import { computeSkillImageIndices, getSkillIconUrl } from '@/lib/utils/images'
import { localizeEgoName } from '@/lib/decks/localize'
import { topUptieSkills } from '@/lib/decks/deck-identity-uptie'
import type { EgoSlotItem, FormationStripSkill } from '@/components/cards/EgoSlotRows'

type StripSkillRow = {
  id: string
  skill_order: number
  skill_type: string
  variant_order?: number | null
  uptie_level?: number | null
  sin_affinity?: string | null
  atk_type?: string | null
  image_id?: string | null
}

/** Skills 1-3 of one identity for the card strip and the skill view (same rules as the deck detail page); `counts` = how many of each the deck holds. */
export function buildStripSkills(
  identity: { sinner_id: string; game_id?: string | null },
  rows: readonly StripSkillRow[],
  counts: readonly number[],
): (FormationStripSkill | null)[] {
  const attacks = topUptieSkills(rows.filter(skill => !['evade', 'defense', 'counter'].includes(skill.skill_type))).sort((a, b) => a.skill_order - b.skill_order)
  const imageIndices = computeSkillImageIndices(attacks)
  return [1, 2, 3].map(order => {
    const skill = attacks.find(row => row.skill_order === order)
    return skill
      ? { iconUrl: getSkillIconUrl({ sinner_id: identity.sinner_id, game_id: identity.game_id ?? null }, imageIndices[skill.id] ?? order, skill), sin: skill.sin_affinity ?? null, attackType: skill.atk_type ?? null, count: counts[order - 1] ?? 4 - order }
      : null
  })
}

type EgoLike = { id: string; sin_affinity?: string | null; image_url?: string | null; name_kr?: string | null; name_en?: string | null; name_jp?: string | null; name?: string | null }

/** One sinner's chosen E.G.O by grade, in the shape the strip and the back panel draw. */
export function toEgoSlotItems(byGrade: Record<string, EgoLike | undefined>, locale: string): Record<string, EgoSlotItem | undefined> {
  const items: Record<string, EgoSlotItem | undefined> = {}
  for (const [grade, ego] of Object.entries(byGrade)) {
    if (ego) items[grade] = { id: ego.id, name: localizeEgoName(ego, locale), sin_affinity: ego.sin_affinity ?? null, image_url: ego.image_url }
  }
  return items
}
