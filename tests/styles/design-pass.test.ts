import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')
/** The rules inside the first `@media (max-width: 40rem)` block that holds `needle`. */
const narrow = (css: string, needle: string) => {
  const blocks = css.split(/@media\s*\(max-width:\s*(?:40rem|639px)\)\s*\{/).slice(1)
  return blocks.find(block => block.includes(needle)) ?? ''
}
const messages = (lang: string) => JSON.parse(read(`messages/${lang}.json`)) as { meta: Record<string, unknown> }

describe('design pass', () => {
  it('REQ-SHARED-103 the meta page carries no explanatory copy, only one closing line', () => {
    const page = read('app/[lang]/meta/page.tsx')
    const client = read('app/[lang]/meta/_components/MetaClient.tsx')
    const overview = read('features/meta/components/MetaOverview.tsx')
    expect(page).not.toMatch(/<PageHeader[^>]*description=/)
    expect(client).not.toContain('<details')
    expect(client).toContain("t('footnote')")
    expect(overview).not.toContain('comboHint')
    for (const lang of ['ko', 'en', 'ja']) {
      const meta = messages(lang).meta
      expect(typeof meta.footnote).toBe('string')
      expect(meta.methodology).toBeUndefined()
      expect(meta.methodologyLabel).toBeUndefined()
    }
  })

  it('REQ-SHARED-103 the filter button shares the period row on a phone', () => {
    const block = narrow(read('styles/components/MetaAnalysis.module.css'), '.toolbarEnd')
    expect(block).toMatch(/\.toolbarEnd\s*\{[^}]*flex-wrap:\s*nowrap/)
    expect(block).toMatch(/\.periods\s*\{[^}]*flex:\s*1/)
  })

  it('REQ-SHARED-104 the gift catalogue has wider cells and a readable name on a phone', () => {
    const catalog = read('features/mirror-dungeon/components/GiftCatalog.tsx')
    const card = read('features/mirror-dungeon/components/GiftCard.tsx')
    const css = read('styles/globals/utilities.css')
    expect(catalog).toContain('var(--gift-catalog-min, 3.625rem)')
    expect(catalog).toContain('gift-catalog-grid')
    expect(card).toContain("fontSize: 'var(--gift-name-size, 0.5625rem)'")
    const block = narrow(css, '.gift-catalog-grid')
    expect(block).toMatch(/--gift-catalog-min:\s*4\.25rem/)
    expect(block).toMatch(/--gift-name-size:\s*var\(--text-xs\)/)
  })

  it('REQ-SHARED-105 labels are no smaller than --text-xs', () => {
    const identity = read('styles/components/IdentityCard.module.css')
    expect(identity).toMatch(/\.stats dt\s*\{[^}]*font-size:\s*var\(--text-xs\)/)
    expect(identity).toMatch(/\.chips span\s*\{[^}]*font-size:\s*var\(--text-xs\)/)
    const meta = read('styles/components/MetaAnalysis.module.css')
    expect(meta).toMatch(/\.donutCenter em\s*\{[^}]*font-size:\s*var\(--text-xs\)/)
    expect(meta).toMatch(/\.constraintShare small\s*\{[^}]*font-size:\s*var\(--text-xs\)/)
    expect(meta).not.toMatch(/\.orderShare\s*\{\s*font-size:\s*\.5625rem/)
    expect(read('features/catalog/components/FilterToggleGroup.module.css')).toMatch(/\.sub\s*\{[^}]*font-size:\s*var\(--text-xs\)/)
    expect(read('app/[lang]/planner/community/[id]/PlanDetailHeader.module.css')).not.toMatch(/font-size:\s*0\.625rem/)
  })

  it('REQ-SHARED-106 phone controls are 2.75rem tall', () => {
    const friends = narrow(read('app/[lang]/friends/_components/Friends.module.css'), '.primary')
    expect(friends).toMatch(/\.primary,\s*\.ghost\s*\{[^}]*height:\s*2\.75rem/)
    expect(friends).toMatch(/\.icon\s*\{[^}]*height:\s*2\.75rem/)
    const random = narrow(read('features/tools/components/random.module.css'), '.toggle')
    expect(random).toMatch(/\.toggle\s*\{[^}]*min-height:\s*2\.75rem/)
    expect(random).toMatch(/\.tab\s*\{[^}]*min-height:\s*2\.75rem/)
    const catalog = read('features/mirror-dungeon/components/GiftCatalog.tsx')
    expect(catalog).not.toMatch(/className=[`"{][^\n]*\bh-9\b(?![^\n]*max-sm:h-11)/)
  })

  it('REQ-SHARED-107 change notes and errors have no thick side stripe', () => {
    expect(read('features/catalog/components/UptieChanges.tsx')).not.toContain('border-l-2')
    expect(read('app/[lang]/login/login.css')).not.toMatch(/\.login-error\s*\{[^}]*border-left:/)
  })

  it('REQ-SHARED-108 the support sign-in gate is a title and a button', () => {
    const desk = read('features/account/components/SupportDesk.tsx')
    const gate = desk.slice(desk.indexOf('className="desk-gate"'), desk.indexOf('desk-privacy'))
    expect(gate).not.toContain('<MessageSquare')
    expect(read('features/account/components/support.css')).toMatch(/\.desk-gate h1\s*\{[^}]*color:\s*var\(--gold\)/)
  })
})
