import { describe, expect, it } from 'vitest'
import { activationChance } from '@/features/community/lib/passive-fit'

const wrath = { wrath: 6 }
const half = { wrath: 3, pride: 3 }
const req = (sin: 'wrath' | 'pride' | 'envy', count: number) => ({ sin, count })

describe('activationChance', () => {
  it('REQ-DECKS-046 is the chance a stock condition holds by the fifth turn: certain when one wrath-only sinner needs 3, none when nobody makes the sin', () => {
    expect(activationChance('stock', [req('wrath', 3)], [wrath])).toBeCloseTo(1)
    expect(activationChance('stock', [req('envy', 1)], [wrath])).toBe(0)
    expect(activationChance('stock', [], [wrath])).toBe(0)
    expect(activationChance('stock', [req('wrath', 1)], [])).toBe(0)
  })

  it('REQ-DECKS-046 falls as the required count grows and rises with a bigger team that makes the sin', () => {
    const chances = [1, 2, 3, 4, 5, 6].map(count => activationChance('stock', [req('wrath', count)], [half, half]))
    chances.slice(1).forEach((chance, i) => expect(chance).toBeLessThanOrEqual(chances[i] + 1e-12))
    expect(activationChance('stock', [req('wrath', 4)], [half, half, half, half])).toBeGreaterThan(activationChance('stock', [req('wrath', 4)], [half]))
  })

  it('REQ-DECKS-046 averages a resonance condition over the first six turns and needs every required sin at once', () => {
    const one = activationChance('resonance', [req('wrath', 2)], [half, half, half])
    const both = activationChance('resonance', [req('wrath', 2), req('pride', 2)], [half, half, half])
    expect(one).toBeGreaterThan(0)
    expect(one).toBeLessThan(1)
    expect(both).toBeLessThan(one)
    expect(activationChance('resonance', [req('wrath', 2)], [{ wrath: 6 }, { wrath: 6 }])).toBeGreaterThan(one)
  })
})
