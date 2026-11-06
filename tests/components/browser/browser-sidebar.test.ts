import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(resolve(__dirname, '../../..', file), 'utf8')

describe('REQ-CATALOG-034 the identity and E.G.O browsers', () => {
  it('REQ-CATALOG-034 keep the filter sidebar beside the grid', () => {
    for (const file of ['app/[lang]/sinners/identities/IdentityBrowserClient.tsx', 'app/[lang]/sinners/ego/EGOBrowserClient.tsx']) {
      expect(read(file), file).toContain('<FilterSidebar')
    }
  })

  it('REQ-CATALOG-034 fill the grid with small cards', () => {
    expect(read('app/[lang]/sinners/identities/IdentityBrowserClient.tsx')).toContain('grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]')
    expect(read('app/[lang]/sinners/ego/EGOBrowserClient.tsx')).toContain('grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]')
  })

  it('REQ-CATALOG-034 light a chosen sinner in its own colour', () => {
    expect(read('components/browser/SinnerFilter.tsx')).toContain('accent: sinnerColor(s.id)')
    expect(read('components/browser/FilterToggleGroup.module.css')).toMatch(/\.item\[aria-pressed='true'\] \{ border-color: var\(--accent, var\(--gold\)\)/)
  })
})
