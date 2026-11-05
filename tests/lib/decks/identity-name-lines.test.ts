import { expect, test } from 'vitest'
import { identityNameLines } from '@/lib/decks/identity-name-lines'

test('uses the game title line breaks and keeps unbroken titles on one line', () => {
  expect(identityNameLines('LCB 수감자', '10101')).toEqual(['LCB', '수감자'])
  expect(identityNameLines('흑수 - 미', '10313')).toEqual(['흑수 - 미'])
  expect(identityNameLines('Heishou Pack - Wei Branch', '10313', 'en')).toEqual(['Heishou Pack -', 'Wei Branch'])
  expect(identityNameLines('알 수 없는 인격', null)).toEqual(['알 수 없는 인격'])
})
