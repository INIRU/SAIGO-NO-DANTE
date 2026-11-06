import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SINNER_COLORS, sinnerColor } from '@/lib/constants/sinner-colors'
import { SINNER_SLUGS } from '@/lib/constants/game'

const read = (file: string) => readFileSync(resolve(__dirname, '../../..', file), 'utf8')
const lineup = read('components/sinners/SinnerLineup.module.css')

describe('REQ-CATALOG-031 the sinner lineup', () => {
  it('REQ-CATALOG-031 on a wide screen the twelve stand in one row and the hovered or focused column widens', () => {
    const wide = lineup.slice(lineup.indexOf('@media (min-width: 64rem)'))
    expect(wide).toMatch(/\.lineup \{ display: flex;/)
    expect(wide).toMatch(/\.slot:has\(\.column:focus-visible\) \{ flex-grow: 4\.2; \}/)
    expect(lineup).toMatch(/\(hover: hover\) and \(pointer: fine\) \{\s*\.slot:has\(\.column:hover\) \{ flex-grow: 4\.2; \}/)
    expect(wide).toMatch(/\.label \{[^}]*writing-mode: vertical-rl/)
  })

  it('REQ-CATALOG-031 the number plate is pinned to the left and drops in after its column', () => {
    expect(lineup).toMatch(/\.plate \{ top: \.5rem; bottom: auto; left: \.5rem;/)
    expect(lineup).toMatch(/@keyframes plate-in/)
  })

  it('REQ-CATALOG-031 names take the sinner colour, one for each of the twelve', () => {
    expect(lineup).toMatch(/\.name \{ color: var\(--sinner/)
    for (const id of SINNER_SLUGS) expect(SINNER_COLORS[id], id).toMatch(/^#[0-9a-f]{6}$/)
    expect(sinnerColor('nobody')).toBe('var(--gold-light)')
  })

  it('REQ-CATALOG-031 reduced motion stops the columns, plates and widening', () => {
    expect(lineup.slice(lineup.indexOf('prefers-reduced-motion: reduce'))).toMatch(/\.slot, \.art, \.shade, \.label, \.text, \.column, \.plate \{ transition: none; animation: none; \}/)
  })
})

describe('REQ-CATALOG-032 sinner detail top', () => {
  const source = read('app/[lang]/sinners/[slug]/SinnerDetailClient.tsx')
  it('REQ-CATALOG-032 the hero replaces the side profile and names the neighbours', () => {
    expect(source).toContain('<SinnerHero')
    expect(read('components/sinners/SinnerHero.tsx')).toMatch(/SINNER_SLUGS\[\(at \+ 1\) % SINNER_SLUGS\.length\]/)
  })
  it('REQ-CATALOG-032 enters within 0.32s and a filter change does not replay the stagger', () => {
    expect(source).not.toMatch(/duration: shouldReduceMotion \? 0 : 0\.6/)
    expect(source).not.toMatch(/<StaggerReveal key=\{filtered/)
  })
  it('REQ-CATALOG-032 identity cards fill the width at 7.5rem or more', () => {
    expect(read('styles/components/SinnerDetail.module.css')).toContain('grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr))')
  })
})
