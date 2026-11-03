import { describe, expect, it } from 'vitest'
import { applyEvent, createPrescriptRun, offer, PRESCRIPT_REROLLS, prescriptPoints, receive, reroll, type PrescriptContext } from '../../../lib/fun/prescript'

const gifts: Record<number, { keyword: string | null; tier: number | null }> = {
  9001: { keyword: 'Combustion', tier: 1 }, 9002: { keyword: 'Combustion', tier: 2 }, 9003: { keyword: 'Bleeding', tier: 1 },
  9004: { keyword: 'Bleeding', tier: 3 }, 9005: { keyword: 'Combustion', tier: 4 }, 9006: { keyword: 'Tremor', tier: 4 },
}
const context = (over: Partial<PrescriptContext> = {}): PrescriptContext => ({
  floor: 2,
  inventory: ['9001', '9002', '9003'],
  planGiftIds: new Set<number>(),
  gift: id => gifts[id],
  craftable: () => [9005],
  themesOn: floor => floor === 4 ? ['101', '102'] : ['201'],
  random: () => 0.5,
  ...over,
})

describe('offer', () => {
  it('offers only prescripts the run can carry out now, at most three of different strengths', () => {
    const cards = offer('special', context())
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.length).toBeLessThanOrEqual(3)
    expect(new Set(cards.map(card => card.strength)).size).toBe(cards.length)
    for (const card of cards) {
      if (card.goal.kind === 'sell-keyword') expect(['Combustion', 'Bleeding']).toContain(card.goal.keyword)
      if (card.goal.kind === 'fuse-gift') expect(card.goal.giftId).toBe(9005)
    }
  })

  it('never asks to sell a gift the plan needs', () => {
    const ctx = context({ inventory: ['9001'], planGiftIds: new Set([9001]), craftable: () => [] })
    const sells = [0.05, 0.3, 0.6, 0.9].flatMap(r => offer('special', { ...ctx, random: () => r }))
      .filter(card => card.goal.kind === 'sell-keyword' || card.goal.kind === 'sell-tier')
    expect(sells).toEqual([])
  })

  it('a standing pack prescript names a later floor and a pack that floor can offer', () => {
    const cards = [0.05, 0.3, 0.6, 0.9].flatMap(r => offer('standing', context({ random: () => r })))
    const picks = cards.filter(card => card.goal.kind === 'pick-theme')
    expect(picks.length).toBeGreaterThan(0)
    for (const card of picks) if (card.goal.kind === 'pick-theme') {
      expect(card.goal.floor).toBeGreaterThan(2)
      if (card.goal.floor === 4) expect(['101', '102']).toContain(card.goal.themeId)
    }
  })
})

describe('judging from the screen', () => {
  const sellCard = { scope: 'special' as const, goal: { kind: 'sell-keyword' as const, keyword: 'Bleeding' }, strength: 2 as const }

  it('a sale of a gift with the keyword carries out a sell prescript; another keyword does not', () => {
    let run = receive(createPrescriptRun(), sellCard, 2, 0)
    run = applyEvent(run, { type: 'sale', giftId: 9001, at: 1 }, context())
    expect(run.prescripts[0].status).toBe('active')
    run = applyEvent(run, { type: 'sale', giftId: 9003, at: 2 }, context())
    expect(run.prescripts[0].status).toBe('done')
    expect(run.score).toBe(prescriptPoints(2, 'special', 1))
  })

  it('the next floor fails an unfinished special prescript and carries out a ban that was kept', () => {
    let run = receive(createPrescriptRun(), sellCard, 2, 0)
    run = receive(run, { scope: 'special', goal: { kind: 'no-sale' }, strength: 2 }, 2, 0)
    run = applyEvent(run, { type: 'floor', floor: 3, themeIds: ['301'], at: 5 }, context())
    expect(run.prescripts.map(p => p.status)).toEqual(['failed', 'done'])
  })

  it('a sale breaks a no-sale prescript at once', () => {
    let run = receive(createPrescriptRun(), { scope: 'special', goal: { kind: 'no-sale' }, strength: 2 }, 2, 0)
    run = applyEvent(run, { type: 'sale', giftId: 9001, at: 1 }, context())
    expect(run.prescripts[0].status).toBe('failed')
  })

  it('a fusion result, a pack on its floor and gifts gathered by keyword are read from their evidence', () => {
    let run = receive(createPrescriptRun(), { scope: 'special', goal: { kind: 'fuse-gift', giftId: 9005 }, strength: 3 }, 2, 0)
    run = receive(run, { scope: 'standing', goal: { kind: 'pick-theme', floor: 4, themeId: '102' }, strength: 3 }, 2, 0)
    run = receive(run, { scope: 'standing', goal: { kind: 'get-keyword', keyword: 'Tremor', count: 1 }, strength: 2 }, 2, 0)
    run = applyEvent(run, { type: 'fusion', resultId: 9005, at: 1 }, context())
    run = applyEvent(run, { type: 'acquire', giftId: 9006, at: 2 }, context())
    run = applyEvent(run, { type: 'floor', floor: 3, themeIds: ['301'], at: 3 }, context())
    expect(run.prescripts.map(p => p.status)).toEqual(['done', 'active', 'done'])
    run = applyEvent(run, { type: 'floor', floor: 4, themeIds: ['101'], at: 4 }, context())
    expect(run.prescripts[1].status).toBe('failed')
  })

  it('a break in the capture voids what was in progress: neither failed nor scored, with the reason kept', () => {
    let run = receive(createPrescriptRun(), sellCard, 2, 0)
    run = applyEvent(run, { type: 'gap', at: 1, reason: 'capture-stopped' }, context())
    expect(run.prescripts[0]).toMatchObject({ status: 'void', reason: 'capture-stopped' })
    expect(run.score).toBe(0)
    run = applyEvent(run, { type: 'sale', giftId: 9003, at: 2 }, context())
    expect(run.prescripts[0].status).toBe('void')
  })
})

describe('rerolls and points', () => {
  it('allows three rerolls a run', () => {
    let run = createPrescriptRun()
    for (let i = 0; i < PRESCRIPT_REROLLS; i++) run = reroll(run)!
    expect(run.rerollsLeft).toBe(0)
    expect(reroll(run)).toBeNull()
  })

  it('strength points, special x1.5 and the streak bonus', () => {
    expect([1, 2, 3, 4, 5].map(s => prescriptPoints(s as 1, 'standing', 1))).toEqual([5, 10, 20, 35, 60])
    expect(prescriptPoints(2, 'special', 1)).toBe(15)
    expect(prescriptPoints(2, 'standing', 3)).toBe(11)
    expect(prescriptPoints(2, 'standing', 5)).toBe(12)
    expect(prescriptPoints(2, 'standing', 10)).toBe(15)
  })
})
