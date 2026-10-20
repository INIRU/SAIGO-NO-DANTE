import { legacyFloorChoices, legacySuggestIdentities, type LegacyFormation, type LegacyPlanChoice } from './legacy'
import { computeKeywordDeckCombo } from '@/lib/decks/keyword-rules'
import type { EvalFormation, Snapshot } from './load-snapshot'
import type { EgoQuery, FloorQuery, IdentityQuery } from './queries'

/** What a ranker returns: ids best first. Items it does not return count as misses. */
export type Rankers = {
  identity: (query: IdentityQuery) => string[]
  ego: (query: EgoQuery) => string[]
  theme: (query: FloorQuery) => string[]
  gift: (query: FloorQuery) => string[]
}

const asFormation = (f: EvalFormation): LegacyFormation => ({ kind: f.kind, id: f.id, identities: f.identities, votes: 0, views: 0 })

/**
 * The algorithms the site shipped before v2 (frozen in legacy.ts), exactly as `app/api/discovery/suggest` ran them:
 * identities = `suggestIdentities` (hard 3-shared minimum, score shared ÷ (expected + 1) summed over the context);
 * E.G.O = identity-ego pair counts with at least 3 (`identityInsights[identity].egos`);
 * packs and gifts = `floorChoices` (plans sharing 2 identities or a main keyword, picks twice at least).
 */
export function baselineRankers(snapshot: Snapshot): Rankers {
  const byKey = new Map<string, LegacyFormation>()
  const formationOf = (f: EvalFormation) => { let row = byKey.get(f.key); if (!row) { row = asFormation(f); byKey.set(f.key, row) } return row }
  const planChoices = new Map<string, LegacyPlanChoice>()
  const identityKeywords = new Map(snapshot.catalog.identities.map(i => [i.id, i.skill_keyword_list ?? i.keywords ?? []]))
  const choiceOf = (f: EvalFormation): LegacyPlanChoice => {
    let choice = planChoices.get(f.key)
    if (!choice) {
      const floors: LegacyPlanChoice['floors'] = {}
      for (const entry of f.floors) floors[entry.floor] = { theme: entry.theme, gifts: entry.gifts }
      choice = { identities: f.identities, keywords: computeKeywordDeckCombo(f.identities.map((id, order) => ({ slot_order: order, skill_keyword_list: identityKeywords.get(id) ?? [] }))), floors }
      planChoices.set(f.key, choice)
    }
    return choice
  }
  const floorRows = (query: FloorQuery) => legacyFloorChoices(
    query.train.filter(f => f.kind === 'planner').map(choiceOf),
    { identities: query.f.identities, keywords: query.f.mainKeywords },
    query.floor,
  )

  return {
    identity: query => legacySuggestIdentities(query.train.map(formationOf), query.context, new Set(query.candidates), 24).map(row => row.id),
    ego: query => {
      const counts = new Map<string, number>()
      for (const f of query.train) {
        if (!f.identities.includes(query.identity)) continue
        for (const ego of new Set(f.egos.filter(e => e.sinner_id === query.sinner).map(e => e.ego_id))) counts.set(ego, (counts.get(ego) ?? 0) + 1)
      }
      return [...counts].filter(([id, count]) => count >= 3 && query.candidates.includes(id)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id)
    },
    theme: query => floorRows(query).themes.map(row => row.id).filter(id => query.candidates.includes(id)),
    gift: query => floorRows(query).gifts.map(row => row.id).filter(id => query.candidates.includes(id)),
  }
}

/** Not used by the site: the most fielded identity / E.G.O / pack, for scale. */
export function popularityRankers(): Rankers {
  const count = (items: Iterable<string>) => { const m = new Map<string, number>(); for (const item of items) m.set(item, (m.get(item) ?? 0) + 1); return m }
  const byCount = (m: Map<string, number>, candidates: string[]) => [...candidates].sort((a, b) => (m.get(b) ?? 0) - (m.get(a) ?? 0) || a.localeCompare(b))
  return {
    identity: query => byCount(count(query.train.flatMap(f => f.identities)), query.candidates),
    ego: query => byCount(count(query.train.flatMap(f => f.egos.map(e => e.ego_id))), query.candidates),
    theme: query => byCount(count(query.train.flatMap(f => f.floors.filter(e => e.floor === query.floor && e.theme).map(e => e.theme!))), query.candidates),
    gift: query => byCount(count(query.train.flatMap(f => f.floors.filter(e => e.floor === query.floor).flatMap(e => e.gifts))), query.candidates),
  }
}
