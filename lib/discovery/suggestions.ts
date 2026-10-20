import { companionsOf, type Formation } from '@/lib/discovery/co-occurrence'

/** Candidates for the empty slot of a formation: the sum, over the identities already fielded, of how tightly each candidate is fielded beside them (`companionsOf` scores). */
export function suggestIdentities(formations: Formation[], context: string[], candidates: ReadonlySet<string>, limit = 6): { id: string; score: number }[] {
  const fielded = new Set(context)
  const scores = new Map<string, number>()
  for (const identity of fielded) {
    for (const row of companionsOf(formations, identity, { limit: Infinity })) {
      if (candidates.has(row.identity_id) && !fielded.has(row.identity_id)) scores.set(row.identity_id, (scores.get(row.identity_id) ?? 0) + row.score)
    }
  }
  return [...scores].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit)
}

/** One public plan reduced to what a floor picker needs: its battle identities, main keywords, and per floor the pack and gifts it took. */
export type PlanChoice = { identities: string[]; keywords: string[]; floors: Record<number, { theme: string | null; gifts: string[] }> }
type Context = { identities: string[]; keywords: string[] }

const MIN_SIMILAR = 3
const MIN_PICKS = 2

/** Plans that share two identities, or one main keyword, with the plan being made; every plan when fewer than three do. */
export function similarPlans(plans: PlanChoice[], context: Context): PlanChoice[] {
  const identities = new Set(context.identities), keywords = new Set(context.keywords)
  const similar = plans.filter(plan => plan.identities.filter(id => identities.has(id)).length >= 2 || plan.keywords.some(keyword => keywords.has(keyword)))
  return similar.length >= MIN_SIMILAR ? similar : plans
}

/** What similar plans took on one floor: packs and gifts picked at least twice, most picked first (each plan counts a pack or gift once). */
export function floorChoices(plans: PlanChoice[], context: Context, floor: number): { themes: { id: string; count: number }[]; gifts: { id: string; count: number }[] } {
  const themes = new Map<string, number>(), gifts = new Map<string, number>()
  for (const plan of similarPlans(plans, context)) {
    const entry = plan.floors[floor]
    if (!entry) continue
    if (entry.theme) themes.set(entry.theme, (themes.get(entry.theme) ?? 0) + 1)
    for (const gift of new Set(entry.gifts)) gifts.set(gift, (gifts.get(gift) ?? 0) + 1)
  }
  const top = (counts: Map<string, number>) => [...counts].filter(([, count]) => count >= MIN_PICKS).map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
  return { themes: top(themes), gifts: top(gifts) }
}
