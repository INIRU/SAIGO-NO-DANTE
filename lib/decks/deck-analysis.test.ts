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

  it('counts S1–S3 attack types and the defense skill once per identity, whatever the uptie rows and second forms', () => {
    // A second form (variant 1) and a counter of that form are left out, as in the sin resources.
    expect(computeAttackTypeCounts([skills])).toEqual({
      attack: { slash: 1, pierce: 1, blunt: 1 },
      defense: { evade: 1, defense: 0, counter: 0 },
    })
    // Real rows of one identity at upties 1–4 (2026-09-28): S3 exists from uptie 3, each skill counts once.
    const upties = [1, 2, 3, 4].flatMap(uptie => [
      { sin_affinity: 'wrath', skill_type: 'slash', skill_order: 1, variant_order: 1, uptie_level: uptie },
      { sin_affinity: 'lust', skill_type: 'pierce', skill_order: 2, variant_order: 2, uptie_level: uptie },
      ...(uptie >= 3 ? [{ sin_affinity: 'gloom', skill_type: 'slash', skill_order: 3, variant_order: 3, uptie_level: uptie }] : []),
      { sin_affinity: 'pride', skill_type: 'evade', skill_order: 4, variant_order: 4, uptie_level: uptie },
    ])
    expect(computeAttackTypeCounts([upties, upties])).toEqual({ attack: { slash: 4, pierce: 2, blunt: 0 }, defense: { evade: 2, defense: 0, counter: 0 } })
  })

  it('sums EGO costs in sin order', () => {
    expect(computeEgoCostTotals([[1, 0, 0, 0, 0, 0, 2], null, [1]])).toMatchObject({ wrath: 2, envy: 2 })
  })
})
