import type { Identity, EGO, Sinner } from '@/lib/types'

export type KeywordCondition = {
  keyword: string
  minCount: number
}

export type RandomOptions = {
  identityEnabled: boolean
  egoEnabled: boolean
  keywords: KeywordCondition[]
  ownedIds: Set<string> | null  // null = use all
}

export type RandomResult = {
  identities: Record<string, Identity | null>  // sinnerId → identity
  egos: Record<string, EGO | null>             // sinnerId → ego
}

/**
 * Validate whether keyword conditions can be satisfied.
 * Returns null if valid, or an error message string if not.
 */
export function validateConditions(
  sinners: Sinner[],
  identitiesBySinner: Record<string, Identity[]>,
  conditions: KeywordCondition[],
): string | null {
  if (conditions.length === 0) return null

  if (conditions.length === 1) {
    const { keyword, minCount } = conditions[0]
    let count = 0
    for (const sinner of sinners) {
      const ids = identitiesBySinner[sinner.id] ?? []
      if (ids.some(i => i.keywords?.includes(keyword))) count++
    }
    if (count < minCount) return `보유 인격으로는 ${keyword} ${minCount}명 조건을 만족할 수 없습니다`
    return null
  }

  // 2 keywords: partition-based validation
  const [condA, condB] = conditions
  let onlyA = 0, onlyB = 0, bothAB = 0
  for (const sinner of sinners) {
    const ids = identitiesBySinner[sinner.id] ?? []
    const hasA = ids.some(i => i.keywords?.includes(condA.keyword))
    const hasB = ids.some(i => i.keywords?.includes(condB.keyword))
    if (hasA && hasB) bothAB++
    else if (hasA) onlyA++
    else if (hasB) onlyB++
  }
  const shortfallA = Math.max(0, condA.minCount - onlyA)
  const shortfallB = Math.max(0, condB.minCount - onlyB)
  if (shortfallA + shortfallB > bothAB) {
    return `보유 인격으로는 조건을 만족할 수 없습니다`
  }
  return null
}

/**
 * Generate a random deck given constraints.
 */
export function generateRandom(
  sinners: Sinner[],
  allIdentities: Identity[],
  allEgos: EGO[],
  options: RandomOptions,
): RandomResult {
  const result: RandomResult = { identities: {}, egos: {} }

  const idsBySinner: Record<string, Identity[]> = {}
  const egosBySinner: Record<string, EGO[]> = {}
  for (const sinner of sinners) {
    idsBySinner[sinner.id] = allIdentities
      .filter(i => i.sinner_id === sinner.id && (options.ownedIds === null || options.ownedIds.has(i.id)))
    egosBySinner[sinner.id] = allEgos
      .filter(e => e.sinner_id === sinner.id && (options.ownedIds === null || options.ownedIds.has(e.id)))
  }

  if (options.identityEnabled) {
    if (options.keywords.length === 0) {
      for (const sinner of sinners) {
        const pool = idsBySinner[sinner.id]
        result.identities[sinner.id] = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
      }
    } else {
      const assigned = keywordAwareAssign(sinners, idsBySinner, options.keywords)
      for (const sinner of sinners) {
        result.identities[sinner.id] = assigned[sinner.id] ?? null
      }
    }
  }

  if (options.egoEnabled) {
    for (const sinner of sinners) {
      const pool = egosBySinner[sinner.id]
      result.egos[sinner.id] = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
    }
  }

  return result
}

function keywordAwareAssign(
  sinners: Sinner[],
  idsBySinner: Record<string, Identity[]>,
  conditions: KeywordCondition[],
): Record<string, Identity | null> {
  const result: Record<string, Identity | null> = {}
  const usedSinners = new Set<string>()

  if (conditions.length === 1) {
    const { keyword, minCount } = conditions[0]
    const canProvide = sinners.filter(s =>
      (idsBySinner[s.id] ?? []).some(i => i.keywords?.includes(keyword))
    )
    const shuffled = shuffle(canProvide)
    for (let i = 0; i < Math.min(minCount, shuffled.length); i++) {
      const s = shuffled[i]
      const pool = (idsBySinner[s.id] ?? []).filter(id => id.keywords?.includes(keyword))
      result[s.id] = pool[Math.floor(Math.random() * pool.length)]
      usedSinners.add(s.id)
    }
  } else if (conditions.length === 2) {
    const [condA, condB] = conditions
    const onlyA: Sinner[] = [], onlyB: Sinner[] = [], bothAB: Sinner[] = []
    for (const s of sinners) {
      const ids = idsBySinner[s.id] ?? []
      const hasA = ids.some(i => i.keywords?.includes(condA.keyword))
      const hasB = ids.some(i => i.keywords?.includes(condB.keyword))
      if (hasA && hasB) bothAB.push(s)
      else if (hasA) onlyA.push(s)
      else if (hasB) onlyB.push(s)
    }

    let needA = condA.minCount, needB = condB.minCount
    for (const s of shuffle(onlyA)) {
      if (needA <= 0) break
      const pool = (idsBySinner[s.id] ?? []).filter(i => i.keywords?.includes(condA.keyword))
      result[s.id] = pool[Math.floor(Math.random() * pool.length)]
      usedSinners.add(s.id)
      needA--
    }
    for (const s of shuffle(onlyB)) {
      if (needB <= 0) break
      const pool = (idsBySinner[s.id] ?? []).filter(i => i.keywords?.includes(condB.keyword))
      result[s.id] = pool[Math.floor(Math.random() * pool.length)]
      usedSinners.add(s.id)
      needB--
    }
    for (const s of shuffle(bothAB)) {
      if (needA <= 0 && needB <= 0) break
      if (usedSinners.has(s.id)) continue
      if (needA > 0) {
        const pool = (idsBySinner[s.id] ?? []).filter(i => i.keywords?.includes(condA.keyword))
        result[s.id] = pool[Math.floor(Math.random() * pool.length)]
        usedSinners.add(s.id)
        needA--
      } else if (needB > 0) {
        const pool = (idsBySinner[s.id] ?? []).filter(i => i.keywords?.includes(condB.keyword))
        result[s.id] = pool[Math.floor(Math.random() * pool.length)]
        usedSinners.add(s.id)
        needB--
      }
    }
  }

  for (const s of sinners) {
    if (usedSinners.has(s.id)) continue
    const pool = idsBySinner[s.id] ?? []
    result[s.id] = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
  }

  return result
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
