'use client'

import { cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import KeywordIcon from '@/components/ui/KeywordIcon'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { STORAGE_BASE } from '@/lib/constants/game'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
import { getKeywordIndex, getLocalizedKeywordIndex, resolveKeywordIconUrl, type KeywordInfo } from '@/lib/keywords/catalog'
export { resolveKeywordIconUrl, type KeywordInfo } from '@/lib/keywords/catalog'
import { SIN_COLORS } from '@/lib/constants/sin'
import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'
import { getLocalizedKeywordDesc, getLocalizedKeywordName } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n'
import { skillConditionColor } from '@/lib/identity/skill-condition-color'
import type { SinType } from '@/lib/types'

const KeywordContext = createContext<Record<string, KeywordInfo>>({})

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

/** Keyword name colour shared by the tooltip and the keyword archive. */
export function keywordAccentColor(keyword: string, info?: KeywordInfo): string {
  return GIFT_KEYWORD_COLORS[keyword] ?? resolveKeywordTextColor(keyword, info)
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

type FormatSkillDescOptions = {
  /** Notes can opt in to a single backslash as a literal-keyword escape. */
  escapeKeywords?: boolean
  /** Tooltips: numbers turn gold and Potency/Count terms take this colour. */
  highlightValues?: string
}

/** formatSkillDesc를 훅으로 제공 — 컴포넌트 최상위에서 호출 */
export function useFormatSkillDesc() {
  const keywords = useKeywords()
  const locale = useLocale()

  const { localKeywords, localToKr } = getLocalizedKeywordIndex(keywords, locale)

  return useCallback(
    (text: string, color: string, skillNameColors?: Record<string, string>, allowedKeywords?: Set<string>, options?: FormatSkillDescOptions) => {
      const filtered = allowedKeywords
        ? localKeywords.filter(kw => {
            const krName = localToKr[kw] ?? kw
            return allowedKeywords.has(krName) || allowedKeywords.has(kw)
          })
        : localKeywords
      return formatSkillDescInner(text, color, filtered, keywords, skillNameColors, localToKr, options)
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
  return getKeywordIndex(useKeywords())
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

const VALUE_PATTERN = /(효과 위력|위력|횟수|Potency|Count|威力|回数|[+-]?\d+(?:\.\d+)?%?)/

function highlightValues(text: string, termColor: string) {
  return text.split(VALUE_PATTERN).map((part, i) =>
    i % 2 === 0 ? part
      : /\d/.test(part) ? <b key={i} style={{ color: '#e8b030', fontWeight: 700 }}>{part}</b>
        : <span key={i} style={{ color: termColor, fontWeight: 600 }}>{part}</span>)
}

function KwTooltipPopup({ id, rect, iconUrl, keyword, info, onMouseEnter, onMouseLeave }: {
  id: string; rect: DOMRect; iconUrl: string | null; keyword: string; info: KeywordInfo
  onMouseEnter: () => void; onMouseLeave: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const t = useTranslations()
  const locale = useLocale()

  const formatDescription = useFormatSkillDesc()
  const localName = getLocalizedKeywordName(keyword, info, locale as SupportedLang)
  const localDesc = getLocalizedKeywordDesc(info.desc, info, locale as SupportedLang)

  const spaceAbove = rect.top
  const spaceBelow = window.innerHeight - rect.bottom
  const showAbove = spaceAbove > spaceBelow
  const maxH = Math.min((showAbove ? spaceAbove : spaceBelow) - 24, window.innerHeight * 0.5)
  // 22rem, never wider than the viewport minus 0.75rem gutters; arrow stays over the trigger.
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const width = Math.min(22 * rem, window.innerWidth - 1.5 * rem)
  const gutter = 0.75 * rem
  const left = Math.max(gutter, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - gutter))
  const arrowX = Math.max(12, Math.min(rect.left + rect.width / 2 - left, width - 12))
  const color = keywordAccentColor(keyword, info)

  useEffect(() => {
    const el = contentRef.current
    if (el) setOverflowing(el.scrollHeight > el.clientHeight)
  }, [])

  return (
    <span
      id={id}
      className="z-[200] rounded text-left"
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left,
        ...(showAbove
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
        background: '#17120c',
        border: `1px solid ${color}66`,
        boxShadow: '0 12px 32px #000a',
        width,
        whiteSpace: 'normal',
      }}
    >
      <span aria-hidden style={{
        position: 'absolute', left: arrowX - 5, width: 10, height: 10, background: '#17120c', transform: 'rotate(45deg)',
        ...(showAbove
          ? { bottom: -6, borderRight: `1px solid ${color}66`, borderBottom: `1px solid ${color}66` }
          : { top: -6, borderLeft: `1px solid ${color}66`, borderTop: `1px solid ${color}66` }),
      }} />
      <div
        ref={contentRef}
        style={{
          position: 'relative',
          padding: '0.875rem 1rem 1rem',
          maxHeight: maxH,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        <span style={{ color, fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem', paddingBottom: '0.625rem', borderBottom: `1px solid ${color}33` }}>
          {iconUrl && (
            <KeywordIcon src={iconUrl} alt="" width={16} height={16} unoptimized style={{ flexShrink: 0, width: '1.5rem', height: '1.5rem' }} />
          )}
          {localName}
          {info.maxStack ? (
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {t('keyword.maxStack')} <b style={{ color: '#e8b030' }}>{info.maxStack}</b>
            </span>
          ) : null}
        </span>
        <span style={{ color: '#d0c7b8', fontSize: '0.875rem', lineHeight: 1.75, display: 'block', whiteSpace: 'pre-line' }}>
          {formatDescription(localDesc, '#d0c7b8', undefined, undefined, { highlightValues: color })}
        </span>
      </div>
      {overflowing && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0, height: 32,
          background: 'linear-gradient(to bottom, transparent, #17120c)',
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
  const tooltipId = useId()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const keywords = useKeywords()
  const lookupKey = krKey ?? keyword
  const info = keywords[lookupKey]
  const iconUrl = getKeywordIconUrl(lookupKey, info?.iconSlug)
  const [failedIconUrl, setFailedIconUrl] = useState<string | null>(null)
  const visibleIconUrl = failedIconUrl === iconUrl ? null : iconUrl

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
      className="inline keyword-token rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={scheduleHide}
      onKeyDown={info ? e => { if (e.key === 'Escape') hide() } : undefined}
      onClick={toggle}
      tabIndex={info ? 0 : undefined}
      aria-describedby={rect && info ? tooltipId : undefined}
      style={{ cursor: info ? 'help' : 'default', position: 'relative' }}
    >
      {visibleIconUrl && (
        <KeywordIcon
          src={visibleIconUrl}
          onError={() => setFailedIconUrl(visibleIconUrl)}
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
        <KwTooltipPopup id={tooltipId} rect={rect} iconUrl={visibleIconUrl} keyword={lookupKey} info={info} onMouseEnter={cancelHide} onMouseLeave={scheduleHide} />,
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
  options?: FormatSkillDescOptions,
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

  const escapedKeywordAt = (value: string) => {
    if (!options?.escapeKeywords) return null
    for (let start = value.indexOf('\\'); start >= 0; start = value.indexOf('\\', start + 1)) {
      if (start > 0 && value[start - 1] === '\\') continue
      let slashCount = 1
      while (value[start + slashCount] === '\\') slashCount += 1
      if (slashCount % 2 === 0) continue
      const keywordStart = start + slashCount
      const keyword = allKeywords.find(kw => {
        const afterHangul = kw.length <= 2 && isHangul(value[keywordStart + kw.length])
        return value.startsWith(kw, keywordStart) && !(afterHangul && !isParticleAfter(value.slice(keywordStart), kw.length))
      })
      if (keyword) return { start, slashCount, keyword }
    }
    return null
  }

  while (remaining.length > 0) {
    const escapedKeyword = escapedKeywordAt(remaining)
    if (escapedKeyword?.start === 0) {
      if (escapedKeyword.slashCount > 1) parts.push({ text: '\\'.repeat(escapedKeyword.slashCount - 1), type: 'normal' })
      parts.push({ text: escapedKeyword.keyword, type: 'normal' })
      prevChar = escapedKeyword.keyword[escapedKeyword.keyword.length - 1]
      remaining = remaining.slice(escapedKeyword.slashCount + escapedKeyword.keyword.length)
      continue
    }
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
    if (escapedKeyword) nextIdx = Math.min(nextIdx, escapedKeyword.start)
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
        const resolvedBracketColor = skillConditionColor(p.text) ?? resolveKeywordTextColor(p.text)
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
        return <span key={i}>{options?.highlightValues ? highlightValues(p.text, options.highlightValues) : p.text}</span>
    }
  })
}
