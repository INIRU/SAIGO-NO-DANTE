import { describe, expect, it } from 'vitest'
import { committedQuery, splitMatch } from '@/lib/utils/global-search'

describe('global search helpers', () => {
  it('splitMatch splits label around the first case-insensitive match', () => {
    expect(splitMatch('LCB 이상', 'lcb')).toEqual(['', 'LCB', ' 이상'])
    expect(splitMatch('로쟈 N사', '쟈')).toEqual(['로', '쟈', ' N사'])
  })
  it('splitMatch returns null when nothing matches or query is empty', () => {
    expect(splitMatch('이상', 'ㅇㅅ')).toBeNull()
    expect(splitMatch('이상', '')).toBeNull()
  })
  it('committedQuery keeps the previous query while an IME is composing', () => {
    expect(committedQuery('이', '이ㅅ', true)).toBe('이')
    expect(committedQuery('이', '이상', false)).toBe('이상')
  })
})
