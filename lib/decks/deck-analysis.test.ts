import { describe, expect, it } from 'vitest'
import { computeAttackTypeCounts, computeEgoCostTotals, computeSinProduction } from './deck-analysis'

describe('deck analysis', () => {
  const skills = [
    { sin_affinity: 'wrath', skill_type: 'slash', skill_order: 1, uptie_level: 3 },
    { sin_affinity: '색욕', skill_type: 'pierce', skill_order: 2, uptie_level: 3 },
    { sin_affinity: 'gloom', skill_type: 'blunt', skill_order: 3, uptie_level: 3 },
    { sin_affinity: 'pride', skill_type: 'blunt', skill_order: 3, uptie_level: 4, variant_order: 1 },
    { sin_affinity: 'pride', skill_type: 'evade', skill_order: 4, uptie_level: 3 },
    { sin_affinity: 'pride', skill_type: 'counter', atk_type: 'pierce', skill_order: 4, variant_order: 1, uptie_level: 3 },
  ]

  it('weights S1–S3 sins by the skill distribution and normalizes Korean sins', () => {
    expect(computeSinProduction([{ skills }])).toMatchObject({ wrath: 3, lust: 2, gloom: 1, pride: 0 })
    expect(computeSinProduction([{ skills, distribution: [0, 2, 4] }])).toMatchObject({ wrath: 0, lust: 2, gloom: 4 })
  })

  it('counts attack variants, defense and deduplicated EGO skills', () => {
    const egoSkills = [[{ skill_type: 'slash', skill_order: 1 }, { skill_type: 'slash', skill_order: 1, construe_level: 2 }]]
    expect(computeAttackTypeCounts([skills], egoSkills)).toEqual({
      attack: { slash: 2, pierce: 2, blunt: 2 },
      defense: { evade: 1, defense: 0, counter: 1 },
    })
  })

  it('sums EGO costs in sin order', () => {
    expect(computeEgoCostTotals([[1, 0, 0, 0, 0, 0, 2], null, [1]])).toMatchObject({ wrath: 2, envy: 2 })
  })
})
