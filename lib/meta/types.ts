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

/** Content a formation was built for. Plans are always Mirror Dungeon. */
export const META_USAGES = ['mirrorDungeon', 'story', 'expDungeon', 'threadDungeon', 'refractionRailway', 'reflectrial', 'none'] as const
export type MetaUsage = typeof META_USAGES[number]
export interface CountStat<K extends string = string> { key: K; count: number }

/** What plans fielding an identity (or all plans) aim for. Gift keys are game ids; theme keys are pack ids. */
export interface MetaPlanSummary { count: number; difficulty: CountStat[]; gifts: CountStat[]; themes: CountStat[] }
export interface MetaGift { game_id: number; name: string; name_en?: string | null; name_jp?: string | null; grade: string | null; keyword: string | null; image_url: string | null }
export interface MetaTheme { id: number; name: string; name_en?: string | null; name_jp?: string | null; image_url: string | null }

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
  /** One entry per sample: which content it targets. */
  usageStats: CountStat<MetaUsage>[]
  /** One entry per sample: keyword deck combo ('화상+진동'), '' when no keyword reaches the threshold. */
  comboStats: CountStat[]
  planStats: MetaPlanSummary
  /** Display data for every gift and theme pack referenced by planStats or an insight's plan summary. */
  giftCatalog: Record<string, MetaGift>
  themeCatalog: Record<string, MetaTheme>
  synergies: Synergy[]
  egoStats: EGOStat[]
  /** S1–S3 of each fielded identity (highest uptie), for the skill exchange icons. */
  skillCatalog: Record<string, MetaSkill[]>
  /** Skill exchange of every fielded slot: key 'S1-S2-S3', most used first. */
  skillSplits: CountStat[]
  /** Floor-by-floor choices of the plans in scope. */
  dungeon: MetaDungeon
}

/** Keys are theme pack ids, gift game ids and constraint card ids; every count is a number of plans. */
export interface MetaDungeon {
  plans: number
  /** Floors 1–15 that some plan gave a theme pack, with its top packs. */
  floors: { floor: number; plans: number; themes: CountStat[] }[]
  /** Gifts planned on a floor, with the floors they are planned on most. */
  routes: { key: string; count: number; floors: CountStat[] }[]
  start: CountStat[]
  observe: CountStat[]
  /** Final gifts planned enhanced. */
  enhanced: { key: string; plus: number; plusplus: number }[]
  /** Floors 11–15: plans that set cards there, and how many of them pick each card. */
  constraints: { floor: number; plans: number; cards: CountStat[] }[]
}

export interface MetaSkill { order: 1 | 2 | 3; name: string; name_en?: string | null; name_jp?: string | null; sin_affinity: string | null; image_id?: string | null }

export const META_SOURCES = ['all', 'decks', 'planner'] as const
export const META_PERIODS = ['7', '30', '90', 'all'] as const
export type MetaSource = typeof META_SOURCES[number]
export type MetaPeriod = typeof META_PERIODS[number]
export const DEFAULT_META_SOURCE: MetaSource = 'all'
export const DEFAULT_META_PERIOD: MetaPeriod = 'all'

export type MetaIdentity = Omit<IdentityStat, 'identity_id' | 'count' | 'keywords'> & { id: string; keywords: string[] | null; skill_keyword_list?: string[] | null }
export type MetaEGO = Omit<EGOStat, 'ego_id' | 'count'> & { id: string }
export type MetaPost = {
  id: string
  source: Exclude<MetaSource, 'all'>
  created_at: string
  title?: string
  keywords?: string[] | null
  content_type?: string | null
  difficulty?: string | null
  /** Gift game ids in the plan's final inventory (start and observation gifts included). */
  gifts?: string[]
  /** Theme pack ids chosen across the plan's floors. */
  themes?: string[]
  /** Raw planner floor_plan and gift_inventory, for the Mirror Dungeon breakdown. */
  floorPlan?: unknown
  inventory?: unknown
  identities: unknown
  egos: unknown
}

export type MetaInsightPost = {
  id: string
  source: Exclude<MetaSource, 'all'>
  title: string
  usage: MetaUsage
  /** Keyword deck combo, sorted; empty when mixed. */
  combo: string[]
  /** The identity sat on the bench (no formation order) in this post. */
  support?: true
}

export interface IdentityInsight {
  companions: { identity_id: string; count: number }[]
  /** Posts where the identity has a formation order. */
  count: number
  orders: Record<string, number>
  egos: EGOStat[]
  /** Formation posts first, then bench-only posts marked support. */
  posts: MetaInsightPost[]
  /** Plans that field this identity. Absent when none do. */
  plan?: MetaPlanSummary
  /** Skill exchange of the formations fielding it: key 'S1-S2-S3' counts (e.g. '3-2-1'), most used first. */
  skills: CountStat[]
}

export function isBaseEgo(gameId: string | null | undefined): boolean {
  return /^(20[1-9]|21[0-2])01$/.test(gameId ?? '')
}
