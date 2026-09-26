import { test, expect, type Locator } from '@playwright/test'

test.use({ channel: 'chrome' })
test.skip(!process.env.LIMBUS_RESTORED_DATA, 'Requires the preserved public planner formation')

async function expectGiftBackground(scope: Locator) {
  const background = scope.locator('[data-gift-background]').first()
  await expect(background).toBeVisible()
  await expect.poll(() => background.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  const source = await background.getAttribute('src')
  expect(source).toMatch(/^\/assets\/game-ui\/gift\/background\.webp\?v=/)
  return source
}

for (const width of [1440, 390]) {
  test(`preserved planner is included after hard refresh and revisit (${width})`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 })
    const data = await (await request.get('/api/meta/usage')).json()
    expect(data.period).toBe('all')
    expect(data.sourceCounts.planner).toBeGreaterThan(0)
    expect(data.battleIdentityStats.length).toBeGreaterThan(0)
    expect(data.egoStats.length).toBeGreaterThan(0)
    await page.goto('/ko/meta')
    const cdp = await page.context().newCDPSession(page)
    await Promise.all([page.waitForEvent('load'), cdp.send('Page.reload', { ignoreCache: true })])
    for (let visit = 0; visit < 2; visit++) {
      await expect(page.getByRole('button', { name: '전체 기간', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('[data-sample-count]')).toHaveText(String(data.sampleCount))
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
      if (!visit) { await page.goto('/ko'); await page.goto('/ko/meta') }
    }
    await page.getByRole('button', { name: '최근 30일', exact: true }).click()
    await expect(page.getByRole('button', { name: '전체 기간 보기', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '전체 기간 보기', exact: true }).click()
    await expect(page.locator('[data-sample-count]')).toHaveText(String(data.sampleCount))
  })

  test(`event artwork and choice navigator survive hard refresh and revisit (${width})`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/ko/mirror-dungeon?tab=events')
    const cdp = await page.context().newCDPSession(page)
    await Promise.all([page.waitForEvent('load'), cdp.send('Page.reload', { ignoreCache: true })])
    for (let visit = 0; visit < 2; visit++) {
      await expect(page.locator('.ev-card')).toHaveCount(154)
      await page.mouse.move(0, 0)
      await expect(page.locator('.ev-card').first()).not.toContainText('지옥나비의 꿈')
      const previewBackground = await expectGiftBackground(page.locator('.ev-card').first())
      await expect(page.locator('.ev-card').first()).toHaveCSS('background-color', 'rgb(26, 21, 16)')
      await page.locator('.ev-card').first().click()
      const modal = page.getByRole('dialog')
      expect(await expectGiftBackground(modal)).toBe(previewBackground)
      const artwork = modal.locator('.event-modal-sidebar a img')
      await expect(artwork).toBeVisible()
      await expect.poll(() => artwork.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && !img.currentSrc.includes('placeholder'))).toBe(true)
      const firstOption = modal.locator('[data-choice-option]').first()
      const secondOption = modal.locator('[data-choice-option]').nth(1)
      if (width < 768) {
        await modal.getByRole('button', { name: '선택지', exact: true }).click()
        await expect(firstOption).toBeInViewport()
      }
      await expect(firstOption).toHaveAttribute('aria-pressed', 'true')
      await expect(firstOption).toHaveCSS('border-top-color', 'rgb(200, 144, 10)')
      await expect(firstOption).toHaveCSS('color', 'rgb(232, 176, 48)')
      await secondOption.focus()
      await page.keyboard.press('Enter')
      await expect(secondOption).toHaveAttribute('aria-pressed', 'true')
      await expect(modal.locator('#event-choice-result > [data-event-choice]')).toHaveAttribute('data-event-choice', (await secondOption.getAttribute('data-choice-option'))!)
      await expect(firstOption).toHaveAttribute('aria-pressed', 'false')
      await firstOption.click()
      const choice = modal.locator('#event-choice-result')
      await expect(choice.getByText('None', { exact: true })).toHaveCount(0)
      const story = choice.getByText('결과 이야기', { exact: true })
      await story.click()
      await expect(choice.locator('details').first()).toHaveAttribute('open', '')
      await story.click()
      await expect.poll(() => modal.locator('.event-modal-content').evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1)
      if (width < 768) await modal.locator('.event-modal-sidebar a').scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`event-${visit}.png`), animations: 'disabled' })
      await page.keyboard.press('Escape')
      await expect(modal).toHaveCount(0)
      if (!visit) { await page.goto('/ko'); await page.goto('/ko/mirror-dungeon?tab=events') }
    }
  })
}

for (const [lang, success, failure] of [['ko', '성공', '실패'], ['en', 'Success', 'Failure'], ['ja', '成功', '失敗']]) {
  test(`event judgment keeps both outcomes visible (${lang})`, async ({ page }, info) => {
    await page.setViewportSize({ width: lang === 'ko' ? 1440 : 390, height: 900 })
    await page.goto(`/${lang}/mirror-dungeon?tab=events`)
    const cdp = await page.context().newCDPSession(page)
    await Promise.all([page.waitForEvent('load'), cdp.send('Page.reload', { ignoreCache: true })])
    for (let visit = 0; visit < 2; visit++) {
      await page.locator('.ev-card[data-event-id="901002"]').click()
      const modal = page.getByRole('dialog')
      await modal.locator('[data-choice-option]').nth(1).click()
      const successBranch = modal.locator('[data-event-branch="success"]').first()
      const failureBranch = modal.locator('[data-event-branch="failure"]').first()
      await expect(successBranch).toContainText(success)
      await expect(failureBranch).toContainText(failure)
      const [successBox, failureBox] = await Promise.all([successBranch.boundingBox(), failureBranch.boundingBox()])
      expect(successBox).not.toBeNull()
      expect(failureBox).not.toBeNull()
      expect(failureBox!.y).toBeGreaterThanOrEqual(successBox!.y + successBox!.height)
      expect(Math.abs(failureBox!.x - successBox!.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(failureBox!.width - successBox!.width)).toBeLessThanOrEqual(1)
      await successBranch.scrollIntoViewIfNeeded()
      await expect(successBranch).toBeVisible()
      await expect.poll(() => modal.locator('.event-modal-content').evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1)
      await page.screenshot({ path: info.outputPath(`judgment-${visit}.png`), animations: 'disabled' })
      await page.keyboard.press('Escape')
      if (!visit) { await page.goto(`/${lang}`); await page.goto(`/${lang}/mirror-dungeon?tab=events`) }
    }
  })
}

test('reduced motion presents final counts without running chart animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/ko/meta')
  await expect(page.locator('.count-up').first()).not.toHaveText('0')
  await expect.poll(() => page.locator('.usage-bar').evaluateAll(bars => bars.flatMap(bar => bar.getAnimations()).filter(a => a.playState === 'running').length)).toBe(0)
  await page.goto('/ko')
  await expect.poll(() => page.locator('.home-command-actions').evaluate(e => e.getAnimations().filter(a => a.playState === 'running').length)).toBe(0)
  await expect(page.locator('.home-command-actions')).toBeVisible()
})

// Check every entry in the rebuilt theme graph, including explicitly unmapped artwork.
for (const width of [1440, 390]) {
  test(`story image aliases load in gallery and modal after hard refresh and revisit (${width})`, async ({ page }, info) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/ko/mirror-dungeon?tab=events')
    const cdp = await page.context().newCDPSession(page)
    await Promise.all([page.waitForEvent('load'), cdp.send('Page.reload', { ignoreCache: true })])
    const pairs = [[971100, 10711], [971101, 10712], [971102, 10713], [971103, 10714], [971110, 10902], [971111, 10903], [971112, 10904]]
    for (let visit = 0; visit < 2; visit++) {
      for (const [id, imageId] of pairs) {
        const card = page.locator(`.ev-card[data-event-id="${id}"]`)
        // Clicking also waits for the streamed gallery's interactive replacement.
        await card.click()
        const modal = page.getByRole('dialog')
        const artwork = modal.locator('.event-modal-sidebar a img')
        await expect(artwork).toBeVisible()
        await expect.poll(() => artwork.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
        await expect(modal.locator('.event-modal-sidebar a').first()).toHaveAttribute('href', new RegExp(`/icons/events/${imageId}\\.webp$`))
        expect(await modal.locator('.event-modal-content').evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1)
        if (id === 971110) await page.screenshot({ path: info.outputPath(`restored-${visit}.png`), animations: 'disabled' })
        await page.keyboard.press('Escape')
        await expect(modal).toHaveCount(0)
        const preview = card.locator('img').first()
        await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
        expect(decodeURIComponent((await preview.getAttribute('src'))!)).toContain(`/icons/events/${imageId}.webp`)
      }
      if (!visit) { await page.goto('/ko'); await page.goto('/ko/mirror-dungeon?tab=events') }
    }
  })
}

test('event gallery loads every confirmed original without placeholders', async ({ page }, info) => {
  test.setTimeout(120000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/ko/mirror-dungeon?tab=events')
  const cards = page.locator('.ev-card')
  // Exercise a live handler before bulk inspection; the streamed server gallery
  // is replaced once when the query-string tab hydrates.
  await cards.first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(cards).toHaveCount(154)
  const missing = await cards.evaluateAll(nodes => nodes.filter(node => !node.querySelector('img[src*="icons%2Fevents"], img[src*="icons/events"]')).map(node => node.getAttribute('data-event-id')))
  expect(missing).toEqual(['971071', '971072'])
  // Load each six-card batch, keeping image requests bounded like normal scrolling.
  for (let start = 0; start < 154; start += 6) {
    const images = page.locator(`.ev-card:nth-child(n+${start + 1}):nth-child(-n+${Math.min(start + 6, 154)}) img`)
    await cards.nth(start).evaluate(element => element.scrollIntoView({ block: 'center' }))
    await images.evaluateAll(nodes => nodes.forEach(node => node.setAttribute('loading', 'eager')))
    await expect.poll(() => images.evaluateAll(nodes => nodes.filter(node => !(node as HTMLImageElement).complete || !(node as HTMLImageElement).naturalWidth || (node as HTMLImageElement).currentSrc.includes('placeholder')).length), { timeout: 15000 }).toBe(0)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: info.outputPath('gallery.png'), animations: 'disabled' })
  await page.getByRole('textbox').last().fill('zzzz-no-matching-event')
  await expect(cards).toHaveCount(0)
  await expect(page.getByText('결과 없음', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '검색 지우기', exact: true }).click()
  await expect(cards).toHaveCount(154)
})

test('event reward opens its original gift detail', async ({ page }) => {
  await page.goto('/ko/mirror-dungeon?tab=events')
  await page.locator('[data-event-id="901001"]').click()
  const reward = page.locator('#event-choice-result button').filter({ hasText: '지옥나비' }).first()
  await expect(reward).toBeVisible()
  const name = (await reward.textContent())!.trim()
  await reward.click()
  await expect(page.getByRole('dialog')).toContainText(name)
  await expect(page.locator('#event-choice-result')).toHaveCount(0)
})

test('gift catalog and event previews use the same framed artwork', async ({ page }) => {
  await page.goto('/ko/mirror-dungeon')
  const source = await expectGiftBackground(page.locator('.gift-card').first())
  await page.locator('.gift-card').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto('/ko/mirror-dungeon?tab=events')
  expect(await expectGiftBackground(page.locator('.ev-card').first())).toBe(source)
  expect(await page.locator('.ev-card button').count()).toBe(0)
})

for (const width of [1440, 390]) {
  test(`rebuilt generator rewards and source styling remain correct (${width})`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/ko/mirror-dungeon?tab=events')
    await page.locator('[data-event-id="971032"]').click()
    const result = page.locator('#event-choice-result')
    const gift = result.getByRole('button', { name: '치사랑', exact: true })
    await expect(gift).toBeVisible()
    await expectGiftBackground(gift)
    await expect(gift).toHaveCSS('border-top-width', '0px')
    const artwork = await gift.locator('.gift-frame').boundingBox()
    const name = await gift.locator('p').boundingBox()
    expect(name!.y).toBeGreaterThan(artwork!.y + artwork!.height)
    expect(name!.y - artwork!.y - artwork!.height).toBeLessThan(10)
    await page.locator('[data-choice-option]').nth(1).click()
    await expect(result.getByRole('button', { name: '어긋난 트랜지스터', exact: true })).toBeVisible()
    await page.locator('[data-choice-option]').nth(2).click()
    await expect(result.locator('[data-event-judgment]')).toContainText('15+')
    await expect(result.locator('[data-event-judgment]')).toContainText('+5')
    const failure = result.locator('[data-event-branch="failure"]')
    await expect(failure).toContainText('20만큼 체력')
    await expect(failure).toContainText('12만큼 정신력')
    await expect(failure.getByRole('button', { name: '치사랑', exact: true })).toBeVisible()
    await expect(failure.getByRole('button', { name: '어긋난 트랜지스터', exact: true })).toBeVisible()
    await expect(failure.locator('[data-source-effect]').first().locator('span').filter({ hasText: '20만큼 체력' })).toHaveCSS('color', 'rgb(227, 0, 0)')
    await failure.getByText('결과 이야기', { exact: true }).click()
    await expect(failure).toContainText('{수감자 이름}')
    await expect(failure).not.toContainText('???')
    await expect.poll(() => page.getByRole('dialog').evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1)
    await failure.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath('generator.png'), animations: 'disabled' })
  })
}

test('grandchildren stay inside the original encounter and retries are finite', async ({ page }) => {
  await page.goto('/ko/mirror-dungeon?tab=events')
  for (const id of [97101201, 97101202, 97101203, 90102301]) await expect(page.locator(`.ev-card[data-event-id="${id}"]`)).toHaveCount(0)
  await page.locator('.ev-card[data-event-id="971012"]').click()
  const firstSuccess = page.locator('#event-choice-result [data-event-branch="success"]').first()
  await firstSuccess.getByText('검계라고 말한다.', { exact: true }).click()
  const grandchild = firstSuccess.locator('[data-event-node="97101203"]')
  await expect(grandchild).toBeVisible()
  await expect(grandchild.locator('[data-event-branch="success"]')).toBeVisible()
  await expect(grandchild.locator('[data-event-branch="failure"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.locator('.ev-card[data-event-id="901023"]').click()
  await page.getByRole('dialog').getByText('물을 좀 더 뿌린다.', { exact: true }).click()
  const child = page.locator('[data-event-node="90102301"]')
  await expect(child).toHaveCount(1)
  await expect(child.locator('[data-event-return="90102301"]')).toBeVisible()
  await expect(child).toContainText('12.5%')
  await expect(child.locator('summary').filter({ hasText: '물을 좀 더 뿌린다.' })).toHaveCount(1)
  await child.locator('[data-event-return]').click()
  await expect(child).toBeInViewport()
})

test('judgment narration that precedes the participant prompt is preserved', async ({ page }) => {
  await page.goto('/ko/mirror-dungeon?tab=events')
  await page.locator('.ev-card[data-event-id="971040"]').click()
  await expect(page.locator('[data-event-node="97104001"]')).toContainText('테이블에는 남은 짐이 보인다.')
})
