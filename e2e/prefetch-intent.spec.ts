import { test, expect } from '@playwright/test'

test.use({ channel: 'chrome' })
test.setTimeout(90000)

// Prefetch runs only in a production build: BASE_URL must point at `next start`.
const DETAIL = /\/sinners\/[^/]+\/identities\/[^/]+$/

test('an identity card prefetches its detail only after the pointer rests on it', async ({ page }) => {
  const prefetched = new Set<string>()
  page.on('request', request => {
    const url = new URL(request.url())
    if (request.headers()['rsc'] && DETAIL.test(url.pathname)) prefetched.add(url.pathname)
  })
  // The announcement popup covers the list on a first visit, whenever it opens.
  const popup = page.getByRole('dialog').filter({ hasText: '공지' })
  await page.addLocatorHandler(popup, async () => { await popup.getByRole('button', { name: '닫기' }).last().click() })
  await page.goto('/ko/sinners/identities')
  const cards = page.locator('a[href*="/identities/"]')
  await expect(cards.first()).toBeVisible()
  await page.waitForTimeout(1500)
  expect(prefetched.size, 'no card is prefetched just for being on screen').toBe(0)

  // Passing over a card does not prefetch it; resting on one does.
  await cards.nth(1).hover()
  await cards.nth(2).hover()
  await page.waitForTimeout(400)
  const href = new URL(await cards.nth(2).evaluate(a => (a as HTMLAnchorElement).href)).pathname
  await expect.poll(() => [...prefetched]).toContain(href)
  expect(prefetched.size).toBe(1)
})
