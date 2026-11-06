import type { RandomResult } from './engine'
import { refOf, type RollSnapshot } from './roll'
import { encodeSnapshot } from './share'
import { isSeed } from './seed'

export const RECENT_LIMIT = 10
const STORAGE_KEY = 'random_recent_rolls'
const MAX_QUERY_LENGTH = 4000

/** A past roll in this browser: its link query to restore it, and twelve portraits (sinner order) with their formation numbers for the thumbnail. */
export type RecentRoll = { seed: string; q: string; at: number; ids: string[]; nums: number[] }

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStorage(): KeyValueStorage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

/** Newest first, at most `limit`; an entry with the same seed is replaced. */
export function pushRecent(list: RecentRoll[], entry: RecentRoll, limit = RECENT_LIMIT): RecentRoll[] {
  return [entry, ...list.filter(item => item.seed !== entry.seed)].slice(0, limit)
}

const isEntry = (value: unknown): value is RecentRoll => {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return isSeed(entry.seed) && typeof entry.q === 'string' && entry.q.length <= MAX_QUERY_LENGTH && typeof entry.at === 'number' && Number.isFinite(entry.at)
    && Array.isArray(entry.ids) && entry.ids.length <= 12 && entry.ids.every(id => typeof id === 'string')
    && Array.isArray(entry.nums) && entry.nums.length <= 12 && entry.nums.every(n => typeof n === 'number')
}

/** The stored list; anything broken reads as an empty one. */
export function parseRecent(raw: string | null): RecentRoll[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry).reduce<RecentRoll[]>((list, entry) => list.some(item => item.seed === entry.seed) ? list : [...list, entry], []).slice(0, RECENT_LIMIT)
  } catch { return [] }
}

export function readRecent(storage: KeyValueStorage | null = browserStorage()): RecentRoll[] {
  try { return parseRecent(storage?.getItem(STORAGE_KEY) ?? null) } catch { return [] }
}

/** False when the browser refused to store it. */
export function writeRecent(list: RecentRoll[], storage: KeyValueStorage | null = browserStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, RECENT_LIMIT)))
    return true
  } catch { return false }
}

export function clearRecent(storage: KeyValueStorage | null = browserStorage()): void {
  try { storage?.removeItem(STORAGE_KEY) } catch { /* storage blocked: nothing was kept anyway */ }
}

/** A roll as a history entry. */
export function recentFromRoll(snapshot: RollSnapshot, result: RandomResult, sinners: { id: string }[], now: number): RecentRoll {
  return {
    seed: snapshot.seed,
    q: encodeSnapshot(snapshot),
    at: now,
    ids: sinners.map(sinner => result.identities[sinner.id] ? refOf(result.identities[sinner.id]!) : ''),
    nums: sinners.map(sinner => (result.order ? result.order.indexOf(sinner.id) + 1 : 0)),
  }
}
