import type { Skill } from '@/lib/types'
import { IDENTITY_STAT_BASE_LEVEL, MAX_IDENTITY_LEVEL } from '@/lib/constants/game'

export { IDENTITY_STAT_BASE_LEVEL, MAX_IDENTITY_LEVEL }

type LevelStats = { hp?: number | null; base_hp?: number | null; hp_per_level?: number | null; def_level?: number | null }

export function identityAtLevel<T extends LevelStats>(identity: T, level: number): T {
  return {
    ...identity,
    hp: identity.base_hp != null && identity.hp_per_level != null
      // The game rounds level × per-level half up (32-bit floats) and adds it to the base.
      ? identity.base_hp + Math.round(Math.fround(level * Math.fround(identity.hp_per_level)))
      : identity.hp,
    def_level: identity.def_level == null ? identity.def_level : identity.def_level + level - IDENTITY_STAT_BASE_LEVEL,
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
