import { test, expect } from '@playwright/test'
test.use({ channel: 'chrome' })
test('identity passive text and tooltip use the user-confirmed original weapon icons after reload', async ({ page }) => {
  await page.goto('/ko/sinners/yi-sang/identities/b89738a3-1532-40cf-b0af-c8d0dca20a92')
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: /^패시브/ }).click()
    const weaponIcons = page.locator('img[src*="/when-"]')
    await expect.poll(() => weaponIcons.count()).toBeGreaterThanOrEqual(9)
    for (const image of await weaponIcons.all()) {
      await expect(image).not.toHaveAttribute('src', /-2\.webp|great-sword/)
      await image.scrollIntoViewIfNeeded()
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    }
    const icon = page.locator('img[src*="when-boring-a-20-inch-hole-with-a-lance"]').first()
    await expect(icon).toHaveAttribute('src', /lance\.webp/)
    await icon.scrollIntoViewIfNeeded(); await icon.hover()
    await expect(page.locator('img[src*="lance.webp"]')).toHaveCount(2)
    if (attempt === 0) await page.reload()
  }
  await page.screenshot({ path: '/tmp/limbus-keyword-original.png' })
})
