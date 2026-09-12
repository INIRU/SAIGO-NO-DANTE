export type KeywordCategory = '상태이상' | '버프' | '디버프' | '고유' | '기타'

const coreStatuses = new Set(['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전'])
const mechanics = new Set(['Aggro', 'Discard', 'SuperCoin', 'CanDuelGuard', 'VibrationExplosion', 'Switch_Vibration', 'FusionVibration', 'SinkingSurge', 'RetreatForCommon'])
const buffs = new Set(['Agility', 'Protection', 'Enhancement', 'Endurance', 'ResultEnhancement', 'AttackUp', 'DefenseUp', 'SkillPowerUp', 'PlusCoinValueUp', 'MinusCoinValueDown', 'TakeHpHealIncrease', 'AttackLevelAdder', 'GainSinStockAdder', 'MentalIncreaseUp', 'MentalDecreaseDown'])
const debuffs = new Set(['Binding', 'Vulnerable', 'Reduction', 'Disarming', 'ResultReduction', 'AttackDown', 'DefenseDown', 'Paralysis', 'PlusCoinValueDown', 'MinusCoinValueUp', 'TakeHpHealReduce', 'MentalIncreaseDown', 'MentalDecreaseUp'])

/** Archive categories: core statuses, signed effects, then source-specific keywords.
 * Use original tags, never translated description substrings (e.g. healing reduction).
 */
export function getKeywordCategory(row: { name: string; tag?: string | null; effect_type?: string | null }): KeywordCategory {
  if (coreStatuses.has(row.name) || row.name.startsWith('진동 - ')) return '상태이상'
  const tag = row.tag ?? ''
  if (mechanics.has(tag)) return '기타'
  if (buffs.has(tag) || /^(?:(?:Crimson|Scarlet|Amber|Shamrock|Azure|Indigo|Violet|Slash|Penetrate|Hit|Critical|Attack)(?:Result|Damage|Dmg)Up|ParryingResultUp|(?:Crimson|Scarlet|Amber|Shamrock|Azure|Indigo|Violet|Slash|Penetrate|Hit)TakeDamageDown)$/.test(tag)) return '버프'
  if (debuffs.has(tag) || /^(?:(?:Crimson|Scarlet|Amber|Shamrock|Azure|Indigo|Violet|Slash|Penetrate|Hit|Attack)(?:Result|Damage|Dmg)Down|ParryingResultDown|(?:Crimson|Scarlet|Amber|Shamrock|Azure|Indigo|Violet|Slash|Penetrate|Hit)(?:TakeDamageUp|ResistDown))$/.test(tag)) return '디버프'
  if (row.effect_type === 'positive') return '버프'
  if (row.effect_type === 'negative') return '디버프'
  return tag ? '고유' : '기타'
}
