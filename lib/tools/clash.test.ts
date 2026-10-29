import { describe, expect, it } from 'vitest'
import { applyCoin, coinsOf, compare, damageLink, headsChance, rollDistribution, solveClash, type ClashCoin, type ClashSide } from './clash'

const add = (scale: number): ClashCoin => ({ scale, operator: 'ADD' })
const side = (basePower: number, coins: ClashCoin[], rest: Partial<ClashSide> = {}): ClashSide => ({ basePower, coins, sanity: 0, ...rest })
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

describe('heads chance', () => {
  it('REQ-TOOLS-030 is 50% plus 1% per point of sanity and adder, held to 5%–95% and to ±45 sanity', () => {
    expect(headsChance(0)).toBe(0.5)
    expect(headsChance(20, 5)).toBeCloseTo(0.75)
    expect(headsChance(-45)).toBeCloseTo(0.05)
    expect(headsChance(45, 30)).toBe(0.95)
    expect(headsChance(100)).toBeCloseTo(0.95)
    expect(headsChance(-45, -30)).toBe(0.05)
  })
})

describe('coins', () => {
  it('adds, subtracts and multiplies, never going below 0', () => {
    expect(applyCoin(4, add(3))).toBe(7)
    expect(applyCoin(2, { operator: 'SUB', scale: 5 })).toBe(0)
    expect(applyCoin(4, { operator: 'MUL', scale: 1.5 })).toBe(6)
  })
  it('rolls the coins in order: a subtracting coin stops at 0 before the next one adds', () => {
    expect(rollDistribution(1, [{ operator: 'SUB', scale: 3 }, add(4)], 0.5)).toEqual([[0, 0.25], [1, 0.25], [4, 0.25], [5, 0.25]])
  })
  it('falls back to the coin count times the one coin power when a skill has no coin list', () => {
    expect(coinsOf({ coins: 2, coin_power: 3 })).toEqual([add(3), add(3)])
    expect(coinsOf({ coins: 2, coin_power: 3, coin_list: [{ scale: 5, operator: 'MUL' }, { scale: 2, operator: 'SUB' }] })).toEqual([{ scale: 5, operator: 'MUL' }, { scale: 2, operator: 'SUB' }])
  })
})

describe('comparing rolls', () => {
  it('REQ-TOOLS-031 splits the chance into win, tie and loss', () => {
    const a = rollDistribution(4, [add(4)], 0.5), b = rollDistribution(4, [add(4)], 0.5)
    expect(compare(a, b)).toEqual({ win: 0.25, tie: 0.5, lose: 0.25 })
  })
})

describe('solveClash', () => {
  it('REQ-TOOLS-032 ends a one-coin clash by geometric ties: an even win chance and two exchanges on average', () => {
    const result = solveClash(side(4, [add(4)]), side(4, [add(4)]))
    expect(result.winA).toBeCloseTo(0.5, 10)
    expect(result.winB).toBeCloseTo(0.5, 10)
    expect(result.meanRounds).toBeCloseTo(2, 6)
    expect(result.rounds[1]).toBeCloseTo(0.5, 12)
    expect(result.rounds[2]).toBeCloseTo(0.25, 12)
  })
  it('keeps every chance accounted for', () => {
    const result = solveClash(side(3, [add(3), add(4), add(2)], { sanity: 12 }), side(5, [add(5), add(2)], { sanity: -8, clashAdder: 1 }))
    expect(result.winA + result.winB + result.unresolved).toBeCloseTo(1, 12)
    expect(sum(result.rounds)).toBeCloseTo(result.winA + result.winB, 12)
    expect(sum(result.leftA)).toBeCloseTo(1, 12)
    expect(sum(result.leftB)).toBeCloseTo(1, 12)
  })
  it('counts the winner\'s coins left and the exchanges when every exchange is certain', () => {
    const result = solveClash(side(10, [add(0), add(0)]), side(5, [add(0), add(0), add(0)]))
    expect(result.winA).toBe(1)
    expect(result.rounds[3]).toBe(1)
    expect(result.leftA[2]).toBe(1)
    expect(result.leftB[0]).toBe(1)
    expect(result.meanRounds).toBe(3)
  })
  it('breaks the front coin of the loser: its later coins are the ones still rolled', () => {
    // A's strong coin is first: once it is lost A has only the 0 coin and can never win again.
    const result = solveClash(side(0, [add(100), add(0)]), side(50, [add(0)]))
    expect(result.winA).toBeCloseTo(0.5, 12)
    expect(result.winB).toBeCloseTo(0.5, 12)
    expect(result.rounds[1]).toBeCloseTo(0.5, 12)
    expect(result.rounds[2]).toBeCloseTo(0.5, 12)
  })
  it('stops at 99 exchanges when ties never end the clash', () => {
    const result = solveClash(side(5, [add(0)]), side(5, [add(0)]))
    expect(result.unresolved).toBe(1)
    expect(result.meanRounds).toBe(0)
  })
  it('lets the adders move the odds: power, coin power, the heads chance and the clash total', () => {
    const base = solveClash(side(4, [add(4)]), side(4, [add(4)])).winA
    expect(solveClash(side(4, [add(4)], { powerAdder: 2 }), side(4, [add(4)])).winA).toBeGreaterThan(base)
    expect(solveClash(side(4, [add(4)], { coinPowerAdder: 2 }), side(4, [add(4)])).winA).toBeGreaterThan(base)
    expect(solveClash(side(4, [add(4)], { probabilityAdder: 10 }), side(4, [add(4)])).winA).toBeGreaterThan(base)
    expect(solveClash(side(4, [add(4)], { clashAdder: 1 }), side(4, [add(4)])).winA).toBeGreaterThan(base)
  })
  it('has no clash when a side has no coins', () => {
    const result = solveClash(side(4, []), side(4, [add(4)]))
    expect(result.rounds[0]).toBe(1)
  })
})

describe('link to the damage calculator', () => {
  it('hands over a whole number of exchanges, held to 0–99', () => {
    expect(damageLink('ko', 2.6)).toBe('/ko/tools/damage?clash=3')
    expect(damageLink('en', 500)).toBe('/en/tools/damage?clash=99')
  })
})
