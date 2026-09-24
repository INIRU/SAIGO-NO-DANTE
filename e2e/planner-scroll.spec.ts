import { test, expect } from '@playwright/test'
import { encode } from 'next-auth/jwt'
import { loadEnvConfig } from '@next/env'
test.use({ channel: 'chrome' })
test.skip(({ browserName }) => browserName !== 'chromium', 'Installed Chrome')
loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
test.skip(!process.env.NEXTAUTH_SECRET, 'Needs NEXTAUTH_SECRET for a local session')

// Sections mount as they near the viewport; a closed modal inside one used to call scrollTo(0, 0) and yank the page to the top.
test('planner keeps the reader\'s scroll position while sections mount', async ({ page, context }) => {
  test.setTimeout(90000)
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { email: 'planner-scroll@example.invalid', name: 'QA', isSuspended: false } })
  await context.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/' }])
  await page.addInitScript({ content: 'window.__scrollTo = []; const o = window.scrollTo.bind(window); window.scrollTo = (...a) => { window.__scrollTo.push(a); return o(...a) }' })
  await page.goto('/ko/planner')
  await page.waitForTimeout(1500)
  await page.mouse.wheel(0, 1200)
  await page.waitForTimeout(3000)
  expect(await page.evaluate(() => (window as unknown as { __scrollTo: unknown[] }).__scrollTo)).toEqual([])
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(600)
})
