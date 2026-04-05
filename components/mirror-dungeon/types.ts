export interface EgoGift {
  id: string
  name: string
  keyword: string
  grade: string
  tier: string | null
  enhancement: boolean
  price: number | null
  sell_price: number | null
  buy_disabled: boolean
  effect_base: string | null
  effect_plus: string | null
  effect_plusplus: string | null
  activation_condition: {
    type: 'keyword' | 'multi_keyword' | 'affiliation' | 'skill'
    keyword?: string
    keywords?: string[]
    affiliation?: string
    affiliations?: string[]
    skill_condition?: string
    count: number
  } | null
  is_synthesis: boolean
  first_appearance: string | null
  related: string | null
  image_url: string | null
  acquisition: string | null
  game_id: number | null
  difficulty: string | null
}

export interface Recipe {
  id: string
  result_name: string
  keyword: string
  ingredients: string[]
  final_result: string | null
}

export interface EgoGiftTheme {
  id: number
  name: string
  dungeon_id: number | null
  ego_gift_ids: number[]
  specific_ego_gift_ids: number[]
  image_url: string | null
  difficulty: string | null
  floor_info: Record<string, number[] | string> | null
  boss_image_url: string | null
  is_hidden: boolean
  hidden_rate: number | null
  fixed_reward_gift_ids: number[] | null
}

export interface EventRewardEffect {
  type:
    | 'cost'
    | 'cost_loss'
    | 'gift'
    | 'gift_battle'
    | 'battle'
    | 'battle_abnormality'
    | 'nothing'
    | 'hp_loss'
    | 'hp_recover'
    | 'mp_loss'
    | 'mp_recover'
    | 'hp_mp_recover'
    | 'hp_mp_loss'
    | 'hp_recover_ratio'
    | 'level_up'
    | 'get_character'
  amount?: number
  count?: number
}

export interface EventRewardBranch {
  probability: number | string
  effects: EventRewardEffect[]
}

export interface EventOption {
  message: string
  messageDesc?: string
  result?: string[]
  rewards?: EventRewardBranch[]
}

export interface MirrorDungeonEvent {
  id: number
  name: string | null
  desc_text: string | null
  options: EventOption[] | null
  gift_ids: number[] | null
  source: string | null
  image_url: string | null
  parent_id: number | null
  option_gifts: number[][] | null
  option_index: number | null
  theme_ids: number[] | null
}

export const KEYWORD_COLORS: Record<string, string> = {
  화상: '#e85830',
  출혈: '#c83030',
  진동: '#d0a020',
  파열: '#8040c0',
  침잠: '#3060b0',
  호흡: '#40a060',
  충전: '#e0c020',
  참격: '#cc4444',
  관통: '#dd8833',
  타격: '#cc8822',
  공통: '#888888',
}

export const GRADES = ['전체', '1', '2', '3', '4', '5', 'EX']

export const GRADE_LABELS: Record<string, string> = {
  '1': 'Ⅰ',
  '2': 'Ⅱ',
  '3': 'Ⅲ',
  '4': 'Ⅳ',
  '5': 'Ⅴ',
  'EX': 'EX',
}
