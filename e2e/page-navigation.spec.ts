import { expect, test } from '@playwright/test'

test('page navigation skips the footer and saved font preferences no longer resize the site', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('font-size', 'large'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/ko/terms')
  const navigation = page.getByRole('navigation', { name: '페이지 이동', exact: true })
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole('button', { name: '맨 위로', exact: true })).toHaveCount(0)
  await expect(page.locator('html')).not.toHaveAttribute('data-font-size')
  await navigation.getByRole('button', { name: '본문 맨 아래로', exact: true }).click()
  await expect.poll(() => page.locator('#main-content').evaluate(element => Math.abs(element.getBoundingClientRect().bottom - innerHeight))).toBeLessThan(2)
  await expect.poll(() => page.locator('footer').evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(await page.evaluate(() => innerHeight))
  await expect(navigation.getByRole('button', { name: '본문 맨 아래로', exact: true })).toHaveCount(0)
  await navigation.getByRole('button', { name: '맨 위로', exact: true }).click()
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
})
