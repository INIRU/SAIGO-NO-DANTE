import { describe, expect, it } from 'vitest'
import { isSubsequence, matchScore, matchesAllWords } from './match'

describe('search matching', () => {
  it('matches Korean, 초성, mixed jamo, spacing and case', () => {
    expect(matchScore(['LCB 수감자'], 'lcb수감')).toBe(2)
    expect(matchScore(['로쟈'], 'ㄹㅈ')).toBe(3)
    expect(matchScore(['검계 살수 료슈'], '살ㅅ')).toBe(1)
    expect(matchScore(['Yi Sang', '이상'], 'yi sang')).toBe(3)
    expect(matchScore(['ロージャ'], 'ロー')).toBe(2)
    expect(matchScore(['로쟈'], 'ㅎ')).toBe(0)
  })
  it('matches multi-word queries across names', () => {
    expect(matchesAllWords(['LCB 수감자', '이상'], '이상 LCB')).toBe(true)
    expect(matchesAllWords(['LCB 수감자', '이상'], '이상 검계')).toBe(false)
  })
  it('suggests by letters in order', () => {
    expect(isSubsequence('검계 살수 료슈', '검료')).toBe(true)
    expect(isSubsequence('검계 살수 료슈', '료검')).toBe(false)
  })
})
