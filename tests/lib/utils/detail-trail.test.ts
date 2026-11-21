import { expect, it } from 'vitest'
import { stepInto } from '@/lib/utils/detail-trail'

const key = (entry: string) => entry

it('adds the window opened from the last one', () => {
  expect(stepInto(['a'], 'b', key)).toEqual(['a', 'b'])
  expect(stepInto([], 'a', key)).toEqual(['a'])
})

it('goes back to a window already on the way instead of adding it again', () => {
  expect(stepInto(['a', 'b', 'c'], 'a', key)).toEqual(['a'])
  expect(stepInto(['a', 'b'], 'b', key)).toEqual(['a', 'b'])
})
