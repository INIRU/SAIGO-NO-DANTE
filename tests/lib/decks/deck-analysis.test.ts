import { describe, expect, it } from 'vitest'
import { computeAttackProfile, computeAttackTypeCounts, computeDeckResources, computeEgoCostTotals, computeSinProduction } from '@/lib/decks/deck-analysis'

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

  it('counts each of S1–S3 once per identity, with defensive and EGO skills apart', () => {
    const egoSkills = [{ skill_type: 'slash', skill_order: 1 }, { skill_type: 'slash', skill_order: 1, construe_level: 2 }, { skill_type: 'blunt', category: 'corrosion', skill_order: 1 }]
    // One slash, one pierce, one blunt. The S3 variant and the counter variant of the evade are the same skills transformed.
    expect(computeAttackProfile([{ skills, egos: [{ skills: egoSkills }] }])).toEqual({
      skills: { slash: 1, pierce: 1, blunt: 1 },
      defense: { evade: 1, defense: 0, counter: 0 },
      ego: { slash: 1, pierce: 0, blunt: 1 },
    })
    // The skill distribution weights the sins produced, not the attack types: seven identities are 21 skills at most.
    expect(computeAttackProfile([{ skills }, { skills, distribution: [0, 2, 4] }]).skills).toEqual({ slash: 2, pierce: 2, blunt: 2 })
  })

  it('counts the deployed identities only, and every placed one while nobody is deployed', () => {
    const bench = { skills, deployed: false, egos: [{ cost: [1] }, { skills: [{ skill_type: 'pierce' }] }] }
    expect(computeDeckResources([{ skills, deployed: true, egos: [{ cost: [1, 0, 0, 0, 0, 0, 2], skills: [{ skill_type: 'blunt' }] }] }, bench])).toMatchObject({
      identities: 1, deployedOnly: true,
      // An EGO adds nothing to the attack types or to what is produced: its type and cost stand beside them.
      attack: { skills: { slash: 1, pierce: 1, blunt: 1 }, ego: { slash: 0, pierce: 0, blunt: 1 } },
      production: { wrath: 3, lust: 2, gloom: 1, envy: 0 },
      egoCost: { wrath: 1, envy: 2 },
    })
    // A deck being built has no formation yet.
    expect(computeDeckResources([{ skills }, bench])).toMatchObject({
      identities: 2, deployedOnly: false,
      attack: { skills: { slash: 2, pierce: 2, blunt: 2 }, ego: { pierce: 1 } },
      production: { wrath: 6, lust: 4, gloom: 2 },
      egoCost: { wrath: 1 },
    })
    expect(computeDeckResources([{ skills, deployed: true }])).toMatchObject({ identities: 1, deployedOnly: true })
  })

  it('sums EGO costs in sin order', () => {
    expect(computeEgoCostTotals([[1, 0, 0, 0, 0, 0, 2], null, [1]])).toMatchObject({ wrath: 2, envy: 2 })
  })
})
