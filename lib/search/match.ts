const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const isCho = (c: string) => c >= 'ㄱ' && c <= 'ㅎ'

function cho(c: string) {
  const n = c.charCodeAt(0) - 0xac00
  return n >= 0 && n <= 11171 ? CHO[Math.floor(n / 588)] : c
}

// 공백·기호·대소문자·전각을 무시한다. 한글 자모(ㄱ~ㅣ)는 NFKC가 다른 코드로 바꾸므로 그대로 둔다.
export const normalize = (s: string) =>
  s.replace(/[^\u3131-\u318e]+/g, m => m.normalize('NFKC')).toLowerCase().replace(/[\s\-_.,·:;'"!?()[\]「」『』]/g, '')

// 검색어의 자음(ㄱ~ㅎ)은 그 자리 음절의 초성과 맞춰 본다. "ㄹㅊ", "로ㅈ" 모두 가능.
function indexOf(hay: string, q: string) {
  outer: for (let i = 0; i + q.length <= hay.length; i++) {
    for (let j = 0; j < q.length; j++) {
      const h = hay[i + j], c = q[j]
      if (h !== c && !(isCho(c) && cho(h) === c)) continue outer
    }
    return i
  }
  return -1
}

/** 0이면 불일치. 정확히 일치 3 > 앞부분 일치 2 > 포함 1 */
export function matchScore(names: (string | null | undefined)[], query: string): number {
  const q = normalize(query)
  if (!q) return 0
  let best = 0
  for (const name of names) {
    if (!name) continue
    const n = normalize(name)
    const i = indexOf(n, q)
    if (i >= 0) best = Math.max(best, n.length === q.length ? 3 : i === 0 ? 2 : 1)
  }
  return best
}

/** 띄어쓴 낱말이 모두 names 어딘가에 있으면 true ("이상 LCB") */
export function matchesAllWords(names: (string | null | undefined)[], query: string) {
  const words = query.trim().split(/\s+/).filter(Boolean)
  return words.length > 1 && words.every(w => matchScore(names, w) > 0)
}

/** 글자가 순서대로 들어 있는지 — 결과가 없을 때 추천용 */
export function isSubsequence(name: string, query: string) {
  const n = normalize(name), q = normalize(query)
  let i = 0
  for (const c of n) if (c === q[i] || (isCho(q[i]) && cho(c) === q[i])) i++
  return q.length > 1 && i === q.length
}
