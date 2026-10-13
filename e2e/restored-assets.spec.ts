import { test, expect } from '@playwright/test'
import { getGameUiAsset } from '../lib/utils/game-ui'
test.use({ channel: 'chrome' })
test.skip(!process.env.LIMBUS_RESTORED_DATA, 'Requires the restored Drive game dataset')
const fifth = 'b23a17a3-82e9-5b50-a9d6-ab1c86a90373'
const fourth = 'd7eef678-ca14-52fc-ab77-85fb264ccb21'

test('EGO stage V changes the passive and preserves independent corrosion tabs', async ({ page }) => {
  await page.goto(`/ko/sinners/faust/ego/${fifth}`)
  const awakening = page.getByRole('tablist').first()
  const corrosion = page.getByRole('tablist').nth(1)
  await expect(awakening.getByRole('tab',{name:'5 해석',exact:true})).toHaveAttribute('aria-selected','true')
  await expect(page.getByRole('main').getByText('불꽃의 검',{exact:true})).toBeVisible()
  await expect(page.getByRole('main').getByText(/탐식 속성 기본 스킬 사용 시/).first()).toBeVisible()
  await awakening.getByRole('tab',{name:'4 해석',exact:true}).click()
  await expect(page.getByRole('main').getByText(/탐식 속성 기본 스킬 사용 시/)).toHaveCount(0)
  await expect(corrosion.getByRole('tab',{name:'5 해석',exact:true})).toHaveAttribute('aria-selected','true')
  await awakening.getByRole('tab',{name:'4 해석',exact:true}).press('Home')
  await expect(page.getByRole('main').getByText('불꽃의 검',{exact:true})).toHaveCount(0)
  await awakening.getByRole('tab',{name:'1 해석',exact:true}).press('End')
  await expect(page.getByRole('main').getByText('불꽃의 검',{exact:true})).toBeVisible()
})

test('IV-only EGO never exposes V and catalogue cards use the actual maximum', async ({ page }) => {
  await page.goto(`/ko/sinners/faust/ego/${fourth}`)
  await expect(page.getByRole('tab',{name:'4 해석',exact:true})).toBeVisible()
  await expect(page.getByRole('tab',{name:'5 해석',exact:true})).toHaveCount(0)
  await expect(page.getByRole('main').getByText('권태',{exact:true})).toBeVisible()
  await page.goto('/ko/sinners/ego')
  await expect(page.locator(`a[href$="/${fifth}"] img[src$="/5.webp"]`)).toHaveCount(1)
  await expect(page.locator(`a[href$="/${fourth}"] img[src$="/4.webp"]`)).toHaveCount(1)
})

test('identity metadata, unframed art and source UI survive a cached revisit on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const route = '/ko/sinners/gregor/identities/2935368e-296f-4738-9fc6-f50c64655647'
  await page.goto(route)
  const cdp = await page.context().newCDPSession(page)
  // CDP acknowledges reload before the new document replaces the previous one.
  await Promise.all([page.waitForEvent('load'), cdp.send('Page.reload', { ignoreCache: true })])
  for (let visit = 0; visit < 2; visit++) {
    const main = page.getByRole('main')
    await expect(main.getByText('2026-07-09', { exact: true })).toBeVisible()
    await expect(main.getByText('9회차', { exact: true })).toBeVisible()
    await expect(main.getByText('인격 키워드 · 소속', { exact: true })).toBeVisible()
    await expect(main.locator('img[src*="identity-card-frames"]')).toHaveCount(0)
    for (const name of ['health', 'speed', 'defense', 'slash', 'pierce', 'blunt']) {
      const icon = main.locator(`img[src*="stats%2F${name}.webp"]`).first()
      await icon.scrollIntoViewIfNeeded()
      await expect.poll(async () => icon.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
      expect(decodeURIComponent((await icon.getAttribute('src'))!)).toContain(getGameUiAsset(`stats/${name}`))
    }
    await expect(main.locator('img[src*="coins%2Funbreakable.webp"]').first()).toBeVisible()
    const coinKeyword = main.locator('.keyword-token').filter({ hasText: /^파괴 불가 코인$/ }).first()
    await expect.poll(async () => {
      const url = new URL((await coinKeyword.locator('img').getAttribute('src'))!, page.url())
      return url.pathname + url.search
    }).toBe(getGameUiAsset('coins/unbreakable'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (!visit) await page.reload()
  }
})

test('unavailable keyword artwork preserves its text and tooltip without a broken image', async ({ page }) => {
  await page.route('**/icons/keywords/burn.webp', route => route.fulfill({ status: 404, body: '' }))
  await page.goto('/ko/sinners/gregor/identities/2935368e-296f-4738-9fc6-f50c64655647')
  const main = page.getByRole('main')
  const burn = main.locator('.keyword-token').filter({ hasText: /^화상$/ }).first()
  await expect(burn).toBeVisible()
  await expect(burn.locator('img')).toHaveCount(0)
  await burn.hover()
  await expect(page.getByRole('tooltip')).toContainText('화상')
  await expect(page.getByRole('tooltip').locator('img')).toHaveCount(0)
})

test('all sinner number overlays and the special panic icon load on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/ko/sinners')
  const numbers = page.getByRole('main').locator('img[src*="game-ui%2Fsinners%2F"]')
  await expect(numbers).toHaveCount(12)
  for (const number of await numbers.all()) {
    await number.scrollIntoViewIfNeeded()
    await expect.poll(async () => number.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  }
  await expect(page.getByRole('main').locator('img[alt="#11"]')).toHaveCount(1)
  await page.goto('/ko/sinners/don-quixote/identities/22487651-860a-45b9-ba20-6add1372531c')
  const special = page.getByRole('main').locator('img[src*="sanity%2F9994.webp"]')
  await special.scrollIntoViewIfNeeded()
  await expect.poll(async () => special.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  const bounds = await special.boundingBox()
  expect(bounds?.width).toBeLessThanOrEqual(88)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('skill nameplates and metadata fit narrow phones without removing animations', async ({ page }) => {
  const routes = [
    '/ko/sinners/gregor/identities/2935368e-296f-4738-9fc6-f50c64655647',
    `/ko/sinners/faust/ego/${fifth}`,
  ]
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 844 })
    for (const route of routes) {
      await page.goto(route)
      const banners = page.getByRole('main').locator('[data-skill-name-banner]')
      await expect(banners.first()).toBeVisible()
      for (const banner of await banners.all()) {
        expect(await banner.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  }
})

test('keyword catalogue and modal keep missing-source text without broken artwork', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route(/offense-level\.webp/, route => route.fulfill({ status: 404, body: '' }))
  await page.goto('/ko/keywords')
  await page.getByRole('button', { name: '필터', exact: true }).click()
  await page.getByRole('dialog', { name: '필터 패널' }).getByRole('textbox').fill('공격 레벨+')
  await page.getByRole('button', { name: '필터 닫기' }).click()
  const card = page.locator('button.kw-card').filter({ hasText: '공격 레벨+' }).first()
  await expect(card).toBeVisible()
  await expect(card.locator('img')).toHaveCount(0)
  await card.click()
  await expect(page.getByRole('heading', { level: 2, name: '공격 레벨+', exact: true })).toBeVisible()
  await expect(page.locator('img[alt="공격 레벨+"]')).toHaveCount(0)
  await expect(page.getByText('한 턴 동안 공격 레벨이 수치만큼 증가', { exact: true }).last()).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '아이콘 보기', exact: true }).click()
  const compact = page.locator('button.cv-card-sm').filter({ hasText: '공격 레벨+' })
  await expect(compact).toBeVisible()
  await expect(compact.locator('img')).toHaveCount(0)
})

for (const route of ['/ko/planner', '/ko/decks/new']) {
  test(`empty formation numbers reuse restored source artwork on ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(route)
    const numbers = page.getByRole('main').locator('img[src*="game-ui%2Fsinners%2F"]')
    await expect(numbers).toHaveCount(12)
    for (const number of await numbers.all()) {
      await number.scrollIntoViewIfNeeded()
      await expect.poll(() => number.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    }
    await expect(page.getByRole('main').locator('img[src*="%2Fnumber.webp"]')).toHaveCount(0)
  })
}


test('blessings and shared starlight load from preserved Drive originals', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/ko/planner?tab=blessing')
  for (let id = 100; id < 110; id++) {
    const icon = page.getByRole('main').locator(`img[src*="start-buffs%2F${id}.webp"]`).first()
    await icon.scrollIntoViewIfNeeded()
    await expect.poll(() => icon.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  }
  for (const route of ['/ko/planner?tab=blessing', '/ko/planner?tab=gift']) {
    await page.goto(route)
    const stars = page.getByRole('main').locator('img[src*="start-buffs%2Fstarlight.webp"]')
    await expect(stars.first()).toBeVisible()
    for (const star of await stars.all()) {
      await star.scrollIntoViewIfNeeded()
      await expect.poll(() => star.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
      expect(new URL(await star.getAttribute('src') ?? '', 'http://localhost').searchParams.get('url')).toBe(getGameUiAsset('start-buffs/starlight'))
    }
  }
})


test('global search opens after hydration and hides an unavailable keyword image', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route(/offense-level\.webp/, route => route.fulfill({ status: 404, body: '' }))
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/ko/decks')
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click()
  await page.getByRole('button', { name: '검색 열기', exact: true }).click()
  const input = page.locator('input').filter({ visible: true }).last()
  await input.fill('공격 레벨+')
  const result = page.locator('[data-search-index]').filter({ hasText: '공격 레벨+' }).first()
  await expect(result).toBeVisible()
  await expect(result.locator('img')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(result).toHaveCount(0)
  expect(errors).toEqual([])
})
