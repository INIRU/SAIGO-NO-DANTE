import type { Formation } from '@/features/community/lib/co-occurrence'

export const RECENT_DAYS = 7
export const BASE_DAYS = 21
/** A post counts for the rising identities when it was written or edited within these days. */
const IDENTITY_DAYS = 14
/** An identity on one post is no trend. */
const MIN_IDENTITY_POSTS = 2

// Prior strength: this many pseudo-visitors are added to the recent count and to the count the base share predicts.
const PRIOR = 3
/** The smallest rise worth showing, as displayed: one decimal above ×1.0. */
const MIN_RISE = 1.1
const MAX_RISE = 99
/** Recent visitors a post needs, strictest first: the next floor is used only when the row is not full. */
const POST_FLOORS = [8, 5, 3]

/** One entity with its visitors in both windows and the whole kind's visitors in both (`discovery_rising_windows`). */
export type RisingRow = { entity_id: string; recent: number; base: number; recent_total: number; base_total: number }
export type Rising = { id: string; recent: number; /** Multiplier of its share of the board's traffic, one decimal, at most 99. */ rise: number }

/** What is shown: the biggest multiplier first, then the most evidence. */
export const byRise = (a: Rising, b: Rising) => b.rise - a.rise || b.recent - a.recent || a.id.localeCompare(b.id)

/**
 * How much more of the board's traffic an entity gets lately than before: its recent share over its base share, so
 * a busy or quiet week for the whole board does not move it. Smoothed toward 1.0 with a prior of three visitors:
 * rise = (recent + 3) ÷ (expected + 3), where expected = base × recent_total ÷ base_total is the recent count an unchanged share would give.
 * Anything that rose by at least ×1.1 qualifies; with at least 8 recent visitors (5, then 3 when the row would not be full).
 * Ranked by (rise − 1) × √recent, so a small jump on little evidence does not beat a clear one on much.
 */
export function rising(rows: RisingRow[], limit = 6): Rising[] {
  const picked: ReturnType<typeof scored> = []
  for (const floor of POST_FLOORS) {
    if (picked.length >= limit) break
    const taken = new Set(picked.map(item => item.id))
    picked.push(...scored(rows.filter(row => !taken.has(row.entity_id)), floor).sort(byScore).slice(0, limit - picked.length))
  }
  return picked.map(({ id, recent, rise }) => ({ id, recent, rise }))
}

const byScore = (a: { score: number; recent: number; id: string }, b: { score: number; recent: number; id: string }) => b.score - a.score || b.recent - a.recent || a.id.localeCompare(b.id)

function scored(rows: RisingRow[], minRecent: number) {
  return rows.flatMap(({ entity_id, recent, base, recent_total, base_total }) => {
    if (recent < minRecent || recent_total <= 0 || base_total <= 0) return []
    const expected = base * recent_total / base_total
    const raw = (recent + PRIOR) / (expected + PRIOR)
    const rise = Math.round(Math.min(MAX_RISE, raw) * 10) / 10
    return rise >= MIN_RISE ? [{ id: entity_id, recent, rise, score: (raw - 1) * Math.sqrt(recent) }] : []
  })
}

export type RisingIdentity = { id: string; /** Recent posts of the board that field it. */ count: number }

/**
 * Identities of one board's recent formations: the posts of `kind` written or edited in the last 14 days are counted per
 * identity, only its deployed slots (formation order 1–7, no backup; `skip`, the LCB defaults, does not count). An identity
 * needs two posts. Most posts first, then id.
 */
export function risingIdentities({ formations, kind, skip = new Set(), now = Date.now() }: {
  formations: readonly Formation[]
  kind: Formation['kind']
  skip?: ReadonlySet<string>
  now?: number
}, limit = 9): RisingIdentity[] {
  const since = now - IDENTITY_DAYS * 86_400_000
  const counts = new Map<string, number>()
  for (const post of formations) {
    if (post.kind !== kind || Math.max(post.createdAt ?? 0, post.editedAt ?? 0) < since) continue
    for (const id of post.deployed ?? post.identities) if (!skip.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts].filter(([, count]) => count >= MIN_IDENTITY_POSTS)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, limit)
}
