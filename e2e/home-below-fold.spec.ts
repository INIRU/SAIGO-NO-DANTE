import { test, expect } from '@playwright/test'

test.use({ channel: 'chrome' })
for (const width of [1440, 390]) {
  test(`approved home sections keep artwork, links and footer separate at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/ko')
    const content = page.locator('[data-home-content]')
    await expect(content).toBeVisible()
    await expect(content.getByRole('heading', { name: '아카이브 바로가기' })).toBeVisible()
    await expect(content.getByRole('heading', { name: '공식 채널', exact: true })).toBeVisible()
    await expect(content).not.toContainText('home.')
    const identities = content.locator('section[aria-labelledby="home-identities-heading"]')
    await identities.scrollIntoViewIfNeeded()
    const cards = identities.locator('a[href*="/identities/"]')
    await expect(cards).toHaveCount(6)
    await expect(cards.locator('[class*="stats"]')).toHaveCount(0)
    for (const card of await cards.all()) {
      await card.scrollIntoViewIfNeeded()
      await expect(card.locator('[class*="name"][aria-label]')).toBeVisible()
      for (const image of await card.locator('img').all()) {
        await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
      }
    }
    const layout = await cards.evaluateAll(elements => elements.map(el => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y })))
    expect(new Set(layout.map(p => p.y)).size).toBe(width === 1440 ? 1 : 3)
    const routes = content.locator('section[aria-labelledby="home-routes-heading"] a')
    await expect(routes).toHaveCount(6)
    for (const img of await routes.locator('img').all()) {
      await img.scrollIntoViewIfNeeded()
      await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
    }
    const official = content.locator('section[aria-labelledby="home-official-heading"]')
    await official.scrollIntoViewIfNeeded()
    await expect(official.locator('a')).toHaveCount(3)
    await expect(page.locator('footer a[href^="https://"]')).toHaveCount(0)
    await routes.first().focus()
    await expect(routes.first()).toBeFocused()
    expect(await routes.first().evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect.poll(() => content.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0)
    await page.screenshot({ path: `/tmp/limbus-home-approved-${width}.png`, fullPage: true })
  })
}


test('home scroll reveal follows viewport and remains readable', async ({ page }) => {
  await page.goto('/ko')
  const section = page.locator('section[aria-labelledby="home-routes-heading"]')
  await expect(section).toBeAttached()
  const opacityAt = async (top: number) => {
    await section.evaluate((el, top) => window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - top, behavior: 'instant' }), top)
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    return section.evaluate(el => Number(getComputedStyle(el).opacity))
  }
  const beginning = await opacityAt(700)
  const settled = await opacityAt(250)
  expect(settled).toBeGreaterThan(beginning)
  expect(settled).toBe(1)
})
