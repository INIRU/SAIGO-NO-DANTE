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

export type AnalysisEgoSkill = {
  skill_type?: string | null
  atkType?: string | null
  attack_type?: string | null
  category?: string | null
  construe_level?: number | null
  construeLevel?: number | null
  skill_order?: number | null
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

/**
 * Sin resources a deck produces: per identity, S1–S3 (base variant, highest uptie) × that slot's skill distribution.
 * Keys are normalized English sins so passive conditions match regardless of the data's language.
 */
export function computeSinProduction(entries: { skills: AnalysisSkill[]; distribution?: SkillDistributionTuple | null }[]): Record<SinType, number> {
  const counts = Object.fromEntries(SIN_ORDER.map(sin => [sin, 0])) as Record<SinType, number>
  for (const { skills, distribution } of entries) {
    const weights = distribution ?? BASE_SKILL_DISTRIBUTION
    const best = new Map<number, AnalysisSkill>()
    for (const skill of skills) {
      if (skill.skill_order < 1 || skill.skill_order > 3) continue
      const current = best.get(skill.skill_order)
      const variant = skill.variant_order ?? 0
      const currentVariant = current?.variant_order ?? 0
      if (!current || variant < currentVariant) best.set(skill.skill_order, skill)
      else if (variant === currentVariant) best.set(skill.skill_order, pickHigherUptie(current, skill))
    }
    for (const [order, skill] of best) {
      const sin = normalizeSin(skill.sin_affinity)
      if (sin) counts[sin] += weights[order - 1] ?? 0
    }
  }
  return counts
}

/** Attack types over every identity skill with an attack type (counters included) plus EGO skills; defense types over defensive skills. */
export function computeAttackTypeCounts(identitySkills: AnalysisSkill[][], egoSkills: (AnalysisEgoSkill[] | null | undefined)[] = []) {
  const attack: Record<AttackType, number> = { slash: 0, pierce: 0, blunt: 0 }
  const defense: Record<DefenseType, number> = { evade: 0, defense: 0, counter: 0 }
  for (const skills of identitySkills) {
    const best = new Map<string, AnalysisSkill>()
    for (const skill of skills) {
      const key = `${skill.skill_order}:${skill.variant_order ?? 0}`
      best.set(key, pickHigherUptie(best.get(key), skill))
    }
    for (const skill of best.values()) {
      if ((DEFENSE_TYPES as readonly string[]).includes(skill.skill_type)) defense[skill.skill_type as DefenseType]++
      const type = toAttackType(skill.atk_type ?? skill.skill_type)
      if (type) attack[type]++
    }
  }
  const construe = (skill?: AnalysisEgoSkill) => skill?.construe_level ?? skill?.construeLevel ?? 0
  for (const skills of egoSkills) {
    const unique = new Map<string, AttackType>()
    const levels = new Map<string, number>()
    ;(skills ?? []).forEach((skill, index) => {
      const type = toAttackType(skill.skill_type ?? skill.atkType ?? skill.attack_type)
      if (!type) return
      const key = `${skill.category ?? 'awakening'}:${skill.skill_order ?? index}:${type}`
      if (!unique.has(key) || construe(skill) > (levels.get(key) ?? 0)) {
        unique.set(key, type)
        levels.set(key, construe(skill))
      }
    })
    for (const type of unique.values()) attack[type]++
  }
  return { attack, defense }
}

/** EGO costs are stored in SIN_ORDER order. */
export function computeEgoCostTotals(costs: (number[] | null | undefined)[]): Record<SinType, number> {
  const totals = Object.fromEntries(SIN_ORDER.map(sin => [sin, 0])) as Record<SinType, number>
  for (const cost of costs) SIN_ORDER.forEach((sin, index) => { totals[sin] += cost?.[index] ?? 0 })
  return totals
}
