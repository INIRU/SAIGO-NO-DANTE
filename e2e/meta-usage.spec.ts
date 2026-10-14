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
      source, period, filters: {}, facets: { usage: {}, keyword: {}, difficulty: {} }, generatedAt: new Date().toISOString(), identityInsights: { fixture: { companions: [{ identity_id: 'companion', count: source === 'planner' ? 2 : 4 }, { identity_id: 'companion-variant', count: 1 }], count, orders: { '1': count }, egos: [{ ego_id: 'base', game_id: '20101', sinner_id: 'yi-sang', name_kr: '기본 검증 EGO', grade: 'ZAYIN', sin_affinity: null, image_url: null, count }, { ego_id: 'other', game_id: '20102', sinner_id: 'yi-sang', name_kr: '추가 검증 EGO', grade: 'ZAYIN', sin_affinity: null, image_url: null, count }], posts: [{ id: 'sample', source: 'decks', title: '검증 화상 덱', usage: 'mirrorDungeon', combo: ['화상'], votes: 0, views: 0, comments: 0 }, { id: 'bench', source: 'planner', title: '검증 대기 플랜', usage: 'mirrorDungeon', combo: [], votes: 0, views: 0, comments: 0, support: true }], skills: [{ key: '3-2-1', count }] } }, sampleCount: count, excludedSamples: 0,
      sourceCounts: { decks: source === 'planner' ? 0 : 5, planner: 3 },
      battleIdentityStats: [{ identity_id: 'fixture', sinner_id: 'yi-sang', name_kr: '검증 인격', keywords: [], rarity: 3, folder_name: null, game_id: null, count }, { identity_id: 'companion', sinner_id: 'faust', name_kr: 'LCB 수감자', name_en: 'LCB Sinner', keywords: [], rarity: 1, folder_name: 'LCB Sinner', game_id: '10201', count: 4 }, { identity_id: 'companion-variant', sinner_id: 'faust', name_kr: '같은 수감자의 다른 인격', keywords: [], rarity: 1, folder_name: 'LCB Sinner', game_id: '10201', count: 1 }],
      supportIdentityStats: [], usageBySinner: {}, usageBySin: {}, keywordUsage: [], usageStats: [], comboStats: [], planStats: { count: 0, difficulty: [], gifts: [], themes: [] }, giftCatalog: {}, themeCatalog: {}, skillCatalog: {}, skillSplits: [], dungeon: { plans: 0, floors: [], routes: [], start: [], observe: [], enhanced: [], constraints: [] }, topPosts: { decks: [], planner: [] }, synergies: [], egoStats: [],
    }
    await route.fulfill({ json: data })
  })
  await page.goto('/ko/meta?tab=identity')
  await expect(page.locator('[data-sample-count]')).toHaveText('8')
  await expect(page.getByRole('region', { name: '함께 편성된 인격' })).toContainText('50.0%')
  await page.getByRole('tab', { name: '거던 플래너', exact: true }).click()
  await expect(page.locator('[data-sample-count]')).toHaveText('3')
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
  await expect(page.getByRole('complementary', { name: '분석할 인격' }).getByRole('button', { name: /검증 인격/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-identity-analysis] img[src*=identity-card-frames]').first()).toBeVisible()
  await expect(page.getByText('추가 검증 EGO', { exact: false })).toBeVisible()
  await expect(page.getByText('기본 검증 EGO', { exact: false })).toHaveCount(0)
  await page.getByRole('switch', { name: '기본 EGO 제외' }).click()
  await expect(page.getByText('기본 검증 EGO', { exact: false })).toBeVisible()
  const purpose = page.getByRole('region', { name: '주로 사용된 덱 용도' })
  await expect(page.getByRole('link', { name: '검증 대기 플랜', exact: false })).toHaveCount(0)
  await purpose.getByRole('switch', { name: '편성된 덱만' }).click()
  await expect(page.getByRole('link', { name: '검증 대기 플랜', exact: false })).toBeVisible()
  await purpose.getByRole('list', { name: '키워드 덱' }).getByRole('button', { name: /화상/ }).click()
  await expect(page.getByRole('link', { name: '검증 대기 플랜', exact: false })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '검증 화상 덱', exact: false })).toHaveAttribute('href', '/ko/decks/sample')
})

test('REQ-META-011 the filter panel takes several values per filter, narrows the sample, keeps its choices in the address and disables empty options', async ({ page }) => {
  const requests: URLSearchParams[] = []
  const row = (identity_id: string, sinner_id: string, rarity: number, count: number) => ({ identity_id, sinner_id, name_kr: identity_id, keywords: [], rarity, folder_name: null, game_id: null, count })
  await page.route('**/api/meta/usage?**', async route => {
    const params = new URL(route.request().url()).searchParams
    requests.push(params)
    const filters: Record<string, unknown> = {}
    for (const key of ['usage', 'keyword', 'difficulty', 'sinner', 'rarity']) if (params.get(key)) filters[key] = params.get(key)!.split(',')
    for (const key of ['keywordMode', 'sinnerMode']) if (params.get(key)) filters[key] = params.get(key)
    // The sample shrinks with every filter value sent, so the page shows which request it is drawing.
    const sampleCount = 9 - [...params.keys()].filter(key => key !== 'source' && key !== 'period').length
    const data: MetaData = {
      source: 'all', period: 'all', filters: filters as MetaData['filters'],
      facets: { usage: { mirrorDungeon: 7, refractionRailway: 2 }, keyword: { '화상': 3, '침잠': 1 }, difficulty: { hard: 1 } },
      generatedAt: new Date().toISOString(), identityInsights: {}, sampleCount, excludedSamples: 0, sourceCounts: { decks: sampleCount, planner: 0 },
      battleIdentityStats: [row('삼성 이상', 'yi-sang', 3, 9), row('일성 파우스트', 'faust', 1, 4), row('일성 이스마엘', 'ishmael', 1, 3), row('삼성 히스클리프', 'heathcliff', 3, 2), row('일성 파우스트 둘', 'faust', 1, 1)],
      supportIdentityStats: [], usageBySinner: {}, usageBySin: {}, keywordUsage: [], usageStats: [], comboStats: [], planStats: { count: 0, difficulty: [], gifts: [], themes: [] }, giftCatalog: {}, themeCatalog: {}, skillCatalog: {}, skillSplits: [], dungeon: { plans: 0, floors: [], routes: [], start: [], observe: [], enhanced: [], constraints: [] }, topPosts: { decks: [], planner: [] }, synergies: [], egoStats: [],
    }
    await route.fulfill({ json: data })
  })
  await page.goto('/ko/meta')
  const sample = page.locator('[data-sample-count]'), panel = page.locator('[data-meta-filters]'), ranking = page.locator('[data-meta-overview] ol > li')
  const toggle = page.getByRole('button', { name: /^필터/ })
  const option = (name: string) => panel.getByRole('button', { name, exact: true })
  const address = () => decodeURIComponent(page.url())
  await expect(sample).toHaveText('9')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(panel).toHaveCount(0)
  await toggle.click()
  // Several values of one filter.
  await option('거울 굴절 철도').click()
  await expect(sample).toHaveText('8')
  await option('거울 던전').click()
  await expect.poll(address).toContain('usage=refractionRailway,mirrorDungeon')
  // One selection has one spelling for the API, whatever order it was pressed in.
  expect(requests.at(-1)!.get('usage')).toBe('mirrorDungeon,refractionRailway')
  await option('거울 던전').click()
  await expect.poll(address).toContain('usage=refractionRailway')
  await expect(option('거울 굴절 철도')).toHaveAttribute('aria-pressed', 'true')
  // An option no formation matches cannot be pressed.
  await expect(option('스토리')).toBeDisabled()
  await expect(option('진동')).toBeDisabled()
  // Two keywords are a dual deck: both at once, or any one after the switch.
  await option('화상').click()
  await expect(panel.getByRole('button', { name: '키워드 덱 AND/OR 조건 전환' })).toHaveCount(0)
  await option('침잠').click()
  await expect.poll(address).toContain('keyword=화상,침잠')
  expect(requests.at(-1)!.get('keywordMode')).toBeNull()
  await panel.getByRole('button', { name: '키워드 덱 AND/OR 조건 전환' }).click()
  await expect(page).toHaveURL(/keywordMode=or/)
  await expect.poll(() => requests.at(-1)!.get('keywordMode')).toBe('or')
  // Rarity and sinner narrow the sample too, and the ranking lists those identities.
  await expect(ranking).toHaveCount(5)
  await option('1성').click()
  await expect.poll(() => requests.at(-1)!.get('rarity')).toBe('1')
  await expect(ranking).toHaveCount(3)
  await option('파우스트').click()
  await expect.poll(() => requests.at(-1)!.get('sinner')).toBe('faust')
  await expect(ranking).toHaveCount(2)
  await expect(ranking.first()).toContainText('일성 파우스트')
  await expect(toggle).toContainText('5')
  // usage, keyword, keywordMode, rarity and sinner were sent.
  await expect(sample).toHaveText('4')
  // An address that carries filters opens with the panel shown.
  await page.goto('/ko/meta?usage=refractionRailway,mirrorDungeon&tab=identity&rarity=3')
  await expect(page.getByRole('button', { name: /^필터/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(option('거울 굴절 철도')).toHaveAttribute('aria-pressed', 'true')
  await expect(option('거울 던전')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('complementary', { name: '분석할 인격' }).getByRole('button')).toHaveCount(2)
  await page.getByRole('button', { name: '지우기', exact: true }).click()
  await expect(page).not.toHaveURL(/usage=|rarity=/)
  await expect(sample).toHaveText('9')
  // An unknown value in the address is read as no filter.
  await page.goto('/ko/meta?usage=raid')
  await expect(sample).toHaveText('9')
  expect(requests.at(-1)!.get('usage')).toBeNull()
})

test('REQ-META-014 REQ-META-015 posts show how they were received: ten of an identity\'s at first, and the most popular decks and plans on the overall and Mirror Dungeon tabs', async ({ page }) => {
  const post = (id: string, source: 'decks' | 'planner', votes: number, views: number, comments = 0): MetaData['topPosts']['decks'][number] => ({ id, source, title: '인기 글 ' + id, usage: 'mirrorDungeon', combo: [], votes, views, comments })
  await page.route('**/api/meta/usage?**', async route => {
    const source = new URL(route.request().url()).searchParams.get('source') as MetaData['source']
    const data: MetaData = {
      source, period: 'all', filters: {}, facets: { usage: {}, keyword: {}, difficulty: {} }, generatedAt: new Date().toISOString(), sampleCount: 12, excludedSamples: 0, sourceCounts: { decks: 9, planner: 3 },
      // The server lists them most popular first.
      identityInsights: { fixture: { companions: [], count: 12, orders: { '1': 12 }, egos: [], skills: [], posts: Array.from({ length: 12 }, (_, i) => post('d' + i, 'decks', 12 - i, 100 + i, i ? 0 : 4)) } },
      battleIdentityStats: [{ identity_id: 'fixture', sinner_id: 'yi-sang', name_kr: '검증 인격', keywords: [], rarity: 3, folder_name: null, game_id: null, count: 12 }],
      supportIdentityStats: [], usageBySinner: {}, usageBySin: {}, keywordUsage: [], usageStats: [], comboStats: [], planStats: { count: 0, difficulty: [], gifts: [], themes: [] }, giftCatalog: {}, themeCatalog: {}, skillCatalog: {}, skillSplits: [], synergies: [], egoStats: [],
      dungeon: { plans: 3, floors: [], routes: [], start: [], observe: [], enhanced: [], constraints: [] },
      topPosts: { decks: source === 'planner' ? [] : [post('d0', 'decks', 12, 100, 4), post('d1', 'decks', 11, 101)], planner: [post('p0', 'planner', 7, 435)] },
    }
    await route.fulfill({ json: data })
  })
  const decks = page.getByRole('region', { name: '인기 덱', exact: true }), plans = page.getByRole('region', { name: '인기 플랜', exact: true })
  // Overall tab: both boards, each row a link to the post with its votes and views (comments when there are any).
  await page.goto('/ko/meta')
  await expect(page.locator('[data-sample-count]')).toHaveText('12')
  await expect(decks.getByRole('link')).toHaveCount(2)
  await expect(decks.getByRole('link', { name: /인기 글 d0.*추천\s*12.*조회\s*100.*댓글\s*4/ })).toHaveAttribute('href', '/ko/decks/d0')
  await expect(decks.getByRole('link').nth(1)).toHaveAccessibleName(/인기 글 d1.*추천\s*11.*조회\s*101$/)
  await expect(plans.getByRole('link', { name: /인기 글 p0.*추천\s*7.*조회\s*435/ })).toHaveAttribute('href', '/ko/planner/community/p0')
  // A board without posts in scope is not drawn.
  await page.getByRole('tab', { name: '거던 플래너', exact: true }).click()
  await expect(decks).toHaveCount(0)
  await expect(plans.getByRole('link')).toHaveCount(1)
  // Mirror Dungeon tab: plans only.
  await page.goto('/ko/meta?tab=dungeon')
  await expect(plans.getByRole('link')).toHaveCount(1)
  await expect(decks).toHaveCount(0)
  // Identity tab: ten rows, the rest behind the button.
  await page.goto('/ko/meta?tab=identity')
  const posts = page.getByRole('region', { name: '이 인격을 사용하는 덱과 플래너' })
  await expect(posts.getByRole('link')).toHaveCount(10)
  await expect(posts.getByRole('link').first()).toHaveAccessibleName(/인기 글 d0.*추천\s*12.*조회\s*100.*댓글\s*4/)
  await posts.getByRole('button', { name: '2개 더 보기' }).click()
  await expect(posts.getByRole('link')).toHaveCount(12)
  await posts.getByRole('button', { name: '접기' }).click()
  await expect(posts.getByRole('link')).toHaveCount(10)
})

test('a failed source request exposes retry instead of an endless skeleton', async ({ page }) => {
  let fails = true
  await page.route('**/api/meta/usage?**', async route => {
    if (fails) return route.fulfill({ status: 503, json: { error: 'unavailable' } })
    return route.fulfill({ json: { source: 'planner', period: '30', generatedAt: new Date().toISOString(), sampleCount: 0, sourceCounts: { decks: 0, planner: 0 }, excludedSamples: 0, battleIdentityStats: [], supportIdentityStats: [], usageBySinner: {}, usageBySin: {}, keywordUsage: [], usageStats: [], comboStats: [], planStats: { count: 0, difficulty: [], gifts: [], themes: [] }, giftCatalog: {}, themeCatalog: {}, synergies: [], egoStats: [] } })
  })
  await page.goto('/ko/meta?source=planner')
  await expect(page.getByRole('alert').filter({ hasText: '통계를 불러오지 못했습니다' })).toContainText('통계를 불러오지 못했습니다')
  await expect(page.getByRole('status', { name: '통계 불러오는 중' })).toHaveCount(0)
  fails = false
  await page.getByRole('button', { name: '다시 시도' }).click()
  await expect(page.locator('[data-sample-count]')).toHaveText('0')
  await expect(page.getByRole('alert').filter({ hasText: '통계를 불러오지 못했습니다' })).toHaveCount(0)
})

test('500 identities stay in a bounded searchable picker on desktop and mobile', async ({ page }) => {
  const rows = Array.from({ length: 500 }, (_, i) => ({ identity_id: `large-${i}`, sinner_id: 'yi-sang', name_kr: `확장 인격 ${i}`, keywords: [], rarity: 3, folder_name: null, game_id: null, count: 1 }))
  await page.route('**/api/meta/usage?**', route => route.fulfill({ json: {
    source: 'all', period: 'all', generatedAt: new Date().toISOString(), sampleCount: 500, excludedSamples: 0, sourceCounts: { decks: 500, planner: 0 },
    battleIdentityStats: rows, supportIdentityStats: [], usageBySinner: {}, usageBySin: {}, keywordUsage: [], usageStats: [], comboStats: [], planStats: { count: 0, difficulty: [], gifts: [], themes: [] }, giftCatalog: {}, themeCatalog: {}, skillCatalog: {}, skillSplits: [], dungeon: { plans: 0, floors: [], routes: [], start: [], observe: [], enhanced: [], constraints: [] }, synergies: [], egoStats: [],
    identityInsights: Object.fromEntries(rows.map(row => [row.identity_id, { count: 1, orders: { '1': 1 }, egos: [], posts: [], companions: [] }])),
  } }))
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/ko/meta?tab=identity')
    await expect(page.getByRole('tab', { name: '편성 통계' })).toHaveCount(0)
    await expect(page.locator('[data-analysis-subject]:visible h2')).toHaveText('확장 인격 0')
    expect((await page.locator('[data-analysis-subject]:visible').boundingBox())!.height).toBeLessThan(320)
    await expect(page.locator('[data-identity-analysis]:visible .formation-board-button')).toHaveCount(0)
    if (width >= 1024) {
      const list = page.getByRole('complementary', { name: '분석할 인격' })
      expect((await list.boundingBox())!.height).toBeLessThanOrEqual(900)
      await list.getByRole('textbox', { name: '인격 이름 또는 수감자 검색' }).fill('확장 인격 499')
      await expect(list.getByRole('button')).toHaveCount(2)
      await list.getByRole('button', { name: /확장 인격 499/ }).click()
      await expect(page).toHaveURL(/id=large-499/)
      await expect(page.locator('[data-analysis-subject]:visible h2')).toHaveText('확장 인격 499')
      continue
    }
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
