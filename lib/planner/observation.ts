import observation from '@/lib/data/observation-gifts.json'

/** Gifts the Mirror Dungeon start observation can offer (game observation data; regenerate with scripts/data/observation-gifts.mjs). */
export const OBSERVATION_GIFT_IDS: ReadonlySet<number> = new Set(observation.giftIds)
export const MAX_OBSERVED_GIFTS = Math.max(...observation.costs.map(cost => cost.count))

/** Starlight spent to observe `count` gifts: 70, 160, 270 for 1, 2, 3 — not a flat price per gift. */
export function observationCost(count: number): number {
  return observation.costs.find(cost => cost.count === count)?.starlight ?? 0
}
