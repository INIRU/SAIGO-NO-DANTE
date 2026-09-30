import { describe, expect, it } from 'vitest'
import { placeholdersToPlainText, splitPlaceholders, tokenizeGamePlaceholders } from './placeholders'

describe('placeholder tokens', () => {
  it('turns numbered game slots into tokens and reports the ones without a role', () => {
    const unknown: number[] = []
    expect(tokenizeGamePlaceholders('(현재 {0}%) {1} {0:F1} {amount}', index => (index === 0 ? 'live' : undefined), index => unknown.push(index)))
      .toBe('(현재 {{live}}%) {{value}} {{live}} {amount}')
    expect(unknown).toEqual([1])
  })
  it('splits text into runs and tokens, ignoring braces that are not tokens', () => {
    expect(splitPlaceholders('a{{live}}b{{nope}}{{count}}')).toEqual(['a', { token: 'live' }, 'b{{nope}}', { token: 'count' }])
  })
  it('writes tokens as labels for plain text', () => {
    expect(placeholdersToPlainText('피해량 +{{potency}}%', 'ko')).toBe('피해량 +(수치)%')
    expect(placeholdersToPlainText('(Current: {{live}}%)', 'en')).toBe('(Current: (in game)%)')
    expect(placeholdersToPlainText(null, 'ja')).toBeNull()
  })
})
