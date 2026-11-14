// ── 타입 ──────────────────────────────────────────────────────────────────
type SkillDetail = {
  image_id?: string | null
  id: string
  name: string
  name_en?: string | null
  name_jp?: string | null
  skill_type: string
  atk_type?: string | null
  sin_affinity: string
  coins: number
  base_power: number
  coin_power: number
  skill_order: number
  atk_weight: number | null
  offense_level: number | null
  description?: string | null
  description_en?: string | null
  description_jp?: string | null
  uptie_level?: number | null
  variant_order?: number | null
}

type PassiveDetail = {
  name: string
  name_en?: string | null
  name_jp?: string | null
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  sin_requirements?: { sin: string; count: number }[] | null
  active_cond: string | null
  description: string
  description_en?: string | null
  description_jp?: string | null
  passive_order: number
  uptie_level?: number | null
}

export type IdentityDetail = {
  id: string
  sinner_id: string
  folder_name: string | null
  game_id: string | null
  keywords: string[] | null
  skill_keyword_list?: string[] | null
  affiliation?: string | null
  association_list?: string[] | null
  name?: string | null
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
  tier: number
  rarity: number
  hp: number | null
  base_hp?: number | null
  hp_per_level?: number | null
  speed_min: number | null
  speed_max: number | null
  def_level: number | null
  slash_res: string | null
  pierce_res: string | null
  blunt_res: string | null
  skills: SkillDetail[]
  passives: PassiveDetail[]
}

export type IdentitySlot = {
  slot_order: number
  gacksung: boolean
  /** 동기화 1–4 (컬럼이 없던 예전 응답은 비어 있음) */
  uptie?: number | null
  s1_count?: number
  s2_count?: number
  s3_count?: number
  identities: IdentityDetail | null
}

export type EgoEntry = {
  grade: string
  ego: {
    id: string
    name?: string | null
    name_kr: string | null
    name_en?: string | null
    name_jp?: string | null
    grade: string
    sin_affinity: string | null
    sinner_id: string
    folder_name: string | null
    image_url: string | null
  }
}

