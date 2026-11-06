import { SIN_ORDER, normalizeSin } from '@/lib/constants/sin'
import type { SinWeights, ActivationKind, ActivationRequirement } from '@/features/community/lib/passive-fit'
import type { SinType } from '@/lib/types'

/** The catalog rows the recommenders read, as the database holds them (see `getRecCatalog` and scripts/recommender/export-snapshot.mjs). */
export type RawCatalog = {
  identities: { id: string; sinner_id: string; name_kr: string; rarity: number; release_date: string | null; keywords: string[] | null; skill_keyword_list: string[] | null; association_list: string[] | null; affiliation: string | null }[]
  egos: { id: string; sinner_id: string; grade: string; sin_affinity: string | null; keywords: string[] | null; release_date: string | null; cost: number[] | null }[]
  skills: { identity_id: string; skill_order: number; sin_affinity: string | null; description: string | null }[]
  passives: { identity_id: string; passive_type: string; passive_order: number; sin_affinity: string | null; sin_count: number | null; active_cond: string | null; sin_requirements: { sin: string; count: number }[] | null; description: string | null }[]
  gifts: { game_id: number; keyword: string | null; grade: string | null }[]
  themes: { id: number; difficulty: string | null; ego_gift_ids: number[] | null; specific_ego_gift_ids: number[] | null; floor_info: Record<string, number[] | string> | null }[]
}

/** The seven status keywords a deck is built around, and the tag each carries in skill text. */
export const STATUS_KEYWORDS = ['화상', '진동', '출혈', '파열', '침잠', '호흡', '충전'] as const
export type StatusKeyword = (typeof STATUS_KEYWORDS)[number]
const STATUS_TAG: Record<string, StatusKeyword> = { Combustion: '화상', Vibration: '진동', Laceration: '출혈', Burst: '파열', Sinking: '침잠', Breath: '호흡', Charge: '충전' }
const STATUS_INDEX = new Map<string, number>(STATUS_KEYWORDS.map((keyword, index) => [keyword, index]))
const DEFAULT_DISTRIBUTION = [3, 2, 1] as const

export type RecPassive = { cond: ActivationKind; req: ActivationRequirement[] }
export type RecIdentity = {
  id: string; sinner: string; name: string; release: number | null
  /** The LCB 수감자 every sinner starts with: it fills a slot but says nothing about a team. */
  starter: boolean
  /** Status keyword weights (log of mentions in S1–S3 and passives, at least 1 for the identity's own skill keywords), in STATUS_KEYWORDS order. */
  status: number[]
  /** Other keywords the identity's kit uses. */
  kw: string[]
  factions: string[]
  /** Skill cards per sin at the default 3-2-1 distribution. */
  sins: SinWeights
  /** Battle passives that depend on the team's sins. */
  passives: RecPassive[]
}
export type RecEgo = { id: string; sinner: string; grade: string; sin: string | null; release: number | null; cost: number[]; status: number[]; kw: string[] }
export type RecTheme = { id: string; difficulty: string | null; gifts: string[]; floorInfo: Record<string, number[] | string> | null }

/** Plain data (cacheable): ids to features, plus the inverse-frequency weights the similarities use. */
export type RecCatalog = {
  identities: Record<string, RecIdentity>
  bySinner: Record<string, string[]>
  egos: Record<string, RecEgo>
  egosBySinner: Record<string, string[]>
  themes: Record<string, RecTheme>
  /** Gift game id → its keyword (공통 for the generic ones). */
  gifts: Record<string, string>
  /** ln(identities ÷ identities carrying it): rare factions and keywords weigh more. */
  idf: { faction: Record<string, number>; kw: Record<string, number> }
}

const parseDate = (value: string | null) => { const time = value ? Date.parse(value) : NaN; return Number.isNaN(time) ? null : time }

function statusWeights(text: string, own: readonly string[]): number[] {
  const counts = STATUS_KEYWORDS.map(() => 0)
  for (const match of text.matchAll(/\[([A-Za-z]+)\]/g)) {
    const keyword = STATUS_TAG[match[1]]
    if (keyword) counts[STATUS_INDEX.get(keyword)!]++
  }
  return counts.map((count, index) => (count > 0 ? 1 + Math.log(count) : own.includes(STATUS_KEYWORDS[index]) ? 1 : 0))
}

export function buildRecCatalog(raw: RawCatalog): RecCatalog {
  const textOf = new Map<string, string>()
  const sinsOf = new Map<string, SinWeights>()
  for (const skill of raw.skills) {
    textOf.set(skill.identity_id, `${textOf.get(skill.identity_id) ?? ''}\n${skill.description ?? ''}`)
    const sin = normalizeSin(skill.sin_affinity)
    const weight = DEFAULT_DISTRIBUTION[skill.skill_order - 1]
    if (sin && weight) { const sins = sinsOf.get(skill.identity_id) ?? {}; sins[sin] = (sins[sin] ?? 0) + weight; sinsOf.set(skill.identity_id, sins) }
  }
  const passivesOf = new Map<string, RecPassive[]>()
  for (const passive of raw.passives) {
    textOf.set(passive.identity_id, `${textOf.get(passive.identity_id) ?? ''}\n${passive.description ?? ''}`)
    if (passive.passive_type !== 'battle' || (passive.active_cond !== 'stock' && passive.active_cond !== 'resonance')) continue
    const req = (passive.sin_requirements?.length ? passive.sin_requirements : [{ sin: passive.sin_affinity ?? '', count: passive.sin_count ?? 0 }])
      .flatMap(row => { const sin = normalizeSin(row.sin); return sin && row.count > 0 ? [{ sin: sin as SinType, count: row.count }] : [] })
    if (!req.length) continue
    const list = passivesOf.get(passive.identity_id) ?? []
    list.push({ cond: passive.active_cond, req })
    passivesOf.set(passive.identity_id, list)
  }

  const identities: Record<string, RecIdentity> = {}
  const bySinner: Record<string, string[]> = {}
  const factionDf: Record<string, number> = {}, kwDf: Record<string, number> = {}
  for (const row of raw.identities) {
    const statusSet = new Set<string>(STATUS_KEYWORDS)
    const factions = [...new Set([...(row.association_list ?? []), ...(row.affiliation ? [row.affiliation] : [])])]
    const kw = [...new Set((row.keywords ?? []).filter(keyword => !statusSet.has(keyword)))]
    identities[row.id] = {
      id: row.id, sinner: row.sinner_id, name: row.name_kr, release: parseDate(row.release_date), starter: row.rarity <= 1,
      status: statusWeights(textOf.get(row.id) ?? '', row.skill_keyword_list ?? []), kw, factions, sins: sinsOf.get(row.id) ?? {}, passives: passivesOf.get(row.id) ?? [],
    }
    ;(bySinner[row.sinner_id] ??= []).push(row.id)
    for (const faction of factions) factionDf[faction] = (factionDf[faction] ?? 0) + 1
    for (const keyword of kw) kwDf[keyword] = (kwDf[keyword] ?? 0) + 1
  }
  const total = Math.max(1, raw.identities.length)
  const idf = (df: Record<string, number>) => Object.fromEntries(Object.entries(df).map(([key, count]) => [key, Math.log(total / count)]))

  const egos: Record<string, RecEgo> = {}
  const egosBySinner: Record<string, string[]> = {}
  for (const row of raw.egos) {
    const keywords = row.keywords ?? []
    const cost = SIN_ORDER.map((_, index) => row.cost?.[index] ?? 0)
    egos[row.id] = {
      id: row.id, sinner: row.sinner_id, grade: row.grade, sin: normalizeSin(row.sin_affinity), release: parseDate(row.release_date), cost,
      status: STATUS_KEYWORDS.map(keyword => (keywords.includes(keyword) ? 1 : 0)), kw: keywords.filter(keyword => !STATUS_INDEX.has(keyword)),
    }
    ;(egosBySinner[row.sinner_id] ??= []).push(row.id)
  }

  return {
    identities, bySinner, egos, egosBySinner,
    themes: Object.fromEntries(raw.themes.map(theme => [String(theme.id), {
      id: String(theme.id), difficulty: theme.difficulty, floorInfo: theme.floor_info,
      gifts: [...new Set([...(theme.ego_gift_ids ?? []), ...(theme.specific_ego_gift_ids ?? [])].map(String))],
    }])),
    gifts: Object.fromEntries(raw.gifts.map(gift => [String(gift.game_id), gift.keyword ?? '공통'])),
    idf: { faction: idf(factionDf), kw: idf(kwDf) },
  }
}

/** Cosine similarity of two non-negative vectors of the same length (0 when either is empty). */
export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0
}

/** Sum of the weight vectors normalised to share-of-mentions, divided by the count: the team's keyword profile. */
export function statusShare(weights: readonly number[]): number[] {
  const total = weights.reduce((sum, value) => sum + value, 0)
  return total > 0 ? weights.map(value => value / total) : weights.map(() => 0)
}
