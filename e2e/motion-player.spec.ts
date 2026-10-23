import { test, expect, type Page } from '@playwright/test'

test.use({ channel: 'chrome' })
test.setTimeout(90000)

// 이상 LCE E.G.O::차원찢개 skill 1: three conditions of different lengths (the videos come from R2).
const SKILL = '/ko/motion/skills?skill=id10116~1011601'

const frameOf = (page: Page) => page.getByRole('slider', { name: '프레임' }).evaluate(input => Number((input as HTMLInputElement).value))

async function closeAnnouncements(page: Page) {
  const popup = page.getByRole('dialog').filter({ hasText: '공지' })
  await page.addLocatorHandler(popup, async () => { await popup.getByRole('button', { name: '닫기' }).last().click() })
}

async function open(page: Page) {
  await closeAnnouncements(page)
  // The asset host answers another origin's CORS header now and then (an edge-cached response): allow this one.
  await page.route('https://assets.saigo-no-dante.com/**', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } })
  })
  await page.goto(SKILL)
  await page.getByRole('button', { name: '확인' }).click()
  await expect(page.getByRole('button', { name: '일시정지' })).toBeEnabled({ timeout: 30000 })
}

test('REQ-MOTION-021 a frame step or the seek bar moves to that frame at once, even before the video gets there', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: '일시정지' }).click()
  const slider = page.getByRole('slider', { name: '프레임' })
  await slider.fill('100')
  expect(await frameOf(page)).toBe(100)
  // Five presses in one go: each one counts from the frame the last one went to.
  await page.getByRole('button', { name: '다음 프레임' }).evaluate(button => { for (let i = 0; i < 5; i++) (button as HTMLButtonElement).click() })
  expect(await frameOf(page)).toBe(105)
  await page.waitForTimeout(1000)
  expect(await frameOf(page), 'the video lands on the frame the controls show').toBe(105)
})

test('REQ-MOTION-021 another condition starts from the first frame', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: '일시정지' }).click()
  await page.getByRole('slider', { name: '프레임' }).fill('120')
  await page.getByRole('button', { name: '기본', exact: true }).click()
  await expect(page).toHaveURL(/state=v%3Abase|state=v:base/)
  await expect(page.getByRole('button', { name: '일시정지' })).toBeEnabled({ timeout: 30000 })
  expect(await frameOf(page)).toBeLessThan(30)
})

test('REQ-MOTION-024 a sinner tab seen once comes back as it was, without loading its portraits again', async ({ page }) => {
  await closeAnnouncements(page)
  await page.goto(SKILL)
  const picker = page.locator('aside').first()
  const tabs = picker.getByRole('tab')
  const portrait = () => picker.locator('ul:visible li img').first()
  await expect(portrait()).toBeVisible({ timeout: 30000 })
  expect(await portrait().getAttribute('loading')).toBe('eager')
  await portrait().evaluate(img => { (img as HTMLImageElement & { seen?: boolean }).seen = true })
  await tabs.nth(1).click()
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  await tabs.nth(0).click()
  expect(await portrait().evaluate(img => (img as HTMLImageElement & { seen?: boolean }).seen ?? false), 'the same image element, not a new one').toBe(true)
})

test('REQ-MOTION-025 coming back to the page, the sound button and the bar match what the video plays', async ({ page }) => {
  // The page's <video> is not in the document: record the element the hook last set, to read what it really plays.
  await page.addInitScript(() => {
    for (const name of ['volume', 'muted'] as const) {
      const property = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, name)!
      Object.defineProperty(HTMLMediaElement.prototype, name, { configurable: true, get() { return property.get!.call(this) },
        set(value) { (window as unknown as { media: HTMLMediaElement }).media = this; property.set!.call(this, value) } })
    }
  })
  const media = () => page.evaluate(() => { const v = (window as unknown as { media: HTMLMediaElement }).media; return { muted: v.muted, volume: v.volume } })
  await open(page)
  await page.getByRole('slider', { name: '음량' }).fill('0.3')
  expect(await media()).toEqual({ muted: false, volume: 0.3 })
  // A client navigation (the site's home link; the motion page hides the bar it sits in), then the browser's back.
  await page.locator('a[href="/ko"]').first().evaluate(link => (link as HTMLAnchorElement).click())
  await page.waitForURL(/\/ko$/)
  await page.goBack()
  await expect(page.getByRole('button', { name: /소리 (켜기|끄기)/ })).toBeEnabled({ timeout: 30000 })
  await expect(page.getByRole('button', { name: '소리 켜기' })).toBeVisible()
  expect((await media()).muted).toBe(true)
  await page.getByRole('button', { name: '소리 켜기' }).click()
  expect(await media()).toEqual({ muted: false, volume: 0.3 })
  await expect(page.getByRole('slider', { name: '음량' })).toHaveValue('0.3')
})

test('REQ-MOTION-003 the video and its layers.json are read at their plain R2 paths, which the upload purges', async ({ page }) => {
  const assets: string[] = []
  page.on('request', request => { if (request.url().startsWith('https://assets.saigo-no-dante.com/') && !request.url().endsWith('index.json')) assets.push(request.url()) })
  await open(page)
  expect(assets.some(url => url.endsWith('/layers.mp4')) && assets.some(url => url.endsWith('/layers.json'))).toBe(true)
  expect(assets.filter(url => url.includes('?'))).toEqual([])
})

test('REQ-MOTION-001 every page open reads index.json from R2 in the browser, not a list the server kept', async ({ page }) => {
  const index: string[] = [], lists: string[] = []
  page.on('request', request => {
    if (request.url() === 'https://assets.saigo-no-dante.com/index.json') index.push(request.headers()['cache-control'] ?? '')
    if (request.url().includes('/api/motion/catalog')) lists.push(request.url())
  })
  await open(page)
  await page.reload()
  await expect(page.getByRole('button', { name: /소리 (켜기|끄기)/ })).toBeVisible({ timeout: 30000 })
  expect(index.length).toBeGreaterThanOrEqual(2)
  expect(lists).toEqual([])
})
