/** Mirror Dungeon start observation: the gifts it can offer and the starlight for observing `count` of them. */
export interface Observation {
  giftIds: number[]
  costs: { count: number; starlight: number }[]
}

/** `limbus.md_observation` columns the site reads (latest season row, written by the extractor's site-sync). */
export type ObservationRow = { gift_ids: number[]; costs: { count: number; starlight: number }[] }

/** Select for the latest season: `.from('md_observation').select(OBSERVATION_COLUMNS).order('mirror_dungeon_id', { ascending: false }).limit(1).maybeSingle()` */
export const OBSERVATION_COLUMNS = 'gift_ids, costs'

/** No row yet (or the read failed): nothing to observe. The table is the only source; there is no bundled copy. */
export function observationFrom(row: ObservationRow | null | undefined): Observation {
  return row ? { giftIds: row.gift_ids, costs: row.costs } : { giftIds: [], costs: [] }
}

export const maxObserved = (observation: Observation) => Math.max(0, ...observation.costs.map(cost => cost.count))

/** Starlight spent to observe `count` gifts: 70, 160, 270 for 1, 2, 3 — not a flat price per gift. */
export function observationCost(observation: Observation, count: number): number {
  return observation.costs.find(cost => cost.count === count)?.starlight ?? 0
}
