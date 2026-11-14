import { noteBlockTokenPattern, noteInlineMarkdownPattern, noteTokenPattern } from '@/lib/notes/inline-tokens'
import type { GiftConditionStatus } from '@/lib/planner/gift-condition-status'
import type { NoteEgoEntry, NoteEgoGiftEntry, NoteIdentityEntry, NotePassiveEntry, NoteSkillEntry } from './note-entries'

/** The lookups a memo reads its tokens from, by token name. */
export type NoteLookups = {
  skill: Record<string, NoteSkillEntry>
  passive: Record<string, NotePassiveEntry>
  ego: Record<string, NoteEgoEntry>
  identity: Record<string, NoteIdentityEntry>
  egoGift: Record<string, NoteEgoGiftEntry>
  egoGiftCondition: Record<string, GiftConditionStatus | null>
}

/** `[s:…]` `[p:…]` `[e:…]` `[k:…]` `[i:…]` `[g:…]`; `entry` is undefined when the lookup has no such name (the renderer then draws a fallback). */
export type NoteInlineToken =
  | { kind: 's'; key: string; entry: NoteSkillEntry | undefined }
  | { kind: 'p'; key: string; entry: NotePassiveEntry | undefined }
  | { kind: 'e'; key: string; entry: NoteEgoEntry | undefined }
  | { kind: 'k'; key: string }
  | { kind: 'i'; key: string; entry: NoteIdentityEntry | undefined }
  | { kind: 'g'; key: string; entry: NoteEgoGiftEntry | undefined }

/** Which token a match of `noteTokenPattern()` is (group 1..6 is its letter), looked up in `lookups`. */
export function resolveInlineToken(match: ArrayLike<string | undefined>, lookups: NoteLookups): NoteInlineToken | null {
  const group = (index: number) => match[index]?.trim()
  const skill = group(1)
  if (skill) {
    // a variant skill falls back to its first variant: "돈키호테:1" → "돈키호테:1:1"
    return { kind: 's', key: skill, entry: lookups.skill[skill] ?? lookups.skill[`${skill}:1`] }
  }
  const passive = group(2)
  if (passive) return { kind: 'p', key: passive, entry: lookups.passive[passive] }
  const ego = group(3)
  if (ego) return { kind: 'e', key: ego, entry: lookups.ego[ego] }
  const keyword = group(4)
  if (keyword) return { kind: 'k', key: keyword }
  const identity = group(5)
  if (identity) return { kind: 'i', key: identity, entry: lookups.identity[identity] }
  const gift = group(6)
  if (gift) return { kind: 'g', key: gift, entry: lookups.egoGift[gift] }
  return null
}

/** `keySuffix` is the part of a React key that depends on where the piece sits in the text. */
export type NoteInlineSegment =
  | { kind: 'text'; text: string; keySuffix: string }
  | { kind: 'token'; token: NoteInlineToken; keySuffix: string }

/** A text cut into its plain parts and its `[x:…]` tokens, in order. */
export function splitInlineTokens(value: string, lookups: NoteLookups): NoteInlineSegment[] {
  const tokenRe = noteTokenPattern()
  const segments: NoteInlineSegment[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(value)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', text: value.slice(last, m.index), keySuffix: `t${last}` })
    const token = resolveInlineToken(m, lookups)
    if (token) segments.push({ kind: 'token', token, keySuffix: `${token.kind}${m.index}` })
    last = m.index + m[0].length
  }
  if (last < value.length) segments.push({ kind: 'text', text: value.slice(last), keySuffix: 'tend' })
  return segments
}

export type NoteMarkdownSegment =
  | { kind: 'text'; text: string; keySuffix: string }
  | { kind: 'link'; text: string; href: string; keySuffix: string }
  | { kind: 'bold' | 'italic' | 'code'; text: string; keySuffix: string }

/** A plain text cut into its plain parts and its `[link](url)`, `**bold**`, `*italic*` / `_italic_` and `` `code` `` parts. */
export function splitMarkdownInline(value: string): NoteMarkdownSegment[] {
  const inlineRe = noteInlineMarkdownPattern()
  const segments: NoteMarkdownSegment[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = inlineRe.exec(value)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', text: value.slice(last, m.index), keySuffix: `t${last}` })
    const matched = m[0]
    if (m[2] && m[3]) {
      segments.push({ kind: 'link', text: m[2], href: m[3], keySuffix: `a${m.index}` })
    } else if (matched.startsWith('**')) {
      segments.push({ kind: 'bold', text: matched.slice(2, -2), keySuffix: `b${m.index}` })
    } else if (matched.startsWith('*') || matched.startsWith('_')) {
      segments.push({ kind: 'italic', text: matched.slice(1, -1), keySuffix: `i${m.index}` })
    } else {
      segments.push({ kind: 'code', text: matched.slice(1, -1), keySuffix: `c${m.index}` })
    }
    last = m.index + matched.length
  }
  if (last < value.length) segments.push({ kind: 'text', text: value.slice(last), keySuffix: 'tend' })
  return segments
}

/** `{{skill:…}}`, `{{passive:…}}`, `{{gift:…}}` alone on a line: a card drawn in place of the token. */
export type NoteBlockPlaceholder =
  | { kind: 'skill'; tokenKey: string; entry: NoteSkillEntry | undefined }
  | { kind: 'passive'; tokenKey: string; entry: NotePassiveEntry | undefined }
  | { kind: 'gift'; tokenKey: string; entry: NoteEgoGiftEntry | undefined; conditionStatus: GiftConditionStatus | null }

/** A skill card of a later variant that the lookup lacks shows the variant before it ("a:2:3" → "a:2:2"). */
export function resolveSkillFrameEntry(
  skillLookup: Record<string, NoteSkillEntry>,
  tokenKey: string,
): NoteSkillEntry | undefined {
  const direct = skillLookup[tokenKey]
  if (direct) return direct
  const parts = tokenKey.split(':')
  if (parts.length !== 3) return undefined
  const humanVariant = Number(parts[2])
  if (!Number.isInteger(humanVariant) || humanVariant <= 1) return undefined
  return skillLookup[`${parts[0]}:${parts[1]}:${humanVariant - 1}`]
}

/** The card a whole line stands for, or null when the line is no `{{…}}` token. */
export function parseBlockPlaceholder(value: string, lookups: NoteLookups): NoteBlockPlaceholder | null {
  const skillMatch = value.trim().match(/^\{\{skill:([^:{}]+):(\d+)(?::(\d+))?\}\}$/)
  if (skillMatch) {
    const tokenKey = skillMatch[3]
      ? `${skillMatch[1]}:${skillMatch[2]}:${skillMatch[3]}`
      : `${skillMatch[1]}:${skillMatch[2]}`
    return { kind: 'skill', tokenKey, entry: resolveSkillFrameEntry(lookups.skill, tokenKey) }
  }

  const passiveMatch = value.trim().match(/^\{\{passive:([^{}]+)\}\}$/)
  if (passiveMatch) {
    const tokenKey = passiveMatch[1].trim()
    return { kind: 'passive', tokenKey, entry: lookups.passive[tokenKey] }
  }

  const giftMatch = value.trim().match(/^\{\{gift:([^{}:]+)(?::(true))?\}\}$/)
  if (giftMatch) {
    const tokenKey = giftMatch[1].trim()
    const entry = lookups.egoGift[tokenKey]
    const showCondition = giftMatch[2] === 'true' && Boolean(entry?.activation_condition)
    return { kind: 'gift', tokenKey, entry, conditionStatus: showCondition ? lookups.egoGiftCondition[tokenKey] : null }
  }

  return null
}

export type NoteMixedLineSegment =
  | { kind: 'text'; text: string; keySuffix: string }
  | { kind: 'block'; placeholder: NoteBlockPlaceholder | null; keySuffix: string }

/** A line that holds `{{…}}` tokens among other text, cut into its trimmed text parts and its cards; null when it holds none. */
export function splitMixedBlockLine(value: string, lookups: NoteLookups): NoteMixedLineSegment[] | null {
  const blockTokenRe = noteBlockTokenPattern()
  const segments: NoteMixedLineSegment[] = []
  let last = 0
  let found = false
  let m: RegExpExecArray | null
  while ((m = blockTokenRe.exec(value)) !== null) {
    found = true
    const before = value.slice(last, m.index).trim()
    if (before) segments.push({ kind: 'text', text: before, keySuffix: `p${last}` })
    segments.push({ kind: 'block', placeholder: parseBlockPlaceholder(m[0], lookups), keySuffix: `b${m.index}` })
    last = m.index + m[0].length
  }
  const rest = value.slice(last).trim()
  if (rest) segments.push({ kind: 'text', text: rest, keySuffix: 'pend' })
  return found ? segments : null
}
