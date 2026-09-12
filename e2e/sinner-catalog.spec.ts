import { test, expect } from '@playwright/test'

test.use({ channel: 'chrome' })
for (const width of [1440, 390, 768]) {
  test(`sinner catalog preserves frames and usable filters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/ko/sinners/yi-sang')
    const grid = page.locator('[class*="identityGrid"]')
    const cards = grid.locator('[role="button"]')
    await expect(cards).toHaveCount(16)
    await expect(page.getByRole('button', { name: '전체 보기', exact: true })).toBeVisible()
    const search = page.getByPlaceholder('인격 이름, 소속, 키워드 검색...')
    await search.fill('거미집')
    await expect(cards).toHaveCount(1)
    await search.press('Escape')
    await expect(cards.first()).toContainText('거미집 검지 아비')
    await search.fill('')
    await expect(cards).toHaveCount(16)
    await page.getByRole('button', { name: '1성', exact: true }).click()
    await expect(cards).toHaveCount(1)
    await page.getByRole('button', { name: '전체', exact: true }).click()
    await expect(cards).toHaveCount(16)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await grid.scrollIntoViewIfNeeded()
    for (const img of await cards.first().locator('img').all()) {
      await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: `/tmp/limbus-sinner-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'EGO', exact: true }).click()
    await expect(page.getByPlaceholder('EGO 이름, 키워드 검색...')).toBeVisible()
    await page.getByRole('button', { name: /^인격/ }).click()
    await cards.first().focus()
    await expect(cards.first()).toBeFocused()
    await cards.first().press('Enter')
    await expect(page).toHaveURL(/\/identities\//)
  })
}

test('identity hover interpolates and reduced motion disables scaling', async ({ page }) => {
  await page.goto('/ko/sinners/yi-sang')
  await expect(page.getByRole('button', { name: '전체 보기', exact: true })).toBeVisible()
  const card = page.locator('[class*="identityGrid"] [role="button"]').first()
  await card.scrollIntoViewIfNeeded()
  await card.hover()
  const values = await card.evaluate(async element => {
    const scales: number[] = []
    const start = performance.now()
    while (performance.now() - start < 400) {
      scales.push(new DOMMatrixReadOnly(getComputedStyle(element).transform).a)
      await new Promise(requestAnimationFrame)
    }
    return scales
  })
  expect(values.some(v => v > 1 && v < 1.024)).toBe(true)
  expect(values.at(-1)).toBeCloseTo(1.025, 3)
  await page.mouse.move(0, 0)
  await expect.poll(() => card.evaluate(e => new DOMMatrixReadOnly(getComputedStyle(e).transform).a)).toBe(1)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await card.hover()
  expect(await card.evaluate(e => new DOMMatrixReadOnly(getComputedStyle(e).transform).a)).toBe(1)
})
