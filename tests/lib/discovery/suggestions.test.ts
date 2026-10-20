import { describe, expect, it } from 'vitest'
import type { Formation } from '@/lib/discovery/co-occurrence'
import { floorChoices, similarPlans, suggestIdentities, type PlanChoice } from '@/lib/discovery/suggestions'

const f = (id: string, identities: string[]): Formation => ({ kind: 'deck', id, identities, votes: 0, views: 0 })

describe('suggestIdentities', () => {
  // Context X is fielded in 5 formations. P (popular, everywhere) and R (rare, only beside X) are candidates.
  const formations = [
    ...Array.from({ length: 5 }, (_, i) => f(`x${i}`, ['X', 'R', 'P'])),
    ...Array.from({ length: 15 }, (_, i) => f(`p${i}`, ['P'])),
  ]

  it('REQ-DECKS-022 ranks candidates beside the fielded identities, tight pairs over popular ones', () => {
    expect(suggestIdentities(formations, ['X'], new Set(['R', 'P'])).map(row => row.id)).toEqual(['R'])
  })

  it('REQ-DECKS-022 sums the scores of every fielded identity and never suggests a fielded one', () => {
    const more = [...formations, ...Array.from({ length: 4 }, (_, i) => f(`y${i}`, ['Y', 'S'])), ...Array.from({ length: 4 }, (_, i) => f(`z${i}`, ['X', 'Y', 'S']))]
    const rows = suggestIdentities(more, ['X', 'Y'], new Set(['R', 'S', 'X']))
    expect(rows.map(row => row.id)).toContain('S')
    expect(rows.map(row => row.id)).not.toContain('X')
  })

  it('REQ-DECKS-022 offers nothing without a fielded identity or enough shared formations', () => {
    expect(suggestIdentities(formations, [], new Set(['R']))).toEqual([])
    expect(suggestIdentities(formations, ['X'], new Set(['nobody']))).toEqual([])
  })
})

const plan = (identities: string[], keywords: string[], floors: PlanChoice['floors']): PlanChoice => ({ identities, keywords, floors })

describe('floor choices', () => {
  const plans = [
    plan(['A', 'B'], ['화상'], { 1: { theme: 't1', gifts: ['g1', 'g2'] } }),
    plan(['A', 'B', 'C'], ['진동'], { 1: { theme: 't1', gifts: ['g1'] } }),
    plan(['A', 'C'], ['출혈'], { 1: { theme: 't2', gifts: ['g3'] } }),
    plan(['Q'], ['화상'], { 1: { theme: 't1', gifts: ['g1'] }, 2: { theme: 't9', gifts: [] } }),
    plan(['Z'], ['충전'], { 1: { theme: 't2', gifts: ['g3'] } }),
    plan(['Z'], ['충전'], { 1: { theme: 't2', gifts: ['g3'] } }),
  ]

  it('REQ-PLANNER-029 counts a plan as similar with two shared identities or one shared main keyword', () => {
    // Plan 0 shares both and the keyword, plan 1 two identities, plan 3 only the keyword.
    expect(similarPlans(plans, { identities: ['A', 'B'], keywords: ['화상'] })).toEqual([plans[0], plans[1], plans[3]])
  })

  it('REQ-PLANNER-029 falls back to every plan when fewer than three are similar', () => {
    expect(similarPlans(plans, { identities: ['A', 'B'], keywords: [] })).toHaveLength(plans.length)
    expect(similarPlans(plans, { identities: ['nobody'], keywords: [] })).toHaveLength(plans.length)
  })

  it('REQ-PLANNER-030 counts the packs and gifts those plans took on the floor, most first, twice at least', () => {
    const rows = floorChoices(plans, { identities: ['A', 'B'], keywords: ['화상'] }, 1)
    // similar = plans 0, 1, 3: t1 three times, g1 three times; g2 once is below the minimum.
    expect(rows.themes).toEqual([{ id: 't1', count: 3 }])
    expect(rows.gifts).toEqual([{ id: 'g1', count: 3 }])
    expect(floorChoices(plans, { identities: ['A', 'B'], keywords: ['화상'] }, 2)).toEqual({ themes: [], gifts: [] })
  })
})
