'use client'

import type { ComponentType, CSSProperties, ReactNode } from 'react'
import KeywordIcon from '@/components/ui/KeywordIcon'
import PlaceholderLabel from '@/components/ui/PlaceholderLabel'
import { skillConditionColor } from '@/lib/identity/skill-condition-color'
import { leadingPlaceholder } from '@/lib/game-text/placeholders'
import type { GameTextNode } from '@/lib/game-text/rich-text'
import { resolveKeywordIconUrl, type KeywordInfo } from '@/lib/keywords/catalog'
import { KEYWORD_DEFAULT_COLOR, resolveKeywordTextColor } from '@/lib/keywords/text-color'
import { useGameTextRefs } from '@/lib/hooks/useGameTextRefs'
import type { GameTextRefName } from '@/lib/db/game-text-refs'

/** `<style="highlight">` and `<style="upgradeHighlight">` of the game text. Tuned here, nowhere else. */
export const GAME_TEXT_HIGHLIGHT = '#f8c200'
export const GAME_TEXT_UPGRADE_HIGHLIGHT = '#ff9000'
/** TextMeshPro's default font size in the game's skill text: `<size=18>` is half of it. */
const FONT_BASE = 36
const MIN_SIZE_EM = 0.5
const MAX_SIZE_EM = 2

const STYLE_COLORS: Record<string, string> = {
  highlight: GAME_TEXT_HIGHLIGHT,
  upgradeHighlight: GAME_TEXT_UPGRADE_HIGHLIGHT,
}

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
 * CSS (white-space) decides how they show. `color` is the text colour outside any `<color>`/`<style>`.
 */
export default function GameText({ nodes, color, keywords, keywordRef: KeywordRef, nested = false }: {
  nodes: readonly GameTextNode[]
  color: string
  keywords: Record<string, KeywordInfo>
  keywordRef: ComponentType<GameTextKeywordProps>
  nested?: boolean
}) {
  const { names } = useGameTextRefs()

  const renderRef = (id: string, key: number, children?: ReactNode): ReactNode => {
    const ref: GameTextRefName | undefined = names?.[id]
    if (!ref) return children ?? `[${id}]`
    if (ref.k === 'skilltag') {
      // The id first: StartBattle_Force and StartBattle share a label but not a colour.
      const accent = skillConditionColor(id) ?? skillConditionColor(ref.n) ?? resolveKeywordTextColor(ref.n)
      return <span key={key} style={{ color: accent === KEYWORD_DEFAULT_COLOR ? color : accent, fontWeight: 600 }}>{children ?? ref.n}</span>
    }
    const accent = resolveKeywordTextColor(ref.n, ref.kw ? keywords[ref.kw] : undefined, ref.kw)
    return (
      <KeywordRef key={key} keyword={ref.n} krKey={ref.kw} refId={id} inline displayColor={accent} plain={children !== undefined} nested={nested}>
        {children ?? <span style={{ color: accent, fontWeight: 600 }}>{ref.n}</span>}
      </KeywordRef>
    )
  }

  const renderNodes = (list: readonly GameTextNode[]): ReactNode =>
    list.map((node, index): ReactNode => {
      switch (node.type) {
        case 'text':
          return node.text
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
            case 'style': {
              const accent = STYLE_COLORS[node.value ?? '']
              return accent ? <span key={index} style={{ color: accent }}>{children}</span> : <span key={index}>{children}</span>
            }
            case 'color':
              return <span key={index} style={{ color: node.value }}>{children}</span>
            case 'mark':
              return <span key={index} style={{ backgroundColor: node.value }}>{children}</span>
            case 'size': {
              const fontSize = fontSizeOf(node.value ?? '')
              return fontSize ? <span key={index} style={{ fontSize }}>{children}</span> : null
            }
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

  return <span style={{ color }}>{renderNodes(nodes)}</span>
}
