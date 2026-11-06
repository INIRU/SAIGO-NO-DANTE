import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

let pathname = '/ko/decks/1'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
import { renderToStaticMarkup } from 'react-dom/server'
import AdSlot, { AdSlotSpace } from '@/components/ads/AdSlot'
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

  it('REQ-SHARED-085 gives each place its own ad unit, so the report shows what each place earns', () => {
    const unit = (place: 'top' | 'inline' | 'left' | 'panel') => renderToStaticMarkup(<AdSlot place={place} />).match(/data-ad-slot="(\d+)"/)?.[1]
    pathname = '/ko/mirror-dungeon'
    expect(unit('top')).toBe('2699879515')
    pathname = '/ko/decks/1'
    expect(unit('inline')).toBe('1649300531')
    pathname = '/ko/motion/skills/watch'
    expect(unit('panel')).toBe('6377068943')
    expect(source('components/ads/AdSlot.tsx')).toMatch(/ADSENSE_SLOTS\[rail \? 'rail' : place\]/)
    expect(source('lib/seo/metadata.ts')).toMatch(/rail: '1316313953'/)
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

  it('REQ-SHARED-085 puts a 160x600 ad in each empty side margin, standing off the window edge, far from the measured content and never over it, not on home', () => {
    const layout = source('app/[lang]/layout.tsx')
    expect(layout).toContain('<AdSlot place="left" />')
    expect(layout).toContain('<AdSlot place="right" />')
    const css = source('components/ads/AdSlot.module.css')
    expect(css).toMatch(/\.rail\s*\{[^}]*display:\s*none[^}]*position:\s*fixed/)
    expect(css).toMatch(/\.railUnit\s*\{[^}]*width:\s*160px[^}]*height:\s*600px/)
    const code = source('components/ads/AdSlot.tsx')
    // off the window edge but as far from the content as the margin allows; a margin without room for the edge, the ad and
    // the gap to the content draws no side ad
    expect(code).toMatch(/const EDGE = 24/)
    // measured without a Windows scrollbar, which a fixed `right` does not count
    expect(code).toMatch(/const width = document\.documentElement\.clientWidth/)
    expect(code).toMatch(/: width - right/)
    expect(code).toMatch(/margin >= EDGE \+ RAIL \+ GAP \? EDGE : null/)
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

  it('REQ-SHARED-085 gives the boards, the identity and E.G.O lists and a sinner page the same page-start banner (shown where the side ads do not fit)', () => {
    const board = source('features/community/components/BoardHeader.tsx')
    expect(board.indexOf('<AdSlot place="top" />')).toBeGreaterThan(board.indexOf('</header>'))
    const browser = source('features/catalog/components/BrowserHeader.tsx')
    expect(browser.indexOf('<AdSlot place="top" />')).toBeGreaterThan(browser.indexOf('</h1>'))
    const sinner = source('app/[lang]/sinners/[slug]/_components/SinnerDetailClient.tsx')
    expect(sinner.indexOf('<AdSlot place="top" />')).toBeGreaterThan(sinner.indexOf('<SinnerHero'))
    expect(sinner.indexOf('<AdSlot place="top" />')).toBeLessThan(sinner.indexOf('role="tablist"'))
    for (const page of ['app/[lang]/series/[id]/page.tsx', 'app/[lang]/announcements/[id]/page.tsx'])
      expect(source(page).indexOf('<AdSlot place="top" />'), page).toBeGreaterThan(source(page).indexOf('</header>'))
    const ego = source('app/[lang]/sinners/[slug]/ego/[egoId]/_components/EGODetailClient.tsx')
    expect(ego.indexOf('<AdSlot place="inline" />')).toBeGreaterThan(ego.indexOf('aria-labelledby="ego-info-title"'))
    expect(ego.indexOf('<AdSlot place="inline" />')).toBeLessThan(ego.indexOf('className={styles.combat}'))
    // the loading screens keep the banner's place, so the loaded page does not move
    for (const skeleton of ['features/community/components/BoardLoading.tsx', 'features/catalog/components/BrowserSkeleton.tsx',
      'features/catalog/components/SinnerDetailSkeleton.tsx', 'features/community/components/SeriesPageSkeleton.tsx'])
      expect(source(skeleton), skeleton).toContain('<AdSlotSpace />')
    // a banner hidden while the side ads stood asks for its ad when a narrower window shows it again
    expect(source('components/ads/AdSlot.tsx')).toMatch(/new ResizeObserver\(tryRequest\)/)
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

  it('REQ-SHARED-085 gives the skill motion picker one phone-only banner under its list', () => {
    const page = source('app/[lang]/motion/skills/page.tsx')
    expect(page.indexOf('<AdSlot place="inline" phoneOnly />')).toBeGreaterThan(page.indexOf('<MotionBrowser />'))
    expect(source('components/ads/AdSlot.module.css')).toMatch(/min-width:\s*768px[^{]*\{\s*\.phoneOnly\s*\{\s*display:\s*none/)
    pathname = '/ko/motion/skills'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="inline" phoneOnly />)).toMatch(/class="site-ad [^"]*phoneOnly/)
  })

  it('REQ-SHARED-085 hides the list page-start banner where a side ad stands (the side ads flag the page root)', () => {
    const css = source('components/ads/AdSlot.module.css')
    expect(css).toMatch(/:global\(html\[data-ad-rail-left="on"\]\) \.top,\s*:global\(html\[data-ad-rail-right="on"\]\) \.top\s*\{\s*display:\s*none/)
    expect(source('components/ads/AdSlot.tsx')).toMatch(/dataset\[flag\] = offset == null \? 'off' : 'on'/)
    // where the side ads can fit it starts hidden and shows only when both found no room, so it never flashes and jumps away
    expect(css).toMatch(/@media \(min-width: 1712px\) and \(min-height: 760px\) \{\s*:global\(html:not\(\[data-ad-rail-left="off"\]\[data-ad-rail-right="off"\]\)\) \.top \{\s*display: none/)
    pathname = '/ko/mirror-dungeon'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="top" />)).toContain('data-ad-slot')
    expect(renderToStaticMarkup(<AdSlotSpace />)).toContain('aria-hidden')
  })

  it('REQ-SHARED-085 puts one 300x250 ad under the skill info in the skill motion player side panel', () => {
    const watch = source('features/motion/components/MotionWatch.tsx')
    expect(watch.indexOf('<AdSlot place="panel" />')).toBeGreaterThan(watch.indexOf("t('skillInfo')"))
    expect(source('components/ads/AdSlot.module.css')).toMatch(/\.panelUnit\s*\{[^}]*width:\s*300px[^}]*height:\s*250px/)
    // the player is otherwise ad-free (no side or banner ads) and hides the page-level ads: the panel ad is its own
    pathname = '/ko/motion/skills/watch'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="inline" />)).toBe('')
    const panel = renderToStaticMarkup(<AdSlot slot="1234567890" place="panel" />)
    expect(panel).toContain('data-ad-slot')
    expect(panel).not.toContain('site-ad')
  })

  it('REQ-SHARED-085 leaves editors, assist, tools, account, admin, legal and error pages without an ad', () => {
    for (const path of ['/ko/decks/new', '/en/decks/abc/edit', '/ko/planner', '/ko/planner/run', '/ko/friends/new', '/ko/login',
      '/ja/mypage', '/ko/admin/users', '/ko/support', '/ko/terms', '/ko/privacy', '/ko/maintenance', '/ko/tools/damage',
      '/ko/random', '/ko/prescript/ranking', '/ko/motion/skills/watch', '/ko/sinners', '/en/sinners/', '/ko/collection', '/ko/users/abc'])
      expect(isAdFreePath(path), path).toBe(true)
    expect(isAdFreePath(null)).toBe(true)
    for (const path of ['/ko', '/en', '/ko/decks', '/ko/decks/abc', '/ko/planner/community', '/ko/planner/community/abc',
      '/ko/sinners/yi-sang/identities/abc', '/ko/sinners/identities', '/ko/sinners/ego', '/ko/sinners/yi-sang', '/ko/motion/skills', '/ko/mirror-dungeon', '/ko/announcements', '/ko/keywords', '/ko/announcements/abc', '/ko/series/abc', '/ko/sinners/faust/ego/abc'])
      expect(isAdFreePath(path), path).toBe(false)
  })
})
