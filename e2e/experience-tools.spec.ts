import { test, expect } from '@playwright/test'

const labels = {
  ko: {title:'경험치 계산기',current:'현재 레벨',target:'목표 레벨',ticket:'인격 학습 티켓 I',skip:'스킵',tools:'도구',other:'기타'},
  en: {title:'EXP calculator',current:'Current level',target:'Target level',ticket:'Identity Training Ticket I',skip:'Skip',tools:'Tools',other:'More'},
  ja: {title:'経験値計算機',current:'現在のレベル',target:'目標レベル',ticket:'人格学習チケット I',skip:'スキップ',tools:'ツール',other:'その他'},
}
for (const locale of ['ko','en','ja'] as const) for(const width of [1440,390]) {
  test(`EXP calculator refresh, revisit and ticket plan ${locale} ${width}`, async({page},info)=>{
    const l=labels[locale], errors:string[]=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.setViewportSize({width,height:1000})
    await page.goto(`/${locale}/tools/experience`)
    const cdp=await page.context().newCDPSession(page)
    await Promise.all([page.waitForEvent('load'),cdp.send('Page.reload',{ignoreCache:true})])
    for(let visit=0;visit<2;visit++) {
      await expect(page.getByTestId('required-exp').filter({visible:true})).toHaveCount(1)
      await expect(page.getByRole('heading',{name:l.title,exact:true})).toBeVisible()
      await expect(page.getByTestId('required-exp').filter({visible:true})).toHaveText('251,629EXP')
      await expect(page.getByTestId('manual-runs').filter({visible:true})).toContainText('10')
      await expect(page.getByTestId('skip-runs').filter({visible:true})).toContainText('7')
      await expect(page.getByTestId('use-ticket-2').filter({visible:true})).toContainText('59')
      await expect(page.getByTestId('excess-exp').filter({visible:true})).toHaveText('+171 EXP')
      const images=page.locator('main img[src*="resources"]:visible')
      expect(await images.count()).toBeGreaterThan(10)
      for(const img of await images.all()) {
        await img.scrollIntoViewIfNeeded()
        await expect.poll(()=>img.evaluate((x:HTMLImageElement)=>x.complete&&x.naturalWidth>0)).toBe(true)
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
      if(!visit){await page.goto(`/${locale}`);await page.goto(`/${locale}/tools/experience`)}
    }
    await page.getByRole('button',{name:l.current,exact:true}).click()
    await page.getByRole('menuitem',{name:'Lv. 55',exact:true}).click()
    await expect(page.getByTestId('required-exp').filter({visible:true})).toHaveText('44,765EXP')
    await expect(page.getByTestId('manual-runs').filter({visible:true})).toContainText('2')
    await page.getByLabel(l.ticket,{exact:true}).fill('900')
    await expect(page.getByTestId('manual-runs').filter({visible:true})).toContainText('0')
    await expect(page.getByTestId('use-ticket-1').filter({visible:true})).toContainText('896')
    await expect(page.getByTestId('excess-exp').filter({visible:true})).toHaveText('+35 EXP')
    await page.getByRole('radio',{name:new RegExp(l.skip)}).check()
    await expect(page.getByTestId('excess-exp').filter({visible:true})).toHaveText('+35 EXP')
    await page.getByRole('button',{name:l.target,exact:true}).click()
    await page.getByRole('menuitem',{name:'Lv. 55',exact:true}).click()
    await expect(page.getByTestId('required-exp').filter({visible:true})).toHaveText('0EXP')
    await expect(page.getByTestId('use-ticket-1').filter({visible:true})).toContainText('0')
    await page.goto(`/${locale}/tools/experience`)
    await page.screenshot({path:info.outputPath(`${locale}-${width}.png`),fullPage:true})
    expect(errors).toEqual([])
  })
}

test('tools menu sits before other menu and links to calculator',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  await page.goto('/ko')
  const tools=page.getByRole('button',{name:'도구',exact:true}), other=page.getByRole('button',{name:'기타',exact:true})
  const [a,b]=await Promise.all([tools.boundingBox(),other.boundingBox()])
  expect(a!.x).toBeLessThan(b!.x)
  await tools.hover()
  await page.getByRole('menuitem',{name:'경험치 계산기',exact:true}).click()
  await expect(page).toHaveURL(/\/ko\/tools\/experience/)
})

test('custom level and stage menus support keyboard selection',async({page},info)=>{
  await page.goto('/ko/tools/experience')
  await expect(page.locator('main select')).toHaveCount(0)
  const current=page.getByRole('button',{name:'현재 레벨',exact:true})
  await current.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem',{name:'Lv. 1',exact:true})).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(current).toContainText('Lv. 2')
  await expect(current).toBeFocused()
  const stage=page.getByRole('button',{name:'입장 가능한 경던 단계',exact:true})
  await stage.click()
  await page.keyboard.press('Home')
  await page.screenshot({path:info.outputPath('custom-dropdown.png')})
  await page.keyboard.press('Enter')
  await expect(stage).toContainText('1단계')
  await expect(page.getByText('1회 획득 2,650 EXP',{exact:true})).toBeVisible()
  await stage.click()
  await page.keyboard.press('Escape')
  await expect(stage).toBeFocused()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.locator('main a[href*="dcinside"]')).toHaveCount(0)
})

test('mobile tools menu opens the calculator',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.goto('/ko')
  await page.getByRole('button',{name:'메뉴 열기',exact:true}).click()
  await page.getByRole('button',{name:'도구',exact:true}).click()
  await page.getByRole('link',{name:'경험치 계산기',exact:true}).click()
  await expect(page).toHaveURL(/\/ko\/tools\/experience/)
  await expect(page.getByRole('button',{name:'메뉴 열기',exact:true})).toBeVisible()
})

