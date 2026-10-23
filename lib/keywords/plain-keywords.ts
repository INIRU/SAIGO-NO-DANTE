import type { KeywordInfo } from '@/lib/keywords/catalog'

/**
 * Battle keywords written as plain words in the game text of older identities and E.G.O (`진동 횟수 6을 얻음`, `침잠쇄도`)
 * where newer text writes `[Vibration]`. GameText never guesses keywords in general (notes, announcements, gifts and
 * keyword tooltips stay as written); a skill or passive of an identity / E.G.O turns this on with `matchPlainKeywords`
 * and the keywords that identity / E.G.O owns (`allowedKeywords`), and this module finds the words.
 *
 * A wrong keyword in a skill text is worse than a missing one, so nothing is found unless all of these hold:
 * - the keyword is in the allowed set of that identity / E.G.O (`identities.keywords` plus the keywords its own texts
 *   reference as `[Id]` / `<link>`); an empty set finds nothing;
 * - it is in PLAIN_KEYWORDS: a battle keyword the game itself references in skill and passive text and whose plain
 *   occurrences in the stored texts of all three languages were read one by one (2026-10-19). Names that are also ordinary words or that occur inside gift, E.G.O or skill names
 *   (버림, 새벽 사무소, 경멸, 주시, Discard, Spore, Insight …) are not in it;
 * - it is written as the language names it: the Korean name, `name_en` or `name_jp` of the keyword_meta row;
 * - nothing but a non-letter stands right before it, and it does not run on into another word: after a Korean name only
 *   a space, a digit, punctuation or the particles 이 가 을 를 은 는 의; in English a whole word; in Japanese no kanji or
 *   katakana (a longer word) after it. So `광신도`, `보호막`, `소수점`, `Tremors` are never cut;
 * - `counted` keywords (ordinary words such as 신속, 보호, 취약, 못; every one-word English name; one-character names)
 *   count only next to their number: `신속 1`, `보호 2 얻음`, `Inflict 2 Haste`, `Charge Count`;
 * - it is not inside a quotation (`'…'`, `‘…’`, `"…"`, `「…」`: skill and E.G.O names), and the caller keeps it out of
 *   the identity's own skill names.
 * Every keyword name of the language takes part in the search, listed or not, so the longest wins (`참격 보호` is not
 * `보호`, `침잠쇄도` is not `침잠`), but only a listed keyword of the allowed set is drawn as a keyword.
 */

/** `free`: found wherever the name stands; `counted`: only next to a number, for names that are also ordinary words. */
export type PlainKeywordTier = 'free' | 'counted'

const FREE = [
  '진동', '충전', '출혈', '파열', '호흡', '화상', '침잠', '진동 폭발', '침잠쇄도', '충전 역장', '충전 인격',
  '탐구한 지식', '앙갚음 대상', '도발치', '차원 균열', '방출 전류', '약점 분석', '혈찬', '부당 수익', '원호 방어',
  'E.G.O 자원 획득량 +', '고귀한 품격', '분홍 리본', '원한 문신',
  '참격 취약', '관통 취약', '타격 취약', '나태 취약', '질투 취약', '분노 취약', '색욕 취약', '탐식 취약', '오만 취약', '우울 취약',
]
const COUNTED = [
  '신속', '보호', '취약', '마비', '속박', '못', '탄환', '광신', '저주', '부적', '나비', '구더기', '관',
  '피해량 증가', '피해량 감소', '공격 위력 증가', '공격 위력 감소', '수비 위력 증가', '수비 위력 감소',
  '참격 위력 증가', '타격 위력 증가', '관통 위력 증가', '참격 피해량 증가', '타격 피해량 증가', '관통 피해량 증가',
  '질투 피해량 증가', '색욕 피해량 증가', '분노 피해량 증가', '분노 위력 증가', '방어 레벨 증가', '방어 레벨 감소', '공격 레벨 증가', '공격 레벨 감소',
  '체력 회복 감소', '정신력 회복 효율', '정신력 감소 효율', '더하기 코인 강화', '더하기 코인 약화', '타격 보호', '나태 보호',
]

/** keyword_meta name (Korean) -> how a plain stretch of text may name it. */
export const PLAIN_KEYWORDS: Readonly<Record<string, PlainKeywordTier>> = Object.freeze({
  ...Object.fromEntries(FREE.map((name) => [name, 'free' as const])),
  ...Object.fromEntries(COUNTED.map((name) => [name, 'counted' as const])),
})

/**
 * A keyword's own description (tooltip, keyword page): the game writes every keyword in it as plain words, in all three
 * languages (no `[Id]` in the game's buff text). PLAIN_KEYWORDS plus the specific names keyword descriptions mention, read
 * one by one in the stored ko/en/ja descriptions (2026-10-23).
 * Left out: names that are (or sit inside) an E.G.O gift name in some language (상처, 경멸, 시선, 가호, 지령, 얽힘, 예지안,
 * 맥동, 원한, 포박, 타오름, 버림, 잔불 …), ordinary words without an English name (관통, 참격, 타격, 해금) and a passive name (추모).
 */
const KEYWORD_TEXT_FREE = [
  '12구산 연료', '과열 연료', '결투 선포', '경혈 갑주', '그림 재료', '생체 재료', '깊은 눈물', '꿰뚫는 검', '지키는 검', '호표탄', '맹호표탄',
  '맺혀가는 응어리', '불안정한 격정', '시간 대여', '천퇴성[天退星]', '신(心) - 천퇴성[天退星]', '아르뮈르 에비이예', '르누아르 개버딘 원단 코트',
  '압송 채비', '원호 공격', '저격 자세', '중지 - 원한', '지령 대상', '지령 표식', '지령의 가호', '진동 - 중첩', '진폭 변환', '진폭 얽힘',
  '집중 공격', '찢긴 색채 [루주]', '찢긴 색채 [블뢰]', '찢어진 추억', '파괴 불가 코인', '포박 [홍루]', '포자탄[기본]', '포자탄[산탄]',
  '피로 물든 손', '합 위력 증가', '해금 - I', '해금 - II', '해금 - III', '화살 - 시', '레플렉시옹', '오혈', '적안', '참회', '현혹', '새단장',
]
const KEYWORD_TEXT_COUNTED = ['부하', '배고픔', '보존', '포자', '절망', '경의']

export const KEYWORD_TEXT_KEYWORDS: Readonly<Record<string, PlainKeywordTier>> = Object.freeze({
  ...PLAIN_KEYWORDS,
  ...Object.fromEntries(KEYWORD_TEXT_FREE.map((name) => [name, 'free' as const])),
  ...Object.fromEntries(KEYWORD_TEXT_COUNTED.map((name) => [name, 'counted' as const])),
})
const KEYWORD_TEXT_NAMES = Object.keys(KEYWORD_TEXT_KEYWORDS)

/** The keywords a keyword's description may draw: every listed one but the keyword itself. */
export function keywordTextAllowed(self: string): ReadonlySet<string> {
  return new Set(KEYWORD_TEXT_NAMES.filter((name) => name !== self))
}

type Lang = 'ko' | 'en' | 'ja'

/** Other ways the stored text writes a name, so that part of it is not cut out: Japanese `振動 爆発` for `振動爆発`. */
const SPELLINGS: Readonly<Record<string, Partial<Record<Lang, readonly string[]>>>> = {
  '진동 폭발': { ja: ['振動 爆発'] },
}

export type PlainKeywordHit = { from: number; to: number; /** keyword_meta name (Korean) */ krKey: string }
export type PlainKeywordMatcher = {
  pattern: RegExp
  /** name in the language -> keyword_meta name; null when two keywords share the name (never drawn). */
  krOf: ReadonlyMap<string, string | null>
  lang: Lang
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const langOf = (locale: string): Lang => (locale === 'en' ? 'en' : locale === 'ja' ? 'ja' : 'ko')

function nameIn(lang: Lang, krKey: string, info: KeywordInfo): string {
  return ((lang === 'en' ? info.nameEn : lang === 'ja' ? info.nameJp : krKey) ?? '').trim()
}

// Left: nothing but a non-letter (a digit may stand there: `3진동`). A letter or mark in front means we are inside a word.
const LEFT = String.raw`(?<![\p{L}\p{M}])`
const LEFT_EN = String.raw`(?<![\p{L}\p{M}\p{N}_'’-])`
// Right: after a Korean name only a particle syllable may be a letter (never `광신도`, `보호막`).
const RIGHT_KO = String.raw`(?![\p{L}\p{M}](?<![이가을를은는의]))`
const RIGHT_EN = String.raw`(?![\p{L}\p{M}\p{N}_-])`
const RIGHT_JA = String.raw`(?![\p{Script=Han}\p{Script=Katakana}A-Za-z])`
// Keyword descriptions (`loose`): hiragana before a Japanese name is a particle or a verb ending (`対象に出血`, `自分の火傷`),
// and 威力 / 回数 / ダメージ after it are its Potency, Count and damage (`火傷回数`), as `Burn Potency` in English.
const LEFT_JA_LOOSE = String.raw`(?<![\p{Script=Han}\p{Script=Katakana}A-Za-z])`
const RIGHT_JA_LOOSE = String.raw`(?!(?!威力|回数|ダメージ)[\p{Script=Han}\p{Script=Katakana}A-Za-z])`

const matchers = new WeakMap<Record<string, KeywordInfo>, Map<string, PlainKeywordMatcher | null>>()

/**
 * The search for one catalog and language, built once and shared (the catalog object is stable per page). `loose`: the
 * Japanese edges of keyword descriptions (LEFT_JA_LOOSE); skill text keeps the audited ones.
 */
export function plainKeywordMatcher(keywords: Record<string, KeywordInfo>, locale: string, loose = false): PlainKeywordMatcher | null {
  let byLang = matchers.get(keywords)
  if (!byLang) matchers.set(keywords, (byLang = new Map()))
  const lang = langOf(locale)
  const key = loose && lang === 'ja' ? 'ja-loose' : lang
  if (!byLang.has(key)) byLang.set(key, buildMatcher(keywords, lang, key === 'ja-loose'))
  return byLang.get(key) ?? null
}

function buildMatcher(keywords: Record<string, KeywordInfo>, lang: Lang, loose: boolean): PlainKeywordMatcher | null {
  const krOf = new Map<string, string | null>()
  for (const [krKey, info] of Object.entries(keywords)) {
    const name = nameIn(lang, krKey, info)
    if (!name || /[<>{}\n]/.test(name)) continue
    for (const spelling of [name, ...(SPELLINGS[krKey]?.[lang] ?? [])]) {
      krOf.set(spelling, krOf.has(spelling) && krOf.get(spelling) !== krKey ? null : krKey)
    }
  }
  if (krOf.size === 0) return null
  const names = [...krOf.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1))
  const left = lang === 'en' ? LEFT_EN : loose ? LEFT_JA_LOOSE : LEFT
  const right = lang === 'en' ? RIGHT_EN : lang === 'ja' ? (loose ? RIGHT_JA_LOOSE : RIGHT_JA) : RIGHT_KO
  return { pattern: new RegExp(`${left}(?:${names.map(escapeRegExp).join('|')})${right}`, 'gu'), krOf, lang }
}

const QUOTE_PAIRS: Readonly<Record<string, string>> = { '‘': '’', '“': '”', '「': '」', '『': '』', '《': '》' }
const CLOSERS = new Set(['’', '”', '」', '』', '》'])
const ALNUM = /[\p{L}\p{N}]/u
const LATIN = /[A-Za-z]/

/**
 * Ranges of `text` inside a quotation. A quote left open runs to the end, and a closing quote with no opening one (the
 * opening one stands in an earlier part of the same game text) covers everything before it: both only hide keywords.
 * An apostrophe between Latin letters (`target's`) is no quote.
 */
export function quotedRanges(text: string): [number, number][] {
  const ranges: [number, number][] = []
  let from = -1
  let closer = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const apostrophe = (ch === '’' || ch === "'") && LATIN.test(text[i - 1] ?? '') && LATIN.test(text[i + 1] ?? '')
    if (from < 0) {
      if (ch in QUOTE_PAIRS) { from = i; closer = QUOTE_PAIRS[ch] }
      else if (ch === '"' || (ch === "'" && !apostrophe && !ALNUM.test(text[i - 1] ?? ''))) { from = i; closer = ch }
      else if (CLOSERS.has(ch) && !apostrophe) ranges.push([0, i + 1])
    } else if (ch === closer && !apostrophe) {
      ranges.push([from, i + 1])
      from = -1
    }
  }
  if (from >= 0) ranges.push([from, text.length])
  return ranges
}

/** Is the name written next to its number? `신속 1`, `보호 2`, `Inflict 2 Haste`, `5+ Burn`, `Charge Count`. */
function counted(lang: Lang, text: string, from: number, to: number): boolean {
  const after = text.slice(to, to + 12)
  if (lang === 'en') return /^\s?[+-]?\d/.test(after) || /^\s(?:Count|Potency)\b/.test(after) || /\d\+?\s$/.test(text.slice(Math.max(0, from - 6), from))
  return /^[이가을를은는의]?\s?[+-]?\d/.test(after)
}

/**
 * The listed keywords of `allowed` written in plain `text`, left to right, never overlapping. `blocked` are further ranges
 * not to touch (the identity's own skill names). Empty `allowed`: nothing.
 */
export function findPlainKeywords(
  text: string,
  matcher: PlainKeywordMatcher | null,
  allowed: ReadonlySet<string> | undefined,
  blocked: readonly (readonly [number, number])[] = [],
  list: Readonly<Record<string, PlainKeywordTier>> = PLAIN_KEYWORDS,
): PlainKeywordHit[] {
  if (!matcher || !allowed || allowed.size === 0 || !text) return []
  const hits: PlainKeywordHit[] = []
  let skip: [number, number][] | null = null
  for (const match of text.matchAll(matcher.pattern)) {
    const krKey = matcher.krOf.get(match[0])
    const listed = krKey ? list[krKey] : undefined
    if (!krKey || !listed || !allowed.has(krKey)) continue
    const from = match.index
    const to = from + match[0].length
    // One-word English names and one-character names are ordinary words: only with their number.
    const ordinary = (matcher.lang === 'en' && !match[0].includes(' ')) || match[0].length <= 1
    if ((listed === 'counted' || ordinary) && !counted(matcher.lang, text, from, to)) continue
    skip ??= [...quotedRanges(text), ...blocked.map(([a, b]): [number, number] => [a, b])]
    if (skip.some(([a, b]) => from < b && a < to)) continue
    hits.push({ from, to, krKey })
  }
  return hits
}
