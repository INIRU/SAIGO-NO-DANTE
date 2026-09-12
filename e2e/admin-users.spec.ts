import { test, expect } from '@playwright/test'
import { encode } from 'next-auth/jwt'
import { loadEnvConfig } from '@next/env'
test.use({ channel: 'chrome' })
test.skip(({ browserName }) => browserName !== 'chromium', 'Installed Chrome')
loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
const id = '00000000-0000-4000-8000-000000000001'
for (const width of [1440, 390]) test(`admin users: review, confirmation, filter and layout ${width}`, async ({ page, context }, info) => {
  test.setTimeout(90000)
  const email = process.env.ADMIN_EMAILS?.split(',')[0]?.trim()
  test.skip(!email || !process.env.NEXTAUTH_SECRET, 'Requires the local admin session configuration')
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { email, isAdmin: true, isSuspended: false } })
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/' }])
  await page.setViewportSize({ width, height: 1000 })
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  let restricted = false; const changes: Record<string, unknown>[] = []
  const user = () => ({ id, username: '차분한 관리자', avatar_url: null, created_at: '2026-09-01T00:00:00Z', last_seen_at: null, restricted })
  await page.route('**/api/admin/users?*', r => {
    const q = new URL(r.request().url()).searchParams
    const users = q.get('search')?.includes('없음') ? [] : [user()]
    return r.fulfill({ json: { users, total: users.length } })
  })
  await page.route(`**/api/admin/users/${id}`, async r => {
    if (r.request().method() === 'PATCH') { const b = r.request().postDataJSON(); changes.push(b); restricted = b.suspended; return r.fulfill({ json: { ok: true } }) }
    return r.fulfill({ json: { ...user(), role: 'user', protected: false, suspension_reason: restricted ? '반복된 도배' : null, suspended_at: restricted ? '2026-09-12T00:00:00Z' : null, suspended_until: null, deckCount: 2, planCount: 1, decks: [{ id: 'deck-one', title: '출혈 덱' }], plans: [{ id: 'plan-one', title: '거울 던전 플랜' }], history: [] } })
  })
  await page.goto('/ko/admin/users')
  await expect(page.getByRole('heading', { name: '유저 관리', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '차분한 관리자', exact: true }).click()
  await expect(page.getByRole('heading', { name: '차분한 관리자' })).toBeVisible()
  const reason = page.getByLabel('제한 사유', { exact: true })
  await reason.fill('반복된 도배')
  await page.getByRole('radio', { name: '30일' }).check()
  await page.screenshot({ path: info.outputPath(`admin-users-${width}.png`), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.locator('.admin-users-moderation').getByRole('button', { name: '이용 제한', exact: true }).click()
  const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('30일')
  expect(changes).toHaveLength(0)
  await dialog.getByRole('button', { name: '취소' }).click(); expect(changes).toHaveLength(0)
  await page.locator('.admin-users-moderation').getByRole('button', { name: '이용 제한', exact: true }).click()
  await dialog.getByRole('button', { name: '이용 제한', exact: true }).click()
  await expect(page.getByRole('button', { name: '제한 해제', exact: true })).toBeVisible()
  expect(changes[0]).toEqual({ suspended: true, expectedSuspendedAt: null, reason: '반복된 도배', durationDays: 30 })
  await page.getByRole('button', { name: '제한 해제', exact: true }).click()
  await dialog.getByRole('button', { name: '제한 해제', exact: true }).click()
  await expect(reason).toBeVisible(); expect(changes[1].suspended).toBe(false)
  if (width < 960) await page.getByRole('button', { name: '목록으로', exact: true }).click()
  await page.getByRole('textbox', { name: '닉네임 또는 이메일 검색' }).fill('없음')
  await expect(page.getByText('검색 조건에 맞는 유저가 없습니다.')).toBeVisible()
  expect(errors).toEqual([])
})
