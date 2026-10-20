import { getAvailableThemes } from '@/lib/planner/fusion'
import { DIFFICULTY_FLOOR_KEY, type Difficulty } from '@/lib/planner/types'
import type { EvalFormation, Snapshot } from './load-snapshot'

/** formation: leave one formation out. author: leave out every formation of its author (a new user's view; near-copies do not count). */
export type Split = 'formation' | 'author'
/**
 * How much of the rest of the formation is known: full = every other member; half = a deterministic half (a user midway);
 * three / one / zero = the first picks (zero: an empty board), where suggestions matter most.
 */
export type Regime = 'full' | 'half' | 'three' | 'one' | 'zero'
const contextSize = (regime: Regime, others: number) => regime === 'zero' ? 0 : regime === 'full' ? others : regime === 'half' ? Math.max(1, Math.ceil(others / 2)) : Math.min(others, regime === 'three' ? 3 : 1)

export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function trainFor(formations: readonly EvalFormation[], split: Split) {
  const cache = new Map<string, EvalFormation[]>()
  return (f: EvalFormation) => {
    // One array per author (or per formation), so a model built from it can be cached by the array itself.
    const key = split === 'author' ? f.author : f.key
    let train = cache.get(key)
    if (!train) { train = formations.filter(g => (split === 'author' ? g.author !== f.author : g !== f)); cache.set(key, train) }
    return train
  }
}

const DAY = 86_400_000
const releasedBy = (date: string | null, now: number) => !date || Date.parse(date) <= now + DAY

export type IdentityQuery = { f: EvalFormation; held: string; sinner: string; context: string[]; candidates: string[]; now: number; mainKeywords: string[]; train: EvalFormation[] }

/** Hide each fielded identity once; rank that sinner's identities (released by then, not already fielded) given the rest. */
export function identityQueries(snapshot: Snapshot, split: Split, regime: Regime): IdentityQuery[] {
  const train = trainFor(snapshot.formations, split)
  const sinnerOf = new Map(snapshot.catalog.identities.map(i => [i.id, i.sinner_id]))
  const out: IdentityQuery[] = []
  for (const f of snapshot.formations) {
    if (f.identities.length < (regime === 'zero' ? 1 : 2)) continue
    for (const held of f.identities) {
      let context = f.identities.filter(id => id !== held)
      if (regime !== 'full') context = [...context].sort((a, b) => hash(`${f.key}:${held}:${a}`) - hash(`${f.key}:${held}:${b}`)).slice(0, contextSize(regime, context.length))
      const sinner = sinnerOf.get(held)!
      const candidates = snapshot.catalog.identities
        .filter(i => i.sinner_id === sinner && i.rarity > 1 && !context.includes(i.id) && (i.id === held || releasedBy(i.release_date, f.createdAt)))
        .map(i => i.id)
      out.push({ f, held, sinner, context, candidates, now: f.createdAt, mainKeywords: f.mainKeywords, train: train(f) })
    }
  }
  return out
}

export type EgoQuery = { f: EvalFormation; held: string; sinner: string; identity: string; team: string[]; otherEgos: string[]; candidates: string[]; now: number; train: EvalFormation[] }

/** Hide each non-ZAYIN E.G.O (ZAYIN is the free default) of a sinner whose identity is fielded; rank that sinner's E.G.O whose grade slot is open. */
export function egoQueries(snapshot: Snapshot, split: Split): EgoQuery[] {
  const train = trainFor(snapshot.formations, split)
  const egoById = new Map(snapshot.catalog.egos.map(e => [e.id, e]))
  const sinnerOf = new Map(snapshot.catalog.identities.map(i => [i.id, i.sinner_id]))
  const out: EgoQuery[] = []
  for (const f of snapshot.formations) {
    const identityOfSinner = new Map(f.identities.map(id => [sinnerOf.get(id)!, id]))
    for (const ego of f.egos) {
      const meta = egoById.get(ego.ego_id)
      if (!meta || meta.grade === 'ZAYIN' || !identityOfSinner.has(meta.sinner_id)) continue
      const others = f.egos.filter(e => e.ego_id !== ego.ego_id)
      const filledGrades = new Set(others.filter(e => e.sinner_id === meta.sinner_id).map(e => e.grade))
      const candidates = snapshot.catalog.egos
        .filter(e => e.sinner_id === meta.sinner_id && e.grade !== 'ZAYIN' && !filledGrades.has(e.grade) && (e.id === ego.ego_id || releasedBy(e.release_date, f.createdAt)))
        .map(e => e.id)
      out.push({ f, held: ego.ego_id, sinner: meta.sinner_id, identity: identityOfSinner.get(meta.sinner_id)!, team: f.identities, otherEgos: others.map(e => e.ego_id), candidates, now: f.createdAt, train: train(f) })
    }
  }
  return out
}

export type FloorQuery = {
  f: EvalFormation; floor: number; difficulty: string; held: string; candidates: string[]
  /** Packs taken on the plan's other floors, and the gifts it already took elsewhere. */
  usedThemes: string[]; takenGifts: string[]
  /** The floor's pack (gift queries only). */
  theme: string | null
  now: number; train: EvalFormation[]
}

/** Hide one floor's pack; rank the packs that floor can offer (its difficulty, not used on another floor). */
export function themeQueries(snapshot: Snapshot, split: Split): FloorQuery[] {
  const train = trainFor(snapshot.formations, split)
  const out: FloorQuery[] = []
  for (const f of snapshot.formations) {
    for (const entry of f.floors) {
      if (!entry.theme) continue
      const used = f.floors.filter(other => other.floor !== entry.floor && other.theme).map(other => other.theme!)
      const key = DIFFICULTY_FLOOR_KEY[(entry.difficulty as Difficulty) in DIFFICULTY_FLOOR_KEY ? entry.difficulty as Difficulty : 'hard']
      const available = getAvailableThemes(snapshot.catalog.themes, key, entry.floor)
        .map(theme => String(theme.id)).filter(id => !used.includes(id))
      const candidates = available.includes(entry.theme) ? available : [...available, entry.theme]
      out.push({ f, floor: entry.floor, difficulty: entry.difficulty, held: entry.theme, candidates, usedThemes: used, takenGifts: [], theme: entry.theme, now: f.createdAt, train: train(f) })
    }
  }
  return out
}

/** Hide one gift of a floor; rank the gifts its pack offers that the plan has not taken elsewhere. */
export function giftQueries(snapshot: Snapshot, split: Split): FloorQuery[] {
  const train = trainFor(snapshot.formations, split)
  const themeById = new Map(snapshot.catalog.themes.map(theme => [String(theme.id), theme]))
  const out: FloorQuery[] = []
  for (const f of snapshot.formations) {
    for (const entry of f.floors) {
      const pack = entry.theme ? themeById.get(entry.theme) : undefined
      if (!pack) continue
      const pool = new Set([...(pack.ego_gift_ids ?? []), ...(pack.specific_ego_gift_ids ?? [])].map(String))
      for (const held of entry.gifts) {
        if (!pool.has(held)) continue
        const taken = new Set([...f.floors.filter(other => other.floor !== entry.floor).flatMap(other => other.gifts), ...entry.gifts.filter(gift => gift !== held)])
        const candidates = [...pool].filter(gift => gift === held || !taken.has(gift))
        out.push({ f, floor: entry.floor, difficulty: entry.difficulty, held, candidates, usedThemes: [], takenGifts: [...taken], theme: entry.theme, now: f.createdAt, train: train(f) })
      }
    }
  }
  return out
}

/**
 * Picks in sequence: for one slot of a real formation, the context grows one identity at a time (a deterministic order of
 * the others). Consecutive steps are compared by `evaluate.ts` to see whether one more pick shifts the list or flips it.
 */
export function stabilityQueries(snapshot: Snapshot, split: Split): IdentityQuery[][] {
  const train = trainFor(snapshot.formations, split)
  const sinnerOf = new Map(snapshot.catalog.identities.map(i => [i.id, i.sinner_id]))
  const out: IdentityQuery[][] = []
  for (const f of snapshot.formations) {
    if (f.identities.length < 4) continue
    for (const held of f.identities) {
      const others = f.identities.filter(id => id !== held).sort((a, b) => hash(`${f.key}:${held}:${a}`) - hash(`${f.key}:${held}:${b}`))
      const sinner = sinnerOf.get(held)!
      const candidates = snapshot.catalog.identities
        .filter(i => i.sinner_id === sinner && i.rarity > 1 && !others.includes(i.id) && (i.id === held || releasedBy(i.release_date, f.createdAt)))
        .map(i => i.id)
      // From two identities up: a first pick has nothing to be stable against.
      out.push(Array.from({ length: others.length - 1 }, (_, step) => ({ f, held, sinner, context: others.slice(0, step + 2), candidates, now: f.createdAt, mainKeywords: f.mainKeywords, train: train(f) })))
    }
  }
  return out
}
