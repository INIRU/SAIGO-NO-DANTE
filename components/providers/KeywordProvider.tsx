'use client'

import { cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { ATK_TYPE_ICON_MAP, STORAGE_BASE } from '@/lib/constants/game'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
import { SIN_COLORS } from '@/lib/constants/sin'
import { getLocalizedKeywordDesc, getLocalizedKeywordName } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n'
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

const KeywordContext = createContext<Record<string, KeywordInfo>>({})

const BASE_ATTACK_ICON_KEYS: Record<string, keyof typeof ATK_TYPE_ICON_MAP> = {
  slash: 'slash',
  pierce: 'pierce',
  blunt: 'blunt',
  '참격': 'slash',
  '관통': 'pierce',
  '타격': 'blunt',
}

const KEYWORD_POSITIVE_COLOR = '#f8c200'
const KEYWORD_NEGATIVE_COLOR = '#e30000'
const KEYWORD_WARNING_COLOR = '#ff0000'
const KEYWORD_DEFAULT_COLOR = '#e8dcc8'

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

function resolveKeywordTextColor(keyword: string, info?: KeywordInfo, fallbackKey?: string): string {
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

export function resolveKeywordIconUrl(keyword: string, iconSlug?: string | null): string | null {
  const attackIconKey = BASE_ATTACK_ICON_KEYS[keyword] ?? (iconSlug ? BASE_ATTACK_ICON_KEYS[iconSlug] : undefined)
  if (attackIconKey) return ATK_TYPE_ICON_MAP[attackIconKey] ?? null
  return getKeywordIconUrl(keyword, iconSlug ?? undefined)
}

export function KeywordProvider({
  keywords,
  children,
}: {
  keywords: Record<string, KeywordInfo>
  children: React.ReactNode
}) {
  return (
    <KeywordContext.Provider value={keywords}>
      {children}
    </KeywordContext.Provider>
  )
}

export function useKeywords() {
  return useContext(KeywordContext)
}

/** formatSkillDesc를 훅으로 제공 — 컴포넌트 최상위에서 호출 */
export function useFormatSkillDesc() {
  const keywords = useKeywords()
  const locale = useLocale()

  const { localKeywords, localToKr } = useMemo(() => {
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
  }, [keywords, locale])

  return useCallback(
    (text: string, color: string, skillNameColors?: Record<string, string>, allowedKeywords?: Set<string>) => {
      const filtered = allowedKeywords
        ? localKeywords.filter(kw => {
            const krName = localToKr[kw] ?? kw
            return allowedKeywords.has(krName) || allowedKeywords.has(kw)
          })
        : localKeywords
      return formatSkillDescInner(text, color, filtered, keywords, skillNameColors, localToKr)
    },
    [keywords, localKeywords, localToKr],
  )
}

// ─── 내부 구현 (KeywordTooltip.tsx에서 이동) ────────────────────────
// 이 함수는 훅이 아니므로 직접 호출하지 마세요. useFormatSkillDesc()를 사용하세요.

/**
 * Context 기반 키워드 데이터 훅.
 * KEYWORD_SIN_MAP / KEYWORD_ICON_MAP 하드코딩 대체용.
 */
export function useKeywordData() {
  const keywords = useKeywords()

  const sinMap = useMemo(() => {
    const map: Record<string, SinType> = {}
    for (const [kw, info] of Object.entries(keywords)) {
      if (info.sinAffinity) map[kw] = info.sinAffinity as SinType
    }
    return map
  }, [keywords])

  const iconMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [kw, info] of Object.entries(keywords)) {
      if (info.iconSlug) map[kw] = info.iconSlug
    }
    return map
  }, [keywords])

  const getIconUrl = useCallback((keyword: string): string | null => {
    const slug = keywords[keyword]?.iconSlug
    return resolveKeywordIconUrl(keyword, slug)
  }, [keywords])

  return { sinMap, iconMap, getIconUrl, keywords }
}

function isHangul(ch: string | undefined): boolean {
  if (!ch) return false
  const code = ch.charCodeAt(0)
  return (code >= 0xAC00 && code <= 0xD7A3) || (code >= 0x3131 && code <= 0x318E)
}

/** 키워드 뒤에 올 수 있는 한국어 조사 — 이 글자가 오면 경계로 취급하지 않음 */
const PARTICLES = new Set([
  '이', '가', '을', '를', '의', '에', '은', '는',
  '과', '와', '도', '로', '만', '야', '라', '며',
  '든', '인', '및', '나', '란', '당', '때', '면',
  '부', '까', '서', '보', '처', '한',
])

/** 키워드 뒤에 조사가 오는지 확인 — 조사면 경계가 아님 (키워드 매칭 허용) */
function isParticleAfter(text: string, kwLen: number): boolean {
  const nextCh = text[kwLen]
  if (!nextCh) return false
  return PARTICLES.has(nextCh)
}

function KwTooltipPopup({ rect, iconUrl, keyword, info, onMouseEnter, onMouseLeave }: {
  rect: DOMRect; iconUrl: string | null; keyword: string; info: KeywordInfo
  onMouseEnter: () => void; onMouseLeave: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const t = useTranslations()
  const locale = useLocale()

  const localName = getLocalizedKeywordName(keyword, info, locale as SupportedLang)
  const localDesc = getLocalizedKeywordDesc(info.desc, info, locale as SupportedLang)

  const spaceAbove = rect.top
  const spaceBelow = window.innerHeight - rect.bottom
  const showAbove = spaceAbove > spaceBelow
  const maxH = Math.min((showAbove ? spaceAbove : spaceBelow) - 20, window.innerHeight * 0.5)

  useEffect(() => {
    const el = contentRef.current
    if (el) setOverflowing(el.scrollHeight > el.clientHeight)
  }, [])

  return (
    <span
      className="z-[200] rounded shadow-lg text-left"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left: Math.min(rect.left, window.innerWidth - 310),
        ...(showAbove
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
        background: '#1a1510',
        border: '1px solid #3a3020',
        minWidth: '200px',
        maxWidth: '300px',
        whiteSpace: 'normal',
        overflow: 'hidden',
      }}
    >
      <div
        ref={contentRef}
        style={{
          padding: '8px 12px',
          maxHeight: maxH,
          overflowY: overflowing ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
        }}
      >
        <span style={{ color: '#e8dcc8', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
          {iconUrl && (
            <Image src={iconUrl} alt="" width={16} height={16} unoptimized style={{ flexShrink: 0, width: '1rem', height: '1rem' }} />
          )}
          {localName}{info.maxStack ? ` (${t('keyword.maxStack')} ${info.maxStack})` : ''}
        </span>
        <span style={{ color: '#999', fontSize: '0.6875rem', lineHeight: 1.5, display: 'block', whiteSpace: 'pre-line' }}>
          {localDesc}
        </span>
      </div>
      {overflowing && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0, height: 32,
          background: 'linear-gradient(to bottom, transparent, #1a1510)',
          borderRadius: '0 0 4px 4px',
          pointerEvents: 'none',
        }} />
      )}
    </span>
  )
}

// 한 번에 하나의 키워드 툴팁만 표시
let activeKwClose: (() => void) | null = null

/** 키워드 아이콘 + 툴팁 (context에서 키워드 데이터 사용) */
export function KeywordWithTooltip({
  keyword,
  krKey,
  inline,
  children,
  displayColor,
}: {
  keyword: string
  /** KR key for lookup when keyword is an EN/JP name */
  krKey?: string
  inline?: boolean
  children?: React.ReactNode
  displayColor?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const keywords = useKeywords()
  const lookupKey = krKey ?? keyword
  const info = keywords[lookupKey]
  const iconUrl = getKeywordIconUrl(lookupKey, info?.iconSlug)

  const hide = useCallback(() => setRect(null), [])
  const show = useCallback(() => {
    if (activeKwClose && activeKwClose !== hide) activeKwClose()
    clearTimeout(hideTimeout.current)
    setRect(ref.current?.getBoundingClientRect() ?? null)
    activeKwClose = hide
  }, [hide])
  const scheduleHide = useCallback(() => {
    hideTimeout.current = setTimeout(() => { setRect(null); if (activeKwClose === hide) activeKwClose = null }, 120)
  }, [hide])
  const cancelHide = useCallback(() => {
    clearTimeout(hideTimeout.current)
  }, [])
  const toggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setRect(prev => prev ? null : ref.current?.getBoundingClientRect() ?? null)
  }, [])

  // 외부 탭 시 닫기
  useEffect(() => {
    if (!rect) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setRect(null)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [rect])

  const textColorHint = `${keyword} ${lookupKey}`
  const iconColorHint = `${info?.iconSlug ?? ''} ${iconUrl ?? ''}`.toLowerCase()
  const hasBladetrailHint =
    textColorHint.includes('검흔') ||
    textColorHint.includes('잔상') ||
    textColorHint.includes('Bladetrail') ||
    iconColorHint.includes('bladetrail-afterimage') ||
    iconColorHint.includes('bladetrail')
  const explicitEffectType = info?.effectType ?? info?.effect_type
  let resolvedDisplayColor = !explicitEffectType && hasBladetrailHint ? KEYWORD_NEGATIVE_COLOR : displayColor
  if (!resolvedDisplayColor || resolvedDisplayColor === KEYWORD_DEFAULT_COLOR) {
    resolvedDisplayColor = resolveKeywordTextColor(keyword, info, lookupKey)
  }

  const renderedChildren = resolvedDisplayColor !== KEYWORD_DEFAULT_COLOR
    ? isValidElement<{ style?: React.CSSProperties }>(children)
      ? cloneElement(children, { style: { ...children.props.style, color: resolvedDisplayColor } })
      : <span style={{ color: resolvedDisplayColor }}>{children}</span>
    : children

  if (!info && !iconUrl) return <>{renderedChildren}</>

  return (
    <span
      ref={ref}
      className="inline keyword-token"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onClick={toggle}
      style={{ cursor: info ? 'help' : 'default', position: 'relative' }}
    >
      {iconUrl && (
        <Image
          src={iconUrl}
          alt=""
          width={inline ? 14 : 16}
          height={inline ? 14 : 16}
          unoptimized
          style={{
            display: 'inline',
            verticalAlign: 'text-bottom',
            marginRight: inline ? '0.0625rem' : '0.1875rem',
            width: '1em',
            height: '1em',
          }}
        />
      )}
      {renderedChildren}
      {rect && info && typeof document !== 'undefined' && createPortal(
        <KwTooltipPopup rect={rect} iconUrl={iconUrl} keyword={lookupKey} info={info} onMouseEnter={cancelHide} onMouseLeave={scheduleHide} />,
        document.body,
      )}
    </span>
  )
}

function formatSkillDescInner(
  text: string,
  color: string,
  allKeywords: string[],
  keywordInfo: Record<string, KeywordInfo>,
  skillNameColors?: Record<string, string>,
  localToKr?: Record<string, string>,
) {
  const parts: {
    text: string
    type: 'normal' | 'bracket' | 'keyword' | 'number' | 'skillname'
    skillColor?: string
    krKey?: string
  }[] = []
  let remaining = text
  let prevChar = ''

  const skillNames = skillNameColors
    ? Object.keys(skillNameColors).sort((a, b) => b.length - a.length)
    : []

  while (remaining.length > 0) {
    // 1. [대괄호] / 【대괄호】 패턴
    const bracketMatch = remaining.match(/^(?:\[([^\]]+)\]|【([^】]+)】)/)
    if (bracketMatch) {
      const inner = bracketMatch[1] || bracketMatch[2]
      const krKey = localToKr?.[inner] ?? (localToKr?.[bracketMatch[0]] ? localToKr[bracketMatch[0]] : undefined)
      parts.push({ text: bracketMatch[0], type: 'bracket', krKey })
      prevChar = bracketMatch[0][bracketMatch[0].length - 1]
      remaining = remaining.slice(bracketMatch[0].length)
      continue
    }

    // 2. 상태이상 키워드 (짧은 키워드 앞뒤에 한글이 이어지면 무시, 단 조사는 허용)
    let foundKeyword = false
    for (const kw of allKeywords) {
      const afterHangul = kw.length <= 2 && isHangul(remaining[kw.length])
      const afterBoundary = afterHangul && !isParticleAfter(remaining, kw.length)
      const beforeBoundary = kw.length <= 2 && isHangul(prevChar)
      if (remaining.startsWith(kw) && !afterBoundary && !beforeBoundary) {
        parts.push({ text: kw, type: 'keyword', krKey: localToKr?.[kw] })
        prevChar = kw[kw.length - 1]
        remaining = remaining.slice(kw.length)
        const numMatch = remaining.match(/^( 횟수)?( \d+)/)
        if (numMatch) {
          parts.push({ text: numMatch[0], type: 'number' })
          prevChar = numMatch[0][numMatch[0].length - 1]
          remaining = remaining.slice(numMatch[0].length)
        }
        foundKeyword = true
        break
      }
    }
    if (foundKeyword) continue

    // 3. 스킬 이름 매칭
    let foundSkillName = false
    for (const name of skillNames) {
      if (remaining.startsWith(name)) {
        parts.push({ text: name, type: 'skillname', skillColor: skillNameColors![name] })
        prevChar = name[name.length - 1]
        remaining = remaining.slice(name.length)
        foundSkillName = true
        break
      }
    }
    if (foundSkillName) continue

    // 4. 일반 텍스트
    let nextIdx = remaining.length
    const bracketIdx = remaining.indexOf('[')
    if (bracketIdx > 0) nextIdx = Math.min(nextIdx, bracketIdx)
    const fwBracketIdx = remaining.indexOf('【')
    if (fwBracketIdx > 0) nextIdx = Math.min(nextIdx, fwBracketIdx)
    for (const kw of allKeywords) {
      let searchFrom = 0
      while (searchFrom < remaining.length) {
        const kwIdx = remaining.indexOf(kw, searchFrom)
        if (kwIdx < 0) break
        const afterH = kw.length <= 2 && isHangul(remaining[kwIdx + kw.length])
        const afterBound = afterH && !isParticleAfter(remaining.slice(kwIdx), kw.length)
        const beforeBound = kw.length <= 2 && kwIdx > 0 && isHangul(remaining[kwIdx - 1])
        if (kwIdx > 0 && !afterBound && !beforeBound) { nextIdx = Math.min(nextIdx, kwIdx); break }
        searchFrom = kwIdx + 1
      }
    }
    for (const name of skillNames) {
      const nameIdx = remaining.indexOf(name)
      if (nameIdx > 0) nextIdx = Math.min(nextIdx, nameIdx)
    }
    const chunk = remaining.slice(0, nextIdx)
    parts.push({ text: chunk, type: 'normal' })
    prevChar = chunk[chunk.length - 1] ?? prevChar
    remaining = remaining.slice(nextIdx)
  }

  return parts.map((p, i) => {
    switch (p.type) {
      case 'bracket':
        if (p.krKey) {
          const inner = p.text.replace(/^[\[【]|[\]】]$/g, '')
          const resolvedColor = resolveKeywordTextColor(inner, keywordInfo[p.krKey], p.krKey)
          return (
            <KeywordWithTooltip key={i} keyword={inner} krKey={p.krKey} inline displayColor={resolvedColor}>
              <span style={{ color: resolvedColor, fontWeight: 600 }}>{inner}</span>
            </KeywordWithTooltip>
          )
        }
        const resolvedBracketColor = resolveKeywordTextColor(p.text)
        return (
          <span key={i} style={{ color: resolvedBracketColor === KEYWORD_DEFAULT_COLOR ? color : resolvedBracketColor, fontWeight: 600 }}>
            {p.text}
          </span>
        )
      case 'keyword':
        const lookupKey = p.krKey ?? p.text
        const resolvedKeywordColor = resolveKeywordTextColor(p.text, keywordInfo[lookupKey], lookupKey)
        return (
          <KeywordWithTooltip key={i} keyword={p.text} krKey={p.krKey} inline displayColor={resolvedKeywordColor}>
            <span style={{ color: resolvedKeywordColor, fontWeight: 600 }}>{p.text}</span>
          </KeywordWithTooltip>
        )
      case 'number':
        return <span key={i} style={{ color: '#e8b030', fontWeight: 700 }}>{p.text}</span>
      case 'skillname':
        const resolvedSkillNameColor = resolveKeywordTextColor(p.text)
        return <span key={i} style={{ color: resolvedSkillNameColor === KEYWORD_DEFAULT_COLOR ? p.skillColor : resolvedSkillNameColor, fontWeight: 600 }}>{p.text}</span>
      default:
        return <span key={i}>{p.text}</span>
    }
  })
}
