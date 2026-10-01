import { describe, expect, it } from 'vitest'
import { egoSkillSlots, resolveEgoStages } from './ego-stages'
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

describe('REQ-CATALOG-018 EGO skills of additionalList', () => {
  it('REQ-CATALOG-018 adds the further awakening skill of additionalList after the main awakening and corrosion', () => {
    // 20211 구멍 (2026-10-01): additionalList repeats the main corrosion 2021121.
    expect(egoSkillSlots({
      awakeningSkillId: 2021111, corrosionSkillId: 2021121,
      additionalList: [{ level: 1, additionalList: [{ awakeningSkillId: 2021112, corrosionSkillId: 2021121, requirementList: [] }] }],
    })).toEqual([
      { category: 'awakening', skillId: 2021111, skillOrder: 1 },
      { category: 'corrosion', skillId: 2021121, skillOrder: 2 },
      { category: 'awakening', skillId: 2021112, skillOrder: 3 },
    ])
  })

  it('REQ-CATALOG-018 keeps an EGO without additionalList or corrosion as before', () => {
    expect(egoSkillSlots({ awakeningSkillId: 2010111, corrosionSkillId: 2010121 })).toEqual([
      { category: 'awakening', skillId: 2010111, skillOrder: 1 },
      { category: 'corrosion', skillId: 2010121, skillOrder: 2 },
    ])
    expect(egoSkillSlots({ awakeningSkillId: 2010111, corrosionSkillId: null })).toEqual([{ category: 'awakening', skillId: 2010111, skillOrder: 1 }])
  })
})
