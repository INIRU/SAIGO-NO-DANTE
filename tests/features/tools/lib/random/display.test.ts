import { describe, expect, it } from 'vitest'
import { REVEAL_CARD_MS, REVEAL_STEP_MS, isRareEgo, isRareIdentity, revealDuration, revealRanks, summarize } from '@/features/tools/lib/random/display'
import { generateRandom } from '@/features/tools/lib/random/engine'
import { rngFromSeed } from '@/features/tools/lib/random/seed'
import { BASE_OPTIONS, EGOS, IDENTITIES, SINNERS } from './fixture'

describe('reveal timing', () => {
  it('finishes a full twelve card reveal within 1.6 seconds', () => {
    expect(revealDuration(12)).toBe(11 * REVEAL_STEP_MS + REVEAL_CARD_MS)
    expect(revealDuration(12)).toBeLessThanOrEqual(1600)
    expect(revealDuration(1)).toBe(REVEAL_CARD_MS)
    expect(revealDuration(0)).toBe(REVEAL_CARD_MS)
  })

  it('reveals numbered cards first in number order, then the rest in board order', () => {
    const ids = ['s1', 's2', 's3', 's4', 's5']
    expect(revealRanks(ids, null)).toEqual({ s1: 0, s2: 1, s3: 2, s4: 3, s5: 4 })
    expect(revealRanks(ids, ['s4', 's1'])).toEqual({ s4: 0, s1: 1, s2: 2, s3: 3, s5: 4 })
  })
})

describe('golden cards and the summary line', () => {
  it('marks three star identities and ALEPH E.G.O as the golden ones', () => {
    expect(IDENTITIES.filter(isRareIdentity).every(identity => identity.rarity === 3)).toBe(true)
    expect(IDENTITIES.filter(isRareIdentity)).toHaveLength(IDENTITIES.filter(identity => identity.rarity === 3).length)
    expect(EGOS.filter(isRareEgo).every(ego => ego.grade === 'ALEPH')).toBe(true)
    expect(isRareIdentity(null)).toBe(false)
  })

  it('counts identities by 000, 00, 0 and E.G.O by grade', () => {
    const result = generateRandom(SINNERS, IDENTITIES, EGOS, BASE_OPTIONS, rngFromSeed('sum'))
    const summary = summarize(result)
    const identities = Object.values(result.identities)
    expect(summary.rarity[3] + summary.rarity[2] + summary.rarity[1]).toBe(12)
    expect(summary.rarity[3]).toBe(identities.filter(identity => identity?.rarity === 3).length)
    expect(summary.rarity[1]).toBe(identities.filter(identity => identity?.rarity === 1).length)
    const egos = Object.values(result.egos).flat()
    expect(summary.grades.ZAYIN).toBe(12)
    expect(Object.values(summary.grades).reduce((sum, count) => sum + count, 0)).toBe(egos.length)
    expect(summary.grades.ALEPH).toBe(egos.filter(ego => ego.grade === 'ALEPH').length)
  })

  it('counts zero for an empty result', () => {
    expect(summarize(null)).toEqual({ rarity: { 1: 0, 2: 0, 3: 0 }, grades: { ZAYIN: 0, TETH: 0, HE: 0, WAW: 0, ALEPH: 0 } })
    expect(summarize({ identities: {}, egos: {}, order: null }).rarity[3]).toBe(0)
  })
})
