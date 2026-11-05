import { expect, it } from 'vitest'
import { safeLoginReturn } from '@/lib/auth-return'
it('preserves local creation routes and rejects external or login-loop destinations', () => {
  expect(safeLoginReturn('/ja/decks/new?fork=abc', 'ja')).toBe('/ja/decks/new?fork=abc')
  for (const path of ['//evil.test', '/\\evil.test', 'https://evil.test', '/en/login', '/login', '/\nevil.test']) expect(safeLoginReturn(path, 'ko')).toBe('/ko')
})
