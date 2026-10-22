export type SearchType = 'sinner' | 'identity' | 'ego' | 'keyword' | 'egoGift' | 'themePack' | 'event' | 'page'
export type ContextField = 'sinner' | 'keyword' | 'alias'
/** 맞은 칸: 표시 이름(label), 다른 언어 이름(ko/en/ja), 맥락 칸, 비슷한 이름(fuzzy) */
export type ReasonField = 'label' | 'ko' | 'en' | 'ja' | ContextField | 'fuzzy'

export interface IndexEntry {
  type: SearchType
  href: string
  label: string
  sublabel?: string
  icon?: string
  rarity?: number
  grade?: string | null
  names: { ko?: string | null; en?: string | null; ja?: string | null }
  /** 이름은 아니지만 이것으로도 찾는 글: 수감자 이름, 기프트 키워드, 별칭 */
  context?: { field: ContextField; text: string }[]
  /** 인격·E.G.O의 수감자 id. expandIndex가 그 수감자의 이름·별칭을 맥락으로 붙인다 */
  sinner?: string
}
export interface Reason { field: ReasonField; text: string; ranges: [number, number][] }
export interface Hit { entry: IndexEntry; score: number; reasons: Reason[] }

const SEP = /[\s\-_.,·・:;'"!?()[\]{}「」『』【】<>~/&+…|*#]/
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const isCho = (c: string) => c >= 'ㄱ' && c <= 'ㅎ'
const isSyllable = (c: string) => c >= '가' && c <= '힣'
const choOf = (c: string) => isSyllable(c) ? CHO[Math.floor((c.charCodeAt(0) - 0xac00) / 588)] : c

function foldChar(ch: string) {
  if (isSyllable(ch) || (ch >= 'ㄱ' && ch <= 'ㆎ')) return ch
  const out = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '').normalize('NFKC').toLowerCase()
  // 가타카나 → 히라가나
  return out.replace(/[ァ-ヶ]/g, k => String.fromCharCode(k.charCodeAt(0) - 0x60))
}

/** 공백·기호·대소문자·전각·라틴 장음 부호를 지우고 가타카나를 히라가나로. map[i]는 접은 글자 i의 원문 위치 */
export function fold(s: string): { text: string; map: number[] } {
  let text = ''
  const map: number[] = []
  for (let i = 0; i < s.length; i++) {
    if (SEP.test(s[i])) continue
    for (const c of foldChar(s[i])) { text += c; map.push(i) }
  }
  return { text, map }
}

const scriptOf = (c: string) => isSyllable(c) ? 'h' : /[a-z]/i.test(c) ? 'l' : /\d/.test(c) ? 'd' : 'o'
const isWordStart = (orig: string, at: number) =>
  at === 0 || SEP.test(orig[at - 1]) || scriptOf(orig[at - 1]) !== scriptOf(orig[at])

const TIER = { exact: 1000, prefix: 800, word: 600, contains: 400 } as const
type Match = { tier: number; score: number; ranges: [number, number][] }

/** 접은 검색어 q가 원문 text 어디에 맞는지. 초성만이거나 한 글자면 이름 가운데에는 맞추지 않는다 */
function matchText(text: string, q: string): Match | null {
  const f = fold(text)
  const strict = q.length === 1 || [...q].every(isCho)
  let best: Match | null = null
  outer: for (let i = 0; i + q.length <= f.text.length; i++) {
    for (let j = 0; j < q.length; j++) {
      const h = f.text[i + j], c = q[j]
      if (h !== c && !(isCho(c) && choOf(h) === c)) continue outer
    }
    const tier = i === 0 ? (q.length === f.text.length ? TIER.exact : TIER.prefix)
      : isWordStart(text, f.map[i]) ? TIER.word : strict ? 0 : TIER.contains
    if (tier && (!best || tier > best.tier)) best = { tier, score: tier, ranges: [[f.map[i], f.map[i + q.length - 1] + 1]] }
    if (best && best.tier >= TIER.prefix) break
  }
  // 같은 등급이면 짧은 이름(검색어가 더 많이 덮는 이름)이 앞
  if (best) best.score += 100 * q.length / f.text.length
  return best
}

function fields(e: IndexEntry): { field: ReasonField; text: string; weight: number }[] {
  const list: { field: ReasonField; text: string; weight: number }[] = [{ field: 'label', text: e.label, weight: 1 }]
  for (const lang of ['ko', 'en', 'ja'] as const) {
    const name = e.names[lang]
    if (name && name !== e.label) list.push({ field: lang, text: name, weight: 1 })
  }
  for (const c of e.context ?? []) list.push({ field: c.field, text: c.text, weight: 0.5 })
  return list
}

// 한 항목 안에서는 등급만 비교해, 같은 등급이면 앞 칸(표시 이름)을 근거로 둔다
function bestField(e: IndexEntry, q: string): { score: number; reason: Reason } | null {
  let best: { tier: number; score: number; reason: Reason } | null = null
  for (const f of fields(e)) {
    const m = matchText(f.text, q)
    if (m && (!best || m.tier * f.weight > best.tier)) best = { tier: m.tier * f.weight, score: m.score * f.weight, reason: { field: f.field, text: f.text, ranges: m.ranges } }
  }
  return best
}

// 같은 점수일 때 앞에 둘 종류
const TYPE_BIAS: Record<SearchType, number> = { sinner: 6, page: 5, identity: 4, ego: 3, keyword: 2, egoGift: 1, themePack: 1, event: 0 }

function subsequence(text: string, q: string): [number, number][] | null {
  const f = fold(text)
  const ranges: [number, number][] = []
  let j = 0
  for (let i = 0; i < f.text.length && j < q.length; i++) {
    const h = f.text[i], c = q[j]
    if (h !== c && !(isCho(c) && choOf(h) === c)) continue
    const at = f.map[i], last = ranges[ranges.length - 1]
    if (last && last[1] === at) last[1] = at + 1
    else ranges.push([at, at + 1])
    j++
  }
  return j === q.length ? ranges : null
}

function withinOneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** 글자가 순서대로 들어 있거나(2글자 이상), 4글자 이상 영문이 한 글자만 다른 이름 */
function fuzzy(e: IndexEntry, q: string): Reason | null {
  for (const f of fields(e)) {
    if (f.field !== 'label' && f.field !== 'ko' && f.field !== 'en' && f.field !== 'ja') continue
    if (q.length >= 4 && /^[a-z]+$/.test(q)) {
      let at = 0
      for (const word of f.text.split(SEP)) {
        if (word && withinOneEdit(fold(word).text, q)) return { field: 'fuzzy', text: f.text, ranges: [[at, at + word.length]] }
        at += word.length + 1
      }
    }
    const ranges = q.length >= 2 ? subsequence(f.text, q) : null
    if (ranges) return { field: 'fuzzy', text: f.text, ranges }
  }
  return null
}

/** 색인을 받은 뒤 한 번: 인격·E.G.O에 수감자 이름(세 언어)과 별칭을 맥락으로, 그림 뒷주소에 저장소 주소를 붙인다 */
export function expandIndex(entries: IndexEntry[], storageBase: string): IndexEntry[] {
  const sinners = new Map(entries.filter(e => e.type === 'sinner').map(e => [e.href.split('/').pop(), e]))
  return entries.map(e => {
    const icon = e.icon && !/^https?:/.test(e.icon) ? `${storageBase}/${e.icon}` : e.icon
    const s = e.sinner ? sinners.get(e.sinner) : undefined
    if (!s) return icon === e.icon ? e : { ...e, icon }
    const texts = [...new Set([s.names.ko, s.names.en, s.names.ja, ...(s.context ?? []).map(c => c.text)])].filter((t): t is string => !!t)
    return { ...e, icon, context: [...(e.context ?? []), ...texts.map(text => ({ field: 'sinner' as const, text }))] }
  })
}

export function search(entries: IndexEntry[], query: string): Hit[] {
  const trimmed = query.trim().slice(0, 80)
  const whole = fold(trimmed).text
  if (!whole) return []
  const words = trimmed.split(/\s+/).map(w => fold(w).text).filter(Boolean)

  const hits: Hit[] = []
  for (const entry of entries) {
    const one = bestField(entry, whole)
    if (one) { hits.push({ entry, score: one.score + TYPE_BIAS[entry.type], reasons: [one.reason] }); continue }
    if (words.length < 2) continue
    // 띄어 쓴 낱말이 모두 어딘가(이름이나 맥락)에 맞아야 한다
    const parts = words.map(w => bestField(entry, w))
    if (parts.every(Boolean)) {
      const sum = parts.reduce((s, p) => s + p!.score, 0)
      hits.push({ entry, score: 300 + sum / (10 * parts.length) + TYPE_BIAS[entry.type], reasons: parts.map(p => p!.reason) })
    }
  }
  if (hits.length === 0) {
    for (const entry of entries) {
      const reason = fuzzy(entry, whole)
      if (reason) hits.push({ entry, score: 100 + TYPE_BIAS[entry.type], reasons: [reason] })
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.entry.label.length - b.entry.label.length)
}
