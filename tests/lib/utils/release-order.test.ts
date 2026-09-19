import { expect, it } from 'vitest'
import { compareReleaseDate } from '@/lib/utils/release-order'

it('puts newest releases first, ties in deterministic ID order, and missing dates last', () => {
  const rows = [{ id: 'missing' }, { id: 'b', release_date: '2026-09-17' }, { id: 'old', release_date: '2023-02-27' }, { id: 'a', release_date: '2026-09-17' }, { id: 'null', release_date: null }]
  expect([...rows].sort(compareReleaseDate).map(row => row.id)).toEqual(['a', 'b', 'old', 'missing', 'null'])
  expect(rows[0].id).toBe('missing')
})
