import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('REQ-COMMUNITY-097 the short strip row has its own width', () => {
  const css = readFileSync('components/friends/SupportStrips.module.css', 'utf8')
  it('REQ-COMMUNITY-097 each strip names its width (an inline-size container has no content width, so an auto column would collapse)', () => {
    expect(css).toMatch(/\.few \.strip\s*\{[^}]*\bwidth:\s*var\(--few-width\)/)
    expect(css).toMatch(/\.few\s*\{[^}]*--few-width:/)
  })
})
