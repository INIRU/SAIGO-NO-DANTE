/**
 * Parser for the game's own description text (Unity rich text), kept as the game wrote it:
 *   <style="highlight"> <color=#ff6000> <u> <b> <i> <s> <mark color=#ff000040> <link="Burst">…</link>
 *   <sprite name="Burst"> (no end tag)   <noparse>…</noparse> (inner stays literal)
 *   [Id] (a BattleKeywords / SkillTag id)   {0} {0:F1} {n} (value slots)   {{live}} {{gift:123}} (site tokens, see placeholders.ts)
 *
 * The parser only splits the string; what an id or a slot means is decided by the renderer. Anything it does not
 * recognise (<E.G.O>, <color=pink>, [사용시], [On Hit]) stays text, so old stored text never loses characters.
 * Unity closes tags by name, not by nesting (`<color><u><link>x</color></link></u>` is common in the source), so a
 * closing tag ends the nearest open element of that name and any elements inside it are reopened for what follows.
 * Like TextMeshPro, a closing tag of a known name with no open element (`</color></color>`, `</color=#ebcaa2>`) is
 * dropped, not shown. <size=N%> (or <size=N>) becomes a `size` element whose value is kept as written; a zero size
 * hides its content, so that element keeps no children. <font=…> and <ruby=…> (and their closing tags) are removed
 * and their inner text stays.
 *
 * `<coin=N>…</coin>` is not a game tag but the site's own: the sync stores each skill coin's description after the
 * skill's main description inside it (`[WhenUse] …\n<coin=1>[OnSucceedAttackHead] …</coin>\n<coin=2>…</coin>`), N being
 * the 1-based coin number. It becomes a `coin` element whose value is N.
 */

import { GAME_PLACEHOLDER_PATTERN, leadingPlaceholder, placeholdersToPlainText } from './placeholders'

export type GameTextElementTag = 'style' | 'color' | 'u' | 'b' | 'i' | 's' | 'mark' | 'link' | 'size' | 'coin'

export type GameTextNode =
  | { type: 'text'; text: string }
  | { type: 'ref'; id: string }
  | { type: 'placeholder'; raw: string; index: number | null; name?: string; token?: string }
  | { type: 'sprite'; name: string }
  | { type: 'element'; tag: GameTextElementTag; value?: string; children: GameTextNode[] }

type ElementNode = Extract<GameTextNode, { type: 'element' }>
type OpenTag = { tag: GameTextElementTag; value?: string }

const QUOTED = String.raw`(?:\\?")?`
const VALUE = String.raw`([^"\\<>]+)`
const HEX = String.raw`(#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4}))`

const STYLE_TAG = new RegExp(`<style=${QUOTED}${VALUE}${QUOTED}>`, 'iy')
// The named colours TextMeshPro itself accepts.
const NAMED_COLOR = 'black|blue|green|orange|purple|red|white|yellow'
const COLOR_TAG = new RegExp(`<color=${QUOTED}(?:${HEX}|(${NAMED_COLOR}))${QUOTED}>`, 'iy')
const SIZE_TAG = new RegExp(`<size=${QUOTED}([+-]?\\d+(?:\\.\\d+)?%?)${QUOTED}>`, 'iy')
const STRIPPED_TAG = /<(?:font|ruby)(?:=[^<>]*)?>/iy
const MARK_TAG = new RegExp(`<mark(?: color)?=${QUOTED}${HEX}${QUOTED}>`, 'iy')
const LINK_TAG = new RegExp(`<link=${QUOTED}${VALUE}${QUOTED}>`, 'iy')
const SPRITE_TAG = new RegExp(`<sprite name=${QUOTED}${VALUE}${QUOTED}>`, 'iy')
const COIN_TAG = new RegExp(`<coin=${QUOTED}(\\d+)${QUOTED}>`, 'iy')
const SIMPLE_TAG = /<([ubis])>/iy
const CLOSE_TAG = /<\/(style|color|u|b|i|s|mark|link|size|coin|font|ruby|noparse)(?:=[^<>]*)?>/iy
const NOPARSE_OPEN = /<noparse>/iy
const NOPARSE_CLOSE = '</noparse>'
const REF = /\[([A-Za-z0-9_]+)\]/y
const GAME_SLOT = new RegExp(GAME_PLACEHOLDER_PATTERN.source, 'y')
const NAMED_SLOT = /\{([A-Za-z_]\w*)\}/y

function matchAt(pattern: RegExp, src: string, at: number): RegExpExecArray | null {
  pattern.lastIndex = at
  return pattern.exec(src)
}

type Parsed = { nodes: GameTextNode[]; sawTag: boolean }

function parse(src: string): Parsed {
  const root: GameTextNode[] = []
  const stack: ElementNode[] = []
  // Elements a mismatched closing tag closed early; they reopen only if more content follows.
  let pending: OpenTag[] = []
  let buffer = ''
  let sawTag = false

  const current = () => (stack.length ? stack[stack.length - 1].children : root)
  const header = (el: OpenTag): ElementNode => ({
    type: 'element',
    tag: el.tag,
    ...(el.value === undefined ? {} : { value: el.value }),
    children: [],
  })
  const reopen = () => {
    for (const open of pending) {
      const el = header(open)
      current().push(el)
      stack.push(el)
    }
    pending = []
  }
  const flush = () => {
    if (!buffer) return
    reopen()
    const siblings = current()
    const last = siblings[siblings.length - 1]
    if (last?.type === 'text') last.text += buffer
    else siblings.push({ type: 'text', text: buffer })
    buffer = ''
  }
  const push = (node: GameTextNode) => {
    flush()
    reopen()
    current().push(node)
  }
  const open = (tag: GameTextElementTag, value?: string) => {
    flush()
    reopen()
    const el = header({ tag, value })
    current().push(el)
    stack.push(el)
    sawTag = true
  }
  /** Returns false when no open element has that name (a stray closing tag). */
  const close = (tag: GameTextElementTag): boolean => {
    flush()
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].tag === tag) {
        pending.splice(i, 1)
        return true
      }
    }
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].tag !== tag) continue
      const above = stack.splice(i).slice(1).map(({ tag: t, value }) => ({ tag: t, value }))
      pending = [...above, ...pending]
      return true
    }
    return false
  }

  const lower = src.toLowerCase()
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    let m: RegExpExecArray | null = null

    if (ch === '<') {
      if ((m = matchAt(NOPARSE_OPEN, src, i))) {
        const innerStart = i + m[0].length
        const end = lower.indexOf(NOPARSE_CLOSE, innerStart)
        sawTag = true
        if (end < 0) {
          buffer += src.slice(innerStart)
          i = src.length
        } else {
          buffer += src.slice(innerStart, end)
          i = end + NOPARSE_CLOSE.length
        }
        continue
      }
      if ((m = matchAt(CLOSE_TAG, src, i))) {
        // A closing tag with no open element is dropped, as TextMeshPro does.
        close(m[1].toLowerCase() as GameTextElementTag)
        sawTag = true
        i += m[0].length
        continue
      }
      if ((m = matchAt(STRIPPED_TAG, src, i))) {
        sawTag = true
        i += m[0].length
        continue
      }
      if ((m = matchAt(SPRITE_TAG, src, i))) {
        push({ type: 'sprite', name: m[1] })
        sawTag = true
      } else if ((m = matchAt(STYLE_TAG, src, i))) open('style', m[1])
      else if ((m = matchAt(COLOR_TAG, src, i))) open('color', m[1] ?? m[2].toLowerCase())
      else if ((m = matchAt(SIZE_TAG, src, i))) open('size', m[1])
      else if ((m = matchAt(MARK_TAG, src, i))) open('mark', m[1])
      else if ((m = matchAt(LINK_TAG, src, i))) open('link', m[1])
      else if ((m = matchAt(COIN_TAG, src, i))) open('coin', String(Number(m[1])))
      else if ((m = matchAt(SIMPLE_TAG, src, i))) open(m[1].toLowerCase() as GameTextElementTag)
      if (m) {
        i += m[0].length
        continue
      }
    } else if (ch === '[') {
      if ((m = matchAt(REF, src, i))) {
        push({ type: 'ref', id: m[1] })
        i += m[0].length
        continue
      }
    } else if (ch === '{') {
      if (src.startsWith('{{', i)) {
        const token = leadingPlaceholder(src.slice(i))
        if (token) {
          const raw = src.slice(i, i + token.length)
          push({ type: 'placeholder', raw, index: null, token: raw.slice(2, -2) })
          i += token.length
        } else {
          buffer += '{{'
          i += 2
        }
        continue
      }
      if ((m = matchAt(GAME_SLOT, src, i))) {
        push({ type: 'placeholder', raw: m[0], index: Number(m[1]) })
        i += m[0].length
        continue
      }
      if ((m = matchAt(NAMED_SLOT, src, i))) {
        push({ type: 'placeholder', raw: m[0], index: null, name: m[1] })
        i += m[0].length
        continue
      }
    }

    buffer += ch
    i++
  }
  flush()
  hideZeroSize(root)
  return { nodes: root, sawTag }
}

/** TextMeshPro draws nothing at size 0, so those elements keep no children. */
function hideZeroSize(nodes: GameTextNode[]) {
  for (const node of nodes) {
    if (node.type !== 'element') continue
    if (node.tag === 'size' && Number.parseFloat(node.value ?? '') === 0) node.children = []
    else hideZeroSize(node.children)
  }
}

export function parseGameText(raw: string): GameTextNode[] {
  return parse(raw).nodes
}

/** Every [Id] used in the nodes, once each, in order of first use. */
export function collectRefIds(nodes: readonly GameTextNode[]): string[] {
  const ids = new Set<string>()
  const visit = (list: readonly GameTextNode[]) => {
    for (const node of list) {
      if (node.type === 'ref') ids.add(node.id)
      else if (node.type === 'element') visit(node.children)
    }
  }
  visit(nodes)
  return [...ids]
}

/**
 * Cheap pre-check: true when the string holds a `<` or an ASCII `[Id]`-shaped bracket, the only things raw game text
 * has that older stored text ([사용시], [On Hit], 【…】) does not. Decides whether the reference table is worth fetching.
 */
export function mayBeRawGameText(raw: string): boolean {
  return raw.includes('<') || /\[[A-Za-z0-9_]+\]/.test(raw)
}

/**
 * True when the string is game source text rather than the older stored form: it holds a recognised Unity tag, or an
 * [Id] that the reference table knows. [사용시] style labels, {{tokens}} and unknown tags alone do not count.
 */
export function isRawGameText(raw: string, refIds: ReadonlySet<string>): boolean {
  if (!raw.includes('<') && !raw.includes('[')) return false
  const { nodes, sawTag } = parse(raw)
  if (sawTag) return true
  return refIds.size > 0 && collectRefIds(nodes).some((id) => refIds.has(id))
}

export type GameTextPlainOptions = {
  /** [Id] → plain name (a BattleKeywords / SkillTag name). An id missing here stays `[Id]`. */
  names?: Readonly<Record<string, string>>
  /** Label put in front of each `<coin=N>` block, e.g. `(n) => `[코인 ${n}]``. Without it a coin shows only its text. */
  coinLabel?: (coinNumber: number) => string
  /** Language of the `{{token}}` labels (`placeholdersToPlainText`): ko (default), en, ja. */
  locale?: string
  /** Leave `{{token}}` as written instead of its "(label)", for comparing with text where those slots hold other text. */
  keepPlaceholders?: boolean
}

/**
 * Game source text as one plain string, for search, subtitles and comparisons: tags are dropped but their inner text
 * stays (a size 0 element has none, `<noparse>` content stays as written), `[Id]` becomes `names[id]` (or stays
 * `[Id]`), sprites vanish, `{{token}}` becomes its "(label)" and numbered slots `{0}` stay as written. Each coin
 * block starts on its own line (prefixed by `coinLabel(n)` plus a space, if given), and what follows it starts on a new line.
 */
export function gameTextToPlain(raw: string, options: GameTextPlainOptions = {}): string {
  const { names, coinLabel, locale = 'ko', keepPlaceholders = false } = options
  let out = ''
  let breakNext = false
  const write = (piece: string, block = false) => {
    if (!piece) return
    if ((block || breakNext) && out && !out.endsWith('\n') && !piece.startsWith('\n')) out += '\n'
    breakNext = false
    out += piece
  }
  const visit = (nodes: readonly GameTextNode[]) => {
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          write(node.text)
          break
        case 'ref':
          write(names?.[node.id] ?? `[${node.id}]`)
          break
        case 'placeholder':
          write(node.token && !keepPlaceholders ? placeholdersToPlainText(node.raw, locale) : node.raw)
          break
        case 'sprite':
          break
        case 'element':
          if (node.tag === 'coin') {
            const label = coinLabel?.(Number(node.value))
            if (label) write(`${label} `, true)
            else if (out && !out.endsWith('\n')) out += '\n'
            breakNext = false
            visit(node.children)
            breakNext = true
          } else visit(node.children)
          break
      }
    }
  }
  visit(parseGameText(raw))
  return out
}

/** `[Id]` → plain name, from the reference table's entries (`gameTextToPlain`'s `names`). */
export function refNameLabels<T extends { n: string }>(names: Readonly<Record<string, T>>): Record<string, string> {
  return Object.fromEntries(Object.entries(names).map(([id, ref]) => [id, ref.n]))
}

/**
 * Game text as the screen shows it, for comparing with what OCR reads: tags gone, `[Id]` replaced by the name the screen
 * shows, `{{token}}`/`{0}` kept (the screen shows other text there). Text that cannot be raw game text is returned as is.
 */
export function gameTextForScreen(raw: string, names?: Readonly<Record<string, string>>): string {
  return mayBeRawGameText(raw) ? gameTextToPlain(raw, { names, keepPlaceholders: true }) : raw
}

const COIN_BLOCK = /<coin=(?:\\?")?(\d+)(?:\\?")?>([\s\S]*?)(?:<\/coin>|$)/gi

/**
 * A stored skill description split at its `<coin=N>…</coin>` blocks: the main text before the first one, and each block's
 * text with its 1-based coin number. A block that is never closed runs to the end. Text without a block is all main text,
 * unchanged (the older `[코인 N]` form is not split here).
 */
export function splitCoinBlocks(raw: string): { main: string; coins: { coinNum: number; text: string }[] } {
  const coins: { coinNum: number; text: string }[] = []
  let main = raw
  for (const match of raw.matchAll(COIN_BLOCK)) {
    if (coins.length === 0) main = raw.slice(0, match.index).trimEnd()
    coins.push({ coinNum: Number(match[1]), text: match[2] })
  }
  return { main, coins }
}

/** True when drawing the text shows something: a character, an `[Id]`, a slot or a sprite (not only tags and blanks). */
export const hasVisibleGameText = (text: string) => /<sprite\b/i.test(text) || gameTextToPlain(text).trim() !== ''

type LineScan = { lines: string[]; open: string[]; inNoparse: boolean }

/** Walks the text the way the parser does, tracking which elements are open at each line break and at the end. */
function scanLines(raw: string): LineScan {
  const lines: string[] = []
  const open: { tag: string; source: string }[] = []
  let inNoparse = false
  let line = ''
  const endLine = () => {
    if (inNoparse) line += NOPARSE_CLOSE
    lines.push(hasVisibleGameText(line) ? line : '')
    line = open.map((element) => element.source).join('') + (inNoparse ? '<noparse>' : '')
  }
  const OPENERS: [RegExp, (m: RegExpExecArray) => string][] = [
    [STYLE_TAG, () => 'style'], [COLOR_TAG, () => 'color'], [SIZE_TAG, () => 'size'], [MARK_TAG, () => 'mark'],
    [LINK_TAG, () => 'link'], [COIN_TAG, () => 'coin'], [SIMPLE_TAG, (m) => m[1].toLowerCase()],
  ]

  let i = 0
  while (i < raw.length) {
    const ch = raw[i]
    if (ch === '\n') {
      endLine()
      i++
      continue
    }
    if (ch === '<') {
      if (inNoparse) {
        if (raw.slice(i, i + NOPARSE_CLOSE.length).toLowerCase() === NOPARSE_CLOSE) {
          inNoparse = false
          line += raw.slice(i, i + NOPARSE_CLOSE.length)
          i += NOPARSE_CLOSE.length
          continue
        }
      } else {
        let m: RegExpExecArray | null
        if ((m = matchAt(NOPARSE_OPEN, raw, i))) {
          inNoparse = true
        } else if ((m = matchAt(CLOSE_TAG, raw, i))) {
          const name = m[1].toLowerCase()
          for (let k = open.length - 1; k >= 0; k--) {
            if (open[k].tag === name) {
              open.splice(k, 1)
              break
            }
          }
        } else {
          for (const [pattern, nameOf] of OPENERS) {
            if ((m = matchAt(pattern, raw, i))) {
              open.push({ tag: nameOf(m), source: m[0] })
              break
            }
          }
          if (!m) m = matchAt(STRIPPED_TAG, raw, i) ?? matchAt(SPRITE_TAG, raw, i)
        }
        if (m) {
          line += m[0]
          i += m[0].length
          continue
        }
      }
    }
    line += ch
    i++
  }
  endLine()
  return { lines, open: open.map((element) => element.tag), inNoparse }
}

/**
 * Splits at line breaks into lines that each parse on their own: a tag still open at a line break is closed by the
 * parser at the end of that line and opened again at the start of the next, so a highlight spread over several lines
 * (`<style="highlight">- a\n- b</style>`) keeps its look on every line. A line left with no visible content (blank, or
 * only tags) becomes ''. Closing follows the parser: a closing tag ends the nearest open element of that name.
 */
export function splitGameTextLines(raw: string): string[] {
  return scanLines(raw).lines
}

/**
 * The text with its still-open tags closed, innermost first. The game closes tags at the end of each string, so a text
 * that is put in front of another (passives of one stage joined with a blank line) must be closed before it.
 */
export function closeGameText(raw: string): string {
  const { open, inNoparse } = scanLines(raw)
  return raw + (inNoparse ? NOPARSE_CLOSE : '') + open.reverse().map((tag) => `</${tag}>`).join('')
}
