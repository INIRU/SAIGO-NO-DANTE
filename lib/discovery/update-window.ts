export type PopularPeriod = "week" | "month" | "all";

const HOUR = 3_600_000;
const WEEK = 7 * 24 * HOUR;
// 1970-01-01 was a Thursday: 12:00 KST (UTC+9, no DST) = 03:00 UTC, so update weeks are a plain modulo from here.
const ANCHOR = 3 * HOUR;

/** Start of the current update week: the latest Thursday 12:00 KST at or before `now`. */
export function updateWeekStart(now: Date): Date {
  const t = now.getTime();
  return new Date(ANCHOR + Math.floor((t - ANCHOR) / WEEK) * WEEK);
}

/**
 * Lower bound (UTC day, YYYY-MM-DD) of the popular window, or null for all time.
 * Visits are stored per UTC day, so the boundary day is included whole.
 * Doubles as the cache key: it changes exactly when the update week rolls over.
 */
export function popularSince(period: PopularPeriod, now: Date = new Date()): string | null {
  if (period === "all") return null;
  const start = updateWeekStart(now).getTime() - (period === "month" ? 3 * WEEK : 0);
  return new Date(start).toISOString().slice(0, 10);
}
