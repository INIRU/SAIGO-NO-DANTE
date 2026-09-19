import { expect, it } from 'vitest'
import type { Identity, Skill } from '@/lib/types'
import { identityAtLevel, skillsAtLevel } from '@/lib/identity/level'

it('recalculates HP and combat levels from the stored level-60 baseline', () => {
  const identity = { hp: 248, base_hp: 100, hp_per_level: 2.46, def_level: 62 } as Identity
  expect(identityAtLevel(identity, 60)).toMatchObject({ hp: 247, def_level: 62 })
  expect(identityAtLevel(identity, 65)).toMatchObject({ hp: 259, def_level: 67 })
  expect(identityAtLevel(identity, 1)).toMatchObject({ hp: 102, def_level: 3 })
  const skills = [{ offense_level: 62 }, { offense_level: null }] as Skill[]
  expect(skillsAtLevel(skills, 65).map(s => s.offense_level)).toEqual([67, null])
  expect(skills[0].offense_level).toBe(62)
})
