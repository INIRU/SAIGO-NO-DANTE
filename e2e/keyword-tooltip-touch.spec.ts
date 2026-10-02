import { test, expect, devices, type Page } from '@playwright/test'

// REQ-KEYWORDS-006: the keyword tooltip under touch (phones) and under the mouse.
// Run against a started server: BASE_URL=http://localhost:3000 npx playwright test e2e/keyword-tooltip-touch.spec.ts
// Chromium runs the installed Chrome, like the other specs; WebKit has no such channel.
test.use({ channel: [async ({ browserName }, use) => { await use(browserName === 'chromium' ? 'chrome' : undefined) }, { scope: 'worker' }] })
const { defaultBrowserType: _pixel, ...pixel } = devices['Pixel 7']
const { defaultBrowserType: _iphone, ...iphone } = devices['iPhone 14']

const tooltip = (page: Page) => page.locator('[role="tooltip"]')
/** First keyword of an identity page that has a tooltip, scrolled to the middle of the screen. */
async function keyword(page: Page) {
  await page.goto('/ko/sinners/identities')
  const href = await page.locator('a[href*="/identities/"]').first().getAttribute('href')
  await page.goto(href!)
  const token = page.locator('.keyword-token[tabindex="0"]').first()
  await token.waitFor({ timeout: 30_000 })
  // The page is still settling right after load (late sections move the text, and it scrolls smoothly): a tooltip closes
  // when its keyword moves, so tap only once the keyword has stopped moving.
  let top = NaN
  await expect.poll(async () => {
    await token.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
    const before = top
    top = (await token.boundingBox())!.y
    return Math.abs(top - before) < 1
  }, { intervals: [400], timeout: 20_000 }).toBe(true)
  return token
}

function touchSuite() {
  test.setTimeout(90_000)

  test('REQ-KEYWORDS-006 one tap opens the tooltip and a second tap closes it', async ({ page }) => {
    const token = await keyword(page)
    await token.tap()
    await expect(tooltip(page)).toHaveCount(1)
    await page.waitForTimeout(300) // the tap's own late events must not close it
    await expect(tooltip(page)).toHaveCount(1)
    await token.tap()
    await expect(tooltip(page)).toHaveCount(0)
  })

  test('REQ-KEYWORDS-006 touching and dragging inside the tooltip keep it open', async ({ page, browserName }) => {
    const token = await keyword(page)
    await token.tap()
    const box = (await tooltip(page).boundingBox())!
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(300)
    await expect(tooltip(page)).toHaveCount(1)
    if (browserName !== 'chromium') return
    // A drag, as when scrolling the tooltip's text (raw touch events need the DevTools protocol).
    const cdp = await page.context().newCDPSession(page)
    const x = box.x + box.width / 2, y = box.y + box.height - 16
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let step = 1; step <= 6; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 10 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(300)
    await expect(tooltip(page)).toHaveCount(1)
  })

  test('REQ-KEYWORDS-006 a tap outside closes the tooltip', async ({ page }) => {
    const token = await keyword(page)
    await token.tap()
    await expect(tooltip(page)).toHaveCount(1)
    const box = (await tooltip(page).boundingBox())!, own = (await token.boundingBox())!
    // A spot that is neither the tooltip nor the keyword: the far side of the screen from the tooltip.
    const y = box.y > 300 ? 120 : Math.max(box.y + box.height, own.y + own.height) + 160
    await page.touchscreen.tap(20, y)
    await expect(tooltip(page)).toHaveCount(0)
  })

  test('REQ-KEYWORDS-006 scrolling the page closes the tooltip', async ({ page }) => {
    const token = await keyword(page)
    await token.tap()
    await expect(tooltip(page)).toHaveCount(1)
    await page.evaluate(() => scrollBy(0, 150))
    await expect(tooltip(page)).toHaveCount(0)
  })
}

test.describe('keyword tooltip, touch (Chrome phone)', () => {
  test.use({ ...pixel })
  test.skip(({ browserName }) => browserName !== 'chromium', 'Installed Chrome')
  touchSuite()
})

test.describe('keyword tooltip, touch (WebKit phone)', () => {
  test.use({ ...iphone })
  test.skip(({ browserName }) => browserName !== 'webkit', 'WebKit only')
  touchSuite()
})

test.describe('keyword tooltip, mouse', () => {
  test.use({ viewport: { width: 1280, height: 900 } })
  test.skip(({ browserName }) => browserName !== 'chromium', 'Installed Chrome')

  test('REQ-KEYWORDS-006 the mouse opens on hover, keeps the tooltip while over it, and closes on leave and Escape', async ({ page }) => {
    test.setTimeout(90_000)
    const token = await keyword(page)
    await token.hover()
    await expect(tooltip(page)).toHaveCount(1)
    await tooltip(page).hover()
    await page.waitForTimeout(300) // longer than the 120 ms hide delay
    await expect(tooltip(page)).toHaveCount(1)
    await page.mouse.move(5, 5)
    await expect(tooltip(page)).toHaveCount(0)
    await token.focus()
    await expect(tooltip(page)).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(tooltip(page)).toHaveCount(0)
  })
})
