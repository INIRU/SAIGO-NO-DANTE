import { test, expect } from '@playwright/test'
import { encode } from 'next-auth/jwt'
import { loadEnvConfig } from '@next/env'
// An administrator's bell lists an inquiry waiting for
// an answer without flashing a scrollbar, and its row opens that inquiry in the inbox, which names the inquirer.
// The session is signed with the local NextAuth key; the feed and the inbox are answered here, and nothing is written.
test.use({ channel: 'chrome' })
test.skip(({ browserName }) => browserName !== 'chromium', 'Installed Chrome')
loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
const id = '00000000-0000-4000-8000-0000000000a1'
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const thread = {
  id, title: '로그인이 안 돼요', category: 'account', status: 'open', created_at: ago(30), last_message_at: ago(5), last_admin_message_at: ago(20),
  user_last_read_at: null, closed_at: null, contribution_accepted: false, reply: '확인 중입니다', author: { username: '파우스트' },
  support_messages: [
    { id: 'm1', author_role: 'user', body: '구글 로그인이 실패합니다', created_at: ago(30) },
    { id: 'm2', author_role: 'admin', body: '확인 중입니다', created_at: ago(20) },
    { id: 'm3', author_role: 'user', body: '아직도 안 됩니다', created_at: ago(5) },
  ],
}
const nameless = { ...thread, id: '00000000-0000-4000-8000-0000000000a2', title: '닉네임 없는 계정의 문의', author: { username: null }, last_message_at: ago(40), support_messages: [thread.support_messages[0]] }
const feed = {
  unread: 1,
  items: [
    { id: 'm3', kind: 'inquiry', target: 'inquiry', href: `/admin/inquiries?id=${id}`, title: thread.title, actor: '파우스트', avatar: null, excerpt: '아직도 안 됩니다', at: ago(5), unread: true },
    { id: 'c2', kind: 'reply', target: 'plan', href: '/planner/community/p1#plan-comments-title', title: '화상 플랜', actor: '료슈', avatar: null, excerpt: '답글 내용', at: ago(60), unread: false },
    { id: 'c1', kind: 'comment', target: 'deck', href: '/decks/d1#deck-comments-title', title: '출혈 덱', actor: '돈키호테', avatar: null, excerpt: '댓글 내용', at: ago(90), unread: false },
  ],
}
for (const width of [1440, 390]) test(`admin inquiry notifications: bell, no scrollbar flash, inbox names ${width}`, async ({ page, context }, info) => {
  test.setTimeout(90000)
  const email = process.env.ADMIN_EMAILS?.split(',')[0]?.trim()
  test.skip(!email || !process.env.NEXTAUTH_SECRET, 'Requires the local admin session configuration')
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { email, isAdmin: true, isSuspended: false } })
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/' }])
  await page.setViewportSize({ width, height: 900 })
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname, read = route.request().method() === 'GET'
    if (path.startsWith('/api/auth/')) return route.continue()
    if (path === '/api/notifications') return route.fulfill({ json: read ? feed : { ok: true } })
    if (path === '/api/inquiries/unread') return route.fulfill({ json: { unread: false } })
    if (path === '/api/admin/inquiries') return route.fulfill({ json: [thread, nameless] })
    if (path === `/api/admin/inquiries/${id}`) return route.fulfill({ json: thread })
    // Other reads go to the dev server; any other change is answered here instead of reaching the database.
    return read ? route.continue() : route.fulfill({ json: { ok: true } })
  })
  await page.goto('/ko/announcements')
  const bell = page.locator('[data-testid="nav-notify-bell"]:visible')
  await expect(bell).toHaveAttribute('aria-label', /1/)
  // Watch the list from the frame it appears until every row has landed: it must never be taller than its box.
  const watched = page.evaluate(() => new Promise<{ seen: boolean; overflow: number }>(done => {
    let overflow = 0, landed = 0
    const giveUp = performance.now() + 15000
    const tick = () => {
      const list = [...document.querySelectorAll<HTMLElement>('[role="dialog"] ul')].find(node => node.offsetParent)
      if (list) {
        landed ||= performance.now() + 1000
        overflow = Math.max(overflow, list.scrollHeight - list.clientHeight)
      }
      if (landed ? performance.now() < landed : performance.now() < giveUp) requestAnimationFrame(tick); else done({ seen: landed > 0, overflow })
    }
    tick()
  }))
  await bell.click()
  expect(await watched).toEqual({ seen: true, overflow: 0 })
  const row = page.locator('[role="dialog"]:visible').getByRole('link', { name: /파우스트.*로그인이 안 돼요/ })
  await expect(row).toContainText('아직도 안 됩니다')
  await page.screenshot({ path: info.outputPath(`bell-${width}.png`) })
  await row.click()
  await expect(page).toHaveURL(new RegExp(`/ko/admin/inquiries\\?id=${id}$`))
  await expect(page.getByRole('heading', { name: thread.title, exact: true })).toBeVisible()
  await expect(page.locator('.desk-msg-author')).toHaveText(['파우스트', '관리자', '파우스트'])
  await expect(page.locator('.desk-thread-head .desk-row-who')).toHaveText('파우스트')
  await page.screenshot({ path: info.outputPath(`inbox-thread-${width}.png`) })
  if (width < 960) await page.getByRole('button', { name: '목록', exact: true }).click()
  await expect(page.locator('.desk-row .desk-row-who')).toHaveText(['파우스트', '작성자'])
  if (width < 960) await page.screenshot({ path: info.outputPath(`inbox-list-${width}.png`) })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  expect(errors).toEqual([])
})
