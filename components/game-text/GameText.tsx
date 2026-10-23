'use client'

import { Fragment, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import KeywordIcon from '@/components/ui/KeywordIcon'
import PlaceholderLabel from '@/components/ui/PlaceholderLabel'
import { skillConditionColor } from '@/lib/identity/skill-condition-color'
import { leadingPlaceholder } from '@/lib/game-text/placeholders'
import type { GameTextNode } from '@/lib/game-text/rich-text'
import { resolveKeywordIconUrl, type KeywordInfo } from '@/lib/keywords/catalog'
import { findPlainKeywords, KEYWORD_TEXT_KEYWORDS, PLAIN_KEYWORDS, plainKeywordMatcher, type PlainKeywordHit, type PlainKeywordMatcher } from '@/lib/keywords/plain-keywords'
import { KEYWORD_DEFAULT_COLOR, resolveKeywordTextColor } from '@/lib/keywords/text-color'
import { useGameTextRefs } from '@/lib/hooks/useGameTextRefs'
import type { GameTextRefName } from '@/lib/db/game-text-refs'

/** TextMeshPro's default font size in the game's skill text: `<size=18>` is half of it. */
const FONT_BASE = 36
const MIN_SIZE_EM = 0.5
const MAX_SIZE_EM = 2

/** CSS font-size of a `<size=…>` value: `N%` as written, a bare number against the base, both kept within 0.5–2em. */
/** A keyword of game text is underlined in its own colour: the word has a tooltip (the game marks its links the same way). */
const KEYWORD_UNDERLINE = {
  textDecorationLine: 'underline',
  textDecorationColor: 'color-mix(in srgb, currentColor 55%, transparent)',
  textDecorationThickness: '1px',
  textUnderlineOffset: '0.2em',
} as const

function fontSizeOf(value: string): string | null {
  const amount = Number.parseFloat(value)
  if (!Number.isFinite(amount) || amount === 0) return null
  const em = value.trim().endsWith('%') ? amount / 100 : amount / FONT_BASE
  const clamped = Math.min(MAX_SIZE_EM, Math.max(MIN_SIZE_EM, em))
  return value.trim().endsWith('%') ? `${Math.round(clamped * 1000) / 10}%` : `${Math.round(clamped * 1000) / 1000}em`
}

const ELEMENT_STYLES: Record<'u' | 'b' | 'i' | 's', CSSProperties> = {
  u: { textDecoration: 'underline' },
  b: { fontWeight: 700 },
  i: { fontStyle: 'italic' },
  s: { textDecoration: 'line-through' },
}

const VALUE_PATTERN = /(효과 위력|위력|횟수|Potency|Count|威力|回数|[+-]?\d+(?:\.\d+)?%?)/

/** Tooltips: numbers turn gold and Potency/Count terms take `termColor`. */
export function highlightValues(text: string, termColor: string) {
  return text.split(VALUE_PATTERN).map((part, i) =>
    i % 2 === 0 ? part
      : /\d/.test(part) ? <b key={i} style={{ color: '#e8b030', fontWeight: 700 }}>{part}</b>
        : <span key={i} style={{ color: termColor, fontWeight: 600 }}>{part}</span>)
}

/** Where the identity's own skill names stand in a text (longest first, as typed). */
function skillNameRanges(text: string, skillNameColors: Readonly<Record<string, string>>): { from: number; to: number }[] {
  const names = Object.keys(skillNameColors).filter(name => name && text.includes(name)).sort((a, b) => b.length - a.length)
  if (names.length === 0) return []
  const pattern = new RegExp(names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
  return [...text.matchAll(pattern)].map(match => ({ from: match.index, to: match.index + match[0].length }))
}

const isCoin = (node: GameTextNode | undefined) => node?.type === 'element' && node.tag === 'coin'

function trimCoinBreaks(text: string, before: GameTextNode | undefined, after: GameTextNode | undefined): string {
  let result = text
  if (isCoin(before)) result = result.replace(/^\r?\n/, '')
  if (isCoin(after)) result = result.replace(/\r?\n$/, '')
  return result
}

const needsRefs = (nodes: readonly GameTextNode[]): boolean =>
  nodes.some(node => node.type === 'ref' || node.type === 'sprite' || (node.type === 'element' && (node.tag === 'link' || needsRefs(node.children))))

/** What GameText hands the keyword component for a keyword `[Id]`: the localized name wrapped in its coloured label. */
type GameTextKeywordProps = {
  keyword: string
  /** keyword_meta name of the keyword, when it has a row there. */
  krKey?: string
  /** Game id of an `[Id]` / `<link>`; a keyword found as a plain word has none. */
  refId?: string
  inline: true
  displayColor: string
  /** Only the tooltip, no icon or keyword colour on the children (a `<link>`). */
  plain: boolean
  /** Drawn inside a tooltip: a keyword without a keyword_meta row gets no tooltip of its own. */
  nested: boolean
  children: ReactNode
}

/**
 * Draws parsed game source text (lib/game-text/rich-text.ts) the way the game does. `[Id]` refs are resolved with the
 * reference table (lib/hooks/useGameTextRefs): keywords are drawn by `keywordRef` (the keyword tooltip component of
 * KeywordProvider, passed in so this file does not import it back: it shows tooltip descriptions with GameText),
 * skill tags are condition labels. Plain text is not searched for keywords, with one exception: the skill and passive text of an
 * identity or E.G.O (callers that set `matchPlainKeywords` and hand over its `allowedKeywords`) may name its keywords as plain
 * words, as older game text does (lib/keywords/plain-keywords.ts says which words count); they are drawn like `[Id]` keywords.
 * Line breaks stay as they are: the caller's CSS (white-space) decides how they show.
 *
 * The body is the default text colour, as in the game: the output carries no colour of its own and inherits the caller's
 * container. `<color>`, `<style="highlight">`, `<style="upgradeHighlight">` and `<mark>` are understood but add no colour or
 * background (user decision 2026-10-01); only keywords, condition tags, own skill names and tooltip numbers are coloured.
 * `accent` (the skill/sin colour the callers pass) is for the coin label and for a condition tag with no colour of its own.
 */
export default function GameText({ nodes, accent, keywords, keywordRef: KeywordRef, nested = false, skillNameColors, highlightValues: valueColor, matchPlainKeywords = false, allowedKeywords, keywordText = false }: {
  nodes: readonly GameTextNode[]
  /** Accent colour of the caller (sin/skill colour): the coin label and condition tags without a colour of their own. */
  accent: string
  keywords: Record<string, KeywordInfo>
  keywordRef: ComponentType<GameTextKeywordProps>
  nested?: boolean
  /** Names of the identity's own skills, coloured by sin inside plain stretches of text. */
  skillNameColors?: Readonly<Record<string, string>>
  /** Tooltips: numbers turn gold and Potency/Count terms take this colour, in text the game did not colour itself. */
  highlightValues?: string
  /** Draw the keywords of `allowedKeywords` written as plain words (skill and passive text of an identity or E.G.O only). */
  matchPlainKeywords?: boolean
  /** keyword_meta names (Korean) the identity / E.G.O owns; without any, no plain word is a keyword. */
  allowedKeywords?: ReadonlySet<string>
  /** A keyword's own description: the longer list of keyword names and the Japanese edges of KEYWORD_TEXT_KEYWORDS. */
  keywordText?: boolean
}) {
  // Plain text and plain styling need no table: only a text that holds a ref, link or sprite asks for it right away
  // (the formatters of KeywordProvider otherwise ask once a text may hold one, see wantGameTextRefs).
  const { names } = useGameTextRefs({ lazy: !needsRefs(nodes) })
  const t = useTranslations()
  const locale = useLocale()
  const plainMatcher: PlainKeywordMatcher | null = matchPlainKeywords && allowedKeywords?.size ? plainKeywordMatcher(keywords, locale, keywordText) : null

  /** A keyword drawn by its tooltip component: `[Id]` / `<link>` of the game text, or a plain word found by the matcher (no `id`). */
  const renderKeyword = (ref: { n: string; kw?: string }, id: string | undefined, key: number | string, children?: ReactNode): ReactNode => {
    const keywordColor = resolveKeywordTextColor(ref.n, ref.kw ? keywords[ref.kw] : undefined, ref.kw)
    return (
      <KeywordRef key={key} keyword={ref.n} krKey={ref.kw} refId={id} inline displayColor={keywordColor} plain={children !== undefined} nested={nested}>
        {children ?? <span style={{ color: keywordColor, fontWeight: 600, ...KEYWORD_UNDERLINE }}>{ref.n}</span>}
      </KeywordRef>
    )
  }

  const renderRef = (id: string, key: number, children?: ReactNode): ReactNode => {
    const ref: GameTextRefName | undefined = names?.[id]
    if (!ref) return children ?? `[${id}]`
    if (ref.k === 'skilltag') {
      // The id first: StartBattle_Force and StartBattle share a label but not a colour.
      const tagColor = skillConditionColor(id) ?? skillConditionColor(ref.n) ?? resolveKeywordTextColor(ref.n)
      return <span key={key} style={{ color: tagColor === KEYWORD_DEFAULT_COLOR ? accent : tagColor, fontWeight: 600 }}>{children ?? ref.n}</span>
    }
    return renderKeyword(ref, id, key, children)
  }

  /** A plain stretch of text as pieces: own skill names (coloured by sin) first, then the plain keywords outside them. */
  const renderText = (text: string, key: number, plainOk: boolean): ReactNode => {
    const stretch = (value: string): ReactNode => valueColor ? highlightValues(value, valueColor) : value
    const names = skillNameColors ? skillNameRanges(text, skillNameColors) : []
    const hits: PlainKeywordHit[] = plainOk ? findPlainKeywords(text, plainMatcher, allowedKeywords, names.map(({ from, to }) => [from, to] as const), keywordText ? KEYWORD_TEXT_KEYWORDS : PLAIN_KEYWORDS) : []
    if (names.length === 0 && hits.length === 0) return skillNameColors || valueColor ? <span key={key}>{stretch(text)}</span> : text
    const pieces = [
      ...names.map(({ from, to }) => ({ from, to, hit: null as PlainKeywordHit | null })),
      ...hits.map(hit => ({ from: hit.from, to: hit.to, hit })),
    ].sort((a, b) => a.from - b.from)
    const out: ReactNode[] = []
    let last = 0
    for (const { from, to, hit } of pieces) {
      if (from > last) out.push(<Fragment key={`t${last}`}>{stretch(text.slice(last, from))}</Fragment>)
      const word = text.slice(from, to)
      if (hit) out.push(renderKeyword({ n: word, kw: hit.krKey }, undefined, `k${from}`))
      else {
        const accentOfName = resolveKeywordTextColor(word)
        out.push(<span key={`n${from}`} style={{ color: accentOfName === KEYWORD_DEFAULT_COLOR ? skillNameColors![word] : accentOfName, fontWeight: 600 }}>{word}</span>)
      }
      last = to
    }
    if (last < text.length) out.push(<Fragment key={`t${last}`}>{stretch(text.slice(last))}</Fragment>)
    return <span key={key}>{out}</span>
  }

  // `plainOk` is false inside a `<link>`: its text is already the keyword.
  const renderNodes = (list: readonly GameTextNode[], plainOk = true): ReactNode =>
    list.map((node, index): ReactNode => {
      switch (node.type) {
        case 'text': {
          // A coin is a block: the line break that separates it from its neighbours would only add an empty line.
          const text = trimCoinBreaks(node.text, list[index - 1], list[index + 1])
          if (!text || (!skillNameColors && !valueColor && !plainMatcher)) return text || null
          return renderText(text, index, plainOk)
        }
        case 'ref':
          return renderRef(node.id, index)
        case 'sprite': {
          const kw = names?.[node.name]?.kw
          const src = kw ? resolveKeywordIconUrl(kw, keywords[kw]?.iconSlug) : null
          return src
            ? <KeywordIcon key={index} src={src} alt="" width={16} height={16} unoptimized style={{ display: 'inline', verticalAlign: 'text-bottom', width: '1em', height: '1em' }} />
            : null
        }
        case 'placeholder': {
          if (node.token) {
            const token = leadingPlaceholder(node.raw)
            return token ? <PlaceholderLabel key={index} token={token.token} giftId={token.giftId} /> : node.raw
          }
          return node.index !== null ? <PlaceholderLabel key={index} token="value" /> : node.raw
        }
        case 'element': {
          const children = renderNodes(node.children, plainOk && node.tag !== 'link')
          switch (node.tag) {
            // Body colour is the default one, as in the game: these tags are read but add neither colour nor background.
            case 'style':
            case 'color':
            case 'mark':
              return <Fragment key={index}>{children}</Fragment>
            case 'size': {
              const fontSize = fontSizeOf(node.value ?? '')
              return fontSize ? <span key={index} style={{ fontSize }}>{children}</span> : null
            }
            case 'coin':
              // Same label as the older `[코인 N]` lines of SkillDescription: accent colour, bold.
              return (
                <div key={index}>
                  <span style={{ color: accent, fontWeight: 600 }}>[{t('identity.skills.coin')} {node.value}] </span>
                  {children}
                </div>
              )
            case 'link': {
              const ref = names?.[node.value ?? '']
              if (ref?.k !== 'keyword') return <span key={index}>{children}</span>
              return renderRef(node.value!, index, children)
            }
            default:
              return <span key={index} style={ELEMENT_STYLES[node.tag]}>{children}</span>
          }
        }
      }
    })

  return <span>{renderNodes(nodes)}</span>
}
