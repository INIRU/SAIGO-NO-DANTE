import type { Identity, Skill } from '@/lib/types'
import { IDENTITY_STAT_BASE_LEVEL, MAX_IDENTITY_LEVEL } from '@/lib/constants/game'

export { IDENTITY_STAT_BASE_LEVEL, MAX_IDENTITY_LEVEL }

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

/** A stored (level-60) offense level shown the way the game and wikis do: the level-65 value and its correction, e.g. 64 and "(-1)". */
export function offenseLevelDisplay(stored: number, level = MAX_IDENTITY_LEVEL) {
  const correction = stored - IDENTITY_STAT_BASE_LEVEL
  return { level: level + correction, correction: correction === 0 ? '' : correction > 0 ? `(+${correction})` : `(${correction})` }
}
