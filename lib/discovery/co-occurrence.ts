/**
 * One public deck or plan reduced to its battle formation (one identity per sinner, slot order below 99).
 * The recommenders also read when it was posted, the E.G.O it equips and, for a plan, what each floor took.
 */
export type Formation = {
  kind: 'deck' | 'planner'; id: string; identities: string[]; votes: number; views: number
  /** The identities that fight (formation order 1–DEPLOYED_SLOT_COUNT), without the backup; `identities` has every ordered one. */
  deployed?: string[]
  createdAt?: number
  egos?: string[]
  floors?: { floor: number; theme: string | null; gifts: string[]; difficulty: string }[]
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
