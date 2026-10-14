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

const isDefenseType = (value: string): value is DefenseType => (DEFENSE_TYPES as readonly string[]).includes(value)
const pickHigherUptie = <T extends AnalysisSkill>(a: T | undefined, b: T) => (!a || (b.uptie_level ?? 0) > (a.uptie_level ?? 0) ? b : a)

/** One skill per slot: the base variant (a 1-1 is the same skill transformed), at its highest uptie. */
function baseSkills(skills: AnalysisSkill[]): Map<number, AnalysisSkill> {
  const best = new Map<number, AnalysisSkill>()
  for (const skill of skills) {
    const current = best.get(skill.skill_order)
    const variant = skill.variant_order ?? 0
    const currentVariant = current?.variant_order ?? 0
    if (!current || variant < currentVariant) best.set(skill.skill_order, skill)
    else if (variant === currentVariant) best.set(skill.skill_order, pickHigherUptie(current, skill))
  }
  return best
}

/** The attack types of an EGO's skills: each skill (awakening or corrosion) once, whatever its threadspin rows. */
function egoAttackTypes(skills: AnalysisEgoSkill[] | null | undefined): AttackType[] {
  const construe = (skill: AnalysisEgoSkill) => skill.construe_level ?? skill.construeLevel ?? 0
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
  return [...unique.values()]
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
      const sin = normalizeSin(skill.sin_affinity)
      if (sin && order >= 1 && order <= 3) counts[sin] += weights[order - 1] ?? 0
    }
  }
  return counts
}

/** One placed identity with its sinner's EGOs, as the deck and plan screens analyse it. */
export type DeckAnalysisEntry = {
  skills: AnalysisSkill[]
  distribution?: SkillDistributionTuple | null
  /** The sinner's chosen EGOs: their skills (awakening and corrosion) and costs (SIN_ORDER order). */
  egos?: { skills?: AnalysisEgoSkill[] | null; cost?: number[] | null }[]
  /** In a SELECTED slot. */
  deployed?: boolean
}

export type AttackProfile = {
  /** S1–S3 of each identity, each skill once. */
  skills: Record<AttackType, number>
  /** Defensive skills, one per identity skill. */
  defense: Record<DefenseType, number>
  /** EGO skills, each once. */
  ego: Record<AttackType, number>
}

/**
 * Attack types of the identities' own attack skills: S1, S2 and S3 (base variant) once each, so an identity adds three
 * at most whatever its skill distribution. Defensive skills and EGO skills are counted apart, to be listed beside them.
 */
export function computeAttackProfile(entries: DeckAnalysisEntry[]): AttackProfile {
  const profile: AttackProfile = { skills: { slash: 0, pierce: 0, blunt: 0 }, defense: { evade: 0, defense: 0, counter: 0 }, ego: { slash: 0, pierce: 0, blunt: 0 } }
  for (const { skills, egos } of entries) {
    for (const [order, skill] of baseSkills(skills)) {
      if (isDefenseType(skill.skill_type)) profile.defense[skill.skill_type]++
      else if (order >= 1 && order <= 3) {
        const type = toAttackType(skill.atk_type ?? skill.skill_type)
        if (type) profile.skills[type]++
      }
    }
    for (const ego of egos ?? []) for (const type of egoAttackTypes(ego.skills)) profile.ego[type]++
  }
  return profile
}

/** The identities a fight fields: the deployed ones, or every placed one while nobody is deployed yet (a deck being built). */
export function fieldedEntries<T extends { deployed?: boolean }>(entries: T[]): T[] {
  const deployed = entries.filter(entry => entry.deployed)
  return deployed.length ? deployed : entries
}

export type DeckResources = {
  /** How many identities were counted, and whether they are the deployed ones (false: every placed one). */
  identities: number
  deployedOnly: boolean
  attack: AttackProfile
  production: Record<SinType, number>
  egoCost: Record<SinType, number>
}

/**
 * Attack types and sin production of the fielded identities' own skills, with their sinners' EGOs beside them (skill types
 * and costs, never added into the counts): a benched identity uses no skill and its sinner no EGO.
 */
export function computeDeckResources(entries: DeckAnalysisEntry[]): DeckResources {
  const fielded = fieldedEntries(entries)
  return {
    identities: fielded.length,
    deployedOnly: fielded.length < entries.length || entries.every(entry => entry.deployed),
    attack: computeAttackProfile(fielded),
    production: computeSinProduction(fielded),
    egoCost: computeEgoCostTotals(fielded.flatMap(entry => (entry.egos ?? []).map(ego => ego.cost))),
  }
}

/**
 * Every skill once: attack types over each identity skill with an attack type (variants and counters included) plus EGO
 * skills, defense types over defensive skills. The assist run's panel and the developer API report this count.
 */
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
      if (isDefenseType(skill.skill_type)) defense[skill.skill_type]++
      const type = toAttackType(skill.atk_type ?? skill.skill_type)
      if (type) attack[type]++
    }
  }
  for (const skills of egoSkills) for (const type of egoAttackTypes(skills)) attack[type]++
  return { attack, defense }
}

/** EGO costs are stored in SIN_ORDER order. */
export function computeEgoCostTotals(costs: (number[] | null | undefined)[]): Record<SinType, number> {
  const totals = Object.fromEntries(SIN_ORDER.map(sin => [sin, 0])) as Record<SinType, number>
  for (const cost of costs) SIN_ORDER.forEach((sin, index) => { totals[sin] += cost?.[index] ?? 0 })
  return totals
}
