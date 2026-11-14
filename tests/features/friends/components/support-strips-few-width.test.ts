import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('the short strip row has its own width', () => {
  const css = readFileSync('features/friends/components/SupportStrips.module.css', 'utf8')
  it('each strip names its width (an inline-size container has no content width, so an auto column would collapse)', () => {
    expect(css).toMatch(/\.few \.strip\s*\{[^}]*\bwidth:\s*var\(--few-width\)/)
    expect(css).toMatch(/\.few\s*\{[^}]*--few-width:/)
  })
})
