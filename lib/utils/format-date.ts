/** "Nov 14, 03:05"-style day and time in the page language, or '' when the value is not a date. */
export function formatShortDateTime(locale: string, value: string | number | Date): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

/** The Seoul calendar day of a timestamp as YYYY.MM.DD; an unreadable value is returned as given. */
export function formatKstDate(value: string): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return value
  const kst = new Date(timestamp + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')}`
}
