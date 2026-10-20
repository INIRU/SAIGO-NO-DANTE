import type { Formation } from '@/lib/discovery/co-occurrence'

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
  return scored(rows).sort((a, b) => b.score - a.score || b.recent - a.recent || a.id.localeCompare(b.id)).slice(0, limit).map(({ id, recent, rise }) => ({ id, recent, rise }))
}

function scored(rows: RisingRow[]) {
  return rows.flatMap(({ entity_id, recent, base, recent_total, base_total }) => {
    if (recent < MIN_RECENT || recent_total <= 0 || base_total <= 0) return []
    const expected = base * recent_total / base_total
    const raw = (recent + PRIOR) / (expected + PRIOR)
    const rise = Math.round(Math.min(MAX_RISE, raw) * 10) / 10
    return rise >= MIN_RISE ? [{ id: entity_id, recent, rise, score: (raw - 1) * Math.sqrt(recent) }] : []
  })
}

/** Distinct visitors of one deck or plan in both windows (`discovery_rising_shares`, kept even with no recent visitor). */
export type PostVisits = { entity_id: string; recent: number; base: number }

const MIN_POSTS = 3
/** How much of the ranking the formations made in the last 14 days may decide: a tie-breaker, not a second ranking. */
const FRESH_WEIGHT = 0.2
/** Identities that rise on the same posts (one team) are shown at most two at a time, and each is marked down by its overlap with the ones already shown. */
const TEAM_OVERLAP = 0.6
const MAX_TEAM = 2
const OVERLAP_PENALTY = 0.7

/**
 * Identities that are fielded in more of the board's traffic lately, read from the formations instead of the identity
 * pages: an identity's visits in a window are the visitors of every deck and plan that fields it (support slots and
 * `skip`, the LCB defaults, do not count), and the window's total is the sum over all fielded identities, so the
 * comparison is the same share-over-share of `rising`. An identity needs at least three posts with a recent visitor.
 * Ranked by (rise − 1) × √recent against the best of them, plus up to 0.2 for how many posts it is fielded in that were
 * made in the last 14 days (relative to the most).
 */
export function risingIdentities({ formations, visits, skip = new Set(), now = Date.now() }: {
  formations: readonly Formation[]
  visits: Record<Formation['kind'], PostVisits[]>
  skip?: ReadonlySet<string>
  now?: number
}, limit = 12): Rising[] {
  const seen = { deck: new Map(visits.deck.map(row => [row.entity_id, row])), planner: new Map(visits.planner.map(row => [row.entity_id, row])) }
  const stats = new Map<string, { recent: number; base: number; posts: number; fresh: number; support: Set<string> }>()
  let recentTotal = 0
  let baseTotal = 0
  for (const post of formations) {
    const visit = seen[post.kind].get(post.id)
    if (!visit) continue
    const fresh = post.created_at !== undefined && now - Date.parse(post.created_at) < BASE_DAYS * 86_400_000
    for (const id of post.identities) {
      if (skip.has(id)) continue
      const stat = stats.get(id) ?? { recent: 0, base: 0, posts: 0, fresh: 0, support: new Set<string>() }
      stat.recent += visit.recent
      stat.base += visit.base
      if (visit.recent > 0) { stat.posts++; stat.support.add(`${post.kind}:${post.id}`) }
      if (fresh) stat.fresh++
      stats.set(id, stat)
      recentTotal += visit.recent
      baseTotal += visit.base
    }
  }
  const rows = [...stats].filter(([, stat]) => stat.posts >= MIN_POSTS).map(([id, stat]) => ({ entity_id: id, recent: stat.recent, base: stat.base, recent_total: recentTotal, base_total: baseTotal }))
  const candidates = scored(rows)
  const best = Math.max(...candidates.map(item => item.score), 0)
  const mostFresh = Math.max(...candidates.map(item => stats.get(item.id)!.fresh), 0)
  const ranked = candidates
    .map(item => ({ ...item, final: item.score / best + (mostFresh ? FRESH_WEIGHT * stats.get(item.id)!.fresh / mostFresh : 0), support: stats.get(item.id)!.support }))
    .sort((a, b) => b.final - a.final || b.recent - a.recent || a.id.localeCompare(b.id))
  // Greedy re-rank: the next pick is the best score after the overlap penalty, and no third identity joins a pair that shares its posts.
  const picked: typeof ranked = []
  while (picked.length < limit && ranked.length) {
    let bestIndex = -1
    let bestValue = -Infinity
    ranked.forEach((item, index) => {
      const overlaps = picked.map(other => jaccard(item.support, other.support))
      if (overlaps.filter(overlap => overlap >= TEAM_OVERLAP).length >= MAX_TEAM) return
      const value = item.final * (1 - OVERLAP_PENALTY * Math.max(0, ...overlaps))
      if (value > bestValue) { bestValue = value; bestIndex = index }
    })
    if (bestIndex < 0) break
    picked.push(...ranked.splice(bestIndex, 1))
  }
  return picked.map(({ id, recent, rise }) => ({ id, recent, rise }))
}

const jaccard = (a: ReadonlySet<string>, b: ReadonlySet<string>) => {
  let shared = 0
  for (const key of a) if (b.has(key)) shared++
  return shared / (a.size + b.size - shared)
}
