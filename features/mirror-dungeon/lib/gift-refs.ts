export interface GiftRefTarget {
  id: string
  /** Display name as it appears in the effect text (already localized). */
  name: string
}

export type GiftTextPart = string | { gift: GiftRefTarget; text: string }

const escape = (s: string) => s.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')

// Short bare names ("믿음", "추억") are ordinary words in effect text; only link them when bracketed.
const MIN_BARE_LENGTH = 3
// Latin-script names are matched as whole words and need more letters: "Gift" would otherwise link inside "E.G.O Gift owned".
const MIN_BARE_LATIN_LENGTH = 6
// Single-word Latin names that are also ordinary effect-text words are never matched bare, whatever their length.
const COMMON_WORDS = new Set([
  'attack', 'battle', 'bonus', 'charge', 'damage', 'defense', 'dungeon', 'effect', 'effects', 'enemies', 'energy', 'floors',
  'health', 'mirror', 'number', 'potency', 'resist', 'sanity', 'shield', 'status', 'strike', 'target', 'targets', 'weapon', 'weapons',
])
const NON_LATIN = /[぀-ヿㄱ-ㆎ㐀-鿿가-힣]/

const isLatinName = (name: string) => !NON_LATIN.test(name)

/** Whether a name may be matched without brackets (the gift a convert_to effect points at always may). */
function allowsBareMatch(name: string, isConvertTarget: boolean): boolean {
  if (isConvertTarget) return true
  const length = [...name].length
  if (!isLatinName(name)) return length >= MIN_BARE_LENGTH
  return length >= MIN_BARE_LATIN_LENGTH && !(/^\S+$/.test(name) && COMMON_WORDS.has(name.toLowerCase()))
}

// Tags the game text parser knows (lib/game-text/rich-text.ts); other `<…>` stays ordinary text.
const GAME_TAG = /<\/?(?:style|color|size|mark|link|sprite|coin|font|ruby|noparse|[ubis])(?=[\s=>/])[^<>]*>/gi

/**
 * Runs `splitPlain` over the plain stretches of a game text only. A gift name is never matched across a tag, and the
 * pieces around a match keep the tags that were open there (opened again at their start, closed at their end), so
 * `<style="highlight">획득: 신검합일 사용</style>` becomes highlighted text, the link, highlighted text.
 */
function splitOutsideTags(text: string, splitPlain: (plain: string) => GiftTextPart[]): GiftTextPart[] {
  const open: { name: string; source: string }[] = []
  const parts: GiftTextPart[] = []
  const wrap = (piece: string) =>
    open.length ? open.map(tag => tag.source).join('') + piece + [...open].reverse().map(tag => `</${tag.name}>`).join('') : piece
  const emitPlain = (plain: string) => {
    if (!plain) return
    const inNoparse = open.some(tag => tag.name === 'noparse')
    for (const part of inNoparse ? [plain] : splitPlain(plain)) parts.push(typeof part === 'string' ? wrap(part) : part)
  }

  let last = 0
  for (const match of text.matchAll(GAME_TAG)) {
    emitPlain(text.slice(last, match.index))
    last = match.index + match[0].length
    const name = /^<\/?([A-Za-z]+)/.exec(match[0])![1].toLowerCase()
    if (name === 'sprite') parts.push(wrap(match[0]))
    else if (match[0][1] === '/') {
      const at = open.map(tag => tag.name).lastIndexOf(name)
      if (at >= 0) open.splice(at, 1)
    } else open.push({ name, source: match[0] })
  }
  emitPlain(text.slice(last))
  return parts
}

/**
 * Builds a splitter that finds other gifts named in effect text, e.g. "→ [가능성]" or "…『신검합일』로 변경".
 * Longest names win, so "회중시계 : 타입 L" is not cut short by a shorter prefix name. Bare (unbracketed) names must be
 * long enough and, for Latin script, whole words that are not everyday words. Tags of game text are kept (see splitOutsideTags).
 */
export function createGiftRefSplitter(targets: GiftRefTarget[], { selfId, convertToId }: { selfId?: string | null; convertToId?: string | null } = {}) {
  const byName = new Map<string, GiftRefTarget>()
  for (const t of targets) if (t.id !== selfId && t.name.trim() && !byName.has(t.name)) byName.set(t.name, t)
  const names = [...byName.keys()].sort((a, b) => b.length - a.length)
  if (names.length === 0) return (text: string): GiftTextPart[] => [text]
  const all = names.map(escape).join('|')
  const bareNames = names.filter(n => allowsBareMatch(n, byName.get(n)!.id === convertToId))
  // `(?!)` never matches: keeps the group numbers fixed when a kind has no bare names.
  const bareLatin = bareNames.filter(isLatinName).map(escape).join('|') || '(?!)'
  const bareOther = bareNames.filter(n => !isLatinName(n)).map(escape).join('|') || '(?!)'
  const pattern = new RegExp(
    '\\[(' + all + ')\\]|『(' + all + ')』|「(' + all + ')」' +
      '|(?<![A-Za-z0-9])(' + bareLatin + ')(?![A-Za-z0-9])|(' + bareOther + ')',
    'g',
  )

  const splitPlain = (text: string): GiftTextPart[] => {
    const parts: GiftTextPart[] = []
    let last = 0
    for (const m of text.matchAll(pattern)) {
      const name = m[1] ?? m[2] ?? m[3] ?? (m[4] || m[5])
      const gift = name ? byName.get(name) : undefined
      if (!gift) continue
      if (m.index > last) parts.push(text.slice(last, m.index))
      parts.push({ gift, text: name })
      last = m.index + m[0].length
    }
    if (last < text.length) parts.push(text.slice(last))
    return parts
  }

  return (text: string): GiftTextPart[] => {
    const parts = text.includes('<') ? splitOutsideTags(text, splitPlain) : splitPlain(text)
    return parts.some(part => typeof part !== 'string') ? parts : [text]
  }
}
