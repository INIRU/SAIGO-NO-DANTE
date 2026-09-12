import type { CollectionData } from '@/lib/collection'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import { normalizeSin } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'

export function countCollection(data: CollectionData | null, owned: Set<string>) {
  const stats = { ownedIdentities: 0, totalIdentities: 0, ownedEgos: 0, totalEgos: 0 }
  const bySinner: Record<string, { owned: number; total: number }> = {}
  if (!data) return { stats, bySinner }
  for (const sinner of data.sinners) {
    const identities = data.identities[sinner.id] ?? []
    const egos = data.egos[sinner.id] ?? []
    let ownedIdentities = 0
    let ownedEgos = 0
    for (const identity of identities) if (owned.has(identity.id)) ownedIdentities++
    for (const ego of egos) if (owned.has(ego.id)) ownedEgos++
    stats.totalIdentities += identities.length
    stats.totalEgos += egos.length
    stats.ownedIdentities += ownedIdentities
    stats.ownedEgos += ownedEgos
    bySinner[sinner.id] = { owned: ownedIdentities + ownedEgos, total: identities.length + egos.length }
  }
  return { stats, bySinner }
}

export function filterCollection(data: CollectionData | null, keyword: string | null, sinMap: Record<string, SinType>): Pick<CollectionData, 'identities' | 'egos'> {
  if (!data) return { identities: {}, egos: {} }
  if (!keyword) return { identities: data.identities, egos: data.egos }
  const sin = sinMap[keyword]
  return {
    identities: Object.fromEntries(Object.entries(data.identities).map(([sinner, rows]) => [sinner,
      rows.filter(identity => identity.keywords?.some(value => (
        normalizeThemeKeyword(value) === keyword || value === keyword || (sin && sinMap[value] === sin)
      ))),
    ])),
    // Keywords without a sin leave the EGO catalog visible, as in both original views.
    egos: sin ? Object.fromEntries(Object.entries(data.egos).map(([sinner, rows]) => [sinner,
      rows.filter(ego => normalizeSin(ego.sin_affinity) === sin),
    ])) : data.egos,
  }
}
