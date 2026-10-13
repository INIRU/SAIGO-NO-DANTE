import { writeFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'

test.use({ channel: 'chrome' })
test.skip(!process.env.LIMBUS_RESTORED_DATA, 'Requires the restored Drive game dataset')

const routes = [
  '', '/sinners', '/sinners/identities', '/sinners/ego', '/sinners/faust',
  '/sinners/gregor/identities/2935368e-296f-4738-9fc6-f50c64655647',
  '/sinners/faust/ego/b23a17a3-82e9-5b50-a9d6-ab1c86a90373',
  '/keywords', '/mirror-dungeon', '/mirror-dungeon?tab=themes', '/mirror-dungeon?tab=events',
  '/planner', '/planner?tab=blessing', '/planner?tab=gift', '/planner?tab=floor', '/planner?tab=summary',
  '/planner/run', '/planner/community',
  '/decks', '/decks/new', '/collection', '/meta', '/random', '/announcements',
  '/login', '/privacy', '/terms', '/offline', '/maintenance',
]

async function inspectArtwork(page: Page) {
  const reset = () => page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelectorAll<HTMLElement>('main *').forEach(el => { if (el.scrollTop) el.scrollTo({ top: 0, behavior: 'instant' }) })
  })
  await reset()
  let settledAtEnd = 0
  for (let step = 0; step < 180; step++) {
    // Scroll as a reader would: forcing every lazy image eager at once creates
    // hundreds of concurrent optimizer requests and does not test normal use.
    await expect.poll(() => page.evaluate(() => Array.from(document.images).filter(img => {
      if (img.complete && img.naturalWidth > 0) return false
      if (!img.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return false
      const rect = img.getBoundingClientRect()
      let top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom)
      let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right)
      for (let el = img.parentElement; el; el = el.parentElement) {
        const style = getComputedStyle(el), clip = el.getBoundingClientRect()
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom) }
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) { left = Math.max(left, clip.left); right = Math.min(right, clip.right) }
      }
      return bottom > top && right > left
    }).map(img => img.currentSrc || img.src)), { timeout: 20_000, message: 'Artwork visible while scrolling must load or explicitly hide on failure' }).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'Page must fit the viewport').toBeLessThanOrEqual(1)
    const moved = await page.evaluate(() => {
      let moved = false
      for (const el of document.querySelectorAll<HTMLElement>('main *')) {
        const rect = el.getBoundingClientRect()
        if (el.clientHeight > 100 && rect.bottom > 0 && rect.top < innerHeight && /auto|scroll/.test(getComputedStyle(el).overflowY)) {
          const before = el.scrollTop
          el.scrollTop += el.clientHeight * 0.8
          moved ||= Math.abs(el.scrollTop - before) > 1
        }
      }
      const before = scrollY
      window.scrollBy(0, innerHeight * 0.8)
      return moved || Math.abs(scrollY - before) > 1
    })
    settledAtEnd = moved ? 0 : settledAtEnd + 1
    if (settledAtEnd >= 2) { await reset(); return }
    // Allow IntersectionObserver batches and existing entrance animations to run.
    await page.waitForTimeout(moved ? 120 : 400)
  }
  throw new Error('Catalogue did not reach its end within 180 viewport steps')
}

for (const width of [1440, 390]) {
  for (const route of routes) {
    test(`${width}px /ko${route || '/'} artwork after hard refresh and revisit`, async ({ page }, info) => {
      test.setTimeout(120_000)
      await page.setViewportSize({ width, height: 900 })
      const errors: string[] = []
      const failedImages = new Set<string>()
      page.on('response', response => {
        if (response.request().resourceType() === 'image' && response.status() >= 400) failedImages.add(response.url())
      })
      page.on('pageerror', error => errors.push(error.message))
      const path = `/ko${route}`
      const response = await page.goto(path)
      expect(response?.status()).toBeLessThan(400)
      await expect(page.getByRole('main')).toBeVisible()
      const cdp = await page.context().newCDPSession(page)
      await Promise.all([page.waitForEvent('load', { timeout: 30_000 }), cdp.send('Page.reload', { ignoreCache: true })])
      await inspectArtwork(page)
      await page.screenshot({ path: info.outputPath('hard-refresh.png'), fullPage: false })
      // Revisit with the same browser cache, without interception or cache bypass.
      await page.goto(path === '/ko/sinners' ? '/ko' : '/ko/sinners')
      await page.goto(path)
      await inspectArtwork(page)
      expect(errors).toEqual([])
      await expect(page.getByText('route paused', { exact: true })).toHaveCount(0)
      const images = await page.locator('img').evaluateAll(images => [...new Set(images.map(img => (img as HTMLImageElement).currentSrc))])
      await writeFile(info.outputPath('loaded-artwork.json'), JSON.stringify({ path, width, images, failedImages: [...failedImages] }, null, 2))
      await info.attach('loaded-artwork.json', { path: info.outputPath('loaded-artwork.json'), contentType: 'application/json' })
      // Only AttackLevelAdder still lacks a verified source; even hidden failures elsewhere are defects.
      expect([...failedImages].filter(url => !decodeURIComponent(url).includes('/offense-level.webp'))).toEqual([])
    })
  }
}

for (const lang of ['en', 'ja']) {
  for (const route of ['/keywords', '/sinners/ego', '/planner']) {
    test(`390px /${lang}${route} localized artwork`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`/${lang}${route}`)
      await expect(page.getByRole('main')).toBeVisible()
      await inspectArtwork(page)
      await expect(page.getByText('route paused', { exact: true })).toHaveCount(0)
    })
  }
}
