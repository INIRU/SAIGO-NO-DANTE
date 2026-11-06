import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')
const cssPath = resolve(root, 'components/layout/NavbarMobileSheet.module.css')
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''

describe('REQ-SHARED-084 the phone menu', () => {
  it('REQ-SHARED-084 lays each group out as two columns of tiles under a gold heading with a rule', () => {
    expect(css).toMatch(/\.items \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
    expect(css).toMatch(/\.tile \{[^}]*border: 1px solid #2e2417/)
    expect(css).toMatch(/\.tile\[aria-current='page'\] \{[^}]*border-color: var\(--gold\)/)
    expect(css).toMatch(/\.heading::after \{/)
  })

  it('REQ-SHARED-084 the groups settle in one after another, and not under reduced motion', () => {
    expect(css).toMatch(/animation-delay: calc\(var\(--i, 0\) \* 40ms\)/)
    expect(css).toMatch(/prefers-reduced-motion: no-preference/)
  })
})
