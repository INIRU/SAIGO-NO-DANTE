import { expect, it } from 'vitest'
import { isAwakenedUptie, rowsAtUptie } from './deck-identity-uptie'

const rows = [3, 4].flatMap(uptie_level => [{ identity_id: 'a', uptie_level }, { identity_id: 'b', uptie_level }])
const levelsOf = (list: typeof rows, id: string) => [...new Set(list.filter(row => row.identity_id === id).map(row => row.uptie_level))]

it('picks each slot uptie, falling back to the nearest level the data has', () => {
  expect(levelsOf(rowsAtUptie(rows, new Map([['a', 3]])), 'a')).toEqual([3])
  expect(levelsOf(rowsAtUptie(rows, new Map([['a', 3]])), 'b')).toEqual([4])
  expect(levelsOf(rowsAtUptie(rows, new Map([['a', 1]])), 'a')).toEqual([3])
  expect(levelsOf(rowsAtUptie([...rows, { identity_id: 'a', uptie_level: 1 }], new Map([['a', 2]])), 'a')).toEqual([1])
  expect(rowsAtUptie(rows.filter(row => row.uptie_level === 4), new Map([['a', 1]]))).toHaveLength(2)
})

it('uses awakened art from uptie III, and for missing upties', () => {
  expect([1, 2, 3, 4, undefined].map(isAwakenedUptie)).toEqual([false, false, true, true, true])
})
