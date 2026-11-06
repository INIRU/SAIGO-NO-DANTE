import { leadingPlaceholder } from '@/lib/game-text/placeholders'

/**
 * The guess the site used to make when it drew a user memo: which words of a plain text are keywords. The renderer no
 * longer guesses (a memo shows keywords only as explicit chips); this matcher stays as the recorded behaviour of the old
 * renderer (tests/lib/notes/memo-keyword-guess.test.ts); no app code imports it.
 *
 * Rules, as the renderer applied them left to right:
 * - names are tried longest first;
 * - a name of at most two letters is not a keyword when a Hangul syllable comes right before it, or right after it
 *   unless that syllable is a particle (이 가 을 를 …);
 * - `[Name]` / `【Name】` whose inside is a known name or game id of this language is a keyword (drawn without brackets),
 *   any other bracket is left alone and not searched;
 * - a number (` 3`, ` 횟수 3`) right after a keyword belongs to it;
 * - `{{live}}`-style placeholder tokens are skipped;
 * - one backslash before a keyword says "plain text"; the backslash is dropped, with an even count it is no escape.
 */

export type KeywordGuessPart = {
  type: 'normal' | 'bracket' | 'keyword' | 'number' | 'placeholder'
  /** The part as it was drawn (an escape's backslash is gone). */
  text: string
  /** The part's range in the source text; a character in no part's range was dropped (an escape's backslash). */
  from: number
  to: number
  /** Korean name of a keyword or bracket the name index knows. */
  krKey?: string
  giftId?: number
}

export type KeywordGuessOptions = {
  /** A backslash before a keyword opts out (user notes). */
  escapes?: boolean
  /** The character before the text, when the text continues a longer one (a chip stands there). */
  before?: string
  /** The characters after the text, which the boundary rules look at (the first one) when the text ends. */
  after?: string
}

function isHangul(ch: string | undefined): boolean {
  if (!ch) return false
  const code = ch.charCodeAt(0)
  return (code >= 0xAC00 && code <= 0xD7A3) || (code >= 0x3131 && code <= 0x318E)
}

/** Korean particles that may follow a short keyword; any other Hangul syllable after it makes it part of a word. */
const PARTICLES = new Set([
  '이', '가', '을', '를', '의', '에', '은', '는',
  '과', '와', '도', '로', '만', '야', '라', '며',
  '든', '인', '및', '나', '란', '당', '때', '면',
  '부', '까', '서', '보', '처', '한',
])

/**
 * `names`: the language's keyword names, longest first (getLocalizedKeywordIndex(...).localKeywords);
 * `toKr`: name or `[Id]` -> Korean keyword name (…localToKr; empty for Korean, where brackets are never keywords).
 */
export function guessKeywordParts(
  text: string,
  names: readonly string[],
  toKr?: Record<string, string>,
  options: KeywordGuessOptions = {},
): KeywordGuessPart[] {
  const after = options.after ?? ''
  // Only names that occur in the text can match (every match is a substring of it).
  const all = names.filter(name => text.includes(name))
  const parts: KeywordGuessPart[] = []
  let remaining = text
  let prevChar = options.before ? options.before[options.before.length - 1] : ''
  const offset = () => text.length - remaining.length
  /** The character `index` into `value`, which is a tail of the text; past its end it is the text that follows. */
  const charAt = (value: string, index: number) => (index < value.length ? value[index] : index === value.length ? after[0] : undefined)
  const afterBoundary = (value: string, start: number, length: number) => {
    const next = charAt(value, start + length)
    return length <= 2 && isHangul(next) && !(next && PARTICLES.has(next))
  }
  const push = (part: Omit<KeywordGuessPart, 'from' | 'to'>, consumed = part.text.length, skipped = 0) => {
    const from = offset() + skipped
    parts.push({ ...part, from, to: from + consumed })
  }

  const escapedKeywordAt = (value: string) => {
    if (!options.escapes) return null
    for (let start = value.indexOf('\\'); start >= 0; start = value.indexOf('\\', start + 1)) {
      if (start > 0 && value[start - 1] === '\\') continue
      let slashCount = 1
      while (value[start + slashCount] === '\\') slashCount += 1
      if (slashCount % 2 === 0) continue
      const keywordStart = start + slashCount
      const keyword = all.find(name => value.startsWith(name, keywordStart) && !afterBoundary(value, keywordStart, name.length))
      if (keyword) return { start, slashCount, keyword }
    }
    return null
  }

  while (remaining.length > 0) {
    const escapedKeyword = escapedKeywordAt(remaining)
    if (escapedKeyword?.start === 0) {
      const { slashCount, keyword } = escapedKeyword
      // One backslash is the marker and is dropped; the others stay as written.
      if (slashCount > 1) push({ type: 'normal', text: '\\'.repeat(slashCount - 1) }, slashCount - 1, 1)
      push({ type: 'normal', text: keyword }, keyword.length, slashCount)
      prevChar = keyword[keyword.length - 1]
      remaining = remaining.slice(slashCount + keyword.length)
      continue
    }

    // {{live}}-style placeholder tokens
    const token = remaining.startsWith('{{') ? leadingPlaceholder(remaining) : null
    if (token) {
      push({ type: 'placeholder', text: token.token, giftId: token.giftId }, token.length)
      prevChar = '}'
      remaining = remaining.slice(token.length)
      continue
    }

    // [bracket] / 【bracket】
    const bracketMatch = remaining.match(/^(?:\[([^\]]+)\]|【([^】]+)】)/)
    if (bracketMatch) {
      const inner = bracketMatch[1] || bracketMatch[2]
      const krKey = toKr?.[inner] ?? (toKr?.[bracketMatch[0]] ? toKr[bracketMatch[0]] : undefined)
      push({ type: 'bracket', text: bracketMatch[0], krKey })
      prevChar = bracketMatch[0][bracketMatch[0].length - 1]
      remaining = remaining.slice(bracketMatch[0].length)
      continue
    }

    // keyword (a short one is ignored inside a Korean word, particles excepted)
    let foundKeyword = false
    for (const name of all) {
      const beforeBoundary = name.length <= 2 && isHangul(prevChar)
      if (remaining.startsWith(name) && !afterBoundary(remaining, 0, name.length) && !beforeBoundary) {
        push({ type: 'keyword', text: name, krKey: toKr?.[name] })
        prevChar = name[name.length - 1]
        remaining = remaining.slice(name.length)
        const numMatch = remaining.match(/^( 횟수)?( \d+)/)
        if (numMatch) {
          push({ type: 'number', text: numMatch[0] })
          prevChar = numMatch[0][numMatch[0].length - 1]
          remaining = remaining.slice(numMatch[0].length)
        }
        foundKeyword = true
        break
      }
    }
    if (foundKeyword) continue

    // plain text up to the next thing that could match
    let nextIdx = remaining.length
    const bracketIdx = remaining.indexOf('[')
    if (bracketIdx > 0) nextIdx = Math.min(nextIdx, bracketIdx)
    const fwBracketIdx = remaining.indexOf('【')
    if (fwBracketIdx > 0) nextIdx = Math.min(nextIdx, fwBracketIdx)
    const tokenIdx = remaining.indexOf('{{', 1)
    if (tokenIdx > 0) nextIdx = Math.min(nextIdx, tokenIdx)
    if (escapedKeyword) nextIdx = Math.min(nextIdx, escapedKeyword.start)
    for (const name of all) {
      let searchFrom = 0
      while (searchFrom < remaining.length) {
        const nameIdx = remaining.indexOf(name, searchFrom)
        if (nameIdx < 0) break
        const beforeBound = name.length <= 2 && nameIdx > 0 && isHangul(remaining[nameIdx - 1])
        if (nameIdx > 0 && !afterBoundary(remaining, nameIdx, name.length) && !beforeBound) { nextIdx = Math.min(nextIdx, nameIdx); break }
        searchFrom = nameIdx + 1
      }
    }
    const chunk = remaining.slice(0, nextIdx)
    push({ type: 'normal', text: chunk })
    prevChar = chunk[chunk.length - 1] ?? prevChar
    remaining = remaining.slice(nextIdx)
  }
  return parts
}
