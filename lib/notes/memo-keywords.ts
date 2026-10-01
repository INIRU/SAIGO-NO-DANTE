import type { JSONContent } from '@tiptap/core'
import { getLocalizedKeywordIndex, type KeywordInfo } from '@/lib/keywords/catalog'
import { guessKeywordParts } from '@/lib/keywords/keyword-guess'
import { NOTE_PREFIX, parseBlockDocument } from '@/lib/notes/blocks'
import { noteBlockTokenPattern, noteInlineMarkdownPattern, noteTokenPattern } from '@/lib/notes/inline-tokens'
import { parseNoteImage } from '@/lib/notes/images'

/**
 * Old memos showed keywords by guessing them from plain words; memos now show keywords only as explicit chips
 * (`noteKeyword` nodes in a block document, `[k:이름]` tokens in a plain/markdown memo). This module rewrites an old memo
 * into the chips the guess would have drawn (lib/keywords/keyword-guess.ts is that guess), so nothing changes on screen.
 * Pure: scripts/notes/convert-memo-keywords.ts reads and writes the database.
 *
 * - Not touched: existing chips and tokens, code, links, images, `{{skill:…}}` cards, anything without a match.
 * - Idempotent: a second run finds nothing, also next to a chip (the matcher is told the letters around the text).
 * - An escaped keyword (`\못`) stays plain text: the backslash becomes an invisible U+2060 WORD JOINER, so the word is
 *   unchanged and a second run still sees that it was meant as plain text.
 */

export const ESCAPE_MARK = '⁠'

export type MemoLocale = 'ko' | 'en' | 'ja'
export type MemoKeywordIndex = { passes: { locale: MemoLocale; names: readonly string[]; toKr: Record<string, string> }[] }

export function memoKeywordIndex(catalog: Record<string, KeywordInfo>): MemoKeywordIndex {
  return {
    passes: (['ko', 'en', 'ja'] as const).map(locale => {
      const { localKeywords, localToKr } = getLocalizedKeywordIndex(catalog, locale)
      return { locale, names: localKeywords, toKr: localToKr }
    }),
  }
}

export type MemoConversion = {
  value: string
  changed: boolean
  /** `blocks`: a block document, `text`: a plain/markdown memo, `invalid`: starts like a block document but cannot be read. */
  format: 'blocks' | 'text' | 'invalid'
  chips: number
  /** Escaped keywords kept as plain text (their backslash became ESCAPE_MARK). */
  escapes: number
  /** Chips by the language whose names found them. */
  byLocale: Record<MemoLocale, number>
  /** The keyword (Korean name) of each chip added, in order. */
  ids: string[]
}

type Counts = Pick<MemoConversion, 'chips' | 'escapes' | 'byLocale' | 'ids'>
const newCounts = (): Counts => ({ chips: 0, escapes: 0, byLocale: { ko: 0, en: 0, ja: 0 }, ids: [] })

const HANGUL = /[ㄱ-ㆎ가-힣]/
/** A name that cannot be written inside a `[k:…]` token. */
const unsafeInToken = (id: string) => /[\[\]\n]/.test(id) || !id.trim() || id !== id.trim()

type Piece = { type: 'text'; text: string } | { type: 'keyword'; id: string }
type Neighbours = { before?: string; after?: string }

/**
 * `text` as text and keyword pieces. A memo written in Korean is read with the Korean names only, as a Korean viewer saw
 * it; a memo with no Hangul at all is also read with the English and Japanese names (`hangul` says which; it is decided
 * once per memo so a second run, which then sees the Korean chip names, reads it the same way).
 */
function chipify(text: string, index: MemoKeywordIndex, hangul: boolean, near: Neighbours, counts: Counts): Piece[] {
  type Match = { from: number; to: number; id: string; locale: MemoLocale }
  const accepted: Match[] = []
  const removed = new Set<number>()
  const results = index.passes
    .filter(pass => pass.locale === 'ko' || !hangul)
    .map(pass => ({ pass, parts: guessKeywordParts(text, pass.names, pass.toKr, { escapes: true, before: near.before, after: near.after }) }))
  for (const { pass, parts } of results) {
    for (const part of parts) {
      const isKeyword = part.type === 'keyword' || (part.type === 'bracket' && part.krKey)
      if (!isKeyword) continue
      const id = part.krKey ?? part.text
      // A word already marked as plain text, or one that cannot be a token, or one overlapping a better match, stays text.
      if (text[part.from - 1] === ESCAPE_MARK || unsafeInToken(id)) continue
      if (accepted.some(match => part.from < match.to && match.from < part.to)) continue
      accepted.push({ from: part.from, to: part.to, id, locale: pass.locale })
    }
  }
  accepted.sort((a, b) => a.from - b.from)
  // The backslashes the guess dropped (an escape), unless a match starts right after one in another language.
  for (const { parts } of results) {
    let end = 0
    for (const part of parts) {
      // The marker takes the place of the backslash next to the word (the guess dropped the first of the run).
      if (part.from > end && text[end] === '\\') {
        let run = 0
        while (text[end + run] === '\\') run += 1
        if (!accepted.some(match => match.from === end + run)) removed.add(end + run - 1)
      }
      end = part.to
    }
  }
  if (!accepted.length && !removed.size) return [{ type: 'text', text }]

  const plain = (from: number, to: number) => {
    let out = ''
    for (let at = from; at < to; at++) out += removed.has(at) ? ESCAPE_MARK : text[at]
    return out
  }
  const pieces: Piece[] = []
  let cursor = 0
  for (const match of accepted) {
    if (match.from > cursor) pieces.push({ type: 'text', text: plain(cursor, match.from) })
    pieces.push({ type: 'keyword', id: match.id })
    counts.chips += 1
    counts.byLocale[match.locale] += 1
    counts.ids.push(match.id)
    cursor = match.to
  }
  if (cursor < text.length) pieces.push({ type: 'text', text: plain(cursor, text.length) })
  counts.escapes += removed.size
  return pieces
}

// ─── inline regions of a text ──────────────────────────────────────────────

type Region =
  | { kind: 'raw'; text: string; keyword?: string }
  | { kind: 'plain'; text: string }
  | { kind: 'span'; marker: '**' | '*' | '_'; inner: string }

/** Splits a text the way the renderer reads it: `[x:…]` tokens and cards, then markdown links, code, bold and italic. */
function scanInline(text: string): Region[] {
  const regions: Region[] = []
  const markdown = (segment: string) => {
    const re = noteInlineMarkdownPattern()
    let last = 0
    for (let match = re.exec(segment); match; match = re.exec(segment)) {
      if (match.index > last) regions.push({ kind: 'plain', text: segment.slice(last, match.index) })
      const value = match[0]
      if (match[2] && match[3]) regions.push({ kind: 'raw', text: value })
      else if (value.startsWith('**')) regions.push({ kind: 'span', marker: '**', inner: value.slice(2, -2) })
      else if (value.startsWith('*')) regions.push({ kind: 'span', marker: '*', inner: value.slice(1, -1) })
      else if (value.startsWith('_')) regions.push({ kind: 'span', marker: '_', inner: value.slice(1, -1) })
      else regions.push({ kind: 'raw', text: value })
      last = match.index + value.length
    }
    if (last < segment.length) regions.push({ kind: 'plain', text: segment.slice(last) })
  }
  const protectedRe = new RegExp(`${noteBlockTokenPattern().source}|${noteTokenPattern().source}`, 'g')
  let last = 0
  for (let match = protectedRe.exec(text); match; match = protectedRe.exec(text)) {
    if (match.index > last) markdown(text.slice(last, match.index))
    const keyword = match[0].startsWith('[k:') ? match[0].slice(3, -1).trim() : undefined
    regions.push({ kind: 'raw', text: match[0], keyword })
    last = match.index + match[0].length
  }
  if (last < text.length) markdown(text.slice(last))
  return regions
}

/** The letters of an existing chip next to a region, which the boundary rules look at. */
function neighbours(regions: Region[], index: number): Neighbours {
  const before = regions[index - 1], after = regions[index + 1]
  return {
    before: before?.kind === 'raw' ? before.keyword : undefined,
    after: after?.kind === 'raw' ? after.keyword : undefined,
  }
}

// ─── plain / markdown memos ────────────────────────────────────────────────

const token = (id: string) => `[k:${id}]`

function convertInlineText(text: string, index: MemoKeywordIndex, hangul: boolean, counts: Counts): string {
  const regions = scanInline(text)
  let out = ''
  regions.forEach((region, at) => {
    if (region.kind === 'raw') { out += region.text; return }
    const near = neighbours(regions, at)
    if (region.kind === 'plain') {
      out += chipify(region.text, index, hangul, near, counts).map(piece => (piece.type === 'keyword' ? token(piece.id) : piece.text)).join('')
      return
    }
    // A token inside **bold** would end the bold, so the bold is closed and opened again around it: **a **[k:x]** b**.
    const pieces = chipify(region.inner, index, hangul, near, counts)
    if (pieces.length === 1 && pieces[0].type === 'text' && pieces[0].text === region.inner) { out += region.marker + region.inner + region.marker; return }
    out += pieces.map(piece => (piece.type === 'keyword' ? token(piece.id) : piece.text.length ? region.marker + piece.text + region.marker : '')).join('')
  })
  return out
}

const LINE_PREFIX = [/^(#{1,2}\s+)/, /^(>\s?)/, /^(\s*[-*]\s+)/, /^(\s*\d+\.\s+)/]

function convertPlainMemo(value: string, index: MemoKeywordIndex, counts: Counts): string {
  const hangul = HANGUL.test(value)
  return value.split(/(\r\n|\n)/).map((line, at) => {
    if (at % 2 === 1 || !line.trim() || parseNoteImage(line)) return line
    const prefix = noteBlockTokenPattern().test(line) ? '' : LINE_PREFIX.map(re => line.match(re)?.[1]).find(Boolean) ?? ''
    return prefix + convertInlineText(line.slice(prefix.length), index, hangul, counts)
  }).join('')
}

// ─── block documents ───────────────────────────────────────────────────────

type Mark = NonNullable<JSONContent['marks']>[number]
const SPAN_MARK: Record<'**' | '*' | '_', string> = { '**': 'bold', '*': 'italic', _: 'italic' }

function convertTextNode(node: JSONContent, index: MemoKeywordIndex, hangul: boolean, near: Neighbours, counts: Counts): JSONContent[] | null {
  const marks = node.marks ?? []
  if (typeof node.text !== 'string' || marks.some(mark => mark.type === 'code' || mark.type === 'link')) return null
  const regions = scanInline(node.text)
  const out: JSONContent[] = []
  let changed = false
  const text = (value: string, extra: Mark[] = []) => {
    if (!value) return
    const all = [...marks, ...extra.filter(mark => !marks.some(own => own.type === mark.type))]
    const last = out[out.length - 1]
    if (last?.type === 'text' && JSON.stringify(last.marks ?? []) === JSON.stringify(all.length ? all : [])) last.text += value
    else out.push({ type: 'text', text: value, ...(all.length || node.marks ? { marks: all } : {}) })
  }
  regions.forEach((region, at) => {
    const edges = { before: at === 0 ? near.before : neighbours(regions, at).before, after: at === regions.length - 1 ? near.after : neighbours(regions, at).after }
    if (region.kind === 'raw') { text(region.text); return }
    const extra: Mark[] = region.kind === 'span' ? [{ type: SPAN_MARK[region.marker] }] : []
    const source = region.kind === 'span' ? region.inner : region.text
    const pieces = chipify(source, index, hangul, edges, counts)
    if (pieces.length === 1 && pieces[0].type === 'text' && pieces[0].text === source) {
      text(region.kind === 'span' ? region.marker + source + region.marker : source)
      return
    }
    changed = true
    for (const piece of pieces) {
      if (piece.type === 'keyword') out.push({ type: 'noteKeyword', attrs: { id: piece.id } })
      else text(piece.text, extra)
    }
  })
  return changed ? out : null
}

/** The letters of a chip sibling, for the boundary rules at the edge of a text node. */
const chipName = (node: JSONContent | undefined) => (node?.type === 'noteKeyword' && typeof node.attrs?.id === 'string' ? node.attrs.id : undefined)

function convertContent(content: JSONContent[], index: MemoKeywordIndex, hangul: boolean, counts: Counts): { content: JSONContent[]; changed: boolean } {
  const out: JSONContent[] = []
  let changed = false
  content.forEach((child, at) => {
    if (child.type === 'text') {
      const converted = convertTextNode(child, index, hangul, { before: chipName(content[at - 1]), after: chipName(content[at + 1]) }, counts)
      if (converted) { out.push(...converted); changed = true } else out.push(child)
      return
    }
    // Code blocks hold literal text; assets, images and videos hold no memo text.
    if (child.type === 'codeBlock' || !Array.isArray(child.content)) { out.push(child); return }
    const inner = convertContent(child.content, index, hangul, counts)
    if (inner.changed) { out.push({ ...child, content: inner.content }); changed = true } else out.push(child)
  })
  return { content: out, changed }
}

function convertBlockMemo(value: string, index: MemoKeywordIndex, counts: Counts): string | null {
  const doc = parseBlockDocument(value)
  if (!doc) return null
  // The stored JSON is converted as it is (parseBlockDocument only proves it is a readable document).
  const raw = JSON.parse(value.slice(NOTE_PREFIX.length)) as JSONContent
  const { content, changed } = convertContent(Array.isArray(raw.content) ? raw.content : [], index, HANGUL.test(JSON.stringify(raw)), counts)
  if (!changed) return value
  const next = NOTE_PREFIX + JSON.stringify({ ...raw, content })
  return parseBlockDocument(next) ? next : null
}

/**
 * The memo with the keywords the old guess drew turned into explicit chips. `value` is returned as it is when nothing
 * changes (`changed: false`), also for text that cannot be read (`format: 'invalid'`).
 */
export function convertMemoKeywords(value: string, index: MemoKeywordIndex): MemoConversion {
  const counts = newCounts()
  if (!value) return { value, changed: false, format: 'text', ...counts }
  if (value.startsWith(NOTE_PREFIX)) {
    const next = convertBlockMemo(value, index, counts)
    if (next === null) return { value, changed: false, format: 'invalid', ...newCounts() }
    return { value: next, changed: next !== value, format: 'blocks', ...counts }
  }
  const next = convertPlainMemo(value, index, counts)
  return { value: next, changed: next !== value, format: 'text', ...counts }
}
