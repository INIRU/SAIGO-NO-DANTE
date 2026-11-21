import { describe, expect, it } from 'vitest'
import { giftIdsIn, hasRawPlaceholder, placeholdersToPlainText, splitPlaceholders } from '@/lib/game-text/placeholders'

describe('placeholder tokens', () => {
  it('lists the gifts some texts point at, each once', () => {
    expect(giftIdsIn('변경됨\n{{gift:9295}}', null, '{{gift:9295}} {{gift:9228}} {{live}}')).toEqual([9295, 9228])
    expect(giftIdsIn(undefined, 'gift:1 {gift:2}')).toEqual([])
  })
  it('splits text into runs and tokens, ignoring braces that are not tokens', () => {
    expect(splitPlaceholders('a{{live}}b{{nope}}{{count}}{{gift:9228}}')).toEqual(['a', { token: 'live' }, 'b{{nope}}', { token: 'count' }, { token: 'gift', giftId: 9228 }])
  })
  it('finds bare slots but not tokens', () => {
    expect(hasRawPlaceholder('현재 {0}%')).toBe(true)
    expect(hasRawPlaceholder('{amount} 획득')).toBe(true)
    expect(hasRawPlaceholder('현재 {{live}}% {{gift:9228}}')).toBe(false)
    expect(hasRawPlaceholder(null)).toBe(false)
  })
  it('writes tokens as labels for plain text', () => {
    expect(placeholdersToPlainText('피해량 +{{potency}}%', 'ko')).toBe('피해량 +(수치)%')
    expect(placeholdersToPlainText('(Current: {{live}}%)', 'en')).toBe('(Current: (Shown in game)%)')
    expect(placeholdersToPlainText(null, 'ja')).toBeNull()
  })
})
