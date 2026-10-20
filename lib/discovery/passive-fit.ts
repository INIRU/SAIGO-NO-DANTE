import { RESONANCE_TURNS, addSlot, emptyState, prepareActivation, reached, slotsAtTurn } from '@/lib/decks/passive-activation'
import type { ActivationKind, ActivationRequirement, SinWeights } from '@/lib/decks/passive-activation'

/**
 * How likely a passive's condition comes true for a team, as a number instead of an easy/medium/hard rating: the recommender's
 * sin/passive fit. The dynamic program is the one in `lib/decks/passive-activation.ts` (rules in that change's design.md):
 * - stock: sin resources are never spent; the chance the team holds every required count by turn STOCK_TURN.
 * - resonance: the chance enough skills of the sin are on the dashboard at once, averaged over the first RESONANCE_TURNS.
 */
export type { ActivationKind, ActivationRequirement, SinWeights }
export { MAX_SLOTS, RESONANCE_TURNS } from '@/lib/decks/passive-activation'
export const STOCK_TURN = 5

/** Chance (0–1) that the passive's condition holds for the fielded `team` (each member's skill cards per sin); 0 when no one makes a required sin. */
export function activationChance(kind: ActivationKind, requirements: readonly ActivationRequirement[], team: readonly SinWeights[]): number {
  if (!team.length || !requirements.length) return 0
  const prepared = prepareActivation(requirements, team)
  if (!prepared) return 0
  const { caps, decks } = prepared

  if (kind === 'stock') {
    let states = emptyState(caps)
    for (let turn = 1; turn <= STOCK_TURN; turn++) for (const slot of slotsAtTurn(decks, turn)) states = addSlot(states, caps, slot)
    return reached(states)
  }
  let sum = 0
  for (let turn = 1; turn <= RESONANCE_TURNS; turn++) {
    let states = emptyState(caps)
    for (const slot of slotsAtTurn(decks, turn)) states = addSlot(states, caps, slot)
    sum += reached(states)
  }
  return sum / RESONANCE_TURNS
}
