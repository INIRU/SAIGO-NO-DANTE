import type { Identity, Skill, ActivationCondition } from '@/lib/data/sinners'

/** What a memo's lookups hold for one token: the data its chip (or card) draws. */
export type NoteSkillEntry = {
  name: string
  skill_type: string
  sin_affinity: string
  skill_order: number
  description?: string | null
  iconUrl?: string
  iconFallbackUrl?: string
  identityName: string
  sinnerName: string
  skill?: Skill
  skills?: Skill[]
  identity?: Pick<Identity, 'sinner_id' | 'game_id'> & { keywords?: readonly string[] | null }
}

export type NotePassiveEntry = {
  name: string
  sin_affinity: string | null
  sin_count: number | null
  sin_requirements?: { sin: string; count: number }[] | null
  active_cond: string | null
  description: string | null
  sinnerName: string
  imageUrl?: string
}

export type NoteEgoEntry = {
  name: string
  grade: string
  sin_affinity: string | null
  image_url?: string | null
  sinnerName: string
}

export type NoteIdentityEntry = {
  name: string
  rarity: number
  imageUrl?: string
  sinnerName: string
  keywords?: string[]
}

export type NoteEgoGiftEntry = {
  name: string
  keyword: string
  grade: string
  image_url?: string | null
  effect_base?: string | null
  activation_condition?: ActivationCondition | null
}
