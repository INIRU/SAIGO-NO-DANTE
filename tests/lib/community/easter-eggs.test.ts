import { describe, expect, it } from 'vitest'
import { EGGS_KEY, readEggs, recordEgg } from '@/lib/community/easter-eggs'

function memory(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[EGGS_KEY, initial]])
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) } }
}

describe('easter eggs', () => {
  it('records an egg once and ignores unknown ids', () => {
    const storage = memory('["konami", "made-up"]')
    expect(readEggs(storage)).toEqual(['konami'])
    expect(recordEgg(storage, 'clock-head')).toBe(true)
    expect(recordEgg(storage, 'clock-head')).toBe(false)
    expect(readEggs(storage)).toEqual(['clock-head', 'konami'])
    expect(readEggs(memory('{'))).toEqual([])
  })
})
