import type { Identity, EGO, Sinner } from '@/lib/types'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import type { Rng } from './seed'

export type KeywordCondition = {
  keyword: string
  minCount: number
}

/** How many sinners get a formation number: any N from min to max, both 1..12. */
export type DeployRange = { min: number; max: number }

/** A slot the user locked: what it held, and its formation number (null = not in the formation). */
export type LockedSlot = {
  identity: Identity | null
  egos: EGO[]
  number: number | null
}

export type RandomOptions = {
  identityEnabled: boolean
  egoEnabled: boolean
  keywords: KeywordCondition[]
  ownedIds: Set<string> | null  // null = use all
  rarityFilter: Set<number> | null  // null = all rarities, e.g. {2, 3} = 2성+3성 only
  /** Also roll a formation order of N sinners (N inside the range). Missing/null = no order. */
  deploy?: DeployRange | null
  /** Locked slots by sinner id: kept as they are while the other slots are drawn. */
  locks?: Record<string, LockedSlot>
}

export type RandomResult = {
  identities: Record<string, Identity | null>  // sinnerId → identity
  egos: Record<string, EGO[]>                  // sinnerId → ego list (one per grade)
  /** Sinner ids by formation number (index 0 = number 1); only the sinners that are in the formation. Null = no order rolled. */
  order: string[] | null
}

export const MAX_DEPLOY = 12

export function normalizeDeployRange(range: DeployRange): DeployRange {
  const clamp = (value: number, fallback: number) => Number.isFinite(value) ? Math.min(MAX_DEPLOY, Math.max(1, Math.round(value))) : fallback
  const min = clamp(range.min, 1)
  return { min, max: Math.max(min, clamp(range.max, MAX_DEPLOY)) }
}

/**
 * Validate whether keyword conditions can be satisfied.
 * Keywords use AND logic: identities must have ALL selected keywords.
 * Returns null if valid, or an error message string if not.
 */
export function validateConditions(
  sinners: Sinner[],
  identitiesBySinner: Record<string, Identity[]>,
  conditions: KeywordCondition[],
): string | null {
  if (conditions.length === 0) return null

  const allKeywords = conditions.map(c => c.keyword)
  const maxMinCount = Math.max(...conditions.map(c => c.minCount))

  const matchesAll = (identity: Identity) =>
    allKeywords.every(kw => identity.keywords?.some(ik => normalizeThemeKeyword(ik) === kw) ?? false)

  let count = 0
  for (const sinner of sinners) {
    const ids = identitiesBySinner[sinner.id] ?? []
    if (ids.some(matchesAll)) count++
  }

  if (count < maxMinCount) {
    const kwLabel = allKeywords.join('+')
    return `보유 인격으로는 ${kwLabel} ${maxMinCount}명 조건을 만족할 수 없습니다`
  }
  return null
}

/** The identities a sinner can draw: owned (when a collection is linked) and inside the rarity filter. */
export function identityPool(allIdentities: Identity[], sinnerId: string, ownedIds: Set<string> | null, rarityFilter: Set<number> | null): Identity[] {
  return allIdentities.filter(i => i.sinner_id === sinnerId
    && (ownedIds === null || ownedIds.has(i.id))
    && (rarityFilter === null || rarityFilter.has(i.rarity)))
}

const pick = <T>(list: T[], rng: Rng): T => list[Math.floor(rng() * list.length)]

/** Another entry of the pool than `current`; null when there is none. */
export function rerollIdentity(pool: Identity[], current: Identity | null | undefined, rng: Rng): Identity | null {
  const others = pool.filter(i => i.id !== current?.id)
  return others.length > 0 ? pick(others, rng) : null
}

/**
 * Generate a random deck given constraints. `rng` is Math.random unless a seeded source is given; the same source and
 * options always give the same result.
 */
export function generateRandom(
  sinners: Sinner[],
  allIdentities: Identity[],
  allEgos: EGO[],
  options: RandomOptions,
  rng: Rng = Math.random,
): RandomResult {
  const result: RandomResult = { identities: {}, egos: {}, order: null }
  const locks = options.locks ?? {}

  const idsBySinner: Record<string, Identity[]> = {}
  const egosBySinner: Record<string, EGO[]> = {}
  for (const sinner of sinners) {
    idsBySinner[sinner.id] = identityPool(allIdentities, sinner.id, options.ownedIds, options.rarityFilter)
    egosBySinner[sinner.id] = allEgos
      .filter(e => e.sinner_id === sinner.id && (options.ownedIds === null || options.ownedIds.has(e.id)))
  }

  if (options.identityEnabled) {
    const fixed: Record<string, Identity> = {}
    for (const sinner of sinners) {
      const identity = locks[sinner.id]?.identity
      if (identity) fixed[sinner.id] = identity
    }
    if (options.keywords.length === 0) {
      for (const sinner of sinners) {
        const pool = idsBySinner[sinner.id]
        result.identities[sinner.id] = fixed[sinner.id] ?? (pool.length > 0 ? pick(pool, rng) : null)
      }
    } else {
      const assigned = keywordAwareAssign(sinners, idsBySinner, options.keywords, fixed, rng)
      for (const sinner of sinners) {
        result.identities[sinner.id] = assigned[sinner.id] ?? null
      }
    }
  }

  if (options.egoEnabled) {
    for (const sinner of sinners) {
      const lockedEgos = locks[sinner.id]?.egos
      if (lockedEgos?.length) { result.egos[sinner.id] = lockedEgos; continue }

      const pool = egosBySinner[sinner.id]
      const byGrade: Record<string, EGO[]> = {}
      for (const ego of pool) {
        if (!byGrade[ego.grade]) byGrade[ego.grade] = []
        byGrade[ego.grade].push(ego)
      }

      const picked: EGO[] = []

      // ZAYIN: always pick one
      if (byGrade['ZAYIN']?.length) {
        picked.push(pick(byGrade['ZAYIN'], rng))
      }

      // Other grades: 50% chance to include
      for (const grade of ['TETH', 'HE', 'WAW', 'ALEPH']) {
        if (byGrade[grade]?.length && rng() < 0.5) {
          picked.push(pick(byGrade[grade], rng))
        }
      }

      result.egos[sinner.id] = picked
    }
  }

  // Only a sinner who has an identity can be in the formation.
  if (options.deploy && options.identityEnabled) {
    const eligible = sinners.filter(s => result.identities[s.id]).map(s => s.id)
    result.order = assignOrder(eligible, locks, normalizeDeployRange(options.deploy), rng)
  }

  return result
}

/**
 * Formation numbers: N sinners (N inside the range, as many as the locks allow) get 1..N in random order, the rest get
 * none. A locked sinner keeps its number; a locked sinner without one stays out. The list has no gaps.
 */
function assignOrder(eligible: string[], locks: Record<string, LockedSlot>, range: DeployRange, rng: Rng): string[] {
  const total = eligible.length
  if (total === 0) return []

  const held = new Map<number, string>()
  const keptOut: string[] = []
  for (const id of eligible) {
    const lock = locks[id]
    if (!lock) continue
    const number = lock.number
    if (number && number >= 1 && number <= total && !held.has(number)) held.set(number, id)
    else keptOut.push(id)
  }

  const feasibleMin = Math.max(1, ...held.keys())
  const feasibleMax = Math.max(feasibleMin, total - keptOut.length)
  const low = Math.max(range.min, feasibleMin)
  const high = Math.min(range.max, feasibleMax)
  const roll = rng()
  const count = low <= high ? low + Math.floor(roll * (high - low + 1)) : Math.min(Math.max(range.min, feasibleMin), feasibleMax)

  const slots: (string | null)[] = Array.from({ length: count }, (_, i) => held.get(i + 1) ?? null)
  const free = shuffle(eligible.filter(id => !locks[id]), rng)
  for (let i = 0; i < slots.length && free.length > 0; i++) {
    if (slots[i] === null) slots[i] = free.shift()!
  }
  return slots.filter((id): id is string => id !== null)
}

/**
 * AND-based keyword assignment.
 * Selected identities must have ALL keywords. Locked identities (`fixed`) stay and count toward the minimum.
 */
function keywordAwareAssign(
  sinners: Sinner[],
  idsBySinner: Record<string, Identity[]>,
  conditions: KeywordCondition[],
  fixed: Record<string, Identity>,
  rng: Rng,
): Record<string, Identity | null> {
  const result: Record<string, Identity | null> = {}
  const usedSinners = new Set<string>()

  const allKeywords = conditions.map(c => c.keyword)
  const maxMinCount = Math.max(...conditions.map(c => c.minCount))

  const matchesAll = (identity: Identity) =>
    allKeywords.every(kw => identity.keywords?.some(ik => normalizeThemeKeyword(ik) === kw) ?? false)

  let satisfied = 0
  for (const s of sinners) {
    const identity = fixed[s.id]
    if (!identity) continue
    result[s.id] = identity
    usedSinners.add(s.id)
    if (matchesAll(identity)) satisfied++
  }

  // Find the free sinners that have at least one identity with ALL keywords
  const canProvide = sinners.filter(s =>
    !usedSinners.has(s.id) && (idsBySinner[s.id] ?? []).some(matchesAll)
  )

  const shuffled = shuffle(canProvide, rng)
  const needed = Math.max(0, maxMinCount - satisfied)
  for (let i = 0; i < Math.min(needed, shuffled.length); i++) {
    const s = shuffled[i]
    const pool = (idsBySinner[s.id] ?? []).filter(matchesAll)
    result[s.id] = pick(pool, rng)
    usedSinners.add(s.id)
  }

  // Fill remaining sinners with random identities
  for (const s of sinners) {
    if (usedSinners.has(s.id)) continue
    const pool = idsBySinner[s.id] ?? []
    result[s.id] = pool.length > 0 ? pick(pool, rng) : null
  }

  return result
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
