import { expect, it } from 'vitest'
import { forYouPhase } from '@/features/community/lib/for-you-phase'

const base = { personal: true, status: 'authenticated', loaded: false, held: false, count: 0 } as const

it('decides what the personal shelf shows', () => {
  // No shelf and no skeleton for visitors without an account, while the session is unknown, or with history off.
  expect(forYouPhase({ ...base, status: 'unauthenticated' })).toBe('hidden')
  expect(forYouPhase({ ...base, status: 'loading' })).toBe('hidden')
  expect(forYouPhase({ ...base, personal: false, loaded: true, count: 3 })).toBe('hidden')
  // Waiting for the picks holds the place.
  expect(forYouPhase(base)).toBe('choosing')
  // The skeleton stays for its minimum time even when the picks are already here, so it never flickers.
  expect(forYouPhase({ ...base, loaded: true, held: true, count: 3 })).toBe('choosing')
  expect(forYouPhase({ ...base, loaded: true, count: 3 })).toBe('ready')
  // Nothing to recommend, or the request failed (loaded with no picks): the shelf folds away.
  expect(forYouPhase({ ...base, loaded: true, count: 0 })).toBe('empty')
})
