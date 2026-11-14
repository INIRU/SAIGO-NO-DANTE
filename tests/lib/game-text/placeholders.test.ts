import { describe, expect, it } from 'vitest'
import { hasRawPlaceholder, placeholdersToPlainText, splitPlaceholders } from '@/lib/game-text/placeholders'

describe('placeholder tokens', () => {
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
