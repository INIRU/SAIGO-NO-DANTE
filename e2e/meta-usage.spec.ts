import { test, expect } from '@playwright/test'
import type { MetaData } from '../lib/meta/types'

test.use({ channel: 'chrome' })

test('identity analysis updates source, period, EGO filters, and linked decks', async ({ page }) => {
  await page.route('**/api/meta/usage?**', async route => {
    const url = new URL(route.request().url())
    const source = url.searchParams.get('source') as MetaData['source']
    const period = url.searchParams.get('period') as MetaData['period']
    const count = source === 'planner' ? 3 : 8
    const data: MetaData = {
      source, period, generatedAt: new Date().toISOString(), identityInsights: { fixture: { companions: [{ identity_id: 'companion', count: source === 'planner' ? 2 : 4 }, { identity_id: 'companion-variant', count: 1 }], count, orders: { '1': count }, keywords: [{ keyword: '화상', count }], egos: [{ ego_id: 'base', game_id: '20101', sinner_id: 'yi-sang', name_kr: '기본 검증 EGO', grade: 'ZAYIN', sin_affinity: null, image_url: null, count }, { ego_id: 'other', game_id: '20102', sinner_id: 'yi-sang', name_kr: '추가 검증 EGO', grade: 'ZAYIN', sin_affinity: null, image_url: null, count }], posts: [{ id: 'sample', source: 'decks', title: '검증 화상 덱', keywords: ['화상'] }] } }, sampleCount: count, excludedSamples: 0,
      sourceCounts: { decks: source === 'planner' ? 0 : 5, planner: 3 },
      battleIdentityStats: [{ identity_id: 'fixture', sinner_id: 'yi-sang', name_kr: '검증 인격', keywords: [], rarity: 3, folder_name: null, game_id: null, count }, { identity_id: 'companion', sinner_id: 'faust', name_kr: 'LCB 수감자', name_en: 'LCB Sinner', keywords: [], rarity: 1, folder_name: 'LCB Sinner', game_id: '10201', count: 4 }, { identity_id: 'companion-variant', sinner_id: 'faust', name_kr: '같은 수감자의 다른 인격', keywords: [], rarity: 1, folder_name: 'LCB Sinner', game_id: '10201', count: 1 }],
      supportIdentityStats: [], usageBySinner: {}, usageBySin: {}, keywordUsage: [], synergies: [], egoStats: [],
    }
    await route.fulfill({ json: data })
  })
  await page.goto('/ko/meta')
  await expect(page.getByText('유효 편성 8건', { exact: false })).toBeVisible()
  await expect(page.getByRole('region', { name: '함께 편성된 인격' })).toContainText('50.0%')
  await page.getByRole('tab', { name: '거던 플래너', exact: true }).click()
  await expect(page.getByText('유효 편성 3건', { exact: false })).toBeVisible()
  await expect(page.getByRole('region', { name: '함께 편성된 인격' })).toContainText('66.7%')
  await expect(page.getByRole('region', { name: '함께 편성된 인격' })).toContainText('3건 중 2건')
  const companions = page.getByRole('region', { name: '함께 편성된 인격' })
  await expect(companions.getByRole('link', { name: 'LCB 수감자 파우스트' })).toHaveAttribute('href', '/ko/sinners/faust/identities/companion')
  await expect(companions.getByRole('listitem')).toHaveCount(2)
  await expect(companions.getByRole('listitem').filter({ hasText: '같은 수감자의 다른 인격' })).toContainText('33.3%')
  await expect(companions.locator('img').first()).toHaveAttribute('src', /10201_normal_info/)
  await expect(companions.locator('img[src*=identity-card-frames]')).toHaveCount(0)
  const portrait = await companions.locator('img').first().boundingBox()
  expect(portrait!.width).toBe(portrait!.height)
  await expect(page.getByText('100.0%', { exact: false }).first()).toBeVisible()
  await page.getByRole('button', { name: '최근 90일', exact: true }).click()
  await expect(page).toHaveURL(/period=90/)
  await expect(page.getByRole('heading', { name: '편성 순서', exact: true })).toBeVisible()
  await expect(page.locator('[data-identity-analysis] select, [data-identity-analysis] input[type=checkbox]')).toHaveCount(0)
  await page.getByRole('button', { name: '인격 변경', exact: true }).click()
  await expect(page.getByRole('button', { name: '검증 인격', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('[data-identity-analysis] img[src*=identity-card-frames]').first()).toBeVisible()
  await expect(page.getByText('추가 검증 EGO', { exact: false })).toBeVisible()
  await expect(page.getByText('기본 검증 EGO', { exact: false })).toHaveCount(0)
  await page.getByRole('switch', { name: '기본 EGO 제외' }).click()
  await expect(page.getByText('기본 검증 EGO', { exact: false })).toBeVisible()
  await page.getByRole('group', { name: '덱 키워드', exact: true }).getByRole('button', { name: '화상' }).click()
  await expect(page.getByRole('link', { name: '검증 화상 덱', exact: false })).toHaveAttribute('href', '/ko/decks/sample')
})

test('a failed source request exposes retry instead of an endless skeleton', async ({ page }) => {
  let fails = true
  await page.route('**/api/meta/usage?**', async route => {
    if (fails) return route.fulfill({ status: 503, json: { error: 'unavailable' } })
    return route.fulfill({ json: { source: 'planner', period: '30', generatedAt: new Date().toISOString(), sampleCount: 0, sourceCounts: { decks: 0, planner: 0 }, excludedSamples: 0, battleIdentityStats: [], supportIdentityStats: [], usageBySinner: {}, usageBySin: {}, keywordUsage: [], synergies: [], egoStats: [] } })
  })
  await page.goto('/ko/meta?source=planner')
  await expect(page.getByRole('alert').filter({ hasText: '통계를 불러오지 못했습니다' })).toContainText('통계를 불러오지 못했습니다')
  await expect(page.getByRole('status', { name: '통계 불러오는 중' })).toHaveCount(0)
  fails = false
  await page.getByRole('button', { name: '다시 시도' }).click()
  await expect(page.getByText('유효 편성 0건', { exact: false })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: '통계를 불러오지 못했습니다' })).toHaveCount(0)
})

test('500 identities stay in a bounded searchable picker on desktop and mobile', async ({ page }) => {
  const rows = Array.from({ length: 500 }, (_, i) => ({ identity_id: `large-${i}`, sinner_id: 'yi-sang', name_kr: `확장 인격 ${i}`, keywords: [], rarity: 3, folder_name: null, game_id: null, count: 1 }))
  await page.route('**/api/meta/usage?**', route => route.fulfill({ json: {
    source: 'all', period: 'all', generatedAt: new Date().toISOString(), sampleCount: 500, excludedSamples: 0, sourceCounts: { decks: 500, planner: 0 },
    battleIdentityStats: rows, supportIdentityStats: [], usageBySinner: {}, usageBySin: {}, keywordUsage: [], synergies: [], egoStats: [],
    identityInsights: Object.fromEntries(rows.map(row => [row.identity_id, { count: 1, orders: { '1': 1 }, keywords: [], egos: [], posts: [], companions: [] }])),
  } }))
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/ko/meta')
    await expect(page.getByRole('tab', { name: '편성 통계' })).toHaveCount(0)
    await expect(page.locator('[data-analysis-subject]:visible h2')).toHaveText('확장 인격 0')
    expect((await page.locator('[data-analysis-subject]:visible').boundingBox())!.height).toBeLessThan(320)
    await expect(page.locator('[data-identity-analysis]:visible .formation-board-button')).toHaveCount(0)
    await page.getByRole('button', { name: '인격 변경' }).click()
    await expect(page.locator('[data-analysis-picker] .formation-board-button')).toHaveCount(36)
    expect((await page.locator('[data-analysis-picker]').boundingBox())!.height).toBeLessThanOrEqual(739)
    await expect(page.getByRole('group', { name: '수감자', exact: true }).getByRole('button', { name: '이상' }).locator('img')).toBeVisible()
    await page.getByRole('textbox', { name: '인격 이름 또는 수감자 검색' }).fill('확장 인격 499')
    await expect(page.locator('[data-analysis-picker] .formation-board-button')).toHaveCount(1)
    await page.getByRole('button', { name: '확장 인격 499', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('[data-analysis-subject]:visible h2')).toHaveText('확장 인격 499')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
