import { test, expect } from '@playwright/test'

test.use({ channel: 'chrome' })
test.skip(!process.env.LIMBUS_RESTORED_DATA, 'Requires restored event localization')

for (const width of [1440, 390]) {
  test(`restored Korean events survive refresh and revisit (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/ko/mirror-dungeon?tab=events')
    const cdp = await page.context().newCDPSession(page)
    await Promise.all([page.waitForEvent('load'), cdp.send('Page.reload', { ignoreCache: true })])
    for (let visit = 0; visit < 2; visit++) {
      for (const [id, name, choice] of [
        [971100, '홍염나방 탈출', '제압에 협력한다.'],
        [971101, '요정초롱 탈출', '제압에 협력한다.'],
        [971102, '충격지네', '제한 풀린 제세동기'],
        [971103, '글귀 선택지 이후', '작전 승인 카드로 문을 연다.'],
      ] as const) {
        const card = page.locator(`[data-event-id="${id}"]`)
        await expect(card).toContainText(name)
        await card.click()
        const modal = page.getByRole('dialog')
        await expect(modal.locator('[data-choice-option]').first()).toContainText(choice)
        await expect(modal).not.toContainText('Containment Breach')
        expect(await modal.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
        await page.keyboard.press('Escape')
        await expect(modal).toHaveCount(0)
      }
      if (!visit) { await page.goto('/ko'); await page.goto('/ko/mirror-dungeon?tab=events') }
    }
  })
}
