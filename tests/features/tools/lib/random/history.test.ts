import { describe, expect, it } from 'vitest'
import { RECENT_LIMIT, clearRecent, parseRecent, pushRecent, readRecent, recentFromRoll, writeRecent, type RecentRoll } from '@/features/tools/lib/random/history'
import { newRoll } from '@/features/tools/lib/random/roll'
import { EGOS, IDENTITIES, SINNERS } from './fixture'

const entry = (seed: string, at = 1): RecentRoll => ({ seed, q: `s=${seed}`, at, ids: Array(12).fill('10101'), nums: Array(12).fill(0) })
const memoryStorage = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
  }
}
const brokenStorage = () => ({
  getItem: () => { throw new Error('blocked') },
  setItem: () => { throw new Error('blocked') },
  removeItem: () => { throw new Error('blocked') },
})

describe('recent rolls', () => {
  it('keeps the newest first and at most ten', () => {
    let list: RecentRoll[] = []
    for (let i = 0; i < 14; i++) list = pushRecent(list, entry(`seed${i}`, i))
    expect(list).toHaveLength(RECENT_LIMIT)
    expect(list.map(item => item.seed)).toEqual(['seed13', 'seed12', 'seed11', 'seed10', 'seed9', 'seed8', 'seed7', 'seed6', 'seed5', 'seed4'])
    expect(RECENT_LIMIT).toBe(10)
  })

  it('replaces an entry with the same seed and moves it to the front', () => {
    const list = pushRecent(pushRecent(pushRecent([], entry('a')), entry('b')), entry('c'))
    const next = pushRecent(list, { ...entry('a', 99), q: 's=a&rr=s1.1' })
    expect(next.map(item => item.seed)).toEqual(['a', 'c', 'b'])
    expect(next[0].q).toBe('s=a&rr=s1.1')
    expect(list.map(item => item.seed)).toEqual(['c', 'b', 'a'])
  })

  it('stores and reads back through storage, and clears', () => {
    const storage = memoryStorage()
    expect(readRecent(storage)).toEqual([])
    const list = pushRecent([], entry('stored', 5))
    expect(writeRecent(list, storage)).toBe(true)
    expect(readRecent(storage)).toEqual(list)
    clearRecent(storage)
    expect(readRecent(storage)).toEqual([])
  })

  it('treats broken stored values as an empty list', () => {
    for (const raw of ['not json', '{}', '[1,2]', '[{"seed":1}]', 'null', '"x"']) expect(parseRecent(raw)).toEqual([])
    const good = entry('keep')
    expect(parseRecent(JSON.stringify([good, { seed: 'BAD SEED', q: 'x' }, good]))).toEqual([good])
    expect(parseRecent(JSON.stringify(Array.from({ length: 30 }, (_, i) => entry(`n${i}`))))).toHaveLength(RECENT_LIMIT)
  })

  it('keeps working when the browser refuses storage', () => {
    const storage = brokenStorage()
    expect(readRecent(storage)).toEqual([])
    expect(writeRecent([entry('x')], storage)).toBe(false)
    expect(() => clearRecent(storage)).not.toThrow()
  })

  it('summarises a roll as its link query plus twelve portraits and their numbers', () => {
    const { snapshot, result } = newRoll({ sinners: SINNERS, identities: IDENTITIES, egos: EGOS }, {
      seed: 'thumb', settings: { identityEnabled: true, egoEnabled: true, keywords: [], rarity: null, deploy: { min: 3, max: 3 } }, marks: [], collectionCode: null, previous: null,
    }, null)
    const recent = recentFromRoll(snapshot, result, SINNERS, 1234)
    expect(recent.seed).toBe('thumb')
    expect(recent.at).toBe(1234)
    expect(recent.q.startsWith('s=thumb')).toBe(true)
    expect(recent.ids).toEqual(SINNERS.map(sinner => result.identities[sinner.id]!.game_id))
    expect(recent.nums.filter(Boolean).sort()).toEqual([1, 2, 3])
    expect(recent.nums[SINNERS.findIndex(sinner => sinner.id === result.order![0])]).toBe(1)
  })
})
