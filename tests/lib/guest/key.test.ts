import { describe, expect, it } from 'vitest'
import { isGuestKey } from '@/lib/guest/key'

describe('guest key', () => {
  it('accepts only the site format', () => {
    expect(isGuestKey('snd_' + 'a'.repeat(43))).toBe(true)
    expect(isGuestKey('snd_' + 'a'.repeat(42))).toBe(false)
    expect(isGuestKey('x' + 'a'.repeat(46))).toBe(false)
    expect(isGuestKey('snd_' + 'a'.repeat(42) + '!')).toBe(false)
  })
})
