import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('app/globals.css', 'utf8')
const rule = (selector: string) => css.match(new RegExp(selector.replace(/[.[\]]/g, '\\$&') + '\\{[^}]*\\}'))?.[0] ?? ''

describe('a mention is a label like the gift label, not a pill', () => {
  it('has no border, background or rounded box', () => {
    const body = rule('.note-mention')
    expect(body).not.toBe('')
    expect(body).not.toMatch(/border|background:(?!none)|padding:[^;]*[1-9]/)
    expect(css).not.toMatch(/\.note-mention[^{]*\{[^}]*(border-radius:62\.5rem|var\(--bg-elevated\))/)
  })
  it('uses the gift label\'s icon size, baseline and weight', () => {
    expect(rule('.note-mention')).toContain('align-items:baseline')
    expect(rule('.note-mention>img')).toMatch(/width:1\.35em;height:1\.35em/)
    expect(rule('.note-mention>img')).toContain('align-self:center')
    expect(rule('.note-mention strong')).toContain('font-weight:600')
    expect(rule('.note-gift-label img')).toMatch(/width:1\.35em;height:1\.35em/)
  })
  it('shows an underline on hover or focus, like a clickable gift label', () => {
    expect(css).toMatch(/a\.note-mention[^{]*\{[^}]*text-decoration:underline/)
    expect(css).toMatch(/a\.note-mention:is\(:hover,:focus-visible\)[^{]*\{[^}]*text-decoration-color:currentColor/)
  })
})
