/** One public deck or plan reduced to its battle formation (one identity per sinner, slot order below 99). */
export type Formation = { kind: 'deck' | 'planner'; id: string; identities: string[]; votes: number; views: number }

export type Companion = { identity_id: string; count: number; score: number }

const MIN_SHARED = 3

/**
 * Identities that share formations with `identityId`, tighter than popularity explains: the shared count divided by
 * (expected + 1), where expected = this identity's formations × the other's ÷ all formations. A pair needs at least
 * three shared formations and more than expected, so a staple that sits in every formation does not top every list.
 */
export function companionsOf(formations: Formation[], identityId: string, { limit = 6 } = {}): Companion[] {
  const total = formations.length
  const withIdentity = formations.filter(formation => formation.identities.includes(identityId))
  const uses = new Map<string, number>()
  for (const formation of formations) for (const id of formation.identities) uses.set(id, (uses.get(id) ?? 0) + 1)
  const shared = new Map<string, number>()
  for (const formation of withIdentity) for (const id of formation.identities) if (id !== identityId) shared.set(id, (shared.get(id) ?? 0) + 1)
  return [...shared]
    .flatMap(([id, count]) => {
      const expected = withIdentity.length * (uses.get(id) ?? 0) / total
      return count >= MIN_SHARED && count > expected ? [{ identity_id: id, count, score: count / (expected + 1) }] : []
    })
    .sort((a, b) => b.score - a.score || b.count - a.count || a.identity_id.localeCompare(b.identity_id))
    .slice(0, limit)
}

/** Posts fielding the identity by window visitors, then votes, then views; posts nobody visited or recommended are left out. `visitors` is keyed `kind:id`. */
export function popularWith(formations: Formation[], identityId: string, visitors: Map<string, number>, limit = 4): Formation[] {
  const seen = (formation: Formation) => visitors.get(`${formation.kind}:${formation.id}`) ?? 0
  return formations
    .filter(formation => formation.identities.includes(identityId) && (seen(formation) > 0 || formation.votes > 0))
    .sort((a, b) => seen(b) - seen(a) || b.votes - a.votes || b.views - a.views || a.id.localeCompare(b.id))
    .slice(0, limit)
}

/** Other posts of the same kind whose battle formation shares the most identities with this one (shared ÷ union), then votes, views, id. */
export function similarTo(formations: Formation[], kind: Formation['kind'], id: string, limit = 8): Formation[] {
  const mine = formations.find(formation => formation.kind === kind && formation.id === id)
  if (!mine) return []
  const own = new Set(mine.identities)
  return formations
    .filter(formation => formation.kind === kind && formation.id !== id)
    .flatMap(formation => {
      const shared = formation.identities.filter(identity => own.has(identity)).length
      return shared ? [{ formation, score: shared / (own.size + formation.identities.length - shared) }] : []
    })
    .sort((a, b) => b.score - a.score || b.formation.votes - a.formation.votes || b.formation.views - a.formation.views || a.formation.id.localeCompare(b.formation.id))
    .slice(0, limit)
    .map(row => row.formation)
}
