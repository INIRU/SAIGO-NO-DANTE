import { describe, expect, it } from 'vitest'
import { applyEvent, candidates, createPrescriptRun, endPrescriptRun, eventPrescript, eventRoomOptions, optionLeadingTo, feasible, missOffer, offer, resist, PRESCRIPT_REROLLS, prescriptPoints, receive, reroll, wanted, type PrescriptContext, type PrescriptRun } from '../../../lib/fun/prescript'

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

describe('shop prescripts', () => {
  it('are offered from the shelf as read: a gift on sale, and the leftmost one', () => {
    const cards = [0.05, 0.5, 0.95].flatMap(r => offer('shop', context({ shelf: [9004, 9006], random: () => r })))
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      if (card.goal.kind === 'buy-gift') expect([9004, 9006]).toContain(card.goal.giftId)
      if (card.goal.kind === 'buy-leftmost') expect(card.goal.giftId).toBe(9004)
    }
    expect(offer('shop', context({ shelf: [] }))).toEqual([])
  })

  it('a shop prescript wants a card once a floor, only while the shelf is seen', () => {
    expect(wanted(createPrescriptRun(), 2, true)).toContain('shop')
    expect(wanted(createPrescriptRun(), 2, false)).not.toContain('shop')
  })

  it('the acquisition of that gift carries it out; leaving the shop without it fails it', () => {
    let run = receive(createPrescriptRun(), { scope: 'shop', goal: { kind: 'buy-gift', giftId: 9004 }, strength: 3 }, 2, 0)
    run = applyEvent(run, { type: 'acquire', giftId: 9004, at: 1 }, context())
    expect(run.prescripts[0].status).toBe('done')
    run = receive(run, { scope: 'shop', goal: { kind: 'buy-leftmost', giftId: 9006 }, strength: 2 }, 3, 2)
    run = applyEvent(run, { type: 'leave-shop', at: 3 }, context())
    expect(run.prescripts[1].status).toBe('failed')
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

describe('no points from the past or from breaks', () => {
  it('evidence captured before the prescript was received does not carry it out', () => {
    const fuse = { scope: 'shop' as const, goal: { kind: 'fuse-gift' as const, giftId: 9005 }, strength: 2 as const }
    let run = receive(createPrescriptRun(), fuse, 2, 1000)
    run = applyEvent(run, { type: 'fusion', resultId: 9005, at: 900 }, context())
    expect(run.prescripts[0].status).toBe('active')
    expect(run.score).toBe(0)
    run = applyEvent(run, { type: 'fusion', resultId: 9005, at: 1100 }, context())
    expect(run.prescripts[0].status).toBe('done')
  })

  it('a standing prescript recalled by a break is drawn again only on the next floor', () => {
    const gather = { scope: 'standing' as const, goal: { kind: 'get-keyword' as const, keyword: 'Bleeding', count: 3 }, strength: 2 as const }
    let run = receive(createPrescriptRun(), gather, 2, 0)
    run = applyEvent(run, { type: 'gap', at: 10, reason: 'capture-stopped' }, context())
    expect(run.prescripts[0].status).toBe('void')
    expect(wanted(run, 2)).not.toContain('standing')
    expect(wanted(run, 3)).toContain('standing')
  })
})

describe('the end of the dungeon', () => {
  it('closes the record and recalls what is still in progress, keeping the grace earned', () => {
    const sell = { scope: 'special' as const, goal: { kind: 'sell-keyword' as const, keyword: 'Bleeding' }, strength: 2 as const }
    const gather = { scope: 'standing' as const, goal: { kind: 'get-keyword' as const, keyword: 'Bleeding', count: 3 }, strength: 2 as const }
    let run = receive(receive(createPrescriptRun(), sell, 2, 0), gather, 2, 0)
    run = applyEvent(run, { type: 'sale', giftId: 9003, at: 1 }, context())
    const ended = endPrescriptRun(run, 2)
    expect(ended.ended).toBe(true)
    expect(ended.score).toBe(run.score)
    expect(ended.prescripts.map(p => p.status)).toEqual(['done', 'void'])
  })
})

describe('burden and timing', () => {
  const tiers = { ...gifts, 9007: { keyword: 'Bleeding', tier: 5 }, 9991: { keyword: null, tier: 5 }, 9008: { keyword: 'Tremor', tier: 2 } }
  const ctx = (over: Partial<PrescriptContext> = {}) => context({ gift: id => tiers[id as keyof typeof tiers], ...over })

  it('selling a tier V gift is the heaviest order; a vestige is never asked for or counted', () => {
    const cards = candidates('special', ctx({ inventory: ['9007', '9991', '9001'] }))
    expect(cards.find(c => c.goal.kind === 'sell-tier' && c.goal.tier === 5)?.strength).toBe(5)
    expect(cards.filter(c => c.goal.kind === 'sell-tier' && c.goal.tier === 5)).toHaveLength(1) // from 9007, not the vestige
    const onlyVestige = candidates('special', ctx({ inventory: ['9991'], craftable: () => [] }))
    expect(onlyVestige.map(c => c.goal.kind)).toEqual(['no-sale'])
    expect(candidates('shop', ctx({ shelf: [9991, 9008] })).some(c => 'giftId' in c.goal && c.goal.giftId === 9991)).toBe(false)
  })

  it('a planned gift on the shelf is the lightest buy', () => {
    const cards = candidates('shop', ctx({ inventory: [], shelf: [9008, 9004], planGiftIds: new Set([9004]) }))
    expect(cards.find(c => c.goal.kind === 'buy-gift' && c.goal.giftId === 9004)?.strength).toBe(1)
  })

  it('refusals raise the weakest strength offered while something that strong is left', () => {
    let run = createPrescriptRun()
    run = resist(resist(run))
    expect(run.resisted).toBe(2)
    expect(offer('special', ctx(), 3, 1 + run.resisted!).every(c => c.strength >= 3)).toBe(true)
    expect(offer('special', ctx({ inventory: [], craftable: () => [] }), 3, 5).map(c => c.goal.kind)).toEqual(['no-sale']) // nothing that strong: the rest
  })

  it('a card is checked again when chosen: the shop left, the gift gone, the floor passed', () => {
    const buy = { scope: 'shop' as const, goal: { kind: 'buy-gift' as const, giftId: 9008 }, strength: 2 as const }
    expect(feasible(buy, ctx({ inventory: [], shelf: [9008] }), true)).toBe(true)
    expect(feasible(buy, ctx({ inventory: [], shelf: [9008] }), false)).toBe(false)
    expect(feasible(buy, ctx({ inventory: [], shelf: [] }), true)).toBe(false)
    const pick = { scope: 'standing' as const, goal: { kind: 'pick-theme' as const, floor: 3, themeId: '201' }, strength: 3 as const }
    expect(feasible(pick, ctx({ floor: 2 }), false)).toBe(true)
    expect(feasible(pick, ctx({ floor: 3 }), false)).toBe(false)
  })

  it('an offer let pass is a violation that breaks the streak, and carrying one out makes up for a refusal', () => {
    let run: PrescriptRun = { ...createPrescriptRun(), streak: 4, resisted: 2 }
    run = missOffer(run, 'shop', 3, 10)
    expect(run.streak).toBe(0)
    expect(run.prescripts.at(-1)).toMatchObject({ status: 'failed', reason: 'no-answer', points: 0 })
    const sell = { scope: 'special' as const, goal: { kind: 'sell-keyword' as const, keyword: 'Bleeding' }, strength: 2 as const }
    run = applyEvent(receive(run, sell, 3, 20), { type: 'sale', giftId: 9003, at: 30 }, ctx())
    expect(run.resisted).toBe(1)
  })
})

describe('the plan keywords', () => {
  it('giving up a main keyword weighs more, gathering it less', () => {
    const ctx = context({ planKeywords: ['Bleeding'] })
    const sell = candidates('special', ctx).find(c => c.goal.kind === 'sell-keyword' && c.goal.keyword === 'Bleeding')!
    const plain = candidates('special', context()).find(c => c.goal.kind === 'sell-keyword' && c.goal.keyword === 'Bleeding')!
    expect(sell.strength).toBe(plain.strength + 1)
    const gather = candidates('standing', ctx).find(c => c.goal.kind === 'get-keyword' && c.goal.keyword === 'Bleeding' && c.goal.count === 3)!
    expect(gather.strength).toBe(2)
  })
})

describe('the ? room prescript', () => {
  it('names one of the options anyone may take, and needs a choice to make', () => {
    expect(eventPrescript(900101, [0, 1, 2], () => 0.5)).toMatchObject({ scope: 'event', goal: { kind: 'event-choice', eventId: 900101, option: 1 } })
    expect(eventPrescript(900101, [0], () => 0.5)).toBeNull()
  })

  it('the result page judges it; leaving without one read recalls it', () => {
    const card = eventPrescript(900101, [0, 1], () => 0)!
    const run = receive(createPrescriptRun(), card, 3, 0)
    expect(applyEvent(run, { type: 'event-outcome', eventId: 900101, option: 0, at: 1 }, context()).prescripts[0].status).toBe('done')
    expect(applyEvent(run, { type: 'event-outcome', eventId: 900101, option: 1, at: 1 }, context()).prescripts[0].status).toBe('failed')
    expect(applyEvent(run, { type: 'event-outcome', eventId: 900102, option: 1, at: 1 }, context()).prescripts[0].status).toBe('active')
    expect(applyEvent(run, { type: 'leave-event', eventId: 900101, at: 1 }, context()).prescripts[0]).toMatchObject({ status: 'void', reason: 'event-unseen' })
  })

  it('two readings naming different options recall it rather than judge it', () => {
    const run = receive(createPrescriptRun(), eventPrescript(900101, [0, 1], () => 0)!, 3, 0)
    expect(applyEvent(run, { type: 'event-outcome', eventId: 900101, option: 0, at: 1, conflict: true }, context()).prescripts[0])
      .toMatchObject({ status: 'void', reason: 'evidence-conflict' })
  })

  it('offers the options a player picks, not the success and failure rows of a check stage (971037, 97103701)', () => {
    const entry = [
      { event_id: 971037, option_index: 0, outcome: null, selection_condition: null, next_event_id: 97103701 },
      { event_id: 971037, option_index: 1, outcome: null, selection_condition: null, next_event_id: null },
    ]
    expect(eventRoomOptions({ judgment: null }, entry)).toEqual([{ option: 0, next: [97103701] }, { option: 1, next: [] }])
    const check = [
      { event_id: 97103701, option_index: 0, outcome: 'success', selection_condition: null, next_event_id: null },
      { event_id: 97103701, option_index: 1, outcome: 'failure', selection_condition: null, next_event_id: null },
    ]
    expect(eventRoomOptions({ judgment: { judgement: {} } }, check)).toEqual([])
    expect(eventRoomOptions({ judgment: null }, check)).toEqual([])
    expect(eventRoomOptions({ judgment: null }, [{ ...entry[0], selection_condition: 'Sinner_3' }, entry[1]])).toEqual([{ option: 1, next: [] }])
    expect(eventRoomOptions(undefined, entry)).toEqual([])
    // the table writes no condition as 'None' (901001's three options)
    expect(eventRoomOptions({ judgment: null }, entry.map(choice => ({ ...choice, selection_condition: 'None' })))).toHaveLength(2)
    expect(eventRoomOptions({ judgment: null }, [{ ...entry[0], selection_condition: 'HasNotEnoughCost_100' }, entry[1]])).toEqual([{ option: 1, next: [] }])
  })

  it('a later stage names the option that led to it, if only one does', () => {
    const options = [{ option: 0, next: [97103701] }, { option: 1, next: [] }, { option: 2, next: [555, 97103702] }]
    expect(optionLeadingTo(options, 97103701)).toBe(0)
    expect(optionLeadingTo(options, 97103702)).toBe(2)
    expect(optionLeadingTo(options, 123)).toBeNull()
    expect(optionLeadingTo([{ option: 0, next: [7] }, { option: 1, next: [7] }], 7)).toBeNull()
  })
})

describe('formation prescripts', () => {
  const ids = ['10101', '10201', '10301', '10401', '10501', '10601', '10701', '10801', '10901', '11001', '11101', '11201']
  const keywordOf: Record<string, string[]> = { 10101: ['화상'], 10201: ['화상'], 10701: ['화상'], 10301: ['출혈'] }
  const identity = (id: string) => ({ sinner: `s${id.slice(1, 3)}`, keywords: keywordOf[id] ?? [] })

  it('asks for one more of a keyword in the front six, lighter when one waits behind', () => {
    const cards = candidates('special', context({ formation: ids, identity }))
    expect(cards.find(c => c.goal.kind === 'formation-keyword' && c.goal.keyword === '화상')).toMatchObject({ goal: { count: 3 }, strength: 2 })
    expect(cards.find(c => c.goal.kind === 'formation-keyword' && c.goal.keyword === '출혈')).toMatchObject({ goal: { count: 2 }, strength: 4 })
  })

  it('a swap is done when the bar shows another Identity in that Sinner place; a front is done when it counts enough', () => {
    const swap = { scope: 'shop' as const, goal: { kind: 'swap-identity' as const, sinner: 's02', fromId: '10201' }, strength: 3 as const }
    let run = receive(createPrescriptRun(), swap, 3, 0)
    run = applyEvent(run, { type: 'formation', ids, at: 1 }, context({ identity }))
    expect(run.prescripts[0].status).toBe('active')
    run = applyEvent(run, { type: 'formation', ids: ids.map(id => id === '10201' ? '10205' : id), at: 2 }, context({ identity }))
    expect(run.prescripts[0].status).toBe('done')
    const front = { scope: 'special' as const, goal: { kind: 'formation-keyword' as const, keyword: '화상', count: 3 }, strength: 2 as const }
    const moved = ['10101', '10201', '10701', '10301', '10401', '10501', '10601', '10801', '10901', '11001', '11101', '11201']
    expect(applyEvent(receive(createPrescriptRun(), front, 3, 0), { type: 'formation', ids: moved, at: 1 }, context({ identity })).prescripts[0].status).toBe('done')
  })
})

describe('the terminal grade', () => {
  it('a Proxy run starts with one reroll and earns half again the grace', () => {
    expect(createPrescriptRun('proxy').rerollsLeft).toBe(1)
    expect(createPrescriptRun().rerollsLeft).toBe(3)
    expect(prescriptPoints(3, 'special', 1, 'proxy')).toBe(Math.round(prescriptPoints(3, 'special', 1) * 1.5))
    const sell = { scope: 'special' as const, goal: { kind: 'sell-keyword' as const, keyword: 'Bleeding' }, strength: 2 as const }
    const run = applyEvent(receive(createPrescriptRun('proxy'), sell, 2, 0), { type: 'sale', giftId: 9003, at: 1 }, context())
    expect(run.score).toBe(prescriptPoints(2, 'special', 1, 'proxy'))
  })
})
