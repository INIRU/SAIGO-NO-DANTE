export const RECENT_DAYS = 3
export const BASE_DAYS = 14
// A visitor a day for two means little: half a visitor a day on each side keeps small counts from jumping to huge ratios.
const SMOOTHING = 0.5
const MAX_RISE = 999

export type RisingRow = { entity_id: string; recent: number; base: number }
export type Rising = { id: string; recent: number; rise: number }

/**
 * Entities whose daily visitors over the last 3 days beat their daily average over the 14 days before, smoothed:
 * rise = ((recent ÷ 3 + 0.5) ÷ (base ÷ 14 + 0.5) − 1) × 100, shown as a whole percent up to 999. Biggest rise first, then more recent visitors, then id.
 */
export function rising(rows: RisingRow[], limit = 6): Rising[] {
  return rows
    .map(({ entity_id, recent, base }) => ({
      id: entity_id,
      recent,
      rise: Math.min(MAX_RISE, Math.round(((recent / RECENT_DAYS + SMOOTHING) / (base / BASE_DAYS + SMOOTHING) - 1) * 100)),
    }))
    .filter(item => item.rise > 0)
    .sort((a, b) => b.rise - a.rise || b.recent - a.recent || a.id.localeCompare(b.id))
    .slice(0, limit)
}
