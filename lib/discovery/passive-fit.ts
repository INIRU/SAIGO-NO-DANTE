import type { SinType } from '@/lib/types'

/**
 * How likely a passive's condition comes true for a team: the dynamic program of `lib/decks/passive-activation.ts` on the
 * branch feat/passive-activation (change "passive-activation"), copied here as the recommender's sin/passive fit so this
 * change does not depend on that branch. It answers with a number instead of an easy/medium/hard rating.
 * The rules (see that change's design.md): a fight starts with one dashboard column per fielded identity and one more column
 * a turn (a random identity's), up to 12; every column holds one of that identity's skill cards, drawn by its sin.
 * - stock: sin resources are never spent; the chance the team holds every required count by turn STOCK_TURN.
 * - resonance: the chance enough skills of the sin are on the dashboard at once, averaged over the first RESONANCE_TURNS.
 */
export type SinWeights = Partial<Record<SinType, number>>
export type ActivationKind = 'stock' | 'resonance'
export type ActivationRequirement = { sin: SinType; count: number }

/** Most dashboard columns a fight can have. */
export const MAX_SLOTS = 12
export const STOCK_TURN = 5
export const RESONANCE_TURNS = 6

/** Per-slot chance of each required sin (the rest of the deck makes some other sin). */
type Slot = number[]

function slotsAtTurn(decks: Slot[], turn: number): Slot[] {
  const n = decks.length
  const total = Math.min(MAX_SLOTS, n + turn - 1)
  const each = Math.floor(total / n)
  const extra = total - each * n
  const average = decks[0].map((_, j) => decks.reduce((sum, deck) => sum + deck[j], 0) / n)
  return [...decks.flatMap(deck => Array.from({ length: each }, () => deck)), ...Array.from({ length: extra }, () => average)]
}

/** Distribution of the capped per-sin counts after the given slots: index = mixed radix of the counts (capped at each requirement). */
function emptyState(caps: number[]): Float64Array {
  const states = new Float64Array(caps.reduce((size, cap) => size * (cap + 1), 1))
  states[0] = 1
  return states
}

function addSlot(states: Float64Array, caps: number[], slot: Slot): Float64Array {
  const next = new Float64Array(states.length)
  const none = Math.max(0, 1 - slot.reduce((sum, p) => sum + p, 0))
  for (let state = 0; state < states.length; state++) {
    const mass = states[state]
    if (mass === 0) continue
    next[state] += mass * none
    let stride = 1
    for (let j = 0; j < caps.length; j++) {
      const digit = Math.floor(state / stride) % (caps[j] + 1)
      next[digit < caps[j] ? state + stride : state] += mass * slot[j]
      stride *= caps[j] + 1
    }
  }
  return next
}

const reached = (states: Float64Array) => states[states.length - 1]

/** Chance (0–1) that the passive's condition holds for the fielded `team` (each member's skill cards per sin); 0 when no one makes a required sin. */
export function activationChance(kind: ActivationKind, requirements: readonly ActivationRequirement[], team: readonly SinWeights[]): number {
  if (!team.length || !requirements.length) return 0
  const needs = new Map<SinType, number>()
  for (const { sin, count } of requirements) needs.set(sin, Math.max(needs.get(sin) ?? 0, count))
  const sins = [...needs.keys()]
  const caps = sins.map(sin => needs.get(sin)!)
  const decks: Slot[] = team.map(weights => {
    const total = Object.values(weights).reduce<number>((sum, value) => sum + (value ?? 0), 0)
    return sins.map(sin => (total > 0 ? (weights[sin] ?? 0) / total : 0))
  })
  if (sins.some((_, j) => decks.every(deck => deck[j] === 0))) return 0

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
