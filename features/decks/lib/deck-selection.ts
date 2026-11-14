import type { EgoSlotItem, FormationStripSkill } from '@/components/cards/EgoSlotRows'

export type PlannerDeckSinner = {
  id: string
  name_kr: string
  name?: string | null
  name_en?: string | null
  name_jp?: string | null
}

export type PlannerDeckIdentity = {
  id: string
  sinner_id: string
  name?: string | null
  name_kr?: string | null
  name_en?: string | null
  name_jp?: string | null
  rarity: number
  release_date?: string | null
  keywords?: string[] | null
  skill_keyword_list?: string[] | null
  game_id?: string | null
  folder_name?: string | null
}

export type PlannerDeckEgo = {
  max_construe_level?: number
  id: string
  sinner_id: string
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
  grade: string
  sin_affinity?: string | null
  image_url?: string | null
  cost?: number[] | null
}

export type PlannerIdentityBoardSlot = {
  sinnerId: string
  identity: PlannerDeckIdentity | null
  identityName?: string
  slotOrder: number | null
  /** Uptie 1–4; missing = 4. */
  uptie?: number
  /** Formation-slot gift icons (Assist mode). */
  giftBadgeUrls?: string[]
  /** Skills 1-3 and this sinner's chosen E.G.O: the strip under the card, and (skills) the skill view. */
  skills?: (FormationStripSkill | null)[]
  egos?: Record<string, EgoSlotItem | undefined>
}

export type PlannerEgoBoardSlot = {
  sinnerId: string
  enabled?: boolean
  /** The identity's name, or empty when the sinner has none (the panel then shows the sinner's name). */
  identityName?: string
  egosByGrade: Record<string, PlannerDeckEgo | undefined>
}

export const PLANNER_EGO_GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const

export const SUGGESTED_LIMIT = 6
