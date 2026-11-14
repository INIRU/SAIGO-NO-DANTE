import { describe, expect, it } from 'vitest'
import { generateRandom, normalizeDeployRange, rerollIdentity, type LockedSlot, type RandomOptions } from '@/features/tools/lib/random/engine'
import { rngFromSeed } from '@/features/tools/lib/random/seed'
import { BASE_OPTIONS, EGOS, IDENTITIES, SINNERS, sinnerIds } from './fixture'

const roll = (seed: string, options: Partial<RandomOptions> = {}) =>
  generateRandom(SINNERS, IDENTITIES, EGOS, { ...BASE_OPTIONS, ...options }, rngFromSeed(seed))
const picks = (result: ReturnType<typeof roll>) => JSON.stringify([
  sinnerIds().map(id => result.identities[id]?.id ?? null),
  sinnerIds().map(id => (result.egos[id] ?? []).map(ego => ego.id)),
  result.order,
])
const seeds = Array.from({ length: 300 }, (_, i) => `seed${i}`)
const lockOf = (result: ReturnType<typeof roll>, id: string): LockedSlot => ({
  identity: result.identities[id], egos: result.egos[id] ?? [], number: result.order ? result.order.indexOf(id) + 1 || null : null,
})

describe('seeded roll', () => {
  it('gives the same result for the same seed and options, and another one for another seed', () => {
    const options = { deploy: { min: 1, max: 12 } }
    expect(picks(roll('alpha', options))).toBe(picks(roll('alpha', options)))
    expect(picks(roll('alpha', options))).not.toBe(picks(roll('beta', options)))
  })

  it('draws one identity per sinner from its own pool and one E.G.O per grade it has, always with a ZAYIN', () => {
    const result = roll('pools')
    for (const sinner of SINNERS) {
      expect(result.identities[sinner.id]?.sinner_id).toBe(sinner.id)
      const egos = result.egos[sinner.id]
      expect(egos[0].grade).toBe('ZAYIN')
      expect(new Set(egos.map(ego => ego.grade)).size).toBe(egos.length)
      expect(egos.every(ego => ego.sinner_id === sinner.id)).toBe(true)
    }
    expect(result.order).toBeNull()
  })

  it('respects the identity, E.G.O and rarity switches', () => {
    const egoOnly = roll('flags', { identityEnabled: false })
    expect(Object.values(egoOnly.identities)).toEqual([])
    expect(egoOnly.order).toBeNull()
    expect(Object.keys(roll('flags', { egoEnabled: false }).egos)).toEqual([])
    const threeStar = roll('rarity', { rarityFilter: new Set([3]) })
    expect(Object.values(threeStar.identities).every(identity => identity?.rarity === 3)).toBe(true)
  })

  it('still rolls with Math.random when no source is given', () => {
    const result = generateRandom(SINNERS, IDENTITIES, EGOS, BASE_OPTIONS)
    expect(Object.values(result.identities).filter(Boolean)).toHaveLength(12)
  })

  it('rerolls a pool to another entry, repeatably', () => {
    const pool = IDENTITIES.filter(identity => identity.sinner_id === 's1')
    const picked = rerollIdentity(pool, pool[0], rngFromSeed('again'))
    expect(picked?.id).not.toBe(pool[0].id)
    expect(rerollIdentity(pool, pool[0], rngFromSeed('again'))?.id).toBe(picked?.id)
    expect(rerollIdentity([pool[0]], pool[0], rngFromSeed('again'))).toBeNull()
  })
})

describe('locked slots', () => {
  it('keeps a locked slot as it was and still draws the others from the seed', () => {
    const first = roll('first')
    const locks = { s3: lockOf(first, 's3'), s9: lockOf(first, 's9') }
    const second = roll('second', { locks })
    for (const id of ['s3', 's9']) {
      expect(second.identities[id]).toBe(first.identities[id])
      expect(second.egos[id]).toEqual(first.egos[id])
    }
    const others = sinnerIds().filter(id => !(id in locks))
    expect(others.some(id => second.identities[id]?.id !== first.identities[id]?.id)).toBe(true)
    // Same seed and locks again gives the same result.
    expect(picks(roll('second', { locks }))).toBe(picks(second))
  })

  it('locks only what exists: an empty locked identity is drawn, locked E.G.O stay', () => {
    const base = roll('egos', { identityEnabled: false })
    const locks = { s2: lockOf(base, 's2') }
    const next = roll('next', { locks })
    expect(next.identities.s2).not.toBeNull()
    expect(next.egos.s2).toEqual(base.egos.s2)
  })

  it('counts a locked identity toward the keyword condition', () => {
    const burn = IDENTITIES.find(identity => identity.sinner_id === 's1' && identity.keywords.includes('화상'))!
    const locks = { s1: { identity: burn, egos: [], number: null } }
    for (const seed of seeds.slice(0, 40)) {
      const result = roll(seed, { keywords: [{ keyword: '화상', minCount: 3 }], locks })
      const burning = sinnerIds().filter(id => result.identities[id]?.keywords.includes('화상'))
      expect(burning.length).toBeGreaterThanOrEqual(3)
      expect(result.identities.s1).toBe(burn)
    }
  })
})

describe('random deployment order', () => {
  const range = (min: number, max: number) => ({ deploy: { min, max } })

  it('numbers N sinners 1..N without gaps, N inside the range, the rest unnumbered', () => {
    for (const seed of seeds) {
      const { order } = roll(seed, range(1, 12))
      expect(order).not.toBeNull()
      expect(order!.length).toBeGreaterThanOrEqual(1)
      expect(order!.length).toBeLessThanOrEqual(12)
      expect(new Set(order).size).toBe(order!.length)
      expect(order!.every(id => sinnerIds().includes(id))).toBe(true)
    }
  })

  it('reaches both ends of the default 1 to 12 range and varies who goes first', () => {
    const counts = seeds.map(seed => roll(seed, range(1, 12)).order!.length)
    expect(counts).toContain(1)
    expect(counts).toContain(12)
    expect(new Set(seeds.map(seed => roll(seed, range(1, 12)).order![0])).size).toBeGreaterThan(5)
  })

  it('stays inside a narrower range, and a fixed range gives exactly that many', () => {
    for (const seed of seeds.slice(0, 100)) {
      const count = roll(seed, range(4, 7)).order!.length
      expect(count).toBeGreaterThanOrEqual(4)
      expect(count).toBeLessThanOrEqual(7)
      expect(roll(seed, range(3, 3)).order).toHaveLength(3)
    }
  })

  it('gives the same count and order for the same seed', () => {
    for (const seed of seeds.slice(0, 20)) expect(roll(seed, range(1, 12)).order).toEqual(roll(seed, range(1, 12)).order)
  })

  it('numbers no sinner without an identity, and skips the order when identities are off', () => {
    expect(roll('x', { ...range(1, 12), identityEnabled: false }).order).toBeNull()
  })

  it('clamps a bad range to 1..12 with min not above max', () => {
    expect(normalizeDeployRange({ min: 0, max: 99 })).toEqual({ min: 1, max: 12 })
    expect(normalizeDeployRange({ min: 9, max: 4 })).toEqual({ min: 9, max: 9 })
    expect(normalizeDeployRange({ min: 2.6, max: 5.2 })).toEqual({ min: 3, max: 5 })
    expect(normalizeDeployRange({ min: Number.NaN, max: Number.NaN })).toEqual({ min: 1, max: 12 })
  })

  it('keeps a locked slot at its number and a locked unnumbered slot out of the order', () => {
    for (const seed of seeds.slice(0, 120)) {
      const locks: Record<string, LockedSlot> = {
        s3: { identity: IDENTITIES.find(i => i.sinner_id === 's3')!, egos: [], number: 5 },
        s7: { identity: IDENTITIES.find(i => i.sinner_id === 's7')!, egos: [], number: 2 },
        s9: { identity: IDENTITIES.find(i => i.sinner_id === 's9')!, egos: [], number: null },
      }
      const { order } = roll(seed, { ...range(1, 12), locks })
      expect(order![4]).toBe('s3')
      expect(order![1]).toBe('s7')
      expect(order).not.toContain('s9')
      expect(order!.length).toBeGreaterThanOrEqual(5)
      expect(order!.length).toBeLessThanOrEqual(11)
      expect(new Set(order).size).toBe(order!.length)
    }
  })

  it('numbers locked slots even when the range cannot hold them, without gaps', () => {
    const locks: Record<string, LockedSlot> = { s3: { identity: IDENTITIES.find(i => i.sinner_id === 's3')!, egos: [], number: 6 } }
    for (const seed of seeds.slice(0, 40)) {
      const { order } = roll(seed, { ...range(1, 2), locks })
      expect(order![5]).toBe('s3')
      expect(order).toHaveLength(6)
    }
  })
})
