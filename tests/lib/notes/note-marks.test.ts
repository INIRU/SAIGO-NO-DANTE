import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NOTE_PREFIX, hasBlocks, normalizeDocument, parseBlockDocument } from '@/lib/notes/blocks'
import { tiptapContentToMarkdown } from '@/lib/notes/document'
import { NOTE_COLOR_SINS, NOTE_HIGHLIGHT_PERCENT, NOTE_SIN_MIX, NOTE_SIN_MIX_ON_HIGHLIGHT, isNoteColorSin } from '@/lib/notes/text-style'
import { SIN_ORDER, getSinIconUrl } from '@/lib/constants/sin'

const css = readFileSync('app/globals.css', 'utf8')
const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1]
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const luminance = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const contrast = (a: number[], b: number[]) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
/** color-mix(in srgb, a share%, b): channel-wise on the encoded values, like the browser. */
const mix = (a: number[], b: number[], share: number) => a.map((v, i) => v * share / 100 + b[i] * (100 - share) / 100)
const doc = (...content: object[]) => ({ type: 'doc', content })
const text = (value: string, ...marks: object[]) => ({ type: 'text', text: value, marks })
const para = (...content: object[]) => ({ type: 'paragraph', content })

describe('REQ-COMMUNITY-049 text marks are saved and whitelisted', () => {
  it('REQ-COMMUNITY-049 keeps strike, highlight and a sin colour, and nothing else', () => {
    const d = normalizeDocument(doc(para(
      text('a', { type: 'strike' }, { type: 'highlight' }, { type: 'noteColor', attrs: { sin: 'wrath' } }),
      text('b', { type: 'noteColor', attrs: { sin: 'red' } }, { type: 'underline' }, { type: 'textStyle', attrs: { color: '#ff0000' } }),
    )))!
    const [a, b] = d.content![0].content!
    expect(a.marks).toEqual([{ type: 'strike' }, { type: 'highlight' }, { type: 'noteColor', attrs: { sin: 'wrath' } }])
    expect(b.marks).toEqual([])
  })
  it('REQ-COMMUNITY-049 offers exactly the seven sins, in game order, each with its game icon', () => {
    expect(NOTE_COLOR_SINS).toEqual(SIN_ORDER)
    expect(NOTE_COLOR_SINS).toHaveLength(7)
    for (const sin of NOTE_COLOR_SINS) expect(getSinIconUrl(sin)).toContain(`/assets/game-ui/sins/${sin}.webp`)
    expect(isNoteColorSin('envy')).toBe(true)
    expect(isNoteColorSin('#c83030')).toBe(false)
  })
  it('REQ-COMMUNITY-049 saves a document with these marks as blocks so they survive a reload', () => {
    for (const mark of [{ type: 'strike' }, { type: 'highlight' }, { type: 'noteColor', attrs: { sin: 'gloom' } }]) {
      const d = doc(para(text('표시', mark)))
      expect(hasBlocks(d)).toBe(true)
      const saved = tiptapContentToMarkdown(d)
      expect(saved.startsWith(NOTE_PREFIX)).toBe(true)
      expect(parseBlockDocument(saved)?.content?.[0].content?.[0].marks).toEqual([mark])
    }
  })
  it('REQ-COMMUNITY-049 leaves an old document alone: bold, italic and links still save as plain markdown', () => {
    const d = doc(para(text('굵게', { type: 'bold' }), text(' '), text('링크', { type: 'link', attrs: { href: 'https://example.com' } })))
    expect(hasBlocks(d)).toBe(false)
    expect(tiptapContentToMarkdown(d)).toBe('**굵게** [링크](https://example.com)')
  })
})

describe('REQ-COMMUNITY-050 sin colours stay readable on the dark panels', () => {
  const sinColour = (sin: string) => rgb(token(sin))
  const text_ = rgb(token('text-primary'))
  const panels = ['bg-deep', 'bg-panel', 'bg-card', 'bg-elevated'].map(name => ({ name, bg: rgb(token(name)) }))
  const warningCallout = mix(rgb('#9b2c23'), rgb(token('bg-card')), 12)
  const gold = rgb(token('gold-light'))
  it('REQ-COMMUNITY-050 the coloured text has at least 4.5:1 on every panel token and the warning callout', () => {
    for (const sin of NOTE_COLOR_SINS) {
      const colour = mix(sinColour(sin), text_, NOTE_SIN_MIX)
      for (const { name, bg } of [...panels, { name: 'warning callout', bg: warningCallout }]) {
        expect(contrast(colour, bg), `${sin} on ${name}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
  it('REQ-COMMUNITY-050 inside a highlight the colour and the plain text both keep 4.5:1', () => {
    for (const { name, bg } of panels) {
      const lit = mix(gold, bg, NOTE_HIGHLIGHT_PERCENT)
      expect(contrast(text_, lit), `text on highlight over ${name}`).toBeGreaterThanOrEqual(4.5)
      for (const sin of NOTE_COLOR_SINS) expect(contrast(mix(sinColour(sin), text_, NOTE_SIN_MIX_ON_HIGHLIGHT), lit), `${sin} on highlight over ${name}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('REQ-COMMUNITY-050 the stylesheet mixes only tokens, with the numbers this file checks', () => {
    expect(css).toContain(`--note-sin-mix:${NOTE_SIN_MIX_ON_HIGHLIGHT}%`)
    expect(css).toMatch(/\.note-sin-color\{--note-sin-text:color-mix\(in srgb,var\(--note-sin\) var\(--note-sin-mix,\d+%\),var\(--text-primary\)\);color:var\(--note-sin-text\)\}/)
    expect(css).toContain(`color-mix(in srgb,var(--gold-light) ${NOTE_HIGHLIGHT_PERCENT}%,transparent)`)
    expect(css).toMatch(/\.note-sin-color\{[^}]*\}/)
    expect(css).toContain(`var(--note-sin-mix,${NOTE_SIN_MIX}%)`)
  })
})
