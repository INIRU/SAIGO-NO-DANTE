// Design Ref: §2 — 파서 설계 (Option C: 실용적 균형)

/** 섹션 마커로 분리된 하나의 섹션 */
export interface AISection {
  title: string
  content: string
}

/** 리치 콘텐츠 파싱 결과의 개별 노드 */
export type RichNode =
  | { type: 'text'; value: string }
  | { type: 'skill'; order: number; variant?: number }
  | { type: 'passive'; passiveType: 'battle' | 'support' }

const SECTION_MARKER = /^---section:(.+?)---$/gm

/**
 * AI 출력을 섹션 마커 기준으로 분리한다.
 * 마커가 없으면 전체를 단일 섹션으로 반환 (구형 데이터 fallback).
 */
export function splitSections(raw: string): AISection[] {
  const markers: { title: string; start: number }[] = []
  let match: RegExpExecArray | null

  SECTION_MARKER.lastIndex = 0
  while ((match = SECTION_MARKER.exec(raw)) !== null) {
    markers.push({ title: match[1].trim(), start: match.index + match[0].length })
  }

  if (markers.length === 0) {
    return [{ title: 'AI 분석', content: raw.trim() }]
  }

  const sections: AISection[] = []
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].start
    const end = i + 1 < markers.length
      ? raw.lastIndexOf('---section:', markers[i + 1].start)
      : raw.length
    const content = raw.slice(start, end).trim()
    if (content) {
      sections.push({ title: markers[i].title, content })
    }
  }

  return sections
}

const COMPONENT_RE = /\{\{(skill|passive):([^}]+)\}\}/g
const VALID_PASSIVE_TYPES = new Set(['battle', 'support'])

/**
 * 섹션 콘텐츠에서 컴포넌트 문법({{skill:N}}, {{passive:type}})을 파싱한다.
 * 잘못된 문법은 텍스트로 유지 (graceful fallback).
 */
export function parseRichContent(content: string): RichNode[] {
  const nodes: RichNode[] = []
  let lastIndex = 0

  COMPONENT_RE.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = COMPONENT_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }

    const kind = match[1]
    const args = match[2]

    if (kind === 'skill') {
      const parts = args.split(':').map(s => s.trim())
      const order = parseInt(parts[0], 10)
      if (!isNaN(order) && order > 0) {
        const variant = parts[1] ? parseInt(parts[1], 10) : undefined
        nodes.push({
          type: 'skill',
          order,
          variant: variant && !isNaN(variant) ? variant : undefined,
        })
      } else {
        nodes.push({ type: 'text', value: match[0] })
      }
    } else if (kind === 'passive') {
      const passiveType = args.trim()
      if (VALID_PASSIVE_TYPES.has(passiveType)) {
        nodes.push({ type: 'passive', passiveType: passiveType as 'battle' | 'support' })
      } else {
        nodes.push({ type: 'text', value: match[0] })
      }
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    nodes.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return nodes
}
