import { describe, expect, it } from 'vitest'
import { metaPeriodStart } from '@/lib/meta/posts'
import { parseMetaPeriod } from '@/lib/meta/types'

// Wednesday 2026-10-28 15:00 KST: the update week began Thursday 2026-10-22 12:00 KST (03:00 UTC).
const NOW = Date.parse('2026-10-28T06:00:00Z')

describe('meta period (game update weeks, like the home and plan boards)', () => {
  it('starts "this week" at the latest Thursday 12:00 KST', () => {
    expect(metaPeriodStart('week', NOW)).toBe('2026-10-22T03:00:00.000Z')
    // Right at the update the new week begins.
    expect(metaPeriodStart('week', Date.parse('2026-10-29T03:00:00Z'))).toBe('2026-10-29T03:00:00.000Z')
  })

  it('reaches back four update weeks for "month" and has no bound for "all"', () => {
    expect(metaPeriodStart('month', NOW)).toBe('2026-10-01T03:00:00.000Z')
    expect(metaPeriodStart('all', NOW)).toBeNull()
  })

  it('reads the old day-count addresses as the nearest update period', () => {
    expect(parseMetaPeriod('7')).toBe('week')
    expect(parseMetaPeriod('30')).toBe('month')
    expect(parseMetaPeriod('90')).toBe('month')
    expect(parseMetaPeriod('week')).toBe('week')
    expect(parseMetaPeriod('nonsense')).toBe('all')
    expect(parseMetaPeriod(null)).toBe('all')
  })
})
