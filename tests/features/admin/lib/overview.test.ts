import { describe, expect, it } from 'vitest'
import { kstDay, lastDays, tallyByDay } from '@/features/admin/lib/overview'

describe('admin overview days', () => {
  it('reads a moment in Korea time', () => {
    expect(kstDay('2026-11-12T14:59:59Z')).toBe('2026-11-12')
    expect(kstDay('2026-11-12T15:00:00Z')).toBe('2026-11-13')
  })
  it('lists the last days oldest first, ending today', () => {
    expect(lastDays(3, Date.parse('2026-11-13T03:00:00Z'))).toEqual(['2026-11-11', '2026-11-12', '2026-11-13'])
  })
  it('counts rows per day and leaves empty days at zero', () => {
    const rows = [{ created_at: '2026-11-12T15:30:00Z' }, { created_at: '2026-11-13T01:00:00Z' }, { created_at: '2026-11-01T00:00:00Z' }]
    expect(tallyByDay(['2026-11-12', '2026-11-13'], rows)).toEqual([0, 2])
  })
})
