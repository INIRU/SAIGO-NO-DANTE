import { expect, it } from 'vitest'
import type { Identity, Skill } from '@/lib/types'
import { identityAtLevel, offenseLevelDisplay, skillsAtLevel } from '@/features/catalog/lib/identity-level'

it('recalculates HP and combat levels from the stored level-60 baseline', () => {
  const identity = { hp: 248, base_hp: 100, hp_per_level: 2.46, def_level: 62 } as Identity
  // HP is the base plus level × per-level rounded half up (game values): 100 + round(147.6) at 60, the stored 248.
  expect(identityAtLevel(identity, 60)).toMatchObject({ hp: 248, def_level: 62 })
  expect(identityAtLevel(identity, 65)).toMatchObject({ hp: 260, def_level: 67 })
  expect(identityAtLevel({ base_hp: 66, hp_per_level: 3.41, def_level: 60 } as Identity, 65)).toMatchObject({ hp: 288 })
  expect(identityAtLevel(identity, 1)).toMatchObject({ hp: 102, def_level: 3 })
  const skills = [{ offense_level: 62 }, { offense_level: null }] as Skill[]
  expect(skillsAtLevel(skills, 65).map(s => s.offense_level)).toEqual([67, null])
  expect(skills[0].offense_level).toBe(62)
})

it('offenseLevelDisplay shows a stored level-60 value at the level cap with its correction', () => {
  // Sunshower (20105) stores 59/63; wikis show 64(-1)/68(+3) at level 65.
  expect(offenseLevelDisplay(59)).toEqual({ level: 64, correction: '(-1)' })
  expect(offenseLevelDisplay(63)).toEqual({ level: 68, correction: '(+3)' })
  expect(offenseLevelDisplay(60)).toEqual({ level: 65, correction: '' })
})
