import { test, expect } from '@playwright/test'

test.use({ channel: 'chrome', viewport: { width: 1440, height: 900 } })

for (const [board, path] of [['deck', '/ko/decks?browse=all'], ['plan', '/ko/planner/community?browse=all']] as const) {
  test(`REQ-DECKS-015 ${board} board: the identity picker changes sinner without closing, and a pick filters and closes it`, async ({ page }) => {
    await page.goto(path)
    const aside = page.locator('aside').first()
    // By attribute, not by role: while the picker is open the page behind it is hidden from the accessibility tree.
    const tile = (sinner: string) => aside.locator(`button[aria-label^="${sinner} 인격 선택"]`)
    // The identity section may be folded.
    const section = aside.getByRole('button', { name: /^인격( 필터)?$/ })
    await expect(section).toBeVisible()
    if (await section.getAttribute('aria-expanded') === 'false') await section.click()
    await tile('이상').click()

    const dialog = page.getByRole('dialog')
    const cards = dialog.locator('ul button[aria-pressed]')
    await expect(dialog.getByRole('heading', { name: '이상 인격 선택', exact: true })).toHaveCount(1)
    // Another sinner, in the same window, before anything is picked.
    await dialog.getByRole('button', { name: '파우스트', exact: true }).click()
    await expect(dialog.getByRole('heading', { name: '파우스트 인격 선택', exact: true })).toHaveCount(1)
    await expect(dialog.locator('ul button[aria-pressed=true]')).toHaveCount(0)

    // A pick goes into the filter and closes the picker.
    await cards.first().click()
    await expect(dialog).toHaveCount(0)
    await expect(tile('파우스트')).toHaveAttribute('data-picked', 'true')

    // Opened again it shows the pick; another identity of the same sinner takes its place (one per sinner).
    await tile('파우스트').click()
    await expect(cards.first()).toHaveAttribute('aria-pressed', 'true')
    await cards.nth(1).click()
    await expect(dialog).toHaveCount(0)
    await tile('파우스트').click()
    await expect(dialog.locator('ul button[aria-pressed=true]')).toHaveCount(1)
    await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'true')

    // Taking a pick off leaves the picker open.
    await cards.nth(1).click()
    await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'false')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(aside.locator('button[data-picked]')).toHaveCount(0)
  })
}

for (const [board, path] of [['deck', '/ko/decks?browse=all'], ['plan', '/ko/planner/community?browse=all']] as const) {
  // A filter written to the URL reached the page a render late: the pressed keyword showed as not pressed for a moment, then pressed again.
  test(`REQ-DECKS-016 ${board} board: a pressed keyword stays pressed while the URL catches up`, async ({ page }) => {
    await page.goto(path)
    const tiles = page.locator('aside').first().locator('button[title][aria-pressed]')
    await expect(tiles.first()).toBeVisible()
    await page.evaluate(() => {
      const aside = document.querySelector('aside')!
      const read = () => [...aside.querySelectorAll('button[title][aria-pressed]')].map(tile => tile.getAttribute('aria-pressed') === 'true' ? 1 : 0).join('')
      const seen = [read()]
      ;(window as unknown as { __pressed: string[] }).__pressed = seen
      new MutationObserver(() => {
        const now = read()
        if (seen.at(-1) !== now) seen.push(now)
      }).observe(aside, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed'] })
    })
    for (const index of [2, 3, 4]) {
      await tiles.nth(index).click()
      await expect(tiles.nth(index)).toHaveAttribute('aria-pressed', 'true')
      await page.waitForTimeout(700)
    }
    // Each press adds one keyword and nothing is ever taken back.
    expect(await page.evaluate(() => (window as unknown as { __pressed: string[] }).__pressed)).toEqual(['0000000000', '0010000000', '0011000000', '0011100000'])
  })
}
