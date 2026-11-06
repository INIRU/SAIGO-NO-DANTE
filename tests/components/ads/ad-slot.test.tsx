import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

let pathname = '/ko/decks/1'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
import { renderToStaticMarkup } from 'react-dom/server'
import AdSlot from '@/components/ads/AdSlot'
import { ADSENSE_ACCOUNT } from '@/lib/seo/metadata'
import { isAdFreePath } from '@/lib/seo/ads'

const root = resolve(__dirname, '../../..')
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('ad slot', () => {
  it('REQ-SHARED-085 draws one display unit of the account in a reserved box', () => {
    pathname = '/ko/decks/1'
    const html = renderToStaticMarkup(<AdSlot slot="1234567890" place="inline" />)
    expect(html).toContain('class="adsbygoogle')
    expect(html).toContain(`data-ad-client="${ADSENSE_ACCOUNT}"`)
    expect(html).toContain('data-ad-slot="1234567890"')
    // the size comes from the reserved box, not from AdSense's own auto sizing (which can grow and push the page)
    expect(html).not.toContain('data-ad-format')
    expect(html).not.toContain('data-full-width-responsive')
  })

  it('REQ-SHARED-085 draws nothing outside development without a unit, and nothing on an ad-free page', () => {
    pathname = '/ko/decks/1'
    expect(renderToStaticMarkup(<AdSlot slot={null} place="inline" />)).toBe('')
    pathname = '/ko/decks/1/edit'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="inline" />)).toBe('')
  })

  it('REQ-SHARED-085 reserves the space and hides an unfilled unit and the ad of a full-screen workspace', () => {
    const css = source('components/ads/AdSlot.module.css')
    expect(css).toMatch(/\.topUnit\s*\{[^}]*height:\s*100px/)
    expect(css).toMatch(/:has\(ins\[data-ad-status=["']?unfilled["']?\]\)[^{]*\{[^}]*display:\s*none/)
    const workspaces = source('styles/globals/workspaces.css')
    for (const flag of ['admin-shell', 'assist-run', 'prescript', 'support-page', 'page-error', 'tool-screen', 'mypage', 'gift-check', 'friend-compose', 'motion', 'login-page'])
      expect(workspaces, flag).toMatch(new RegExp(`\\[data-with-${flag}\\][^{]*\\.site-ad`))
  })

  it('REQ-SHARED-085 has no ad glued above every footer; a detail page or the home puts its banner between its own parts', () => {
    const layout = source('app/[lang]/layout.tsx')
    expect(layout).not.toMatch(/<AdSlot \/>|<AdSlot place="(top|inline)"/)
    const identity = source('app/[lang]/sinners/[slug]/identities/[id]/_components/IdentityDetailClient.tsx')
    expect(identity.indexOf('<AdSlot place="inline" />')).toBeGreaterThan(identity.indexOf('<IdentitySanitySection'))
    expect(identity.indexOf('<AdSlot place="inline" />')).toBeLessThan(identity.indexOf('{recommendations}'))
    const home = source('app/[lang]/(home)/_components/HomeStaticSections.tsx')
    expect(home.indexOf('<AdSlot place="inline" />')).toBeGreaterThan(home.indexOf('<Official '))
  })

  it('REQ-SHARED-085 puts a 160x600 ad in each empty side margin, placed beside the measured content and never over it, not on home', () => {
    const layout = source('app/[lang]/layout.tsx')
    expect(layout).toContain('<AdSlot place="left" />')
    expect(layout).toContain('<AdSlot place="right" />')
    const css = source('components/ads/AdSlot.module.css')
    expect(css).toMatch(/\.rail\s*\{[^}]*display:\s*none[^}]*position:\s*fixed/)
    expect(css).toMatch(/\.railUnit\s*\{[^}]*width:\s*160px[^}]*height:\s*600px/)
    const code = source('components/ads/AdSlot.tsx')
    // the margin must hold the ad, the gap to the content and an edge, or the side ad is not drawn
    expect(code).toMatch(/margin >= RAIL \+ GAP \+ 16 \? margin - RAIL - GAP : null/)
    // before the content is measured (the server render) there is no side ad, so it never lands on the content
    pathname = '/ko/decks/1'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="left" />)).toBe('')
    pathname = '/ko'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="left" />)).toBe('')
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="inline" />)).toContain('data-ad-slot')
  })

  it('REQ-SHARED-085 puts a page-start banner under a list page title, before its content, with its place kept while loading', () => {
    const header = source('components/ui/PageHeader.tsx')
    expect(header.indexOf('<AdSlot place="top" />')).toBeGreaterThan(header.indexOf('</header>'))
    expect(source('app/[lang]/motion/skills/page.tsx')).toContain('<PageHeader title={t(\'title\')} ad={false} />')
    expect(header).toContain('<AdSlotSpace />')
    const css = source('components/ads/AdSlot.module.css')
    expect(css).toMatch(/\.topUnit\s*\{[^}]*height:\s*100px/)
    expect(css).toMatch(/min-width:\s*768px[^{]*\{\s*\.topUnit\s*\{\s*height:\s*90px/)
    pathname = '/ko/mirror-dungeon'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="top" />)).toContain('data-ad-slot')
    pathname = '/ko/tools/damage'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="top" />)).toBe('')
  })

  it('REQ-SHARED-085 puts a small banner under a deck or plan section tabs, before the first heading', () => {
    for (const [page, first] of [
      ['app/[lang]/decks/[id]/DeckDetailClient.tsx', '<section id="deck-formation"'],
      ['app/[lang]/planner/community/[id]/PlanDetailClient.tsx', '{plan.description && ('],
    ]) {
      const text = source(page)
      const inline = text.indexOf('<AdSlot place="inline" />')
      expect(inline, page).toBeGreaterThan(text.indexOf('<main className="min-w-0 overflow-x-clip">'))
      expect(inline, page).toBeGreaterThan(text.indexOf('sticky-under-nav'))
      expect(inline, page).toBeLessThan(text.indexOf(first))
      expect(text.match(/<AdSlot\b/g), page).toHaveLength(1)
    }
    expect(source('components/ads/AdSlot.module.css')).toMatch(/\.inline\s*\{[^}]*margin-top:\s*2\.5rem/)
  })

  it('REQ-SHARED-085 leaves editors, assist, tools, account, admin, legal and error pages without an ad', () => {
    for (const path of ['/ko/decks/new', '/en/decks/abc/edit', '/ko/planner', '/ko/planner/run', '/ko/friends/new', '/ko/login',
      '/ja/mypage', '/ko/admin/users', '/ko/support', '/ko/terms', '/ko/privacy', '/ko/maintenance', '/ko/tools/damage',
      '/ko/random', '/ko/prescript/ranking', '/ko/motion/skills/watch', '/ko/sinners', '/en/sinners/'])
      expect(isAdFreePath(path), path).toBe(true)
    expect(isAdFreePath(null)).toBe(true)
    for (const path of ['/ko', '/en', '/ko/decks', '/ko/decks/abc', '/ko/planner/community', '/ko/planner/community/abc',
      '/ko/sinners/yi-sang/identities/abc', '/ko/sinners/identities', '/ko/sinners/ego', '/ko/sinners/yi-sang', '/ko/motion/skills', '/ko/mirror-dungeon', '/ko/announcements', '/ko/keywords'])
      expect(isAdFreePath(path), path).toBe(false)
  })
})
