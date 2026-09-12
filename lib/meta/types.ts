export interface IdentityStat {
  identity_id: string
  sinner_id: string
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
  keywords: string[]
  rarity: number
  folder_name: string | null
  game_id: string | null
  count: number
}

export interface KeywordStat { keyword: string; count: number }

export interface Synergy {
  a_id: string; a_name: string; a_sinner_id: string; a_folder: string | null; a_game_id: string | null
  b_id: string; b_name: string; b_sinner_id: string; b_folder: string | null; b_game_id: string | null
  count: number
}

export interface EGOStat {
  ego_id: string
  game_id?: string | null
  sinner_id: string
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
  grade: string
  sin_affinity: string | null
  image_url: string | null
  count: number
}

export interface MetaData {
  identityInsights: Record<string, IdentityInsight>
  sampleCount: number
  sourceCounts: { decks: number; planner: number }
  excludedSamples: number
  source: MetaSource
  period: MetaPeriod
  generatedAt: string
  battleIdentityStats: IdentityStat[]
  supportIdentityStats: IdentityStat[]
  usageBySinner: Record<string, number>
  usageBySin: Record<string, number>
  keywordUsage: KeywordStat[]
  synergies: Synergy[]
  egoStats: EGOStat[]
}

export const META_SOURCES = ['all', 'decks', 'planner'] as const
export const META_PERIODS = ['7', '30', '90', 'all'] as const
export type MetaSource = typeof META_SOURCES[number]
export type MetaPeriod = typeof META_PERIODS[number]
export const DEFAULT_META_SOURCE: MetaSource = 'all'
export const DEFAULT_META_PERIOD: MetaPeriod = 'all'

export type MetaIdentity = Omit<IdentityStat, 'identity_id' | 'count' | 'keywords'> & { id: string; keywords: string[] | null }
export type MetaEGO = Omit<EGOStat, 'ego_id' | 'count'> & { id: string }
export type MetaPost = {
  id: string
  source: Exclude<MetaSource, 'all'>
  created_at: string
  title?: string
  keywords?: string[] | null
  identities: unknown
  egos: unknown
}

export interface IdentityInsight {
  companions: { identity_id: string; count: number }[]
  count: number
  orders: Record<string, number>
  keywords: KeywordStat[]
  egos: EGOStat[]
  posts: { id: string; source: Exclude<MetaSource, 'all'>; title: string; keywords: string[] }[]
}

export function isBaseEgo(gameId: string | null | undefined): boolean {
  return /^(20[1-9]|21[0-2])01$/.test(gameId ?? '')
}
