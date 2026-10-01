'use client'

import { Fragment, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import KeywordIcon from '@/components/ui/KeywordIcon'
import PlaceholderLabel from '@/components/ui/PlaceholderLabel'
import { skillConditionColor } from '@/lib/identity/skill-condition-color'
import { leadingPlaceholder } from '@/lib/game-text/placeholders'
import type { GameTextNode } from '@/lib/game-text/rich-text'
import { resolveKeywordIconUrl, type KeywordInfo } from '@/lib/keywords/catalog'
import { KEYWORD_DEFAULT_COLOR, resolveKeywordTextColor } from '@/lib/keywords/text-color'
import { useGameTextRefs } from '@/lib/hooks/useGameTextRefs'
import type { GameTextRefName } from '@/lib/db/game-text-refs'

/** TextMeshPro's default font size in the game's skill text: `<size=18>` is half of it. */
const FONT_BASE = 36
const MIN_SIZE_EM = 0.5
const MAX_SIZE_EM = 2

/** CSS font-size of a `<size=…>` value: `N%` as written, a bare number against the base, both kept within 0.5–2em. */
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

/** Colours the names of the identity's own skills (longest first, as typed) inside plain stretches of text. */
function colourSkillNames(text: string, skillNameColors: Readonly<Record<string, string>>, rest: (plain: string) => ReactNode): ReactNode[] {
  const names = Object.keys(skillNameColors).filter(name => name && text.includes(name)).sort((a, b) => b.length - a.length)
  if (names.length === 0) return [rest(text)]
  const pattern = new RegExp(names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
  const out: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) out.push(rest(text.slice(last, match.index)))
    const accent = resolveKeywordTextColor(match[0])
    out.push(<span key={`n${match.index}`} style={{ color: accent === KEYWORD_DEFAULT_COLOR ? skillNameColors[match[0]] : accent, fontWeight: 600 }}>{match[0]}</span>)
    last = match.index + match[0].length
  }
  if (last < text.length) out.push(rest(text.slice(last)))
  return out
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
  refId: string
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
 * skill tags are condition labels. Plain text is never searched for keywords. Line breaks stay as they are: the caller's
 * CSS (white-space) decides how they show.
 *
 * The body is the default text colour, as in the game: the output carries no colour of its own and inherits the caller's
 * container. `<color>`, `<style="highlight">`, `<style="upgradeHighlight">` and `<mark>` are understood but add no colour or
 * background (user decision 2026-10-01); only keywords, condition tags, own skill names and tooltip numbers are coloured.
 * `accent` (the skill/sin colour the callers pass) is for the coin label and for a condition tag with no colour of its own.
 */
export default function GameText({ nodes, accent, keywords, keywordRef: KeywordRef, nested = false, skillNameColors, highlightValues: valueColor }: {
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
}) {
  // Plain text and plain styling need no table: only a text that holds a ref, link or sprite asks for it right away
  // (the formatters of KeywordProvider otherwise ask once a text may hold one, see wantGameTextRefs).
  const { names } = useGameTextRefs({ lazy: !needsRefs(nodes) })
  const t = useTranslations()

  const renderRef = (id: string, key: number, children?: ReactNode): ReactNode => {
    const ref: GameTextRefName | undefined = names?.[id]
    if (!ref) return children ?? `[${id}]`
    if (ref.k === 'skilltag') {
      // The id first: StartBattle_Force and StartBattle share a label but not a colour.
      const tagColor = skillConditionColor(id) ?? skillConditionColor(ref.n) ?? resolveKeywordTextColor(ref.n)
      return <span key={key} style={{ color: tagColor === KEYWORD_DEFAULT_COLOR ? accent : tagColor, fontWeight: 600 }}>{children ?? ref.n}</span>
    }
    const keywordColor = resolveKeywordTextColor(ref.n, ref.kw ? keywords[ref.kw] : undefined, ref.kw)
    return (
      <KeywordRef key={key} keyword={ref.n} krKey={ref.kw} refId={id} inline displayColor={keywordColor} plain={children !== undefined} nested={nested}>
        {children ?? <span style={{ color: keywordColor, fontWeight: 600 }}>{ref.n}</span>}
      </KeywordRef>
    )
  }

  const renderNodes = (list: readonly GameTextNode[]): ReactNode =>
    list.map((node, index): ReactNode => {
      switch (node.type) {
        case 'text': {
          // A coin is a block: the line break that separates it from its neighbours would only add an empty line.
          const text = trimCoinBreaks(node.text, list[index - 1], list[index + 1])
          if (!text || (!skillNameColors && !valueColor)) return text || null
          const plain = (stretch: string): ReactNode => valueColor ? highlightValues(stretch, valueColor) : stretch
          return <span key={index}>{skillNameColors ? colourSkillNames(text, skillNameColors, plain) : plain(text)}</span>
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
          const children = renderNodes(node.children)
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
