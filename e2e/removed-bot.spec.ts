import { test, expect } from '@playwright/test'

test.use({ channel: 'chrome' })

for (const locale of ['ko', 'en', 'ja']) {
  test(`removed bot page has no home link and returns 404 (${locale})`, async ({ page, request }) => {
    await page.goto(`/${locale}`)
    await expect(page.locator('a[href$="/bot"]')).toHaveCount(0)
    const response = await request.get(`/${locale}/bot`)
    expect(response.status()).toBe(404)
  })
}
