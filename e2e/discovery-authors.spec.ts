import { test, expect } from '@playwright/test'
test.use({ channel: 'chrome' })
for (const kind of ['deck', 'planner']) test(`${kind} shelf retains registered author names`, async ({ request, page }) => {
  const response = await request.get(`/api/discovery?kind=${kind}&days=7`)
  expect(response.ok()).toBe(true)
  const data = await response.json()
  const posts = [...data.recent, ...data.updated, ...data.popular]
  const named = posts.filter(post => post.profiles?.username)
  test.skip(!named.length, 'No public posts with a registered author')
  for (const post of named) {
    if (kind === 'deck') expect(post.username).toBe(post.profiles.username)
    else expect(post.profiles.username).toBeTruthy()
  }
  await page.goto(kind === 'deck' ? '/ko/decks' : '/ko/planner/community')
  await expect(page.getByText(named[0].profiles.username, { exact: true }).first()).toBeVisible()
})
