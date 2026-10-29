import { test, expect, type Page } from '@playwright/test'

test.use({ channel: 'chrome' })
test.setTimeout(90000)

// 이상 LCE E.G.O::차원찢개 skill 1: three conditions of different lengths (the videos come from R2).
const SKILL = '/ko/motion/skills?skill=id10116~1011601'

const frameOf = (page: Page) => page.getByRole('slider', { name: '프레임' }).evaluate(input => Number((input as HTMLInputElement).value))

async function closeAnnouncements(page: Page) {
  const popup = page.getByRole('dialog').filter({ has: page.locator('[data-announcement-popup]') })
  await page.addLocatorHandler(popup, async () => { await popup.getByRole('button', { name: '닫기' }).last().click() })
}

async function open(page: Page) {
  await closeAnnouncements(page)
  // The asset host answers another origin's CORS header now and then (an edge-cached response): allow this one.
  await page.route('https://assets.saigo-no-dante.com/**', async route => {
    try {
      const response = await route.fetch()
      await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } })
    } catch { /* the test ended while a sound file was still loading */ }
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

test('REQ-MOTION-025 coming back to the page, the sound is off and the volume panel holds the volumes set before', async ({ page }) => {
  // The page's <video> is not in the document: record the element the hook last muted or unmuted.
  await page.addInitScript(() => {
    const property = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted')!
    Object.defineProperty(HTMLMediaElement.prototype, 'muted', { configurable: true, get() { return property.get!.call(this) },
      set(value) { (window as unknown as { media: HTMLMediaElement }).media = this; property.set!.call(this, value) } })
  })
  const muted = () => page.evaluate(() => (window as unknown as { media: HTMLMediaElement }).media.muted)
  await open(page)
  await page.getByRole('button', { name: '음량' }).click()
  // The master above 0 turns the sound on (the silent track unmuted: iOS lets Web Audio through only then).
  await page.getByRole('slider', { name: '전체' }).fill('0.3')
  await page.getByRole('slider', { name: '보이스' }).fill('0.6')
  expect(await muted()).toBe(false)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('slider', { name: '전체' })).toBeHidden()
  // A client navigation (the site's home link; the motion page hides the bar it sits in), then the browser's back.
  await page.locator('a[href="/ko"]').first().evaluate(link => (link as HTMLAnchorElement).click())
  await page.waitForURL(/\/ko$/)
  await page.goBack()
  await expect(page.getByRole('button', { name: '소리 켜기' })).toBeEnabled({ timeout: 30000 })
  expect(await muted()).toBe(true)
  await page.getByRole('button', { name: '음량' }).click()
  await expect(page.getByRole('slider', { name: '전체' })).toHaveValue('0.3')
  await expect(page.getByRole('slider', { name: '보이스' })).toHaveValue('0.6')
  await expect(page.getByRole('slider', { name: '효과음' })).toHaveValue('1')
})

test('REQ-MOTION-030 the sounds come from the shared library and the play rules on R2, not from the video', async ({ page }) => {
  const asked: string[] = []
  page.on('request', request => { if (request.url().startsWith('https://assets.saigo-no-dante.com/')) asked.push(new URL(request.url()).pathname) })
  await open(page)
  await expect.poll(() => asked.some(path => /^\/(sfx|voices)\/.+\.m4a$/.test(path)), { timeout: 15000 }).toBe(true)
  expect(asked).toContain('/sound_rules.json')
  await page.getByRole('button', { name: '음량' }).click()
  await expect(page.getByRole('switch', { name: '치명타 소리' })).toBeVisible()
})

test('REQ-MOTION-032 in the sound tail past the last picture frame, nothing is drawn again and the last frame stays', async ({ page }) => {
  // Count the frames the compositor uploads, and keep the page's (off-document) video at hand.
  await page.addInitScript(() => {
    const w = window as unknown as { uploads: number; media: HTMLMediaElement }
    w.uploads = 0
    const upload = WebGL2RenderingContext.prototype.texImage2D
    WebGL2RenderingContext.prototype.texImage2D = function (this: WebGL2RenderingContext, ...args: unknown[]) { w.uploads++; return (upload as (...a: unknown[]) => void).apply(this, args) } as typeof upload
    const property = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted')!
    Object.defineProperty(HTMLMediaElement.prototype, 'muted', { configurable: true, get() { return property.get!.call(this) },
      set(value) { w.media = this; property.set!.call(this, value) } })
  })
  await open(page)
  const slider = page.getByRole('slider', { name: '프레임' })
  const last = Number(await slider.getAttribute('max'))
  await slider.fill(String(last))
  await expect.poll(() => frameOf(page)).toBe(last)
  await page.waitForTimeout(500)
  const before = await page.evaluate(() => (window as unknown as { uploads: number }).uploads)
  // Into the tail: the video's time at or past frames / fps (its length is the sound's).
  await page.evaluate(n => new Promise<void>(resolve => {
    const v = (window as unknown as { media: HTMLMediaElement }).media
    v.addEventListener('seeked', () => resolve(), { once: true })
    v.currentTime = Math.min(v.duration, (n + 1) / 60 + 0.001)
  }), last)
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => (window as unknown as { uploads: number }).uploads)).toBe(before)
  expect(await frameOf(page)).toBe(last)
})

test('REQ-MOTION-034 공간참 - 잔 opens with the four 아비 dead, and a card turned off opens the state without that one', async ({ page }) => {
  await closeAnnouncements(page)
  await page.goto('/ko/motion/skills?skill=id10415~1041507')
  await page.getByRole('button', { name: '확인' }).click()
  const cards = page.locator('[data-dead]')
  await expect(cards).toHaveCount(4, { timeout: 30000 })
  for (const card of await cards.all()) await expect(card).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-dead="11115"]').click()
  await expect(page).toHaveURL(/state=v(%3A|:)dead-10916(%2B|\+)dead-10115(%2B|\+)dead-10614/)
  await expect(page.locator('[data-dead="11115"]')).toHaveAttribute('aria-pressed', 'false')
})

test('REQ-MOTION-035 an identity with link lines has their sound buttons in its link section', async ({ page }) => {
  await closeAnnouncements(page)
  await page.goto('/ko/motion/skills?skill=id10315~1031505')
  await page.getByRole('button', { name: '확인' }).click()
  const line = page.locator('[data-voice="noir-sinclair"]')
  await expect(line).toBeVisible({ timeout: 30000 })
  await line.click()
  await expect(line).toHaveAttribute('aria-pressed', 'true')
  await line.click()
  await expect(line).toHaveAttribute('aria-pressed', 'false')
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

test('REQ-MOTION-026 the stage keeps drawing while the video plays even when the browser stops reporting new video frames', async ({ page }) => {
  // Windows Chrome: the canvas froze mid-skill while the video, fully buffered, played on. Here the frame reports never come.
  await page.addInitScript(() => {
    HTMLVideoElement.prototype.requestVideoFrameCallback = function () { return 1 }
    HTMLVideoElement.prototype.cancelVideoFrameCallback = function () {}
  })
  await open(page)
  const frame = () => page.getByRole('slider', { name: '프레임' }).evaluate(input => Number((input as HTMLInputElement).value))
  const first = await frame()
  await page.waitForTimeout(1500)
  expect(await frame()).toBeGreaterThan(first + 30)
})

test('REQ-MOTION-029 the player has no effect switches, even for a skill whose index entry counts layers', async ({ page }) => {
  // 이상 흑수 - 오 필두 skill 1: the index counted two buff layers before version 9.
  await closeAnnouncements(page)
  await page.goto('/ko/motion/skills?skill=id10114~1011401')
  await page.getByRole('button', { name: '확인' }).click()
  await expect(page.getByRole('button', { name: '일시정지' }).or(page.getByText('영상을 불러오지 못했습니다.'))).toBeVisible({ timeout: 30000 })
  await expect(page.getByText('이펙트', { exact: true })).toHaveCount(0)
})

test('REQ-MOTION-028 a layers.json from before version 7 (no Y·Cb·Cr planes) is not drawn: the stage says it could not load', async ({ page }) => {
  await page.route('https://assets.saigo-no-dante.com/**/layers.json', route => route.fulfill({
    json: { version: 4, fps: 60, frames: 10, tile: { w: 1920, h: 1080 }, video: { file: 'layers.mp4', w: 1920, h: 1080 }, base: { x: 0, y: 0, w: 1920, h: 1080 }, layers: [] },
    headers: { 'access-control-allow-origin': '*' },
  }))
  await closeAnnouncements(page)
  await page.goto(SKILL)
  await page.getByRole('button', { name: '확인' }).click()
  await expect(page.getByText('영상을 불러오지 못했습니다.')).toBeVisible({ timeout: 30000 })
})
