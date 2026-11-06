import { describe, expect, it } from 'vitest'
import { FAUST_SEEN_KEY, markFaceSeen, readSeenFaces } from '@/features/community/lib/faust-faces'

function memory(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[FAUST_SEEN_KEY, initial]])
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) } }
}

describe('faust faces', () => {
  it('remembers each face once and ignores junk', () => {
    const storage = memory('[1, 1, 99, "x"]')
    expect(readSeenFaces(storage)).toEqual([1])
    markFaceSeen(storage, 3)
    markFaceSeen(storage, 3)
    expect(readSeenFaces(storage)).toEqual([1, 3])
    expect(readSeenFaces(memory('not json'))).toEqual([])
  })
})
