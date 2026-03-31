import type { ReactNode } from 'react'
import { SIN_KR_TO_EN, SIN_COLORS } from '@/lib/constants/sin'
import { KEYWORD_COLORS } from '@/components/mirror-dungeon/types'
import { CHOICE_EVENT_EFFECTS } from '@/lib/data/choice-event-effects'
import { ACTION_EVENT_EFFECTS, AB_EVENT_EFFECTS } from '@/lib/data/event-effects-map'

// ── Unity <color=...> 태그 파서 ─────────────────────────────────────────────

const UNITY_COLOR_RE = /<color=(#[0-9a-fA-F]{6})>([\s\S]*?)<\/color>/g

/** Unity <color=#hex>text</color> 태그를 React span으로 변환 */
export function parseUnityColorTags(raw: string): ReactNode {
  const parts: ReactNode[] = []
  let cursor = 0
  let keyIdx = 0

  // 잘못된 닫는 태그 정리 (</color=#xxx> → </color>)
  const cleaned = raw.replace(/<\/color=[^>]*>/g, '</color>')

  const re = new RegExp(UNITY_COLOR_RE.source, UNITY_COLOR_RE.flags)
  let m: RegExpExecArray | null
  while ((m = re.exec(cleaned)) !== null) {
    if (m.index > cursor) {
      parts.push(cleaned.slice(cursor, m.index))
    }
    parts.push(
      <span key={keyIdx++} style={{ color: m[1], fontWeight: 600 }}>
        {m[2]}
      </span>
    )
    cursor = m.index + m[0].length
  }
  if (cursor < cleaned.length) parts.push(cleaned.slice(cursor))

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}

// ── 이벤트 효과 텍스트 조회 ─────────────────────────────────────────────────

/** 액션 이벤트 옵션의 효과 (게임 데이터 직접 조회) */
export function getOptionEffects(eventId: number, optionIndex: number): ReactNode[] {
  const texts = ACTION_EVENT_EFFECTS[eventId]?.[optionIndex]
  if (!texts) return []
  return texts.map(t => parseUnityColorTags(t))
}

/** AbEvent(연계 이벤트)의 성공/실패 효과 */
export function getAbEventEffects(eventId: number): { success: ReactNode[]; failure: ReactNode[] } {
  const data = AB_EVENT_EFFECTS[eventId]
  if (!data) return { success: [], failure: [] }
  return {
    success: data.success.map(t => parseUnityColorTags(t)),
    failure: data.failure.map(t => parseUnityColorTags(t)),
  }
}

// ── 효과 텍스트 컬러 코딩 (나레이션용) ──────────────────────────────────────

const EFFECT_PATTERNS: Array<{ pattern: RegExp; color: string; bold?: boolean }> = [
  // E.G.O 기프트 (이름 포함) 획득
  { pattern: /E\.?G\.?O\s*(GIFT|기프트)\s*.*?획득!?/gi, color: '#fcba03', bold: true },
  { pattern: /E\.?G\.?O\s*(GIFT|기프트)/gi, color: '#fcba03' },
  // 체력+정신력 동시 피해
  { pattern: /\d+만큼\s*체력[,\s]*정신력\s*피해!?/g, color: '#e30000', bold: true },
  // 체력 피해
  { pattern: /\d+만큼\s*체력\s*피해!?/g, color: '#e30000', bold: true },
  { pattern: /체력\s*\d+\s*피해/g, color: '#e30000', bold: true },
  { pattern: /체력을?\s*(잃|회복|감소|피해)/g, color: '#e30000' },
  // 정신력 피해
  { pattern: /\d+만큼\s*정신력\s*피해!?/g, color: '#fe4b48', bold: true },
  { pattern: /정신력\s*\d+\s*(피해|감소|회복)/g, color: '#fe4b48', bold: true },
  { pattern: /정신력을?\s*(잃|회복|감소|피해)/g, color: '#fe4b48' },
  // 회복
  { pattern: /\d+만큼\s*(체력|정신력)\s*회복/g, color: '#00d48a', bold: true },
  // 전투
  { pattern: /전투\s*(승리|발생)/g, color: '#d0c0a0', bold: true },
]

const SIN_NAMES_KR = Object.keys(SIN_KR_TO_EN)
const SIN_PATTERN = new RegExp(`(${SIN_NAMES_KR.join('|')})`, 'g')

const KEYWORD_NAMES = Object.keys(KEYWORD_COLORS)
const KEYWORD_PATTERN = new RegExp(`(${KEYWORD_NAMES.join('|')})`, 'g')

type TextMatch = { start: number; end: number; text: string; color: string; bold?: boolean }

/** 이벤트 나레이션 텍스트에 컬러 코딩을 적용하여 ReactNode로 반환 */
export function colorizeEventText(text: string | null | undefined): ReactNode {
  if (!text) return null
  const processed = text.replace(/\{(\d+)\}/g, '???')

  const matches: TextMatch[] = []

  for (const { pattern, color, bold } of EFFECT_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags)
    let m: RegExpExecArray | null
    while ((m = re.exec(processed)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], color, bold })
    }
  }

  {
    const re = new RegExp(SIN_PATTERN.source, SIN_PATTERN.flags)
    let m: RegExpExecArray | null
    while ((m = re.exec(processed)) !== null) {
      const sinEn = SIN_KR_TO_EN[m[0]]
      if (sinEn) {
        matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], color: SIN_COLORS[sinEn], bold: true })
      }
    }
  }

  {
    const re = new RegExp(KEYWORD_PATTERN.source, KEYWORD_PATTERN.flags)
    let m: RegExpExecArray | null
    while ((m = re.exec(processed)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], color: KEYWORD_COLORS[m[0]] })
    }
  }

  if (matches.length === 0) return processed

  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
  const filtered: TextMatch[] = []
  let lastEnd = 0
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m)
      lastEnd = m.end
    }
  }

  const parts: ReactNode[] = []
  let cursor = 0
  for (const m of filtered) {
    if (m.start > cursor) parts.push(processed.slice(cursor, m.start))
    parts.push(
      <span key={m.start} style={{ color: m.color, fontWeight: m.bold ? 600 : undefined }}>
        {m.text}
      </span>
    )
    cursor = m.end
  }
  if (cursor < processed.length) parts.push(processed.slice(cursor))

  return parts
}

/** 플레이스홀더만 치환 (문자열 반환) */
export function replaceEventPlaceholders(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(/\{(\d+)\}/g, '???')
}
