import { getKeywordIconUrl } from '@/lib/constants/keywords'
import type { SinType } from '@/lib/types'

export type KeywordInfo = {
  desc: string
  maxStack?: number
  iconSlug?: string
  sinAffinity?: string
  effectType?: 'positive' | 'negative' | 'neutral' | null
  effect_type?: 'positive' | 'negative' | 'neutral' | null
  nameEn?: string | null
  nameJp?: string | null
  descEn?: string | null
  descJp?: string | null
}

export function resolveKeywordIconUrl(keyword: string, iconSlug?: string | null): string | null {
  return getKeywordIconUrl(keyword, iconSlug ?? undefined)
}

type KeywordCatalog = Record<string, KeywordInfo>

// The server sends immutable catalog snapshots. Weak keys release an old catalog
// after navigation; every consumer of the same snapshot shares these indexes.
const indexes = new WeakMap<KeywordCatalog, ReturnType<typeof buildKeywordIndex>>()
const localizedIndexes = new WeakMap<KeywordCatalog, Map<string, ReturnType<typeof buildLocalizedIndex>>>()

function buildKeywordIndex(keywords: KeywordCatalog) {
  const sinMap: Record<string, SinType> = {}
  const iconMap: Record<string, string> = {}
  for (const [keyword, info] of Object.entries(keywords)) {
    if (info.sinAffinity) sinMap[keyword] = info.sinAffinity as SinType
    if (info.iconSlug) iconMap[keyword] = info.iconSlug
  }
  return {
    keywords, sinMap, iconMap,
    getIconUrl: (keyword: string) => resolveKeywordIconUrl(keyword, keywords[keyword]?.iconSlug),
  }
}

export function getKeywordIndex(keywords: KeywordCatalog) {
  let index = indexes.get(keywords)
  if (!index) {
    index = buildKeywordIndex(keywords)
    indexes.set(keywords, index)
  }
  return index
}

function buildLocalizedIndex(keywords: KeywordCatalog, locale: string) {
  if (locale === 'ko') {
    const krKeys = Object.keys(keywords).sort((a, b) => b.length - a.length)
    return { localKeywords: krKeys, localToKr: {} as Record<string, string> }
  }
  const map: Record<string, string> = {} // localName → krName
  const list: string[] = []
  for (const [krName, info] of Object.entries(keywords)) {
    const localName = locale === 'en' ? info.nameEn : info.nameJp
    if (localName) {
      map[localName] = krName
      list.push(localName)
    }
    // KR name as fallback (some descriptions mix languages)
    map[krName] = krName
    list.push(krName)
  }
  // Internal game-data tag aliases → KR keyword names
  // EN effect descriptions use these internal tags (e.g. [Vibration])
  // but keyword_meta stores display names (e.g. "Tremor")
  const TAG_ALIASES: Record<string, string> = {
    'Aggro': '도발치',
    'Agility': '신속',
    'AttackDmgUp': '피해량 증가',
    'AttackDown': '공격 레벨 감소',
    'AttackUp': '공격 레벨 증가',
    'AzureResultUp': '우울 위력 증가',
    'Binding': '속박',
    'BlessingOfIndexPrescriptAlly': '지령의 가호',
    'BloodArmorCasting': '주조된 경혈',
    'BloodDinner': '혈찬',
    'BloodDinner_Accumulation': '누적 소모 혈찬',
    'BloodDinner_Common_Accumulation': '공용 누적 소모 혈찬',
    'Breath': '호흡',
    'Bullet': '탄환',
    'Burst': '파열',
    'BurstAgility': '주살【신속】',
    'Charge': '충전',
    'ChargeForceField': '충전 역장',
    'ChargeLoad': '부하',
    'ChoSuperCharge': '초아광축전',
    'Combustion': '화상',
    'CriticalDamageUp': '크리티컬 피해량 증가',
    'DefenseDown': '방어 레벨 감소',
    'DefenseUp': '방어 레벨 증가',
    'DesperadoBuff': '데스페라도',
    'Discard': '버림',
    'EmergencyChargeForceField': '비상용 역장 배터리',
    'Endurance': '수비 위력 증가',
    'Enhancement': '공격 위력 증가',
    'FusionVibration': '진폭 얽힘',
    'GiftCannon': '화력',
    'GiftGlass': '연약',
    'GreatAesthetics': '훌륭한 미감',
    'HighVoltageExoshell': '고전압 외피',
    'HitDamageUp': '타격 피해량 증가',
    'HitResultUp': '타격 위력 증가',
    'IDMicroChip': '주민등록 마이크로칩',
    'IndexPrescriptTargetToEnemy': '지령 대상',
    'Inspire': '영감',
    'KarmaOfIndexAlly': '카르마',
    'KnightBless': '가호',
    'Laceration': '출혈',
    'LookingFutureMirror': '순간의 예지',
    'MentalSystemResultDecrease_Typo': '정신력 감소 효율',
    'MentalSystemResultIncrease_Typo': '정신력 회복 효율',
    'MinusCoinValueUp': '빼기 코인 강화',
    'MlynarWaiting': '칼집 속 사람',
    'Muckworm': '구더기',
    'NailPersonality': '못',
    'NervousImpairment': '신경 손상',
    'ObjectOfExploration': '탐구 대상',
    'PaintingMaterial': '그림 재료',
    'Paralysis': '마비',
    'ParryingResultUp': '합 위력 증가',
    'PenetrateDamageUp': '관통 피해량 증가',
    'PenetrateResultUp': '관통 위력 증가',
    'PinkPetals': '분홍 꽃잎',
    'PlusCoinValueUp': '더하기 코인 강화',
    'Protection': '보호',
    'QueenBeeMark': '페로몬 표식',
    'QueenBeepheromone': '페로몬',
    'RequestedTarget': '의뢰 대상',
    'ResultEnhancement': '위력 증가',
    'ResultReduction': '위력 감소',
    'RetaliationBook': '앙갚음 대상',
    'RetreatForCommon': '전장 퇴각',
    'RoseThorn': '탐식극(貪食棘)',
    'ScarletResultUp': '색욕 위력 증가',
    'ShareCharge': '자가 공진 회로',
    'Sinking': '침잠',
    'SkillPowerUp': '기본 위력 증가',
    'SlashDamageUp': '참격 피해량 증가',
    'SlashResultUp': '참격 위력 증가',
    'SuperCoin': '파괴 불가 코인',
    'SwirlingBloodPersonality': '일렁임【혈귀】',
    'Switch_Vibration': '진폭 변환',
    'TakeHpHealIncrease': '체력 회복 증가',
    'TakeHpHealReduce': '체력 회복 감소',
    'TensionUp': '텐션 업',
    'TimeRentalTwoPersonality': '시간 대여',
    'TimeSuspend': '시간 유예',
    'TraumaShield': '트라우마 방지장',
    'UltraPrecisionTimeAcceleration': '초정밀 시간 가속',
    'UnlockBuff_Base': '해금',
    'VerEmergencyCandy': '비상용 사탕',
    'VerHunger': '배고픔',
    'Vibration': '진동',
    'VibrationDistribution': '진동 - 분배',
    'VibrationExplosion': '진동 폭발',
    'VibrationIgnition': '진동 - 작열',
    'VibrationNesting': '진동 - 중첩',
    'VioletTakeDamageUp': '질투 취약',
    'Vulnerable': '취약',
    'WaveSinking': '역류',
    'Zazen': '참선',
  }
  for (const [tag, krName] of Object.entries(TAG_ALIASES)) {
    if (!map[tag]) {
      map[tag] = krName
      list.push(tag)
    }
  }
  return {
    localKeywords: [...new Set(list)].sort((a, b) => b.length - a.length),
    localToKr: map,
  }
}

export function getLocalizedKeywordIndex(keywords: KeywordCatalog, locale: string) {
  let byLocale = localizedIndexes.get(keywords)
  if (!byLocale) {
    byLocale = new Map()
    localizedIndexes.set(keywords, byLocale)
  }
  let index = byLocale.get(locale)
  if (!index) {
    index = buildLocalizedIndex(keywords, locale)
    byLocale.set(locale, index)
  }
  return index
}
