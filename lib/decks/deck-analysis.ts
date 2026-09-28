import { SIN_ORDER, normalizeSin } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'

export type SkillDistributionTuple = readonly [number, number, number]
export const BASE_SKILL_DISTRIBUTION: SkillDistributionTuple = [3, 2, 1]

export type AnalysisSkill = {
  sin_affinity: string | null
  skill_type: string
  skill_order: number
  atk_type?: string | null
  uptie_level?: number | null
  variant_order?: number | null
}

export const ATTACK_TYPES = ['slash', 'pierce', 'blunt'] as const
export const DEFENSE_TYPES = ['evade', 'defense', 'counter'] as const
export type AttackType = (typeof ATTACK_TYPES)[number]
export type DefenseType = (typeof DEFENSE_TYPES)[number]

const ATTACK_ALIASES: Record<string, AttackType> = {
  slash: 'slash', pierce: 'pierce', penetrate: 'pierce', blunt: 'blunt', hit: 'blunt',
  '참격': 'slash', '관통': 'pierce', '타격': 'blunt',
}

function toAttackType(value: string | null | undefined): AttackType | null {
  return value ? ATTACK_ALIASES[value.trim().toLowerCase()] ?? null : null
}

const pickHigherUptie = <T extends AnalysisSkill>(a: T | undefined, b: T) => (!a || (b.uptie_level ?? 0) > (a.uptie_level ?? 0) ? b : a)

/** S1–S4 of one identity: base variant (a second form's skills are left out), highest uptie among the given rows. */
function baseSkills(skills: AnalysisSkill[]): Map<number, AnalysisSkill> {
  const best = new Map<number, AnalysisSkill>()
  for (const skill of skills) {
    if (skill.skill_order < 1 || skill.skill_order > 4) continue
    const current = best.get(skill.skill_order)
    const variant = skill.variant_order ?? 0
    const currentVariant = current?.variant_order ?? 0
    if (!current || variant < currentVariant) best.set(skill.skill_order, skill)
    else if (variant === currentVariant) best.set(skill.skill_order, pickHigherUptie(current, skill))
  }
  return best
}

/**
 * Sin resources a deck produces: per identity, S1–S3 (base variant, highest uptie) × that slot's skill distribution.
 * Keys are normalized English sins so passive conditions match regardless of the data's language.
 */
export function computeSinProduction(entries: { skills: AnalysisSkill[]; distribution?: SkillDistributionTuple | null }[]): Record<SinType, number> {
  const counts = Object.fromEntries(SIN_ORDER.map(sin => [sin, 0])) as Record<SinType, number>
  for (const { skills, distribution } of entries) {
    const weights = distribution ?? BASE_SKILL_DISTRIBUTION
    for (const [order, skill] of baseSkills(skills)) {
      if (order > 3) continue
      const sin = normalizeSin(skill.sin_affinity)
      if (sin) counts[sin] += weights[order - 1] ?? 0
    }
  }
  return counts
}

/**
 * Per identity, the attack type of S1–S3 and the type of its defense skill (S4), counted once each like the sin
 * resources: base variant at the given uptie. Uptie rows, second forms and EGO skills are not counted: a deck may list
 * four EGOs per sinner, which outnumbered the identity skills (2026-09-28: 67/36/31 for 12 identities).
 */
export function computeAttackTypeCounts(identitySkills: AnalysisSkill[][]) {
  const attack: Record<AttackType, number> = { slash: 0, pierce: 0, blunt: 0 }
  const defense: Record<DefenseType, number> = { evade: 0, defense: 0, counter: 0 }
  for (const skills of identitySkills) {
    for (const [order, skill] of baseSkills(skills)) {
      if (order === 4) {
        if ((DEFENSE_TYPES as readonly string[]).includes(skill.skill_type)) defense[skill.skill_type as DefenseType]++
        continue
      }
      const type = toAttackType(skill.atk_type ?? skill.skill_type)
      if (type) attack[type]++
    }
  }
  return { attack, defense }
}

/** EGO costs are stored in SIN_ORDER order. */
export function computeEgoCostTotals(costs: (number[] | null | undefined)[]): Record<SinType, number> {
  const totals = Object.fromEntries(SIN_ORDER.map(sin => [sin, 0])) as Record<SinType, number>
  for (const cost of costs) SIN_ORDER.forEach((sin, index) => { totals[sin] += cost?.[index] ?? 0 })
  return totals
}
