// ── 타입 정의 ──────────────────────────────────────────────────────────────

export type SinType = 'wrath' | 'lust' | 'sloth' | 'gluttony' | 'gloom' | 'pride' | 'envy'

export type Sinner = {
  id: string
  name: string
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
  order_num: number
  description: string
  literary_source: string
}

export type SanityCondition = {
  template_id: string
  condition_type: 'increase' | 'decrease'
  text: string
  text_en?: string | null
  text_jp?: string | null
  sort_order: number
}

export type PanicType = {
  id: number
  name: string
  name_en?: string | null
  name_jp?: string | null
  description: string
  description_en?: string | null
  description_jp?: string | null
}

export type Identity = {
  id: string
  sinner_id: string
  name: string
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
  tier: number
  sin_affinity?: SinType | null
  hp: number
  speed_min: number
  speed_max: number
  def_level: number
  keywords: string[]
  skill_keyword_list?: string[]
  unit_keyword_list?: string[]
  association_list?: string[]
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
  panic_type?: number | null
  break_section?: number[]
  base_hp?: number
  hp_per_level?: number
  bg_image_url?: string | null
  sanity_conditions?: SanityCondition[]
  acquisition_info?: {
    type: 'default' | 'standard' | 'event' | 'limited' | 'walpurgis' | 'attendance'
    release_season: number
    fragment_cost: number | null
    gacha: 'always' | 'seasonal' | 'walpurgis' | 'none' | 'pickup'
    gacha_from_season?: number
    target_sinner?: string
    gacha_id?: number
    gacha_name?: string
    gacha_name_en?: string
    gacha_name_jp?: string
    exchange_from_season?: number
    walpurgis_edition?: number
    event_name?: string
    event_currency?: string
    event_cost?: number
  } | null
}

export type Skill = {
  image_id?: string | null
  id: string
  identity_id: string
  name: string
  skill_type: string
  sin_affinity: SinType
  coins: number
  base_power: number
  coin_power: number
  description: string
  flavor?: string | null
  skill_order: number
  atk_weight?: number
  offense_level?: number
  quantity?: number
  uptie_level?: number
  variant_order?: number
  name_en?: string | null
  name_jp?: string | null
  description_en?: string | null
  description_jp?: string | null
  flavor_en?: string | null
  flavor_jp?: string | null
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
  flavor?: string | null
  passive_order: number
  uptie_level?: number
  name_en?: string | null
  name_jp?: string | null
  description_en?: string | null
  description_jp?: string | null
  flavor_en?: string | null
  flavor_jp?: string | null
}

export type EGOSkill = {
  gameSkillId?: number | null
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
  offenseLevel: number | null
  normalEffect: string
  coin1Effect: string
  coin2Effect: string
  coin3Effect: string
  coin4Effect: string
  coin5Effect: string
  name_en?: string | null
  name_jp?: string | null
  normalEffect_en?: string | null
  normalEffect_jp?: string | null
  coin1Effect_en?: string | null
  coin1Effect_jp?: string | null
  coin2Effect_en?: string | null
  coin2Effect_jp?: string | null
  coin3Effect_en?: string | null
  coin3Effect_jp?: string | null
  coin4Effect_en?: string | null
  coin4Effect_jp?: string | null
  coin5Effect_en?: string | null
  coin5Effect_jp?: string | null
}

export interface EGOPassive {
  game_passive_id: number
  min_stage: number
  max_stage: number
  name: string
  description: string
  name_en?: string | null
  description_en?: string | null
  name_jp?: string | null
  description_jp?: string | null
}

export type EGO = {
  stage_passives?: EGOPassive[]
  max_construe_level?: number
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  name_en?: string | null
  name_jp?: string | null
  grade: string
  sin_affinity: SinType | null
  description: string | null
  corrosion_risk: string | null
  folder_name: string | null
  image_url: string | null
  passive_name: string | null
  passive_content: string | null
  passive_name_en?: string | null
  passive_name_jp?: string | null
  passive_content_en?: string | null
  passive_content_jp?: string | null
  obtaining_method_en?: string | null
  obtaining_method_jp?: string | null
  ego_skills: EGOSkill[] | null
  ego_cor_skills: EGOSkill[] | null
  resistance: string[] | null
  cost: number[] | null
  keywords: string[] | null
  obtaining_method: string | null
  cor_image_url: string | null
  game_id: string | null
  release_date?: string | null
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
  name_en?: string | null
  name_jp?: string | null
  keyword: string
  grade: string
  image_url: string | null
  effect_base: string | null
  effect_base_en?: string | null
  effect_base_jp?: string | null
  activation_condition: ActivationCondition | null
}

export type EgoGiftTheme = {
  id: number
  name: string
  dungeon_id: number | null
  ego_gift_ids: number[]
  specific_ego_gift_ids: number[]
}
