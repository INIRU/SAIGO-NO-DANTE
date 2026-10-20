import { describe, expect, it } from 'vitest'
import { ratePassiveActivation, rateIdentityPassive, ACTIVATION_ORDER } from '@/lib/decks/passive-activation'

const wrath = { wrath: 6 }
const half = { wrath: 3, pride: 3 }
const req = (sin: 'wrath' | 'pride' | 'envy', count: number) => ({ sin, count })

describe('REQ-DECKS-025 stock: turns until the team holds enough, resources never spent', () => {
  it('REQ-DECKS-025 one wrath-only sinner gains 1, 2, 3... wrath a turn (slots grow by one a turn)', () => {
    // After t turns the team holds t(t+1)/2 wrath: 3 at turn 2, 6 at turn 3, 15 at turn 5.
    expect(ratePassiveActivation('stock', [req('wrath', 1)], [wrath])).toMatchObject({ level: 'easy', turns: 1 })
    expect(ratePassiveActivation('stock', [req('wrath', 3)], [wrath])).toMatchObject({ level: 'easy', turns: 2 })
    expect(ratePassiveActivation('stock', [req('wrath', 6)], [wrath])).toMatchObject({ level: 'medium', turns: 3 })
    expect(ratePassiveActivation('stock', [req('wrath', 10)], [wrath])).toMatchObject({ level: 'medium', turns: 4 })
    expect(ratePassiveActivation('stock', [req('wrath', 15)], [wrath])).toMatchObject({ level: 'hard', turns: 5 })
  })

  it('REQ-DECKS-025 reaches the count at half probability exactly: 3 wrath + 3 pride cards, one slot, wants 1 wrath', () => {
    expect(ratePassiveActivation('stock', [req('wrath', 1)], [half])).toMatchObject({ level: 'easy', turns: 1 })
  })

  it('REQ-DECKS-025 is impossible when nobody fielded makes the sin, and hard when it takes more than 10 turns', () => {
    expect(ratePassiveActivation('stock', [req('envy', 1)], [wrath])).toMatchObject({ level: 'impossible', turns: null })
    // Only the one sinner makes pride among twelve: far too few cards for 7 pride.
    const team = [{ pride: 1, wrath: 5 }, ...Array.from({ length: 11 }, () => wrath)]
    expect(ratePassiveActivation('stock', [req('pride', 7)], team)).toMatchObject({ level: 'hard', turns: null })
  })

  it('REQ-DECKS-025 a bigger team collects faster, a larger count never gets easier', () => {
    const order = ['easy', 'medium', 'hard', 'impossible']
    let previous = 0
    for (let count = 1; count <= 7; count++) {
      const rating = ratePassiveActivation('stock', [req('wrath', count)], [half, half, half, half])!
      expect(order.indexOf(rating.level)).toBeGreaterThanOrEqual(previous)
      previous = order.indexOf(rating.level)
    }
    const alone = ratePassiveActivation('stock', [req('wrath', 4)], [half])!
    const together = ratePassiveActivation('stock', [req('wrath', 4)], [half, half, half, half, half, half])!
    expect(together.turns!).toBeLessThan(alone.turns!)
  })

  it('REQ-DECKS-025 several sins must all be held at once', () => {
    // Two sinners, a wrath one and a pride one: both fill a slot every turn, so 1 wrath + 1 pride is held after one turn.
    expect(ratePassiveActivation('stock', [req('wrath', 1), req('pride', 1)], [wrath, { pride: 6 }])).toMatchObject({ level: 'easy', turns: 1 })
    // The same team can never hold envy.
    expect(ratePassiveActivation('stock', [req('wrath', 1), req('envy', 1)], [wrath, { pride: 6 }])!.level).toBe('impossible')
    // Needing both from one mixed sinner takes longer than needing one.
    const one = ratePassiveActivation('stock', [req('wrath', 2)], [half])!
    const both = ratePassiveActivation('stock', [req('wrath', 2), req('pride', 2)], [half])!
    expect(both.turns!).toBeGreaterThanOrEqual(one.turns!)
  })
})

describe('REQ-DECKS-025 resonance: chance in a turn to line up enough skills of one sin', () => {
  it('REQ-DECKS-025 averages the exact chance over the first six turns', () => {
    // One sinner with 3 wrath + 3 pride cards: slots 1..6 over six turns, P(>=2 wrath) = 0, .25, .5, 11/16, 13/16, 57/64.
    const rating = ratePassiveActivation('resonance', [req('wrath', 2)], [half])!
    expect(rating.chance).toBeCloseTo(3.140625 / 6, 10)
    expect(rating.level).toBe('medium')
  })

  it('REQ-DECKS-025 grades by chance: easy from 60%, medium from 25%, below that hard', () => {
    // Wrath-only: slots 1..6, so 3 wrath lines up from turn 3 on (4 of 6 turns), 5 from turn 5 (2 of 6), 7 never in six turns.
    expect(ratePassiveActivation('resonance', [req('wrath', 3)], [wrath])).toMatchObject({ level: 'easy', turns: null })
    expect(ratePassiveActivation('resonance', [req('wrath', 3)], [wrath])!.chance).toBeCloseTo(4 / 6, 10)
    expect(ratePassiveActivation('resonance', [req('wrath', 5)], [wrath])).toMatchObject({ level: 'medium' })
    expect(ratePassiveActivation('resonance', [req('wrath', 7)], [wrath])).toMatchObject({ level: 'hard', chance: 0 })
  })

  it('REQ-DECKS-025 is impossible only when no fielded skill has the sin', () => {
    expect(ratePassiveActivation('resonance', [req('envy', 2)], [wrath, half])).toMatchObject({ level: 'impossible', chance: 0 })
  })

  it('REQ-DECKS-025 twelve sinners fill all twelve slots every turn', () => {
    const team = Array.from({ length: 12 }, () => wrath)
    expect(ratePassiveActivation('resonance', [req('wrath', 5)], team)).toMatchObject({ level: 'easy', chance: 1 })
  })

  it('REQ-DECKS-025 needing two sins at once is rarer than either alone', () => {
    const team = [half, half, half]
    const wrathOnly = ratePassiveActivation('resonance', [req('wrath', 2)], team)!.chance
    const prideOnly = ratePassiveActivation('resonance', [req('pride', 2)], team)!.chance
    const both = ratePassiveActivation('resonance', [req('wrath', 2), req('pride', 2)], team)!.chance
    expect(both).toBeLessThan(Math.min(wrathOnly, prideOnly))
    expect(both).toBeGreaterThan(0)
  })
})

describe('REQ-DECKS-025 whose passives are rated', () => {
  const stock = { passive_type: 'battle', active_cond: 'stock' }
  it('REQ-DECKS-025 rates a battle passive of a fielded identity and a support passive of a benched one, by the fielded team', () => {
    expect(rateIdentityPassive(stock, [req('wrath', 1)], true, [wrath])?.level).toBe('easy')
    expect(rateIdentityPassive({ ...stock, passive_type: 'support' }, [req('wrath', 1)], false, [wrath])?.level).toBe('easy')
    expect(rateIdentityPassive({ ...stock, passive_type: 'support' }, [req('envy', 1)], false, [wrath])?.level).toBe('impossible')
  })

  it('REQ-DECKS-025 does not rate the other role, or a passive without a stock or resonance condition', () => {
    expect(rateIdentityPassive(stock, [req('wrath', 1)], false, [wrath])).toBeNull()
    expect(rateIdentityPassive({ ...stock, passive_type: 'support' }, [req('wrath', 1)], true, [wrath])).toBeNull()
    expect(rateIdentityPassive({ passive_type: 'battle', active_cond: null }, [req('wrath', 1)], true, [wrath])).toBeNull()
  })
})

describe('REQ-DECKS-025 what can be rated', () => {
  it('REQ-DECKS-025 gives nothing without a fielded team or a condition', () => {
    expect(ratePassiveActivation('stock', [req('wrath', 1)], [])).toBeNull()
    expect(ratePassiveActivation('resonance', [], [wrath])).toBeNull()
  })

  it('REQ-DECKS-025 orders hard and impossible first for listing', () => {
    expect(ACTIVATION_ORDER.impossible).toBeLessThan(ACTIVATION_ORDER.hard)
    expect(ACTIVATION_ORDER.hard).toBeLessThan(ACTIVATION_ORDER.medium)
    expect(ACTIVATION_ORDER.medium).toBeLessThan(ACTIVATION_ORDER.easy)
  })
})
