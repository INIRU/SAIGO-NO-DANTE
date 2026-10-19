import type { EGO, Identity, Sinner } from '@/lib/types'
import {
  generateRandom, identityPool, rerollIdentity,
  type DeployRange, type KeywordCondition, type LockedSlot, type RandomResult,
} from './engine'
import { rngFromSeed } from './seed'

export type RollData = { sinners: Sinner[]; identities: Identity[]; egos: EGO[] }

/** What a roll is drawn from (everything the user set before pressing roll). */
export type RollSettings = {
  identityEnabled: boolean
  egoEnabled: boolean
  keywords: KeywordCondition[]
  /** Allowed rarities (sorted); null = all. */
  rarity: number[] | null
  /** Formation order range; null = no order. */
  deploy: DeployRange | null
}

/** A locked slot as references (game ids), so it can be written into a link. */
export type LockRef = { sinnerId: string; identityRef: string | null; egoRefs: string[]; number: number | null }

/**
 * Everything needed to draw the same result again: the seed, the settings, the slots that were locked when it was drawn
 * (their picks are written in, because they come from an earlier roll) and how often each sinner was rerolled since.
 */
export type RollSnapshot = {
  seed: string
  settings: RollSettings
  locks: LockRef[]
  rerolls: Record<string, number>
  /** Sinners marked as locked right now; they are kept by the next roll. Not part of what the result depends on. */
  marks: string[]
  /** The collection code that made the owned-only pool, if one was used. */
  collectionCode: string | null
}

type Sourced = { id: string; game_id?: string | null }

/** How a link names an identity or E.G.O: its game id, or its id when it has none. */
export const refOf = (item: Sourced): string => item.game_id || item.id

function lockedSlots(data: RollData, locks: LockRef[]): Record<string, LockedSlot> {
  const slots: Record<string, LockedSlot> = {}
  for (const lock of locks) {
    const identity = lock.identityRef ? data.identities.find(i => i.sinner_id === lock.sinnerId && refOf(i) === lock.identityRef) ?? null : null
    const egos = lock.egoRefs.flatMap(ref => data.egos.find(e => e.sinner_id === lock.sinnerId && refOf(e) === ref) ?? [])
    // A pick that is no longer in the data cannot be kept.
    if (identity || egos.length > 0) slots[lock.sinnerId] = { identity, egos, number: lock.number }
  }
  return slots
}

function rarityFilter(settings: RollSettings) {
  return settings.rarity ? new Set(settings.rarity) : null
}

function reroll(data: RollData, snapshot: RollSnapshot, ownedIds: Set<string> | null, result: RandomResult, sinnerId: string, count: number): RandomResult | null {
  const pool = identityPool(data.identities, sinnerId, ownedIds, rarityFilter(snapshot.settings))
  const next = rerollIdentity(pool, result.identities[sinnerId], rngFromSeed(snapshot.seed, 'reroll', sinnerId, count))
  return next ? { ...result, identities: { ...result.identities, [sinnerId]: next } } : null
}

/** The result a snapshot stands for: the seeded roll with its locks, then each counted reroll in turn. */
export function resolveSnapshot(data: RollData, snapshot: RollSnapshot, ownedIds: Set<string> | null): RandomResult {
  const { settings } = snapshot
  let result = generateRandom(data.sinners, data.identities, data.egos, {
    identityEnabled: settings.identityEnabled,
    egoEnabled: settings.egoEnabled,
    keywords: settings.identityEnabled ? settings.keywords : [],
    ownedIds,
    rarityFilter: rarityFilter(settings),
    deploy: settings.deploy,
    locks: lockedSlots(data, snapshot.locks),
  }, rngFromSeed(snapshot.seed))
  for (const sinner of data.sinners) {
    for (let count = 1; count <= (snapshot.rerolls[sinner.id] ?? 0); count++) {
      const next = reroll(data, snapshot, ownedIds, result, sinner.id, count)
      if (!next) break
      result = next
    }
  }
  return result
}

/** The locked slots of the marked sinners as they are in `result`, in sinner order. */
export function lockRefsFromResult(result: RandomResult, marks: Iterable<string>, sinners: { id: string }[]): LockRef[] {
  const wanted = new Set(marks)
  return sinners.filter(sinner => wanted.has(sinner.id)).flatMap((sinner): LockRef[] => {
    const identity = result.identities[sinner.id] ?? null
    const egos = result.egos[sinner.id] ?? []
    if (!identity && egos.length === 0) return []
    const index = result.order ? result.order.indexOf(sinner.id) : -1
    return [{ sinnerId: sinner.id, identityRef: identity ? refOf(identity) : null, egoRefs: egos.map(refOf), number: index >= 0 ? index + 1 : null }]
  })
}

/** A new roll: the marked sinners of `previous` stay as they are, the others are drawn from the seed. */
export function newRoll(
  data: RollData,
  input: { seed: string; settings: RollSettings; marks: string[]; collectionCode: string | null; previous: RandomResult | null },
  ownedIds: Set<string> | null,
): { snapshot: RollSnapshot; result: RandomResult } {
  const snapshot: RollSnapshot = {
    seed: input.seed,
    settings: input.settings,
    locks: input.previous ? lockRefsFromResult(input.previous, input.marks, data.sinners) : [],
    rerolls: {},
    marks: [...input.marks],
    collectionCode: input.collectionCode,
  }
  return { snapshot, result: resolveSnapshot(data, snapshot, ownedIds) }
}

/** One more reroll of a sinner's identity, counted in the snapshot so a link can replay it. Null when the pool has no other entry. */
export function rerollSinner(data: RollData, snapshot: RollSnapshot, ownedIds: Set<string> | null, result: RandomResult, sinnerId: string): { snapshot: RollSnapshot; result: RandomResult } | null {
  const count = (snapshot.rerolls[sinnerId] ?? 0) + 1
  const next = reroll(data, snapshot, ownedIds, result, sinnerId, count)
  return next ? { snapshot: { ...snapshot, rerolls: { ...snapshot.rerolls, [sinnerId]: count } }, result: next } : null
}
