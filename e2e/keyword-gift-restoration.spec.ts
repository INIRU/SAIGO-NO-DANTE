import { test, expect } from '@playwright/test'
import { getGameUiAsset } from '../lib/utils/game-ui'

test.use({ channel: 'chrome' })
test.skip(!process.env.LIMBUS_RESTORED_DATA, 'Requires the restored source catalog')

for (const width of [1440, 390]) {
  test(`keyword catalog covers all restored entries after hard refresh and revisit (${width})`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({width,height:900})
    const route='/ko/keywords?view=compact&cat='+encodeURIComponent('기타')
    await page.goto(route)
    const cdp=await page.context().newCDPSession(page)
    await Promise.all([page.waitForEvent('load'),cdp.send('Page.reload',{ignoreCache:true})])
    for(let visit=0;visit<2;visit++) {
      await expect(page.getByText(/482종의 키워드/)).toBeVisible()
      const cards=page.locator('button.cv-card-sm')
      await expect.poll(async()=>{
        await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight))
        return cards.count()
      },{timeout:60_000,intervals:[500]}).toBe(482)
      for(const name of ['참선','점혈 - 홍루','봉인된 검','분노 보호','리듬']) {
        const card=cards.filter({has:page.getByText(name,{exact:true})})
        await card.scrollIntoViewIfNeeded()
        await expect.poll(()=>card.locator('img').evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0)).toBe(true)
      }
      await expect(cards.filter({has:page.getByText('점혈 - 홍루',{exact:true})}).locator('img')).toHaveAttribute('src',/game-DianxueDonQuixote\.webp/)
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      if(!visit){await page.goto('/ko');await page.goto(route)}
    }
    await page.goto('/ko/keywords?cat='+encodeURIComponent('기타')+'&q='+encodeURIComponent('참선'))
    await expect(page.getByRole('img',{name:'참선',exact:true})).toBeVisible()
    await expect(page.getByText(/수치당 가하는 피해량/).first()).toBeVisible()
  })

  test(`gift background, EX sprite and bronze filters survive cache reuse (${width})`, async ({ page, request }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({width,height:900})
    await page.goto('/ko/mirror-dungeon')
    const cdp=await page.context().newCDPSession(page)
    await Promise.all([page.waitForEvent('load'),cdp.send('Page.reload',{ignoreCache:true})])
    for(let visit=0;visit<2;visit++) {
      const card=page.locator('.gift-card').filter({has:page.locator('img[alt="EX"]')}).first()
      // Mobile initially mounts only the first batch; load later gifts by scrolling.
      await expect.poll(async()=>{
        await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight))
        return card.count()
      },{timeout:60_000,intervals:[500]}).toBe(1)
      await card.scrollIntoViewIfNeeded()
      await expect.poll(()=>card.locator('img[alt="EX"]').evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0)).toBe(true)
      expect(await card.locator('.gift-frame').evaluate(e=>getComputedStyle(e).backgroundImage)).toContain(getGameUiAsset('gift/background'))
      expect((await request.get(getGameUiAsset('gift/background'))).status()).toBe(200)
      for(const type of ['slash','pierce','blunt']) {
        expect(await page.locator('img').evaluateAll((images,part)=>images.some(i=>decodeURIComponent(i.getAttribute('src')??'').includes(part)),getGameUiAsset(`stats/${type}`))).toBe(true)
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      await card.click()
      const modal=page.getByRole('dialog')
      await expect(modal).toBeVisible()
      await expect(modal.getByRole('img',{name:'EX',exact:true})).toBeVisible()
      await expect(modal.locator('img[src*="credits.webp"]')).toHaveCount(0)
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      if(!visit){await page.goto('/ko');await page.goto('/ko/mirror-dungeon')}
    }
  })
}
