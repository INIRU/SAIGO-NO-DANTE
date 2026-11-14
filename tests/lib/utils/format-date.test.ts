import { describe, expect, it } from 'vitest'
import { formatKstDate, formatShortDateTime } from '@/lib/utils/format-date'

// The two expressions the call sites carried before the helper existed.
const inlineShort = (locale: string, date: Date) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
function inlineKst(d: string) {
  const timestamp = Date.parse(d)
  if (Number.isNaN(timestamp)) return d
  const kst = new Date(timestamp + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')}`
}

describe('formatShortDateTime', () => {
  const iso = '2026-11-13T16:05:00Z'

  it('matches the inline Intl format in every site language', () => {
    for (const locale of ['ko', 'en', 'ja']) {
      expect(formatShortDateTime(locale, iso)).toBe(inlineShort(locale, new Date(iso)))
      expect(formatShortDateTime(locale, new Date(iso))).toBe(inlineShort(locale, new Date(iso)))
      expect(formatShortDateTime(locale, Date.parse(iso))).toBe(inlineShort(locale, new Date(iso)))
    }
  })

  it('is empty for a value that is not a date', () => {
    expect(formatShortDateTime('ko', 'not a date')).toBe('')
    expect(formatShortDateTime('ko', Number.NaN)).toBe('')
  })
})

describe('formatKstDate', () => {
  it('writes the Seoul calendar day as YYYY.MM.DD', () => {
    expect(formatKstDate('2026-11-13T16:00:00Z')).toBe('2026.11.14')
    expect(formatKstDate('2026-01-02T14:59:59Z')).toBe('2026.01.02')
  })

  it('gives an unreadable value back unchanged', () => {
    expect(formatKstDate('soon')).toBe('soon')
  })

  it('gives the same result as the inline function it replaces', () => {
    for (const value of ['2026-11-13T16:00:00Z', '2025-12-31T15:00:00Z', '2026-03-01', 'soon', '']) expect(formatKstDate(value)).toBe(inlineKst(value))
  })
})
