import { describe, expect, it } from 'vitest'
import { KEYWORD_DEFAULT_COLOR, resolveKeywordTextColor } from '@/lib/keywords/text-color'

describe('keyword text colour', () => {
  it('colours negative and positive keywords from the catalog effect type or the fallback lists', () => {
    expect(resolveKeywordTextColor('화상')).toBe('#ff4f42')
    expect(resolveKeywordTextColor('호흡')).toBe('#f8c200')
    expect(resolveKeywordTextColor('x', { desc: '', effectType: 'negative' })).toBe('#ff4f42')
    expect(resolveKeywordTextColor('x', { desc: '', effectType: 'positive' })).toBe('#f8c200')
  })

  it('does not colour the names the game types as neutral or negative as positive', () => {
    for (const name of ['도발치', '정신력 회복 효율', '빼기 코인 강화']) expect(resolveKeywordTextColor(name)).toBe(KEYWORD_DEFAULT_COLOR)
  })

  it('colours warning brackets red, bladetrail names negative and unknown names with the default', () => {
    expect(resolveKeywordTextColor('[합 불가능]')).toBe('#ff0000')
    expect(resolveKeywordTextColor('검흔[잔상]')).toBe('#ff4f42')
    expect(resolveKeywordTextColor('계산값')).toBe(KEYWORD_DEFAULT_COLOR)
  })
})
