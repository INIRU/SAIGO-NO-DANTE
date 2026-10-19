/** A function that returns a number in [0, 1), like Math.random. */
export type Rng = () => number

const SEED_PATTERN = /^[0-9a-z]{1,12}$/

/** mulberry32: a 32-bit seeded generator, small and good enough for picking cards. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a over the string, as a 32-bit number. */
function hashString(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** The stream of a seed. Extra parts (e.g. 'reroll', sinner id, count) give a separate stream of the same seed. */
export function rngFromSeed(seed: string, ...parts: (string | number)[]): Rng {
  return mulberry32(hashString([seed, ...parts].join('|')))
}

/** A fresh short seed (base 36 of a 32-bit number). */
export function createSeed(source: Rng = Math.random): string {
  return Math.floor(source() * 4294967296).toString(36)
}

/** Seeds are short lowercase base-36 strings; anything else from a link is refused. */
export function isSeed(value: unknown): value is string {
  return typeof value === 'string' && SEED_PATTERN.test(value)
}
