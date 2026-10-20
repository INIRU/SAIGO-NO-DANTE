import { describe, expect, it } from 'vitest'
import { rising } from '@/lib/discovery/rising'

const row = (entity_id: string, recent: number, base: number) => ({ entity_id, recent, base })

describe('rising', () => {
  it('REQ-COMMUNITY-068 ranks by the daily average of the last 3 days against the previous 14, smoothed', () => {
    // 6 visitors in 3 days = 2 a day; 14 in 14 days = 1 a day: (2 + 0.5) / (1 + 0.5) = 1.67 → +67%.
    const [first] = rising([row('a', 6, 14)])
    expect(first).toEqual({ id: 'a', recent: 6, rise: 67 })
  })

  it('REQ-COMMUNITY-068 puts the bigger rise first, then more recent visitors, then id', () => {
    const ids = rising([row('b', 6, 14), row('a', 6, 14), row('c', 9, 14), row('d', 30, 14), row('e', 6, 0)]).map(item => item.id)
    expect(ids).toEqual(['d', 'e', 'c', 'a', 'b'])
  })

  it('REQ-COMMUNITY-068 leaves out what did not rise and softens a jump from almost nothing', () => {
    expect(rising([row('flat', 6, 28), row('down', 5, 70)])).toEqual([])
    // Five visitors against none would be an infinite jump; smoothing caps it at (1.67 + 0.5) / 0.5 → +333%.
    expect(rising([row('new', 5, 0)])[0].rise).toBe(333)
  })

  it('REQ-COMMUNITY-068 keeps at most the limit and shows no more than 999', () => {
    expect(rising(Array.from({ length: 10 }, (_, i) => row(`x${i}`, 6 + i, 0)), 4)).toHaveLength(4)
    expect(rising([row('huge', 400, 0)])[0].rise).toBe(999)
  })
})
