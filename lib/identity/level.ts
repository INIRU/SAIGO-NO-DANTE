import type { Identity, Skill } from '@/lib/types'

export const MAX_IDENTITY_LEVEL = 65
// Stored sync stats are calculated at level 60; keep this baseline explicit.
export const IDENTITY_STAT_BASE_LEVEL = 60

export function identityAtLevel(identity: Identity, level: number): Identity {
  return {
    ...identity,
    hp: identity.base_hp != null && identity.hp_per_level != null
      ? Math.floor(identity.base_hp + identity.hp_per_level * level)
      : identity.hp,
    def_level: identity.def_level + level - IDENTITY_STAT_BASE_LEVEL,
  }
}

export function skillsAtLevel(skills: Skill[], level: number): Skill[] {
  return skills.map(skill => ({
    ...skill,
    offense_level: skill.offense_level == null ? skill.offense_level : skill.offense_level + level - IDENTITY_STAT_BASE_LEVEL,
  }))
}
