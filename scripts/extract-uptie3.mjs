#!/usr/bin/env node
/**
 * 나무위키에서 4동기화/4해석 시 변경점을 추출하는 스크립트
 * 호넷【변조】(뫼르소) - 인격 → 4동기화
 * 하모니 EGO(싱클레어) - EGO → 4해석
 */

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const PAGES = [
  {
    name: '뫼르소',
    url: 'https://namu.wiki/w/%EB%AB%BC%EB%A5%B4%EC%86%8C/%EC%9D%B8%EA%B2%8C%EC%9E%84%20%EC%A0%95%EB%B3%B4',
    targets: [{ name: '호넷', type: 'identity', keyword: '동기화' }],
  },
  {
    name: '싱클레어',
    url: 'https://namu.wiki/w/%EC%8B%B1%ED%81%B4%EB%A0%88%EC%96%B4(Project%20Moon%20%EC%84%B8%EA%B3%84%EA%B4%80)/%EC%9D%B8%EA%B2%8C%EC%9E%84%20%EC%A0%95%EB%B3%B4',
    targets: [{ name: '하모니', type: 'ego', keyword: '해석' }],
  },
]

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })

  for (const target of PAGES) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  ${target.name}`)
    console.log(`${'═'.repeat(60)}`)

    const page = await browser.newPage()
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await sleep(3000)

    await page.evaluate(() => {
      document.querySelectorAll('details').forEach(d => d.open = true)
    })
    await sleep(1000)

    const text = await page.evaluate(() => {
      document.querySelectorAll('noscript, style').forEach(n => n.remove())
      return document.body.textContent
    })

    console.log(`  텍스트 길이: ${text.length}`)

    for (const t of target.targets) {
      const searchTerms = ['변경점', `4${t.keyword}`]
      console.log(`\n  ── ${t.name} (${t.type}) 검색 [${searchTerms.join(', ')}] ──`)

      // 대상 이름 위치 찾기 (모든 출현)
      const namePositions = []
      let ni = 0
      while ((ni = text.indexOf(t.name, ni)) !== -1) {
        namePositions.push(ni)
        ni += 1
      }
      console.log(`  "${t.name}" 출현 ${namePositions.length}회: ${namePositions.slice(0, 10).join(', ')}`)

      for (const term of searchTerms) {
        console.log(`\n  --- "${term}" 검색 ---`)
        let si = 0
        let count = 0
        while ((si = text.indexOf(term, si)) !== -1) {
          count++
          // 가장 가까운 대상 이름 위치 찾기
          const closestName = namePositions.reduce((best, pos) =>
            Math.abs(pos - si) < Math.abs(best - si) ? pos : best, namePositions[0] || 0)
          const dist = si - closestName

          if (Math.abs(dist) < 15000) {
            const start = Math.max(0, si - 200)
            const end = Math.min(text.length, si + 3000)
            const snippet = text.substring(start, end).replace(/\s+/g, ' ')
            console.log(`\n  #${count} (pos ${si}, "${t.name}"까지 거리: ${dist})`)
            console.log(`  ${snippet}`)
          }
          si += 1
        }
        if (count === 0) console.log(`  "${term}" 없음`)
      }
    }

    await page.close()
    await sleep(2000)
  }

  await browser.close()
  console.log('\n완료.')
}

main().catch(err => { console.error(err); process.exit(1) })
