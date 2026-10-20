/**
 * The suggestion algorithms the site shipped before recommender v2 (lib/discovery/suggestions.ts and companionsOf in
 * co-occurrence.ts at commit 9c18dc15), frozen here so `evaluate.ts --algo baseline` keeps measuring them after the
 * library moved on. Do not "improve" this file: it is the yardstick.
 */
export type LegacyFormation = { kind: 'deck' | 'planner'; id: string; identities: string[]; votes: number; views: number }
export type LegacyPlanChoice = { identities: string[]; keywords: string[]; floors: Record<number, { theme: string | null; gifts: string[] }> }

const MIN_SHARED = 3

export function legacyCompanionsOf(formations: LegacyFormation[], identityId: string, { limit = 6 } = {}) {
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

export function legacySuggestIdentities(formations: LegacyFormation[], context: string[], candidates: ReadonlySet<string>, limit = 6): { id: string; score: number }[] {
  const fielded = new Set(context)
  const scores = new Map<string, number>()
  for (const identity of fielded) {
    for (const row of legacyCompanionsOf(formations, identity, { limit: Infinity })) {
      if (candidates.has(row.identity_id) && !fielded.has(row.identity_id)) scores.set(row.identity_id, (scores.get(row.identity_id) ?? 0) + row.score)
    }
  }
  return [...scores].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit)
}

type Context = { identities: string[]; keywords: string[] }
const MIN_SIMILAR = 3
const MIN_PICKS = 2

export function legacySimilarPlans(plans: LegacyPlanChoice[], context: Context): LegacyPlanChoice[] {
  const identities = new Set(context.identities), keywords = new Set(context.keywords)
  const similar = plans.filter(plan => plan.identities.filter(id => identities.has(id)).length >= 2 || plan.keywords.some(keyword => keywords.has(keyword)))
  return similar.length >= MIN_SIMILAR ? similar : plans
}

export function legacyFloorChoices(plans: LegacyPlanChoice[], context: Context, floor: number): { themes: { id: string; count: number }[]; gifts: { id: string; count: number }[] } {
  const themes = new Map<string, number>(), gifts = new Map<string, number>()
  for (const plan of legacySimilarPlans(plans, context)) {
    const entry = plan.floors[floor]
    if (!entry) continue
    if (entry.theme) themes.set(entry.theme, (themes.get(entry.theme) ?? 0) + 1)
    for (const gift of new Set(entry.gifts)) gifts.set(gift, (gifts.get(gift) ?? 0) + 1)
  }
  const top = (counts: Map<string, number>) => [...counts].filter(([, count]) => count >= MIN_PICKS).map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
  return { themes: top(themes), gifts: top(gifts) }
}
