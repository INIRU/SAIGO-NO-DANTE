import { describe, expect, it } from 'vitest'
import { resolveEgoStages } from './ego-stages'
import { egoSkillsAtStage, egoStages } from '../../lib/ego/stages'
import type { EGOSkill } from '../../lib/types'

describe('source EGO stages', () => {
  it('inherits sparse stage patches through V, including stage II', () => {
    const stages = resolveEgoStages([
      { gaksungLevel: 1, defaultValue: 18, mpUsage: 20, coinList: [{ operatorType: 'ADD', scale: 8 }] },
      { gaksungLevel: 4, defaultValue: 22 }, { gaksungLevel: 5, mpUsage: 25 },
    ])
    expect(stages.map(stage => stage.gaksungLevel)).toEqual([1, 2, 3, 4, 5])
    expect(stages[1].defaultValue).toBe(18)
    expect(stages[4]).toMatchObject({ defaultValue: 22, mpUsage: 25, coinList: [{ operatorType: 'ADD', scale: 8 }] })
  })
  it('does not invent V for a IV-only EGO and rejects missing base stats', () => {
    expect(resolveEgoStages([{ gaksungLevel: 1 }, { gaksungLevel: 4 }])).toHaveLength(4)
    expect(() => resolveEgoStages([{ gaksungLevel: 4 }])).toThrow('stage 1')
  })
  it('uses source IDs when a skill changes name and never falls forward to a locked stage', () => {
    const skills = [{ gameSkillId: 123, name: 'Before', construeLevel: 3 }, { gameSkillId: 123, name: 'After', construeLevel: 5 }] as EGOSkill[]
    expect(egoStages(skills)).toEqual([3, 5])
    expect(egoSkillsAtStage(skills, 4).map(skill => skill.name)).toEqual(['Before'])
    expect(egoSkillsAtStage(skills, 1)).toEqual([])
  })
})
