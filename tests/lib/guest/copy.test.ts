import { describe, expect, it } from 'vitest'
import { getGuestCopy, guestAuthorName, guestPinProblem, guestRecoverMessage } from '@/lib/guest/copy'

describe('guest copy', () => {
  it('labels guest authors by tag in each locale', () => {
    expect(guestAuthorName('1a2b', 'ko')).toBe('익명 #1a2b')
    expect(guestAuthorName('1a2b', 'en')).toBe('Anonymous #1a2b')
    expect(guestAuthorName('1a2b', 'ja')).toBe('匿名 #1a2b')
    expect(guestAuthorName(null, 'ko')).toBeNull()
  })

  it('falls back to Korean and keeps every locale complete', () => {
    expect(getGuestCopy('fr')).toBe(getGuestCopy('ko'))
    const keys = Object.keys(getGuestCopy('ko')).sort()
    expect(Object.keys(getGuestCopy('en')).sort()).toEqual(keys)
    expect(Object.keys(getGuestCopy('ja')).sort()).toEqual(keys)
    expect(getGuestCopy('en').claimed(1, 2)).toBe('Moved 1 deck and 2 plans.')
  })

  it('REQ-COMMUNITY-031 says why a new post cannot go up with this password', () => {
    for (const locale of ['ko', 'en', 'ja']) {
      const copy = getGuestCopy(locale)
      expect(['', '48', '1234', '0000', '4821'].map(pin => guestPinProblem(pin, locale))).toEqual([copy.pinRequired, copy.pinRequired, copy.pinWeak, copy.pinWeak, null])
      expect(copy.pinWeak).not.toBe(copy.pinRequired)
    }
  })

  it('REQ-COMMUNITY-031 names each result of a password recovery in every locale', () => {
    for (const locale of ['ko', 'en', 'ja']) {
      const copy = getGuestCopy(locale)
      const named = ['wrong_pin', 'pin_locked', 'no_pin', 'not_found'].map(code => guestRecoverMessage(code, locale))
      expect(named).toEqual([copy.wrongPin, copy.pinLocked, copy.noPin, copy.noPost])
      expect(new Set([...named, copy.recoverFailed]).size).toBe(5)
      for (const other of ['has_post', 'failed', undefined]) expect(guestRecoverMessage(other, locale)).toBe(copy.recoverFailed)
    }
  })
})
