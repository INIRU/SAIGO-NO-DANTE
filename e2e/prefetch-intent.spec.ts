import { test, expect } from '@playwright/test'

test.use({ channel: 'chrome' })
test.setTimeout(90000)

// Prefetch runs only in a production build: BASE_URL must point at `next start`.
const DETAIL = /\/sinners\/[^/]+\/identities\/[^/]+$/

// A card on screen prefetches the detail's shell (requests with Next-Router-Prefetch); the whole detail
// (an RSC request without that header) only for the card the pointer rests on.
test('an identity card prefetches its detail shell on sight and the whole detail only after the pointer rests on it', async ({ page }) => {
  const shells = new Set<string>()
  const whole = new Set<string>()
  page.on('request', request => {
    const url = new URL(request.url())
    const headers = request.headers()
    if (!headers['rsc'] || !DETAIL.test(url.pathname)) return
    ;(headers['next-router-prefetch'] ? shells : whole).add(url.pathname)
  })
  // The announcement popup covers the list on a first visit, whenever it opens.
  const popup = page.getByRole('dialog').filter({ has: page.locator('[data-announcement-popup]') })
  await page.addLocatorHandler(popup, async () => { await popup.getByRole('button', { name: '닫기' }).last().click() })
  await page.goto('/ko/sinners/identities')
  const cards = page.locator('a[href*="/identities/"]')
  await expect(cards.first()).toBeVisible()
  await expect.poll(() => shells.size, { message: 'cards on screen prefetch their detail shell' }).toBeGreaterThan(0)
  expect(whole.size, 'no card is prefetched whole just for being on screen').toBe(0)

  // Passing over a card does not prefetch it whole; resting on one does.
  await cards.nth(1).hover()
  await cards.nth(2).hover()
  await page.waitForTimeout(400)
  const href = new URL(await cards.nth(2).evaluate(a => (a as HTMLAnchorElement).href)).pathname
  await expect.poll(() => [...whole]).toContain(href)
  expect(whole.size).toBe(1)
})
