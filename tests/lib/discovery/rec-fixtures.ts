import type { Formation } from '@/lib/discovery/co-occurrence'
import { buildRecCatalog, type RawCatalog } from '@/lib/discovery/rec-catalog'

/** Small hand-made catalogs and posts for the recommender tests (not a test file itself). */
export const NOW = Date.parse('2026-10-20')

export const identity = (id: string, sinner: string, o: { status?: string[]; factions?: string[]; rarity?: number; release?: string | null; kw?: string[] } = {}): RawCatalog['identities'][number] => ({
  id, sinner_id: sinner, name_kr: id, rarity: o.rarity ?? 3, release_date: o.release === undefined ? '2024-01-01' : o.release, keywords: o.kw ?? [],
  skill_keyword_list: o.status ?? [], association_list: o.factions ?? [], affiliation: o.factions?.[0] ?? null,
})
export const ego = (id: string, sinner: string, grade: string, o: { status?: string[]; cost?: number[]; release?: string } = {}): RawCatalog['egos'][number] => ({
  id, sinner_id: sinner, grade, sin_affinity: null, keywords: o.status ?? [], release_date: o.release ?? '2024-01-01', cost: o.cost ?? null,
})

export const catalogOf = (parts: Partial<RawCatalog>) => buildRecCatalog({ identities: [], egos: [], skills: [], passives: [], gifts: [], themes: [], ...parts })

let counter = 0
export const post = (identities: string[], o: Partial<Formation> = {}): Formation => ({ kind: 'deck', id: `p${counter++}`, identities, votes: 0, views: 0, createdAt: NOW - 86_400_000, ...o })
export const times = (count: number, make: () => Formation) => Array.from({ length: count }, make)
