import { test, expect } from '@playwright/test'

test.use({ channel: 'chrome' })
test('deck preview does not leave an unformed identity selected or dimmed', async ({ page }) => {
  await page.goto('/ko/decks/ca5785ae-7cd5-4956-a96a-ea5e080bb33e')
  const board = page.locator('.deck-detail-formation')
  const first = board.locator('.formation-board-button').first()
  await expect(first).toBeVisible()
  const checkCards = async () => {
    await expect(board.locator('[aria-pressed="true"]')).toHaveCount(0)
    const filters = await board.locator('[class*="portraitInner"]').evaluateAll(nodes =>
      nodes.filter(node => !node.closest('[data-formation]')).map(node => getComputedStyle(node).filter),
    )
    expect(filters.length).toBeGreaterThan(1)
    expect(new Set(filters).size).toBe(1)
    await expect(board.locator('[data-formation="selected"]')).toHaveCount(7)
  }
  await checkCards()
  await first.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await checkCards()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
