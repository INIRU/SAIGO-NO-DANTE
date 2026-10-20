export const RECENT_DAYS = 3
export const BASE_DAYS = 14
/** Posts and identities newer than this are "new", not "rising": the whole window plus a day. */
export const NEW_WITHIN_DAYS = RECENT_DAYS + BASE_DAYS

// Prior strength: this many pseudo-visitors are added to the recent count and to the count the base share predicts.
const PRIOR = 3
const MIN_RECENT = 5
const MIN_RISE = 1.5
const MAX_RISE = 99

/** One entity with its visitors in both windows and the whole kind's visitors in both (`discovery_rising_shares`). */
export type RisingRow = { entity_id: string; recent: number; base: number; recent_total: number; base_total: number }
export type Rising = { id: string; recent: number; /** Multiplier of its share of the board's traffic, one decimal, at most 99. */ rise: number }

/**
 * How much more of the board's traffic an entity gets lately than before: its recent share over its base share, so
 * a busy or quiet week for the whole board does not move it. Smoothed toward 1.0 with a prior of three visitors:
 * rise = (recent + 3) ÷ (expected + 3), where expected = base × recent_total ÷ base_total is the recent count an unchanged share would give.
 * Needs at least 5 recent visitors and a smoothed rise of ×1.5; ranked by (rise − 1) × √recent, so a small jump on little evidence
 * does not beat a clear one on much.
 */
export function rising(rows: RisingRow[], limit = 6): Rising[] {
  return rows
    .flatMap(({ entity_id, recent, base, recent_total, base_total }) => {
      if (recent < MIN_RECENT || recent_total <= 0 || base_total <= 0) return []
      const expected = base * recent_total / base_total
      const raw = (recent + PRIOR) / (expected + PRIOR)
      const rise = Math.round(Math.min(MAX_RISE, raw) * 10) / 10
      return rise >= MIN_RISE ? [{ id: entity_id, recent, rise, score: (raw - 1) * Math.sqrt(recent) }] : []
    })
    .sort((a, b) => b.score - a.score || b.recent - a.recent || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ id, recent, rise }) => ({ id, recent, rise }))
}
