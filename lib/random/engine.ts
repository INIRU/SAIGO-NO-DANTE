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
    allKeywords.every(kw => identity.keywords?.includes(kw))

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

/**
 * AND-based keyword assignment.
 * Selected identities must have ALL keywords.
 */
function keywordAwareAssign(
  sinners: Sinner[],
  idsBySinner: Record<string, Identity[]>,
  conditions: KeywordCondition[],
): Record<string, Identity | null> {
  const result: Record<string, Identity | null> = {}
  const usedSinners = new Set<string>()

  const allKeywords = conditions.map(c => c.keyword)
  const maxMinCount = Math.max(...conditions.map(c => c.minCount))

  const matchesAll = (identity: Identity) =>
    allKeywords.every(kw => identity.keywords?.includes(kw))

  // Find sinners that have at least one identity with ALL keywords
  const canProvide = sinners.filter(s =>
    (idsBySinner[s.id] ?? []).some(matchesAll)
  )

  const shuffled = shuffle(canProvide)
  for (let i = 0; i < Math.min(maxMinCount, shuffled.length); i++) {
    const s = shuffled[i]
    const pool = (idsBySinner[s.id] ?? []).filter(matchesAll)
    result[s.id] = pool[Math.floor(Math.random() * pool.length)]
    usedSinners.add(s.id)
  }

  // Fill remaining sinners with random identities
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
