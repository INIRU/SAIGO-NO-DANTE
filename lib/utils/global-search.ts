/** 라벨을 [앞, 일치, 뒤]로 나눈다. 일치가 없으면 null. 대소문자 무시. */
export function splitMatch(label: string, query: string): [string, string, string] | null {
  const q = query.trim()
  if (!q) return null
  const at = label.toLowerCase().indexOf(q.toLowerCase())
  if (at < 0) return null
  return [label.slice(0, at), label.slice(at, at + q.length), label.slice(at + q.length)]
}

/** IME 조합 중에는 검색어를 바꾸지 않고, 조합이 끝나면 확정된 값을 쓴다. */
export function committedQuery(prev: string, next: string, composing: boolean): string {
  return composing ? prev : next
}
