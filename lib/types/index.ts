// ── 타입 정의 ──────────────────────────────────────────────────────────────

export type SinType = 'wrath' | 'lust' | 'sloth' | 'gluttony' | 'gloom' | 'pride' | 'envy'

export type Sinner = {
  id: string
  name: string
  name_kr: string
  order_num: number
  description: string
  literary_source: string
}

export type Identity = {
  id: string
  sinner_id: string
  name: string
  name_kr: string
  tier: number
  hp: number
  speed_min: number
  speed_max: number
  def_level: number
  keywords: string[]
  rarity: number
  affiliation?: string
  quote?: string
  slash_res?: string
  pierce_res?: string
  blunt_res?: string
  release_date?: string
  acquisition?: string
  game_id?: string | null
  folder_name?: string | null
  panic_type?: string
  panic_description?: string
  sanity_increase?: string
  sanity_decrease?: string
  acquisition_info?: {
    type: 'default' | 'standard' | 'event' | 'walpurgis' | 'attendance'
    release_season: number
    fragment_cost: number | null
    gacha: 'always' | 'seasonal' | 'walpurgis' | 'none'
    gacha_from_season?: number
    target_sinner?: string
    exchange_from_season?: number
    walpurgis_edition?: number
    event_name?: string
    event_currency?: string
    event_cost?: number
  } | null
}

export type Skill = {
  id: string
  identity_id: string
  name: string
  skill_type: string
  sin_affinity: SinType
  coins: number
  base_power: number
  coin_power: number
  description: string
  skill_order: number
  atk_weight?: number
  offense_level?: number
  quantity?: number
  uptie_level?: number
  variant_order?: number
}

export type Passive = {
  id: string
  identity_id: string
  passive_type: string   // 'battle' | 'support'
  name: string
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null
  description: string
  passive_order: number
  uptie_level?: number
}

export type EGOSkill = {
  name: string
  power: string
  mentalConsume: number
  atkType: string
  resource: string
  skillPower: number
  coinPower: number
  coinNum: number
  atkWeight: number
  construeLevel: number
  normalEffect: string
  coin1Effect: string
  coin2Effect: string
  coin3Effect: string
  coin4Effect: string
  coin5Effect: string
}

export type EGO = {
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  grade: string
  sin_affinity: SinType | null
  description: string | null
  corrosion_risk: string | null
  folder_name: string | null
  image_url: string | null
  passive_name: string | null
  passive_content: string | null
  ego_skills: EGOSkill[] | null
  ego_cor_skills: EGOSkill[] | null
  resistance: string[] | null
  cost: number[] | null
  keywords: string[] | null
  obtaining_method: string | null
  cor_image_url: string | null
  game_id: string | null
}

export type IdentityWithSinner = Identity & { sinner: Sinner }
export type EGOWithSinner = EGO & { sinner: Sinner }

export type ActivationCondition = {
  type: 'keyword' | 'multi_keyword' | 'affiliation' | 'skill'
  keyword?: string
  keywords?: string[]
  affiliation?: string
  affiliations?: string[]
  skill_condition?: string
  count: number
}

export type EgoGiftNote = {
  name: string
  keyword: string
  grade: string
  image_url: string | null
  effect_base: string | null
  activation_condition: ActivationCondition | null
}

export type EgoGiftTheme = {
  id: number
  name: string
  dungeon_id: number | null
  ego_gift_ids: number[]
}
