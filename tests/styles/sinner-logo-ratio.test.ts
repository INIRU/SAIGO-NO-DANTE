import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Sinner logos are taller than wide (about 346×410); a square box must contain them, never stretch them.
describe('sinner logos keep their ratio', () => {
  it('the search window contains the logo in its square', () => {
    const css = readFileSync('components/ui/SearchModal.module.css', 'utf8')
    expect(css).toMatch(/\.sinner img\s*\{[^}]*object-fit:\s*contain/)
    expect(css).toMatch(/\.metaLogo\s*\{[^}]*object-fit:\s*contain/)
  })

  it('the sinner page hero sizes the logo by width only, so it keeps its own height', () => {
    const css = readFileSync('components/sinners/SinnerHero.module.css', 'utf8')
    expect(css).toMatch(/\.logo\s*\{[^}]*width:\s*2\.25rem;\s*height:\s*auto/)
  })
})
