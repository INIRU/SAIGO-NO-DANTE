import { describe, expect, it } from 'vitest'
import { noteBlockTokenPattern, noteInlineMarkdownPattern, noteTokenPattern } from '@/lib/notes/inline-tokens'
import {
  parseBlockPlaceholder,
  resolveSkillFrameEntry,
  splitInlineTokens,
  splitMarkdownInline,
  splitMixedBlockLine,
  type NoteBlockPlaceholder,
  type NoteLookups,
} from '@/features/notes/lib/note-tokens'
import type { NoteSkillEntry } from '@/features/notes/lib/note-entries'

// Plain stand-ins for the React nodes the renderer builds, so the old and the new reading can be compared key by key.
type Node = { tag: string; key: string; [extra: string]: unknown }

const skill = (name: string): NoteSkillEntry => ({ name, skill_type: 'attack', sin_affinity: 'WRATH', skill_order: 1, identityName: 'i', sinnerName: 's' })
const lookups: NoteLookups = {
  skill: { '돈키호테:1': skill('a'), '돈키호테:1:1': skill('a11'), '이상:2:1': skill('b'), '이상:3': skill('c') },
  passive: { 패시브A: { name: '패시브A', sin_affinity: null, sin_count: null, active_cond: null, description: null, sinnerName: 's' } },
  ego: { 'e 1': { name: 'e 1', grade: 'ZAYIN', sin_affinity: null, sinnerName: 's' } },
  identity: { 'LCB 이상': { name: 'LCB 이상', rarity: 1, sinnerName: 's' } },
  egoGift: {
    혈향도래: { name: '혈향도래', keyword: '출혈', grade: '3', activation_condition: { type: 'x' } as never },
    평범: { name: '평범', keyword: '출혈', grade: '1' },
  },
  egoGiftCondition: { 혈향도래: { met: true } as never, 평범: null },
}

// ── the code NoteChips.tsx had before the split (JSX replaced by plain objects) ──
function oldResolveSkillFrameEntry(skillLookup: Record<string, NoteSkillEntry>, tokenKey: string): NoteSkillEntry | undefined {
  const direct = skillLookup[tokenKey]
  if (direct) return direct
  const parts = tokenKey.split(':')
  if (parts.length !== 3) return undefined
  const humanVariant = Number(parts[2])
  if (!Number.isInteger(humanVariant) || humanVariant <= 1) return undefined
  return skillLookup[`${parts[0]}:${parts[1]}:${humanVariant - 1}`]
}

function oldRenderMarkdownInline(value: string, keyPrefix: string): Node[] {
  const nodes: Node[] = []
  const inlineRe = noteInlineMarkdownPattern()
  let last = 0
  let m: RegExpExecArray | null
  while ((m = inlineRe.exec(value)) !== null) {
    if (m.index > last) nodes.push({ tag: 'span', key: `${keyPrefix}-t${last}`, text: value.slice(last, m.index) })
    const matched = m[0]
    if (m[2] && m[3]) nodes.push({ tag: 'a', key: `${keyPrefix}-a${m.index}`, href: m[3], text: m[2] })
    else if (matched.startsWith('**')) nodes.push({ tag: 'strong', key: `${keyPrefix}-b${m.index}`, text: matched.slice(2, -2) })
    else if (matched.startsWith('*') || matched.startsWith('_')) nodes.push({ tag: 'em', key: `${keyPrefix}-i${m.index}`, text: matched.slice(1, -1) })
    else nodes.push({ tag: 'code', key: `${keyPrefix}-c${m.index}`, text: matched.slice(1, -1) })
    last = m.index + matched.length
  }
  if (last < value.length) nodes.push({ tag: 'span', key: `${keyPrefix}-tend`, text: value.slice(last) })
  return nodes
}

function oldRenderInline(value: string, keyPrefix: string, l: NoteLookups): Node[] {
  const tokenRe = noteTokenPattern()
  const elements: Node[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(value)) !== null) {
    for (let gi = 1; gi <= 6; gi++) { if (m[gi]) m[gi] = m[gi].trim() }
    if (m.index > last) elements.push(...oldRenderMarkdownInline(value.slice(last, m.index), `${keyPrefix}-t${last}`))
    if (m[1]) {
      const e = l.skill[m[1]] ?? l.skill[`${m[1]}:1`]
      elements.push(e ? { tag: 'SkillChip', key: `${keyPrefix}-s${m.index}`, entry: e } : { tag: 'Fallback', key: `${keyPrefix}-s${m.index}`, type: 's', tokenKey: m[1] })
    } else if (m[2]) {
      const e = l.passive[m[2]]
      elements.push(e ? { tag: 'PassiveChip', key: `${keyPrefix}-p${m.index}`, entry: e } : { tag: 'Fallback', key: `${keyPrefix}-p${m.index}`, type: 'p', tokenKey: m[2] })
    } else if (m[3]) {
      const e = l.ego[m[3]]
      elements.push(e ? { tag: 'EgoChip', key: `${keyPrefix}-e${m.index}`, entry: e } : { tag: 'Fallback', key: `${keyPrefix}-e${m.index}`, type: 'e', tokenKey: m[3] })
    } else if (m[4]) {
      elements.push({ tag: 'Keyword', key: `${keyPrefix}-k${m.index}`, id: m[4] })
    } else if (m[5]) {
      const e = l.identity[m[5]]
      elements.push(e ? { tag: 'IdentityChip', key: `${keyPrefix}-i${m.index}`, entry: e } : { tag: 'Fallback', key: `${keyPrefix}-i${m.index}`, type: 'i', tokenKey: m[5] })
    } else if (m[6]) {
      const e = l.egoGift[m[6]]
      elements.push(e ? { tag: 'GiftChip', key: `${keyPrefix}-g${m.index}`, entry: e } : { tag: 'Fallback', key: `${keyPrefix}-g${m.index}`, type: 'g', tokenKey: m[6] })
    }
    last = m.index + m[0].length
  }
  if (last < value.length) elements.push(...oldRenderMarkdownInline(value.slice(last), `${keyPrefix}-tend`))
  return elements
}

function oldRenderBlockPlaceholder(value: string, keyPrefix: string, l: NoteLookups): Node | null {
  const skillMatch = value.trim().match(/^\{\{skill:([^:{}]+):(\d+)(?::(\d+))?\}\}$/)
  if (skillMatch) {
    const tokenKey = skillMatch[3] ? `${skillMatch[1]}:${skillMatch[2]}:${skillMatch[3]}` : `${skillMatch[1]}:${skillMatch[2]}`
    const entry = oldResolveSkillFrameEntry(l.skill, tokenKey)
    return entry ? { tag: 'SkillFrame', key: `${keyPrefix}-skill`, entry } : { tag: 'Fallback', key: `${keyPrefix}-skill-fallback`, type: 's', tokenKey }
  }
  const passiveMatch = value.trim().match(/^\{\{passive:([^{}]+)\}\}$/)
  if (passiveMatch) {
    const tokenKey = passiveMatch[1].trim()
    const entry = l.passive[tokenKey]
    return entry ? { tag: 'PassiveBlock', key: `${keyPrefix}-passive`, entry } : { tag: 'Fallback', key: `${keyPrefix}-passive-fallback`, type: 'p', tokenKey }
  }
  const giftMatch = value.trim().match(/^\{\{gift:([^{}:]+)(?::(true))?\}\}$/)
  if (giftMatch) {
    const tokenKey = giftMatch[1].trim()
    const entry = l.egoGift[tokenKey]
    const showCondition = giftMatch[2] === 'true' && Boolean(entry?.activation_condition)
    return entry
      ? { tag: 'GiftCard', key: `${keyPrefix}-gift`, entry, conditionStatus: showCondition ? l.egoGiftCondition[tokenKey] : null }
      : { tag: 'Fallback', key: `${keyPrefix}-gift-fallback`, type: 'g', tokenKey }
  }
  return null
}

function oldRenderMixedBlockLine(value: string, keyPrefix: string, l: NoteLookups): Node[] | null {
  const blockTokenRe = noteBlockTokenPattern()
  const nodes: Node[] = []
  let last = 0
  let found = false
  let m: RegExpExecArray | null
  while ((m = blockTokenRe.exec(value)) !== null) {
    found = true
    const before = value.slice(last, m.index).trim()
    if (before) nodes.push({ tag: 'p', key: `${keyPrefix}-p${last}`, children: oldRenderInline(before, `${keyPrefix}-p${last}`, l) })
    const placeholder = oldRenderBlockPlaceholder(m[0], `${keyPrefix}-b${m.index}`, l)
    if (placeholder) nodes.push(placeholder)
    last = m.index + m[0].length
  }
  const rest = value.slice(last).trim()
  if (rest) nodes.push({ tag: 'p', key: `${keyPrefix}-pend`, children: oldRenderInline(rest, `${keyPrefix}-pend`, l) })
  return found ? nodes : null
}

// ── the same readings, built from the new functions the way NoteRenderer.tsx does ──
const TAG = { s: 'SkillChip', p: 'PassiveChip', e: 'EgoChip', i: 'IdentityChip', g: 'GiftChip' } as const

function newRenderMarkdownInline(value: string, keyPrefix: string): Node[] {
  return splitMarkdownInline(value).map((segment): Node => {
    const key = `${keyPrefix}-${segment.keySuffix}`
    if (segment.kind === 'text') return { tag: 'span', key, text: segment.text }
    if (segment.kind === 'link') return { tag: 'a', key, href: segment.href, text: segment.text }
    return { tag: segment.kind === 'bold' ? 'strong' : segment.kind === 'italic' ? 'em' : 'code', key, text: segment.text }
  })
}

function newRenderInline(value: string, keyPrefix: string, l: NoteLookups): Node[] {
  return splitInlineTokens(value, l).flatMap((segment): Node[] => {
    const key = `${keyPrefix}-${segment.keySuffix}`
    if (segment.kind === 'text') return newRenderMarkdownInline(segment.text, key)
    const { token } = segment
    if (token.kind === 'k') return [{ tag: 'Keyword', key, id: token.key }]
    return [token.entry ? { tag: TAG[token.kind], key, entry: token.entry } : { tag: 'Fallback', key, type: token.kind, tokenKey: token.key }]
  })
}

function newRenderPlaceholder(p: NoteBlockPlaceholder, keyPrefix: string): Node {
  if (p.kind === 'skill') return p.entry ? { tag: 'SkillFrame', key: `${keyPrefix}-skill`, entry: p.entry } : { tag: 'Fallback', key: `${keyPrefix}-skill-fallback`, type: 's', tokenKey: p.tokenKey }
  if (p.kind === 'passive') return p.entry ? { tag: 'PassiveBlock', key: `${keyPrefix}-passive`, entry: p.entry } : { tag: 'Fallback', key: `${keyPrefix}-passive-fallback`, type: 'p', tokenKey: p.tokenKey }
  return p.entry
    ? { tag: 'GiftCard', key: `${keyPrefix}-gift`, entry: p.entry, conditionStatus: p.conditionStatus }
    : { tag: 'Fallback', key: `${keyPrefix}-gift-fallback`, type: 'g', tokenKey: p.tokenKey }
}

function newRenderMixedBlockLine(value: string, keyPrefix: string, l: NoteLookups): Node[] | null {
  const segments = splitMixedBlockLine(value, l)
  if (!segments) return null
  return segments.flatMap((segment): Node[] => {
    const key = `${keyPrefix}-${segment.keySuffix}`
    if (segment.kind === 'text') return [{ tag: 'p', key, children: newRenderInline(segment.text, key, l) }]
    return segment.placeholder ? [newRenderPlaceholder(segment.placeholder, key)] : []
  })
}

const INLINE_TEXTS = [
  '',
  '그냥 글',
  '[s:돈키호테:1] [s:돈키호테:2] [s:없음:9] [s:이상:2]',
  '[p:패시브A] [p:없는패시브] [e:e 1] [e:다른 ego] [k:화상] [i:LCB 이상] [i:x] [g:혈향도래] [g:없는기프트]',
  '[s: 돈키호테:1 ] [p:  패시브A  ] [k:  ] 끝 [k:못]',
  '**굵게** *기울임* _밑줄_ `코드` [링크](https://example.test/a) 글 [s:돈키호테:1] **뒤**',
  '앞 [g:평범] 중간 [g:혈향도래] 뒤 *굵*',
  '[s:a][p:b][e:c][k:d][i:e][g:f]',
  '[링크](ftp://nope) **미완 *x [s:돈키호테:1',
  '가나다 {{potency}} 라마',
]
const LINES = [
  '{{skill:돈키호테:1}}',
  '{{skill:이상:2:2}}',
  '{{skill:이상:2:1}}',
  '{{skill:이상:3:3}}',
  '{{skill:없음:1}}',
  '  {{passive:패시브A}}  ',
  '{{passive: 없음 }}',
  '{{gift:혈향도래}}',
  '{{gift:혈향도래:true}}',
  '{{gift:평범:true}}',
  '{{gift:없음:true}}',
  '{{gift:a:b}}',
  '{{skill:a:b:1}}',
  '그냥 줄',
  '앞 {{gift:혈향도래}} 뒤',
  '{{gift:혈향도래}}{{passive:패시브A}}',
  '글 [s:돈키호테:1] {{skill:돈키호테:1}} [k:못] {{passive:없음}} 끝',
  '{{skill:a:b:1}} 이상',
  '   {{gift:혈향도래:true}}   ',
  '',
]

describe('note token reading', () => {
  it.each(INLINE_TEXTS)('reads the inline tokens and markdown of %j as before', text => {
    expect(newRenderInline(text, 'inline', lookups)).toEqual(oldRenderInline(text, 'inline', lookups))
  })

  it.each(INLINE_TEXTS)('splits the markdown of %j as before', text => {
    expect(newRenderMarkdownInline(text, 'm')).toEqual(oldRenderMarkdownInline(text, 'm'))
  })

  it.each(LINES)('reads the card of the line %j as before', line => {
    const old = oldRenderBlockPlaceholder(line, 'block-3', lookups)
    const parsed = parseBlockPlaceholder(line, lookups)
    expect(parsed === null).toBe(old === null)
    if (parsed) expect(newRenderPlaceholder(parsed, 'block-3')).toEqual(old)
  })

  it.each(LINES)('reads the mixed line %j as before', line => {
    expect(newRenderMixedBlockLine(line, 'mixed-7', lookups)).toEqual(oldRenderMixedBlockLine(line, 'mixed-7', lookups))
  })

  it('reads every inline text with empty lookups as before', () => {
    const empty: NoteLookups = { skill: {}, passive: {}, ego: {}, identity: {}, egoGift: {}, egoGiftCondition: {} }
    for (const text of INLINE_TEXTS) expect(newRenderInline(text, 'x', empty)).toEqual(oldRenderInline(text, 'x', empty))
    for (const line of LINES) expect(newRenderMixedBlockLine(line, 'y', empty)).toEqual(oldRenderMixedBlockLine(line, 'y', empty))
  })

  it('finds the earlier variant of a skill card the lookup lacks', () => {
    for (const key of ['돈키호테:1', '이상:2:1', '이상:2:2', '이상:2:3', '이상:2:0', '이상:2:x', '이상:3:3', '없음', 'a:b:c:d']) {
      expect(resolveSkillFrameEntry(lookups.skill, key)).toBe(oldResolveSkillFrameEntry(lookups.skill, key))
    }
    expect(resolveSkillFrameEntry(lookups.skill, '이상:2:2')).toBe(lookups.skill['이상:2:1'])
  })

  it('falls back to the first variant of a skill token and keeps a token no group holds out', () => {
    const [segment] = splitInlineTokens('[s:돈키호테:1]', lookups)
    expect(segment).toMatchObject({ kind: 'token', keySuffix: 's0', token: { kind: 's', key: '돈키호테:1' } })
    expect(splitInlineTokens('[s:이상:2]', lookups)[0]).toMatchObject({ token: { kind: 's', entry: lookups.skill['이상:2:1'] } })
  })
})
