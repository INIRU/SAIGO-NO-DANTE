import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })

const sinners = [
  { name: '료슈', url: 'https://namu.wiki/w/료슈/인게임%20정보' },
  { name: '파우스트', url: 'https://namu.wiki/w/파우스트(Project%20Moon%20세계관)/인게임%20정보' },
  { name: '히스클리프', url: 'https://namu.wiki/w/히스클리프(Project%20Moon%20세계관)/인게임%20정보' },
]

for (const sinner of sinners) {
  const page = await browser.newPage()
  await page.goto(sinner.url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true))
  await page.waitForTimeout(2000)

  const result = await page.evaluate(() => {
    const results = []
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
    let inEgo = false, currentEgoName = null, inChangepoint = false, node
    while ((node = tw.nextNode())) {
      if (node.tagName === 'H2' && node.textContent.includes('E.G.O')) inEgo = true
      if (!inEgo) continue
      if (node.tagName === 'H4') currentEgoName = node.textContent.replace(/[\d.]+\s*/, '').trim()
      if (node.tagName === 'STRONG') {
        const t = node.textContent.trim()
        if (t.includes('4해석') && t.includes('변경')) { inChangepoint = true; continue }
        if (inChangepoint && ['패시브', '공격 레벨', '정신 소모량', '코스트'].some(k => t === k)) inChangepoint = false
      }
      if (inChangepoint && node.tagName === 'UL') {
        const clone = node.cloneNode(true)
        clone.querySelectorAll('noscript, img, style, script').forEach(n => n.remove())
        results.push({ ego: currentEgoName, changeText: clone.textContent.trim() })
        inChangepoint = false
      }
    }
    return results
  })

  console.log(`\n\n########## ${sinner.name} ##########`)
  for (const r of result) {
    console.log(`\n=== ${r.ego} ===`)
    console.log(r.changeText)
  }
  await page.close()
  await new Promise(r => setTimeout(r, 2000))
}
await browser.close()
