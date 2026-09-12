import { test, expect } from '@playwright/test'

test.use({ channel: 'chrome' })
for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [390, 844]]) {
  test(`home actions and announcement fit the first viewport ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/ko')
    const title = page.locator('.home-announcement-toggle strong')
    await expect(title).toBeVisible()
    expect(await page.locator('.home-announcement').evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(50)
    await expect(page.locator('[data-hero-artwork]')).toHaveCSS('opacity', '0.5')
    await expect(page.locator('[data-hero-artwork] img').last()).toHaveAttribute('src', /_(?:normal|gacksung)\.webp/)
    await expect(page.locator('[data-hero-artwork] img').last()).toHaveCSS('object-fit', 'cover')
    expect(await page.locator('[data-hero-slider]').evaluate(el => el.getBoundingClientRect().width)).toBe(width)
    await expect(page.locator('.home-announcement-excerpt')).toHaveCount(0)
    for (let visit = 0; visit < 2; visit++) {
      await expect.poll(() => title.evaluate(el => el.getBoundingClientRect().bottom <= innerHeight)).toBe(true)
      const actions = page.locator('.home-command-actions')
      await expect(actions).toBeInViewport({ ratio: 1 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
      if (!visit) { await page.goto('/ko/sinners'); await page.goto('/ko') }
    }
    await page.locator('.home-announcement-toggle').click()
    await expect(page.locator('#home-announcement-body')).toBeVisible()
    await page.locator('.home-announcement-toggle').click()
    await expect.poll(() => title.evaluate(el => el.getBoundingClientRect().bottom <= innerHeight)).toBe(true)
  })
}
