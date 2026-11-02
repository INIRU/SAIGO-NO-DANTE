import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'
import { KEYWORD_NEGATIVE_COLOR } from '@/lib/keywords/text-color'

const css = readFileSync('app/globals.css', 'utf8')
const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1]
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Text sits on any surface up to the raised one, the lightest of the brown layers.
const SURFACE = token('bg-elevated')

describe('text colours stay readable on the brown surfaces', () => {
  it.each(['text-primary', 'text-secondary', 'text-tertiary', 'text-muted', 'gold', 'gold-light', 'gold-dim', 'error-text'])('%s reaches 4.5:1 on the raised surface', name => {
    expect(contrast(token(name), SURFACE)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the steps of the text scale in order', () => {
    const steps = ['text-primary', 'text-secondary', 'text-tertiary', 'text-muted'].map(name => luminance(token(name)))
    expect(steps).toEqual([...steps].sort((a, b) => b - a))
  })

  it('keeps the edge of a field visible on the raised surface', () => {
    expect(contrast(token('border-control'), SURFACE)).toBeGreaterThanOrEqual(3)
  })

  it('keeps white text readable on the danger fill', () => {
    expect(contrast('#ffffff', token('error'))).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps keyword colours readable as text', () => {
    expect(contrast(KEYWORD_NEGATIVE_COLOR, SURFACE)).toBeGreaterThanOrEqual(4.5)
    for (const [keyword, colour] of Object.entries(GIFT_KEYWORD_COLORS)) {
      expect(contrast(colour, SURFACE), keyword).toBeGreaterThanOrEqual(4.5)
    }
  })
})
