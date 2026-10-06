import { describe, expect, it } from 'vitest'
import { groupByDay, isMonth, kstDay, monthGrid, monthRange, pickContent, shiftMonth } from '@/lib/news/calendar'

const text = (title: string, translated = false) => ({ title, body: '', url: null, media: [], translated })

describe('news calendar', () => {
  it('REQ-NEWS-007 puts an item on its Korean date', () => {
    expect(kstDay('2026-10-06T14:59:59Z')).toBe('2026-10-06')
    expect(kstDay('2026-10-06T15:00:00Z')).toBe('2026-10-07')
    expect(kstDay('2026-10-01T00:30:00+09:00')).toBe('2026-10-01')
    expect(groupByDay([{ published_at: '2026-10-06T15:00:00Z' }, { published_at: '2026-10-07T01:00:00Z' }, { published_at: '2026-10-05T23:00:00+09:00' }]))
      .toEqual({ '2026-10-07': [{ published_at: '2026-10-06T15:00:00Z' }, { published_at: '2026-10-07T01:00:00Z' }], '2026-10-05': [{ published_at: '2026-10-05T23:00:00+09:00' }] })
  })

  it('REQ-NEWS-007 reads one Korean month at a time', () => {
    expect(monthRange('2026-10')).toEqual(['2026-09-30T15:00:00.000Z', '2026-10-31T15:00:00.000Z'])
    expect(monthRange('2026-12')).toEqual(['2026-11-30T15:00:00.000Z', '2026-12-31T15:00:00.000Z'])
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect([isMonth('2026-10'), isMonth('2026-13'), isMonth('2026-1'), isMonth(undefined)]).toEqual([true, false, false, false])
    const grid = monthGrid('2026-10')
    expect(grid.length % 7).toBe(0)
    expect(grid.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01'])
    expect(grid.filter(Boolean)).toHaveLength(31)
  })

  it('REQ-NEWS-008 falls back through ko, en, ja and keeps the translation mark', () => {
    expect(pickContent({ ko: text('가'), en: text('A', true) }, 'en')).toMatchObject({ title: 'A', lang: 'en', translated: true })
    expect(pickContent({ ko: text('가'), en: text('A') }, 'ja')).toMatchObject({ title: '가', lang: 'ko' })
    expect(pickContent({ en: text('A'), ja: text('あ') }, 'ko')).toMatchObject({ title: 'A', lang: 'en' })
    expect(pickContent({ ja: text('あ') }, 'en')).toMatchObject({ title: 'あ', lang: 'ja' })
  })
})
