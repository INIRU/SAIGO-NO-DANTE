export interface EgoGift {
  id: string
  name: string
  keyword: string
  grade: string
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
  related: string | null
  image_url: string | null
  acquisition: string | null
  game_id: number | null
  difficulty: string | null
  convert_to: number | null
  name_en?: string | null
  name_jp?: string | null
  effect_base_en?: string | null
  effect_base_jp?: string | null
  effect_plus_en?: string | null
  effect_plus_jp?: string | null
  effect_plusplus_en?: string | null
  effect_plusplus_jp?: string | null
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
  is_hidden: boolean
  hidden_rate: number | null
  fixed_reward_gift_ids: number[] | null
  name_en?: string | null
  name_jp?: string | null
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
  gift_id?: number
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
  next_event?: {
    id: number
    name: string | null
    desc: string | null
    options: EventOption[] | null
  }
}

export interface MirrorDungeonEvent {
  id: number
  name: string | null
  desc_text: string | null
  options: EventOption[] | null
  gift_ids: number[] | null
  source: string | null
  image_url: string | null
  theme_ids: number[] | null
}

// ── New event types for redesigned 2-table DB ────────────────────────────────

export interface EventJudgment {
  intro?: { ko: string; en: string; ja: string }
  participantInfo?: { min: number; max: number }
  judgement?: { upDownType: number; inclusiveValue: number; exclusiveValue: number; judgementDataList: { attributeType: string }[] }
  corrections?: { correctionCase: string; adder: number; labels: { ko: string; en: string; ja: string } }[]
}

export interface MdEvent {
  judgment?: EventJudgment | null
  id: number
  name: string | null
  desc_text: string | null
  event_type: 'ACTION' | 'COIN_EVENT' | 'action' | 'ab' | 'personality' | null
  source: string | null
  image_url: string | null
  theme_ids: number[] | null
  gift_ids: number[] | null
  variant_of: number | null
  category: string | null
  name_en?: string | null
  name_jp?: string | null
  desc_text_en?: string | null
  desc_text_jp?: string | null
}

export interface MdEventChoice {
  option_index?: number | null
  result_index?: number | null
  outcome?: string | null
  result_condition?: string | null
  selection_condition?: string | null
  id: number
  event_id: number
  sort_order: number
  message: string | null
  message_en?: string | null
  message_jp?: string | null
  message_desc: string | null
  message_desc_en?: string | null
  message_desc_jp?: string | null
  result_text: string | null
  result_text_en?: string | null
  result_text_jp?: string | null
  probability: string | null
  next_event_id: number | null
  effects: ChoiceEffect[] | null
}

export interface ChoiceEffect {
  text?: { ko: string; en: string; ja: string }
  source?: Record<string, unknown>
  type: string
  amount?: number
  hp?: number
  mp?: number
  gift_id?: number | null
  count?: number
  battle_id?: number | null
  effect?: string
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
