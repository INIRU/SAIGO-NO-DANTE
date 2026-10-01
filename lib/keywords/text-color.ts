// Keyword name colours: effect type, fixed lists and sin affinity. Shared by the keyword tooltip, the keyword archive and game text.
import { SIN_COLORS } from '@/lib/constants/sin'
import type { KeywordInfo } from '@/lib/keywords/catalog'
import type { SinType } from '@/lib/types'

const KEYWORD_POSITIVE_COLOR = '#f8c200'
export const KEYWORD_NEGATIVE_COLOR = '#e30000'
const KEYWORD_WARNING_COLOR = '#ff0000'
export const KEYWORD_DEFAULT_COLOR = '#e8dcc8'

const WARNING_BRACKET_KEYWORDS = new Set([
  'CantDuel',
  'CannotDuel',
  'Cannot Duel',
  "Can't Duel",
  'Unclashable',
  '합 불가',
  '합 불가능',
  '일방 공격',
])

const POSITIVE_KEYWORD_FALLBACKS = new Set([
  '도발치',
  '신속',
  '피해량 증가',
  '공격 레벨 증가',
  '위력 증가',
  '우울 위력 증가',
  '수비 위력 증가',
  '공격 위력 증가',
  '크리티컬 피해량 증가',
  '타격 피해량 증가',
  '타격 위력 증가',
  '정신력 회복 효율',
  '빼기 코인 강화',
  '관통 피해량 증가',
  '관통 위력 증가',
  '더하기 코인 강화',
  '보호',
  '참격 피해량 증가',
  '참격 위력 증가',
  '체력 회복 증가',
  '기본 위력 증가',
  '분노 위력 증가',
  '색욕 위력 증가',
  '나태 위력 증가',
  '탐식 위력 증가',
  '오만 위력 증가',
  '질투 위력 증가',
  '호흡',
  '충전',
  '얽힘',
  'Poise',
  'Charge',
  'Entanglement',
  'Haste',
  'Protection',
  'Damage Up',
  'Attack Level Up',
  'Power Up',
  'Coin Power Up',
])

const NEGATIVE_KEYWORD_FALLBACKS = new Set([
  '공격 레벨 감소',
  '속박',
  '화상',
  '방어 레벨 감소',
  '연약',
  '출혈',
  '검흔[잔상]',
  '검흔',
  '잔상',
  '신경 손상',
  '마비',
  '위력 감소',
  '침잠',
  '체력 회복 감소',
  '진동',
  '질투 취약',
  '취약',
  '파열',
  'Burn',
  'Bleed',
  'Bladetrail [Afterimage]',
  'Bladetrail',
  'Afterimage',
  'Tremor',
  'Rupture',
  'Sinking',
  'Paralysis',
  'Bind',
  'Fragile',
  'Vulnerable',
  'Damage Down',
  'Attack Down',
  'Attack Level Down',
])

function normalizedKeywordToken(value: string): string {
  const trimmed = value.trim()
  const wrapperMatch = trimmed.match(/^(?:\[([^\]]+)\]|【([^】]+)】)$/)
  return wrapperMatch ? (wrapperMatch[1] ?? wrapperMatch[2]).trim() : trimmed
}

export function resolveKeywordTextColor(keyword: string, info?: KeywordInfo, fallbackKey?: string): string {
  const token = normalizedKeywordToken(keyword)
  const key = fallbackKey ? normalizedKeywordToken(fallbackKey) : token
  if (WARNING_BRACKET_KEYWORDS.has(token) || WARNING_BRACKET_KEYWORDS.has(key)) return KEYWORD_WARNING_COLOR
  const effectType = info?.effectType ?? info?.effect_type
  if (effectType === 'negative') return KEYWORD_NEGATIVE_COLOR
  if (effectType === 'positive') return KEYWORD_POSITIVE_COLOR
  if (!effectType) {
    if (NEGATIVE_KEYWORD_FALLBACKS.has(key) || NEGATIVE_KEYWORD_FALLBACKS.has(token)) return KEYWORD_NEGATIVE_COLOR
    if (
      token.includes('검흔') ||
      token.includes('잔상') ||
      token.includes('Bladetrail') ||
      token.includes('Afterimage') ||
      key.includes('검흔') ||
      key.includes('잔상') ||
      key.includes('Bladetrail') ||
      key.includes('Afterimage')
    ) return KEYWORD_NEGATIVE_COLOR
    if (POSITIVE_KEYWORD_FALLBACKS.has(key) || POSITIVE_KEYWORD_FALLBACKS.has(token)) return KEYWORD_POSITIVE_COLOR
  }

  const sin = info?.sinAffinity
  if (sin && sin in SIN_COLORS) return SIN_COLORS[sin as SinType]

  return KEYWORD_DEFAULT_COLOR
}
