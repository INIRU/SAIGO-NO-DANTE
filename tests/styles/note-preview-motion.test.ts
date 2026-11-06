import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KEYWORD_TOOLTIP_Z } from '@/lib/keywords/tooltip-stack'

const css = readFileSync(resolve(__dirname, '../../app/globals.css'), 'utf8')
const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[[\]().-]/g, '\\$&')}\\{([^}]*)\\}`))?.[1] ?? ''

describe('REQ-COMMUNITY-061 the preview card opens in place', () => {
  it('REQ-COMMUNITY-061 a card above the name is lifted with translate, which the entrance does not animate', () => {
    const above = rule('.note-preview-popover[data-above]')
    expect(above).toMatch(/translate:\s*0 -100%/)
    expect(above).not.toMatch(/transform\s*:/)
  })

  it('REQ-COMMUNITY-061 the entrance moves 0.25rem toward the name from either side', () => {
    expect(css).toMatch(/@keyframes note-preview-in\{from\{opacity:0;transform:translateY\(-\.25rem\)\}\}/)
    expect(css).toMatch(/@keyframes note-preview-in-above\{from\{opacity:0;transform:translateY\(\.25rem\)\}\}/)
    expect(css).toMatch(/\.note-preview-popover\[data-above\]\{animation-name:note-preview-in-above\}/)
  })
})

describe('REQ-KEYWORDS-010 keyword tooltips draw over cards and dialogs', () => {
  it('REQ-KEYWORDS-010 the tooltip layer is above the preview card', () => {
    const cardZ = Number(rule('.note-preview-popover').match(/z-index:(\d+)/)?.[1])
    expect(cardZ).toBeGreaterThan(0)
    expect(KEYWORD_TOOLTIP_Z).toBeGreaterThan(cardZ)
  })
})
