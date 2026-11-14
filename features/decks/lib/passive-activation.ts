import type { SinType } from '@/lib/types'

/** Cards per sin in one identity's skill deck (what `computeSinProduction` returns for that identity alone). */
export type SinWeights = Partial<Record<SinType, number>>
export type ActivationKind = 'stock' | 'resonance'
type ActivationLevel = 'easy' | 'medium' | 'hard' | 'impossible'
export type ActivationRequirement = { sin: SinType; count: number }

export type PassiveActivation = {
  level: ActivationLevel
  kind: ActivationKind
  /** Stock: turns of play until the team holds enough at even odds (null: not within STOCK_MAX_TURNS or never). */
  turns: number | null
  /** Resonance: average chance per turn over the first RESONANCE_TURNS turns. Stock: chance at the turn reported. */
  chance: number
}

/** Most dashboard columns a fight can have. */
export const MAX_SLOTS = 12
export const STOCK_MAX_TURNS = 10
export const RESONANCE_TURNS = 6
/** Stock: at most this many turns is easy / medium. Resonance: at least this chance is easy / medium. */
const STOCK_EASY_TURNS = 2
const STOCK_MEDIUM_TURNS = 4
const RESONANCE_EASY_CHANCE = 0.6
const RESONANCE_MEDIUM_CHANCE = 0.25

/** Listing order: the hardest first. */
export const ACTIVATION_ORDER: Record<ActivationLevel, number> = { impossible: 0, hard: 1, medium: 2, easy: 3 }

/** Per-slot chance of each required sin (the rest of the deck makes some other sin). */
type Slot = number[]

/**
 * Slots of a turn: a fight starts with one column per fielded identity and one more column a turn (random identity), up to 12.
 * Every identity has floor(S/n) of them; the S mod n others belong to a random identity, drawn as the team's average slot.
 */
export function slotsAtTurn(decks: Slot[], turn: number): Slot[] {
  const n = decks.length
  const total = Math.min(MAX_SLOTS, n + turn - 1)
  const each = Math.floor(total / n)
  const extra = total - each * n
  const average = decks[0].map((_, j) => decks.reduce((sum, deck) => sum + deck[j], 0) / n)
  return [...decks.flatMap(deck => Array.from({ length: each }, () => deck)), ...Array.from({ length: extra }, () => average)]
}

/** Distribution of the capped per-sin counts after the given slots: index = mixed radix of the counts (capped at each requirement). */
export function emptyState(caps: number[]): Float64Array {
  const states = new Float64Array(caps.reduce((size, cap) => size * (cap + 1), 1))
  states[0] = 1
  return states
}

export function addSlot(states: Float64Array, caps: number[], slot: Slot): Float64Array {
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

export const reached = (states: Float64Array) => states[states.length - 1]

/**
 * The per-sin caps (the highest count any requirement asks) and each identity's chance per card of making each required sin;
 * null when no fielded identity makes one of the required sins at all. Shared with the recommender (`features/community/lib/passive-fit.ts`).
 */
export function prepareActivation(requirements: readonly ActivationRequirement[], team: readonly SinWeights[]): { caps: number[]; decks: Slot[] } | null {
  const needs = new Map<SinType, number>()
  for (const { sin, count } of requirements) needs.set(sin, Math.max(needs.get(sin) ?? 0, count))
  const sins = [...needs.keys()]
  const caps = sins.map(sin => needs.get(sin)!)
  const decks: Slot[] = team.map(weights => {
    const total = Object.values(weights).reduce<number>((sum, value) => sum + (value ?? 0), 0)
    return sins.map(sin => (total > 0 ? (weights[sin] ?? 0) / total : 0))
  })
  if (sins.some((_, j) => decks.every(deck => deck[j] === 0))) return null
  return { caps, decks }
}

/**
 * How easily a passive's condition comes true for the fielded team, from the sin of each skill-deck card (see the change's
 * design.md for the rules and sources). `team` is the decks of the identities in battle; null when there is nothing to rate.
 * - stock: sin resources are never spent; turns until the team holds every required count at even odds.
 * - resonance: chance in a turn that enough skills of the sin are on the dashboard (order is the player's to arrange),
 *   averaged over the first turns.
 */
export function ratePassiveActivation(kind: ActivationKind, requirements: readonly ActivationRequirement[], team: readonly SinWeights[]): PassiveActivation | null {
  if (team.length === 0 || requirements.length === 0) return null
  const prepared = prepareActivation(requirements, team)
  if (!prepared) return { level: 'impossible', kind, turns: null, chance: 0 }
  const { caps, decks } = prepared

  if (kind === 'stock') {
    let states = emptyState(caps)
    let chance = 0
    for (let turn = 1; turn <= STOCK_MAX_TURNS; turn++) {
      for (const slot of slotsAtTurn(decks, turn)) states = addSlot(states, caps, slot)
      chance = reached(states)
      if (chance >= 0.5 - 1e-12) {
        return { level: turn <= STOCK_EASY_TURNS ? 'easy' : turn <= STOCK_MEDIUM_TURNS ? 'medium' : 'hard', kind, turns: turn, chance }
      }
    }
    return { level: 'hard', kind, turns: null, chance }
  }

  let sum = 0
  for (let turn = 1; turn <= RESONANCE_TURNS; turn++) {
    let states = emptyState(caps)
    for (const slot of slotsAtTurn(decks, turn)) states = addSlot(states, caps, slot)
    sum += reached(states)
  }
  const chance = sum / RESONANCE_TURNS
  return { level: chance >= RESONANCE_EASY_CHANCE ? 'easy' : chance >= RESONANCE_MEDIUM_CHANCE ? 'medium' : 'hard', kind, turns: null, chance }
}

/**
 * A battle passive acts while its identity is fielded, a support passive while it is benched; both draw on the fielded team's
 * skills and resources. Passives without a stock or resonance condition have nothing to rate.
 */
export function rateIdentityPassive(
  passive: { passive_type: string; active_cond: string | null },
  requirements: readonly ActivationRequirement[],
  fielded: boolean,
  team: readonly SinWeights[],
): PassiveActivation | null {
  if (passive.active_cond !== 'stock' && passive.active_cond !== 'resonance') return null
  if (passive.passive_type !== (fielded ? 'battle' : 'support')) return null
  return ratePassiveActivation(passive.active_cond, requirements, team)
}
