import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Sinner logos are taller than wide (about 346×410); a square box must contain them, never stretch them.
describe('sinner logos keep their ratio', () => {
  it('the search window contains the logo in its square', () => {
    const css = readFileSync('components/ui/SearchModal.module.css', 'utf8')
    expect(css).toMatch(/\.sinner img\s*\{[^}]*object-fit:\s*contain/)
    expect(css).toMatch(/\.metaLogo\s*\{[^}]*object-fit:\s*contain/)
  })

  it('the sinner page header contains the logo in its square', () => {
    const source = readFileSync('app/[lang]/sinners/[slug]/SinnerDetailClient.tsx', 'utf8')
    expect(source).toMatch(/src=\{getSinnerLogoUrl\(sinner\.id\)\}[\s\S]{0,200}object-contain/)
  })
})
