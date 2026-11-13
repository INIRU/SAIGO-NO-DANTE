/** A moment as the site's operators read it (Korea time), `YYYY-MM-DD`. */
export const kstDay = (at: Date | string | number) => new Date(new Date(at).getTime() + 9 * 36e5).toISOString().slice(0, 10)

/** The last `count` Korea-time days ending today, oldest first. */
export const lastDays = (count: number, now = Date.now()) => Array.from({ length: count }, (_, i) => kstDay(now - (count - 1 - i) * 864e5))

/** How many rows were created on each of `days`. */
export function tallyByDay(days: string[], rows: { created_at: string }[]) {
  const tally = new Map<string, number>()
  for (const row of rows) tally.set(kstDay(row.created_at), (tally.get(kstDay(row.created_at)) ?? 0) + 1)
  return days.map(day => tally.get(day) ?? 0)
}
