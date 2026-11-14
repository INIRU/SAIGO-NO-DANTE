import type { DeckFilterIdentity } from '../components/DeckIdentityFilterModal'

export { QUERY_OPTIONS } from '@/lib/constants/query-options'

/** The identity picker of the deck and plan boards. Without `skill_keyword_list` (a database that lacks the column) the legacy select is used. */
export const IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS = 'id, sinner_id, name_kr, name_en, name_jp, rarity, release_date, keywords, skill_keyword_list, folder_name, game_id, hp, speed_min, speed_max, def_level, sinner:sinners(id, name_kr, order_num)'
export const IDENTITY_FILTER_SELECT_LEGACY = 'id, sinner_id, name_kr, name_en, name_jp, rarity, release_date, keywords, folder_name, game_id, hp, speed_min, speed_max, def_level, sinner:sinners(id, name_kr, order_num)'

/** A comma-separated query value as a list: trimmed, empty items dropped. A missing parameter has no values. */
export function parseCsvParam(value: string | null | undefined): string[] {
  if (!value) return []
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

/** The query value for a list, or null (the parameter is removed) when nothing is picked. */
export function serializeCsvParam(values: Iterable<string>): string | null {
  const serialized = [...values].filter(Boolean).join(',')
  return serialized || null
}

export type IdentityNameEntry = {
  id: string
  name: string
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
  sinner_id: string
  folder_name: string | null
  game_id: string | null
  rarity: number
  release_date?: string | null
  keywords: string[] | null
  skill_keyword_list?: string[] | null
  hp: number | null
  speed_min: number | null
  speed_max: number | null
  def_level: number | null
  sinner?: {
    id: string
    name_kr: string
    order_num: number
  } | { id: string; name_kr: string; order_num: number }[] | null
}

/** `fallbackToKeywords`: the plan board shows an identity's keywords where the skill keyword column is missing; the deck list shows none. */
export function toDeckFilterIdentity(identity: IdentityNameEntry, { fallbackToKeywords = false }: { fallbackToKeywords?: boolean } = {}): DeckFilterIdentity {
  const sinner = Array.isArray(identity.sinner) ? identity.sinner[0] : identity.sinner
  return {
    id: identity.id,
    sinner_id: identity.sinner_id,
    name: identity.name_kr,
    name_kr: identity.name_kr,
    name_en: identity.name_en,
    name_jp: identity.name_jp,
    rarity: identity.rarity,
    release_date: identity.release_date ?? undefined,
    keywords: identity.keywords ?? [],
    skill_keyword_list: identity.skill_keyword_list ?? (fallbackToKeywords ? identity.keywords : null) ?? [],
    folder_name: identity.folder_name,
    game_id: identity.game_id,
    hp: identity.hp ?? 0,
    speed_min: identity.speed_min ?? 0,
    speed_max: identity.speed_max ?? 0,
    def_level: identity.def_level ?? 0,
    tier: 0,
    sinner: sinner ?? null,
  }
}
