import type { RandomResult } from './engine'

/** Gap between two cards starting to turn, and how long one card takes to land. */
export const REVEAL_STEP_MS = 80
export const REVEAL_CARD_MS = 640

export const EGO_GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const
type EgoGrade = (typeof EGO_GRADES)[number]

/** From the first card turning to the last one landing. */
export const revealDuration = (count: number) => Math.max(0, count - 1) * REVEAL_STEP_MS + REVEAL_CARD_MS

/** Where each sinner's card comes in: the numbered ones first in number order, then the rest in board order. */
export function revealRanks(sinnerIds: string[], order: string[] | null): Record<string, number> {
  const sequence = [...(order ?? []), ...sinnerIds.filter(id => !order?.includes(id))]
  return Object.fromEntries(sequence.map((id, rank) => [id, rank]))
}

/** 3-star (000) identities and ALEPH E.G.O get the golden reveal. */
export const isRareIdentity = (identity: { rarity: number } | null | undefined) => identity?.rarity === 3
export const isRareEgo = (ego: { grade: string } | null | undefined) => ego?.grade === 'ALEPH'

type ResultSummary = { rarity: Record<1 | 2 | 3, number>; grades: Record<EgoGrade, number> }

/** How many 000 / 00 / 0 identities and how many E.G.O of each grade the result holds. */
export function summarize(result: RandomResult | null): ResultSummary {
  const summary: ResultSummary = { rarity: { 1: 0, 2: 0, 3: 0 }, grades: { ZAYIN: 0, TETH: 0, HE: 0, WAW: 0, ALEPH: 0 } }
  if (!result) return summary
  for (const identity of Object.values(result.identities)) {
    if (identity && identity.rarity in summary.rarity) summary.rarity[identity.rarity as 1 | 2 | 3]++
  }
  for (const ego of Object.values(result.egos).flat()) {
    if (ego.grade in summary.grades) summary.grades[ego.grade as EgoGrade]++
  }
  return summary
}
