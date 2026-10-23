import { test, expect, type Page } from '@playwright/test'

test.use({ channel: 'chrome' })
test.setTimeout(90000)

// 이상 LCE E.G.O::차원찢개 skill 1: three conditions of different lengths (the videos come from R2).
const SKILL = '/ko/motion/skills?skill=id10116~1011601'

const frameOf = (page: Page) => page.getByRole('slider', { name: '프레임' }).evaluate(input => Number((input as HTMLInputElement).value))

async function open(page: Page) {
  const popup = page.getByRole('dialog').filter({ hasText: '공지' })
  await page.addLocatorHandler(popup, async () => { await popup.getByRole('button', { name: '닫기' }).last().click() })
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
