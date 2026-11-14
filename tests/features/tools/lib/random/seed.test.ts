import { describe, expect, it } from 'vitest'
import { createSeed, isSeed, mulberry32, rngFromSeed } from '@/features/tools/lib/random/seed'

const take = (rng: () => number, count: number) => Array.from({ length: count }, () => rng())

describe('seeded random numbers', () => {
  it('gives the same sequence for the same seed and a different one otherwise', () => {
    expect(take(rngFromSeed('abc123'), 8)).toEqual(take(rngFromSeed('abc123'), 8))
    expect(take(rngFromSeed('abc123'), 8)).not.toEqual(take(rngFromSeed('abc124'), 8))
    expect(take(mulberry32(7), 4)).toEqual(take(mulberry32(7), 4))
  })

  it('stays in [0, 1) and spreads over the range', () => {
    const values = take(rngFromSeed('spread'), 2000)
    expect(values.every(value => value >= 0 && value < 1)).toBe(true)
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    expect(mean).toBeGreaterThan(0.45)
    expect(mean).toBeLessThan(0.55)
  })

  it('separates streams by the extra parts so a reroll does not repeat the roll', () => {
    expect(take(rngFromSeed('abc', 'reroll', 's1', 1), 4)).not.toEqual(take(rngFromSeed('abc'), 4))
    expect(take(rngFromSeed('abc', 'reroll', 's1', 1), 4)).not.toEqual(take(rngFromSeed('abc', 'reroll', 's1', 2), 4))
    expect(take(rngFromSeed('abc', 'reroll', 's1', 1), 4)).toEqual(take(rngFromSeed('abc', 'reroll', 's1', 1), 4))
  })

  it('makes short valid seeds from the given source and accepts only that shape', () => {
    const seed = createSeed(() => 0.5)
    expect(isSeed(seed)).toBe(true)
    expect(seed.length).toBeLessThanOrEqual(7)
    expect(createSeed(() => 0.1)).not.toBe(createSeed(() => 0.9))
    for (const bad of ['', 'UPPER', 'has space', 'a'.repeat(13), '한글', 'a-b']) expect(isSeed(bad)).toBe(false)
    expect(isSeed('k3j2h1')).toBe(true)
  })
})
