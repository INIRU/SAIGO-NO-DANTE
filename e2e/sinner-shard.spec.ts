import { test, expect } from '@playwright/test'

test('native sinner shard appears before the exchange cost without glass',async({page},info)=>{
  await page.goto('/ko/sinners/gregor/identities/2935368e-296f-4738-9fc6-f50c64655647')
  const cdp=await page.context().newCDPSession(page)
  await Promise.all([page.waitForEvent('load'),cdp.send('Page.reload',{ignoreCache:true})])
  for(let visit=0;visit<2;visit++) {
    const shard=page.locator('[data-sinner-shard="gregor"]')
    await expect(shard).toHaveCount(1)
    await expect(async()=>{await shard.scrollIntoViewIfNeeded();await expect(shard).toBeVisible()}).toPass()
    await expect(shard).toBeVisible()
    for(const img of await shard.locator('img').all()) await expect.poll(()=>img.evaluate((x:HTMLImageElement)=>x.complete&&x.naturalWidth>0)).toBe(true)
    await expect(shard.locator('img')).toHaveCount(1)
    expect(await shard.locator('img').getAttribute('src')).toContain('gregor')
    await expect(shard.locator('..')).toContainText('400')
    if(!visit){await page.goto('/ko');await page.goBack()}
  }
  await page.screenshot({path:info.outputPath('shard-cost.png')})
})
