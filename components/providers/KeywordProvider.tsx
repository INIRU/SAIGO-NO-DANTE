'use client'

import { createContext, useContext, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'

export type KeywordInfo = {
  desc: string
  maxStack?: number
  iconSlug?: string
  sinAffinity?: string
  nameEn?: string | null
  nameJp?: string | null
  descEn?: string | null
  descJp?: string | null
}

const KeywordContext = createContext<Record<string, KeywordInfo>>({})

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
  const { lang } = useLanguage()

  const { localKeywords, localToKr } = useMemo(() => {
    if (lang === 'ko') {
      const krKeys = Object.keys(keywords).sort((a, b) => b.length - a.length)
      return { localKeywords: krKeys, localToKr: {} as Record<string, string> }
    }
    const map: Record<string, string> = {} // localName → krName
    const list: string[] = []
    for (const [krName, info] of Object.entries(keywords)) {
      const localName = lang === 'en' ? info.nameEn : info.nameJp
      if (localName) {
        map[localName] = krName
        list.push(localName)
      }
      // KR name as fallback (some descriptions mix languages)
      map[krName] = krName
      list.push(krName)
    }
    return {
      localKeywords: [...new Set(list)].sort((a, b) => b.length - a.length),
      localToKr: map,
    }
  }, [keywords, lang])

  return useCallback(
    (text: string, color: string, skillNameColors?: Record<string, string>, allowedKeywords?: Set<string>) => {
      const filtered = allowedKeywords
        ? localKeywords.filter(kw => {
            const krName = localToKr[kw] ?? kw
            return allowedKeywords.has(krName) || allowedKeywords.has(kw)
          })
        : localKeywords
      return formatSkillDescInner(text, color, filtered, skillNameColors, localToKr)
    },
    [localKeywords, localToKr],
  )
}

// ─── 내부 구현 (KeywordTooltip.tsx에서 이동) ────────────────────────
// 이 함수는 훅이 아니므로 직접 호출하지 마세요. useFormatSkillDesc()를 사용하세요.

import { getKeywordIconUrl } from '@/lib/constants/keywords'
import { STORAGE_BASE } from '@/lib/constants/game'
import { useLanguage, getLocalizedKeywordName, getLocalizedKeywordDesc } from '@/lib/i18n'
import type { SinType } from '@/lib/types'
import { useState, useRef, useEffect } from 'react'

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
    if (!slug) return null
    return `${STORAGE_BASE}/icons/keywords/${slug}.webp`
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
  const { lang, t } = useLanguage()

  const localName = getLocalizedKeywordName(keyword, info, lang)
  const localDesc = getLocalizedKeywordDesc(info.desc, info, lang)

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
}: {
  keyword: string
  /** KR key for lookup when keyword is an EN/JP name */
  krKey?: string
  inline?: boolean
  children?: React.ReactNode
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

  if (!info && !iconUrl) return <>{children}</>

  return (
    <span
      ref={ref}
      className="inline"
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
      {children}
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
          return (
            <KeywordWithTooltip key={i} keyword={inner} krKey={p.krKey} inline>
              <span style={{ color: '#e8dcc8', fontWeight: 600 }}>{p.text}</span>
            </KeywordWithTooltip>
          )
        }
        return <span key={i} style={{ color, fontWeight: 600 }}>{p.text}</span>
      case 'keyword':
        return (
          <KeywordWithTooltip key={i} keyword={p.text} krKey={p.krKey} inline>
            <span style={{ color: '#e8dcc8', fontWeight: 600 }}>{p.text}</span>
          </KeywordWithTooltip>
        )
      case 'number':
        return <span key={i} style={{ color: '#e8b030', fontWeight: 700 }}>{p.text}</span>
      case 'skillname':
        return <span key={i} style={{ color: p.skillColor, fontWeight: 600 }}>{p.text}</span>
      default:
        return <span key={i}>{p.text}</span>
    }
  })
}
