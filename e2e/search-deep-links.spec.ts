import { test, expect } from '@playwright/test'
import type { IndexEntry, SearchType } from '@/lib/search/engine'

test.use({ channel: 'chrome' })
test.setTimeout(120000)

// 검색 결과 주소는 그 대상을 연다
const MODAL_TYPES: SearchType[] = ['egoGift', 'keyword', 'themePack', 'event']

test('search index links open the matching detail', async ({ page, request }) => {
  const res = await request.get('/api/search/index?lang=ko')
  expect(res.ok()).toBe(true)
  const { entries } = await res.json() as { entries: IndexEntry[] }
  for (const type of ['sinner', 'identity', 'ego', ...MODAL_TYPES, 'page'] as SearchType[]) {
    expect(entries.some(e => e.type === type), type).toBe(true)
  }

  for (const type of MODAL_TYPES) {
    const entry = entries.find(e => e.type === type)!
    await page.goto('/ko' + entry.href)
    await expect(page.getByRole('dialog').filter({ hasText: entry.label }).first(), `${type} ${entry.href}`).toBeVisible({ timeout: 20000 })
  }

  const identity = entries.find(e => e.type === 'identity')!
  await page.goto('/ko' + identity.href)
  await expect(page.locator('h1').first()).toContainText(identity.label.split(' ')[0])
})

test('closing a linked gift removes it from the address', async ({ page, request }) => {
  const { entries } = await (await request.get('/api/search/index?lang=ko')).json() as { entries: IndexEntry[] }
  const gift = entries.find(e => e.type === 'egoGift')!
  await page.goto('/ko' + gift.href)
  const dialog = page.getByRole('dialog').filter({ hasText: gift.label }).first()
  await expect(dialog).toBeVisible({ timeout: 20000 })
  await dialog.getByRole('button', { name: '닫기' }).first().click()
  await expect(page).not.toHaveURL(/gift=/)
})
