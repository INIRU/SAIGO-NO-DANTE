import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

let pathname = '/ko/decks/1'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
// these check the ads as they run with the switch on (ads-off.test.tsx covers it off)
vi.mock('@/lib/seo/ads', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/seo/ads')>(), ADS_ON: true }))
import { renderToStaticMarkup } from 'react-dom/server'
import AdSlot, { AdSlotSpace } from '@/components/ads/AdSlot'
import { ADSENSE_ACCOUNT } from '@/lib/seo/metadata'
import { isAdFreePath } from '@/lib/seo/ads'

const root = resolve(__dirname, '../../..')
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('ad slot', () => {
  it('draws one display unit of the account in a reserved box', () => {
    pathname = '/ko/decks/1'
    const html = renderToStaticMarkup(<AdSlot slot="1234567890" place="inline" />)
    // push({}) fills the first unprocessed ins.adsbygoogle on the page, not the one that asked: a hidden page-start banner
    // earlier in the page would take the side ad's request. So the class goes on only right before this slot's own push.
    expect(html).not.toContain('adsbygoogle')
    expect(source('components/ads/AdSlot.tsx')).toMatch(/ins\.classList\.add\('adsbygoogle'\)\s*\n\s*try \{ \(window\.adsbygoogle/)
    expect(html).toContain(`data-ad-client="${ADSENSE_ACCOUNT}"`)
    expect(html).toContain('data-ad-slot="1234567890"')
    // the size comes from the reserved box, not from AdSense's own auto sizing (which can grow and push the page)
    expect(html).not.toContain('data-ad-format')
    expect(html).not.toContain('data-full-width-responsive')
  })

  it('gives each place its own ad unit, so the report shows what each place earns', () => {
    const unit = (place: 'top' | 'inline' | 'left' | 'panel') => renderToStaticMarkup(<AdSlot place={place} />).match(/data-ad-slot="(\d+)"/)?.[1]
    pathname = '/ko/mirror-dungeon'
    expect(unit('top')).toBe('2699879515')
    pathname = '/ko/decks/1'
    expect(unit('inline')).toBe('1649300531')
    pathname = '/ko/motion/skills/watch'
    expect(unit('panel')).toBe('6377068943')
    expect(source('components/ads/AdSlot.tsx')).toMatch(/ADSENSE_SLOTS\[rail \? 'rail' : place === 'hero' \? 'top' : place\]/)
    expect(source('lib/seo/ads.ts')).toMatch(/rail: '1316313953'/)
  })

  it('draws nothing outside development without a unit, and nothing on an ad-free page', () => {
    pathname = '/ko/decks/1'
    expect(renderToStaticMarkup(<AdSlot slot={null} place="inline" />)).toBe('')
    pathname = '/ko/decks/1/edit'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="inline" />)).toBe('')
  })

  it('reserves the space and hides an unfilled unit and the ad of a full-screen workspace', () => {
    const css = source('components/ads/AdSlot.module.css')
    expect(css).toMatch(/\.topUnit\s*\{[^}]*height:\s*100px/)
    // the in-content banner is a 300x250 rectangle on a phone (owner 2026-11-09)
    expect(css).toMatch(/\.inlineUnit\s*\{[^}]*width:\s*300px[^}]*height:\s*250px/)
    expect(css).toMatch(/:has\(ins\[data-ad-status=["']?unfilled["']?\]\)[^{]*\{[^}]*display:\s*none/)
    const workspaces = source('styles/globals/workspaces.css')
    for (const flag of ['admin-shell', 'assist-run', 'prescript', 'support-page', 'page-error', 'tool-screen', 'mypage', 'gift-check', 'friend-compose', 'motion', 'login-page'])
      expect(workspaces, flag).toMatch(new RegExp(`\\[data-with-${flag}\\][^{]*\\.site-ad`))
  })

  it('has no ad glued above every footer; a detail page or the home puts its banner between its own parts', () => {
    const layout = source('app/[lang]/layout.tsx')
    expect(layout).not.toMatch(/<AdSlot \/>|<AdSlot place="(top|inline)"/)
    const identity = source('app/[lang]/sinners/[slug]/identities/[id]/_components/IdentityDetailClient.tsx')
    expect(identity.indexOf('<AdSlot place="inline" />')).toBeGreaterThan(identity.indexOf('<IdentitySanitySection'))
    expect(identity.indexOf('<AdSlot place="inline" />')).toBeLessThan(identity.indexOf('{recommendations}'))
    const home = source('app/[lang]/(home)/_components/HomeStaticSections.tsx')
    expect(home.indexOf('<AdSlot place="inline" />')).toBeGreaterThan(home.indexOf('<Official '))
  })

  it('puts a second detail banner under the line after a plan\'s final gifts and a deck\'s note, above the related posts', () => {
    // owner, 2026-11-07: "플랜은 최종 기프트 밑에 덱은 스킬 분포 밑에", "선 밑에"
    for (const [page, after, before] of [
      ['app/[lang]/planner/community/[id]/PlanDetailClient.tsx', '<Section id="plan-final">', '{coVisited}'],
      ['app/[lang]/decks/[id]/DeckDetailClient.tsx', 'id="deck-note"', '{hasRecommendations ? ('],
    ]) {
      const text = source(page)
      expect(text, page).toMatch(/const lowerAd = ADS_ON && <div className=\{`\$\{styles\.section\} \$\{styles\.adSection\}`\}><AdSlot place="inline" \/><\/div>/)
      const at = text.indexOf('{lowerAd}')
      expect(at, page).toBeGreaterThan(text.indexOf(after))
      expect(at, page).toBeLessThan(text.indexOf(before))
    }
    for (const css of ['app/[lang]/decks/[id]/DeckDetail.module.css', 'app/[lang]/planner/community/[id]/PlanDetailHeader.module.css']) {
      // the line above the banner comes from `.section + .section`; the section after it draws none
      expect(source(css), css).toMatch(/\.adSection \+ \.section, \.adSection \+ \.section:empty \+ \.section \{ border-top: 0; margin-top: 0; \}/)
    }
  })

  it('puts a 160x600 ad in each empty side margin, standing off the window edge, far from the measured content and never over it', () => {
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
    // a side ad starts below a full-bleed hero (a sinner's art) and rises to its place under the navbar as the page scrolls
    expect(code).toContain("document.querySelector('[data-ad-rail-below]')")
    expect(source('features/catalog/components/SinnerHero.tsx')).toContain('data-ad-rail-below')
    // at the end of the page a side ad stops above the footer and scrolls up with it
    // only a footer that is drawn: a hidden one (a page that hides it, a streamed copy not shown yet) reads top 0 and pushed
    // both side ads above the window on plan and deck details
    expect(code).toMatch(/\[\.\.\.document\.querySelectorAll\('\.site-footer'\)\]\.find\(f => f\.getClientRects\(\)\.length\)/)
    expect(code).toContain('footerTop - GAP - ad.offsetHeight')
    // placed again when the page under it changes, not only on scroll: coming to the home from another page, the loading
    // screen (no hero) placed the right side ad at the navbar and it stayed over the hero until a scroll
    expect(code).toMatch(/useRailTop[\s\S]*?new ResizeObserver\(schedule\)\s*const main = document\.getElementById\('main-content'\)\s*if \(main\) content\.observe\(main\)/)
    // a hero's art that reaches the window edge does not count as content (it hid the right side ad on a sinner page)
    expect(code).toMatch(/box\.left <= 0 \|\| box\.right >= width/)
    // before the content is measured (the server render) the side ad is hidden, so it never lands on the content
    pathname = '/ko/decks/1'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="left" />)).toMatch(/<aside[^>]*data-off="true"/)
    // the home too (owner, 2026-11-07: "메인 페이지가 밑으로 내려야만 광고가 보여서"): its side ads start below the first
    // screen (hero and notice strip) and follow the page from there; what stands in the hero does not narrow the margin
    pathname = '/ko'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="left" />)).toMatch(/<aside[^>]*data-off="true"/)
    expect(code).not.toMatch(/\/\^\\\/\(\?:ko\|en\|ja\)\\\/\?\$\//)
    expect(source('app/[lang]/(home)/HomeClient.tsx')).toMatch(/className="home-first-viewport[^"]*" data-ad-rail-below/)
    expect(code).toMatch(/el\.closest\('\[data-ad-rail-below\]'\)/)
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="inline" />)).toContain('data-ad-slot')
  })

  it('puts a banner in the home hero under its links, from 768px wide, kept while the side ads stand', () => {
    pathname = '/ko'
    const html = renderToStaticMarkup(<AdSlot place="hero" />)
    // the home's page-start banner: the list pages' start unit
    expect(html).toContain('data-ad-slot="2699879515"')
    const home = source('app/[lang]/(home)/HomeClient.tsx')
    expect(home.indexOf('<AdSlot place="hero" />')).toBeGreaterThan(home.indexOf('<DiscordSupportLink />'))
    const css = source('components/ads/AdSlot.module.css')
    expect(css).toMatch(/\.hero\s*\{[^}]*display:\s*none/)
    expect(css).toMatch(/@media \(min-width: 768px\)\s*\{\s*\.hero\s*\{[^}]*display:\s*flex/)
    expect(css).toMatch(/\.heroUnit\s*\{[^}]*height:\s*90px/)
    // only the list banner gives way to the side ads
    expect(css).not.toMatch(/data-ad-rail-left="on"\]\)\s*\.hero/)
    expect(css).toMatch(/:is\(\.top, \.inline, \.panel, \.rail, \.hero\):has\(ins\[data-ad-status="unfilled"\]\)/)
  })

  it('puts the phone\'s home start banner under the notice strip, before the new identities', () => {
    // a phone's hero has no room for its banner: the plan detail's start banner stands right after the first screen instead
    const home = source('app/[lang]/(home)/HomeClient.tsx')
    const ad = home.indexOf('<AdSlot place="inline" phoneOnly />')
    expect(ad).toBeGreaterThan(home.indexOf('<AnnouncementBanner'))
    // outside the first screen, so it does not squeeze the hero
    expect(home.slice(ad - 200, ad)).toMatch(/<\/div>\s*(\{\/\*[^*]*\*\/\}\s*)?$/)
  })

  it('keeps both side ads in view while scrolling, the owner\'s call against AdSense\'s one-sticky rule (recorded)', () => {
    const code = source('components/ads/AdSlot.tsx')
    expect(code).toContain('support.google.com/adsense/answer/10734935')
    expect(code).not.toMatch(/railScroll/)
    expect(source('DESIGN.md')).toContain('정책 위험이 있다는 것을 알고 정한 배치다')
  })

  it('keeps a side ad that loses its room in the page, hidden, so the same ad comes back when the window widens', () => {
    // removing it and asking again after a resize is what AdSense leaves unfilled, which collapsed every ad (owner, 2026-11-07)
    const code = source('components/ads/AdSlot.tsx')
    expect(code).not.toMatch(/if \(rail && offset == null\) return null/)
    expect(code).toContain('data-off={off || undefined}')
    expect(source('components/ads/AdSlot.module.css')).toMatch(/\.rail\[data-off\]\s*\{\s*display:\s*none/)
    pathname = '/ko/decks/1'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="right" />)).toContain('data-ad-slot="1234567890"')
  })

  it('puts a page-start banner under a list page title, before its content, with its place kept while loading', () => {
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

  it('gives the boards, the identity and E.G.O lists and a sinner page the same page-start banner (shown where the side ads do not fit)', () => {
    const board = source('features/community/components/BoardHeader.tsx')
    expect(board.indexOf('<AdSlot place="top" />')).toBeGreaterThan(board.indexOf('</header>'))
    const browser = source('features/catalog/components/BrowserHeader.tsx')
    expect(browser.indexOf('<AdSlot place="top" />')).toBeGreaterThan(browser.indexOf('</h1>'))
    const sinner = source('app/[lang]/sinners/[slug]/_components/SinnerDetailClient.tsx')
    expect(sinner.indexOf('<AdSlot place="top" />')).toBeGreaterThan(sinner.indexOf('<SinnerHero'))
    expect(sinner.indexOf('<AdSlot place="top" />')).toBeLessThan(sinner.indexOf('role="tablist"'))
    for (const page of ['app/[lang]/series/[id]/page.tsx', 'app/[lang]/announcements/[id]/page.tsx'])
      expect(source(page).indexOf('<AdSlot place="top" />'), page).toBeGreaterThan(source(page).indexOf('</header>'))
    const ego = source('features/catalog/components/EgoDetailView.tsx')
    expect(ego.indexOf('<AdSlot place="inline" />')).toBeGreaterThan(ego.indexOf('aria-labelledby="ego-info-title"'))
    expect(ego.indexOf('<AdSlot place="inline" />')).toBeLessThan(ego.indexOf('className={styles.combat}'))
    // the loading screens keep the banner's place, so the loaded page does not move
    for (const skeleton of ['features/community/components/BoardLoading.tsx', 'features/catalog/components/BrowserSkeleton.tsx',
      'features/catalog/components/SinnerDetailSkeleton.tsx', 'features/community/components/SeriesPageSkeleton.tsx'])
      expect(source(skeleton), skeleton).toContain('<AdSlotSpace />')
    // a banner hidden while the side ads stood asks for its ad when a narrower window shows it again
    expect(source('components/ads/AdSlot.tsx')).toMatch(/new ResizeObserver\(tryRequest\)/)
  })

  it('puts a small banner under a deck or plan section tabs, before the first heading', () => {
    for (const [page, first] of [
      ['app/[lang]/decks/[id]/DeckDetailClient.tsx', '<section id="deck-formation"'],
      ['app/[lang]/planner/community/[id]/PlanDetailClient.tsx', '{plan.description && ('],
    ]) {
      const text = source(page)
      const main = text.indexOf('<main className="min-w-0 overflow-x-clip">')
      const inline = text.indexOf('<AdSlot place="inline" />', main)
      expect(main, page).toBeGreaterThan(0)
      expect(inline, page).toBeGreaterThan(text.indexOf('sticky-under-nav'))
      expect(inline, page).toBeLessThan(text.indexOf(first))
      // this one and the lower banner above the related posts (second detail banner)
      expect(text.match(/<AdSlot\b/g), page).toHaveLength(2)
    }
    expect(source('components/ads/AdSlot.module.css')).toMatch(/\.inline\s*\{[^}]*margin-top:\s*2\.5rem/)
  })

  it('gives the skill motion picker one phone-only banner under its list', () => {
    const page = source('app/[lang]/motion/skills/page.tsx')
    expect(page.indexOf('<AdSlot place="inline" phoneOnly />')).toBeGreaterThan(page.indexOf('<MotionBrowser />'))
    expect(source('components/ads/AdSlot.module.css')).toMatch(/min-width:\s*768px[^{]*\{\s*\.phoneOnly\s*\{\s*display:\s*none/)
    pathname = '/ko/motion/skills'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="inline" phoneOnly />)).toMatch(/class="site-ad [^"]*phoneOnly/)
  })

  it('hides the list page-start banner where a side ad stands (the side ads flag the page root)', () => {
    const css = source('components/ads/AdSlot.module.css')
    expect(css).toMatch(/:global\(html\[data-ad-rail-left="on"\]\) \.top,\s*:global\(html\[data-ad-rail-right="on"\]\) \.top\s*\{\s*display:\s*none/)
    expect(source('components/ads/AdSlot.tsx')).toMatch(/dataset\[flag\] = offset == null \? 'off' : 'on'/)
    // where the side ads can fit it starts hidden and shows only when both found no room, so it never flashes and jumps away
    expect(css).toMatch(/@media \(min-width: 1712px\) and \(min-height: 760px\) \{\s*:global\(html:not\(\[data-ad-rail-left="off"\]\[data-ad-rail-right="off"\]\)\) \.top \{\s*display: none/)
    pathname = '/ko/mirror-dungeon'
    expect(renderToStaticMarkup(<AdSlot slot="1234567890" place="top" />)).toContain('data-ad-slot')
    expect(renderToStaticMarkup(<AdSlotSpace />)).toContain('aria-hidden')
  })

  it('puts one 300x250 ad under the skill info in the skill motion player side panel', () => {
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

  it('leaves editors, assist, tools, account, admin, legal and error pages without an ad', () => {
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
