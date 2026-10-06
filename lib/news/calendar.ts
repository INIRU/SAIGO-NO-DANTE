/** Calendar arithmetic for news. Days and months are Korean time (UTC+9, no daylight saving). */
import { NEWS_LANGS, type NewsInput, type NewsLang, type NewsText } from './payload'

const KST = 9 * 3600_000

export const kstDay = (iso: string) => new Date(Date.parse(iso) + KST).toISOString().slice(0, 10)
export const isMonth = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
export const shiftMonth = (month: string, by: number) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + by, 1)).toISOString().slice(0, 7)

/** The UTC instants [from, to) that bound a Korean month (YYYY-MM). */
export const monthRange = (month: string): [string, string] => [
  new Date(Date.parse(`${month}-01T00:00:00Z`) - KST).toISOString(),
  new Date(Date.parse(`${shiftMonth(month, 1)}-01T00:00:00Z`) - KST).toISOString(),
]

/** Sunday-first cells of a month: a date (YYYY-MM-DD) or null for the padding around it. */
export function monthGrid(month: string): (string | null)[] {
  const first = new Date(`${month}-01T00:00:00Z`)
  const days = new Date(Date.parse(`${shiftMonth(month, 1)}-01T00:00:00Z`) - 86400_000).getUTCDate()
  const cells: (string | null)[] = [
    ...Array<null>(first.getUTCDay()).fill(null),
    ...Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`),
  ]
  while (cells.length % 7) cells.push(null)
  return cells
}

export function groupByDay<T extends { published_at: string }>(items: T[]) {
  const days: Record<string, T[]> = {}
  for (const item of items) (days[kstDay(item.published_at)] ??= []).push(item)
  return days
}

/** The text for a viewer's language, or the first that exists in ko, en, ja order. `lang` says which one it is. */
export function pickContent(content: NewsInput['content'], lang: NewsLang): NewsText & { lang: NewsLang } {
  for (const key of [lang, ...NEWS_LANGS]) {
    const text = content[key]
    if (text) return { ...text, lang: key }
  }
  throw Error('News item without content')
}
