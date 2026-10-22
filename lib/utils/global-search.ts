import type { Hit, SearchType } from '@/lib/search/engine'

/** 근거 범위대로 글을 칠할 부분과 그냥 둘 부분으로 나눈다 */
export function markParts(text: string, ranges: [number, number][]): { text: string; marked: boolean }[] {
  const parts: { text: string; marked: boolean }[] = []
  let at = 0
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    if (start > at) parts.push({ text: text.slice(at, start), marked: false })
    if (end > Math.max(start, at)) parts.push({ text: text.slice(Math.max(start, at), end), marked: true })
    at = Math.max(at, end)
  }
  if (at < text.length || parts.length === 0) parts.push({ text: text.slice(at), marked: false })
  return parts
}

/** 종류별로 묶어 가장 잘 맞은 결과가 있는 묶음부터. 묶음마다 앞의 limit개(종류마다 다를 수 있다)만 남기고 전체 수를 센다 */
export function groupHits(hits: Hit[], limit: number | ((type: SearchType) => number)): { type: SearchType; total: number; hits: Hit[] }[] {
  const max = typeof limit === 'number' ? () => limit : limit
  const groups = new Map<SearchType, { type: SearchType; total: number; hits: Hit[] }>()
  for (const hit of hits) {
    const group = groups.get(hit.entry.type) ?? { type: hit.entry.type, total: 0, hits: [] }
    group.total += 1
    if (group.hits.length < max(hit.entry.type)) group.hits.push(hit)
    groups.set(hit.entry.type, group)
  }
  return [...groups.values()]
}

/** IME 조합 중에는 검색어를 바꾸지 않고, 조합이 끝나면 확정된 값을 쓴다. */
export function committedQuery(prev: string, next: string, composing: boolean): string {
  return composing ? prev : next
}
