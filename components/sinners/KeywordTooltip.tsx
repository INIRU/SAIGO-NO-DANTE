'use client'

import { useState, useRef } from 'react'
import { getKeywordIconUrl } from '@/lib/data/sinners'
import { KEYWORD_DESCRIPTIONS } from '@/lib/data/keyword-descriptions'

// ─── 키워드 아이콘 + 툴팁 컴포넌트 ───────────────────────────────────
export function KeywordWithTooltip({
  keyword,
  inline,
  children,
}: {
  keyword: string
  inline?: boolean
  children?: React.ReactNode
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const iconUrl = getKeywordIconUrl(keyword)
  const info = KEYWORD_DESCRIPTIONS[keyword]

  if (!info && !iconUrl) return <>{children}</>

  return (
    <span
      ref={ref}
      className="inline-flex items-center"
      onMouseEnter={() => setRect(ref.current?.getBoundingClientRect() ?? null)}
      onMouseLeave={() => setRect(null)}
      style={{ cursor: info ? 'help' : 'default', verticalAlign: 'middle', position: 'relative' }}
    >
      {iconUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          width={inline ? 14 : 16}
          height={inline ? 14 : 16}
          style={{
            display: 'inline-block',
            verticalAlign: 'middle',
            marginRight: inline ? '2px' : '4px',
            flexShrink: 0,
          }}
        />
      )}
      {children}
      {rect && info && (
        <span
          className="z-[200] px-3 py-2 rounded shadow-lg text-left pointer-events-none"
          style={{
            position: 'fixed',
            left: Math.min(rect.left, window.innerWidth - 310),
            ...(rect.top > 120
              ? { bottom: window.innerHeight - rect.top + 6 }
              : { top: rect.bottom + 6 }),
            background: '#1a1510',
            border: '1px solid #3a3020',
            minWidth: '200px',
            maxWidth: '300px',
            whiteSpace: 'normal',
          }}
        >
          <span style={{ color: '#e8dcc8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
            {keyword}{info.maxStack ? ` (최대 ${info.maxStack})` : ''}
          </span>
          <span style={{ color: '#999', fontSize: '0.6875rem', lineHeight: 1.5, display: 'block', whiteSpace: 'pre-line' }}>
            {info.desc}
          </span>
        </span>
      )}
    </span>
  )
}

// ─── 스킬 설명 포맷터 ─────────────────────────────────────────────────
export const ALL_KEYWORDS = Object.keys(KEYWORD_DESCRIPTIONS).sort((a, b) => b.length - a.length)

export function isHangul(ch: string | undefined): boolean {
  if (!ch) return false
  const code = ch.charCodeAt(0)
  return (code >= 0xAC00 && code <= 0xD7A3) || (code >= 0x3131 && code <= 0x318E)
}

export function formatSkillDesc(
  text: string,
  color: string,
  skillNameColors?: Record<string, string>,
) {
  const parts: {
    text: string
    type: 'normal' | 'bracket' | 'keyword' | 'number' | 'skillname'
    skillColor?: string
  }[] = []
  let remaining = text
  let prevChar = ''

  const skillNames = skillNameColors
    ? Object.keys(skillNameColors).sort((a, b) => b.length - a.length)
    : []

  while (remaining.length > 0) {
    // 1. [대괄호] 패턴
    const bracketMatch = remaining.match(/^\[([^\]]+)\]/)
    if (bracketMatch) {
      parts.push({ text: bracketMatch[0], type: 'bracket' })
      prevChar = bracketMatch[0][bracketMatch[0].length - 1]
      remaining = remaining.slice(bracketMatch[0].length)
      continue
    }

    // 2. 상태이상 키워드 (짧은 키워드 앞뒤에 한글이 이어지면 무시)
    let foundKeyword = false
    for (const kw of ALL_KEYWORDS) {
      const afterBoundary = kw.length <= 2 && isHangul(remaining[kw.length])
      const beforeBoundary = kw.length <= 2 && isHangul(prevChar)
      if (remaining.startsWith(kw) && !afterBoundary && !beforeBoundary) {
        parts.push({ text: kw, type: 'keyword' })
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
    for (const kw of ALL_KEYWORDS) {
      let searchFrom = 0
      while (searchFrom < remaining.length) {
        const kwIdx = remaining.indexOf(kw, searchFrom)
        if (kwIdx < 0) break
        const afterBound = kw.length <= 2 && isHangul(remaining[kwIdx + kw.length])
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
        return <span key={i} style={{ color, fontWeight: 600 }}>{p.text}</span>
      case 'keyword':
        return (
          <KeywordWithTooltip key={i} keyword={p.text} inline>
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
