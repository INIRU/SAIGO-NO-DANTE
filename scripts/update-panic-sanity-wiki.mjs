#!/usr/bin/env node
/**
 * 나무위키에서 패닉 유형 + 정신력 증감 조건 추출 → DB 업데이트
 *
 * 사용법:
 *   node --env-file=.env.local scripts/update-panic-sanity-wiki.mjs [--sinner yi-sang] [--dry-run]
 *
 * 추출 대상:
 *   - panic_type: 패닉 유형 라벨 (STRONG 텍스트, 예: "패닉")
 *   - panic_description: 패닉 설명 (BR 뒤 텍스트, 예: "한 턴 동안 행동하지 않음")
 *   - sanity_increase: 정신력 증가 조건 텍스트
 *   - sanity_decrease: 정신력 감소 조건 텍스트
 *
 * 나무위키 DOM 구조:
 *   STRONG "패닉 유형" → parent.parent.children[2]:
 *     [IMG 림버스컴퍼니 정신력 패닉] STRONG "패닉" <BR> "한 턴 동안 행동하지 않음"
 *   STRONG "정신력 증가 조건" → parent.parent.textContent (헤더 제거)
 *   STRONG "정신력 감소 조건" → parent.parent.textContent (헤더 제거)
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ── .env.local 로드 ──
const ROOT = process.cwd()
const envFile = readFileSync(resolve(ROOT, '.env.local'), 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const idx = l.indexOf('=')
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
  })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'limbus',
  'Content-Profile': 'limbus',
}

// ── CLI 인자 ──
const args = process.argv.slice(2)
const sinnerFilter = args.includes('--sinner') ? args[args.indexOf('--sinner') + 1] : null
const dryRun = args.includes('--dry-run')

// ── 수감자별 나무위키 URL ──
const WIKI_URLS = {
  'yi-sang':     'https://namu.wiki/w/이상(Project%20Moon%20세계관)/인게임%20정보',
  'faust':       'https://namu.wiki/w/파우스트(Project%20Moon%20세계관)/인게임%20정보',
  'don-quixote': 'https://namu.wiki/w/돈키호테(Project%20Moon%20세계관)/인게임%20정보',
  'ryoshu':      'https://namu.wiki/w/료슈/인게임%20정보',
  'meursault':   'https://namu.wiki/w/뫼르소/인게임%20정보',
  'hong-lu':     'https://namu.wiki/w/홍루/인게임%20정보',
  'heathcliff':  'https://namu.wiki/w/히스클리프(Project%20Moon%20세계관)/인게임%20정보',
  'ishmael':     'https://namu.wiki/w/이스마엘(Project%20Moon%20세계관)/인게임%20정보',
  'rodion':      'https://namu.wiki/w/로쟈(Project%20Moon%20세계관)/인게임%20정보',
  'sinclair':    'https://namu.wiki/w/싱클레어(Project%20Moon%20세계관)/인게임%20정보',
  'outis':       'https://namu.wiki/w/오티스(Project%20Moon%20세계관)/인게임%20정보',
  'gregor':      'https://namu.wiki/w/그레고르(Project%20Moon%20세계관)/인게임%20정보',
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── 이름 정규화 (위키 ↔ DB 매칭용) ──
function normalize(s) {
  return s
    .normalize('NFKC')
    .replace(/【/g, '[').replace(/】/g, ']')
    .replace(/…/g, '...')
    .replace(/[.!?,，。！？]/g, '')
    .replace(/\s+/g, '')
    .replace(/:/g, '')
    .toLowerCase()
}

// ── 페이지에서 인격별 패닉/정신력 데이터 추출 ──
async function extractPanicSanity(page) {
  return await page.evaluate(() => {
    // details 펼침
    document.querySelectorAll('details').forEach(d => d.open = true)

    // 코인 효과 키워드 (인격명이 아님)
    const COIN_KEYWORDS = ['적중', '앞면', '뒷면', '코인', '크리티컬']

    const results = []
    let currentIdentity = null
    let currentData = null
    let inEgoSection = false

    // TreeWalker로 document order 순회
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)

    while (walker.nextNode()) {
      const node = walker.currentNode

      // H2/H3/H4 — EGO 섹션 감지
      if (['H2', 'H3', 'H4'].includes(node.tagName)) {
        const headText = node.textContent.trim()
        if (/E\.?G\.?O/i.test(headText) && !headText.includes('E.G.O::')) {
          inEgoSection = true
        } else if (/^\d+\.\d+\.\d+\./.test(headText)) {
          inEgoSection = false
        }
      }

      if (node.tagName !== 'STRONG') continue
      const text = node.textContent.trim()

      // 인격 이름: "[ XXX ] 수감자명" 패턴
      const identMatch = text.match(/^\[\s*(.+?)\s*\]\s+(.+)/)
      if (identMatch) {
        const name = identMatch[1].trim()

        // 코인 효과 패턴 필터
        if (COIN_KEYWORDS.some(k => name.includes(k))) continue

        // EGO 섹션 내 스킵
        if (inEgoSection) continue

        // 이전 인격 데이터 저장
        if (currentData && currentIdentity && (currentData.panicType || currentData.sanityIncrease || currentData.sanityDecrease)) {
          results.push({ identity: currentIdentity, ...currentData })
        }
        currentIdentity = name
        currentData = {}
        continue
      }

      // 대괄호만 있는 패턴 스킵
      if (text.startsWith('[')) continue

      // ── 패닉 유형 ──
      // DOM 구조: STRONG "패닉 유형" → parent.parent 3번째 자식 →
      //   [IMG 패닉아이콘] STRONG "패닉" <BR> "한 턴 동안 행동하지 않음"
      if (text === '패닉 유형' && currentIdentity) {
        const parentDiv = node.parentElement?.parentElement
        if (!parentDiv) continue
        const dataDiv = parentDiv.children[2]
        if (!dataDiv) continue

        // STRONG 요소에서 패닉 유형 라벨 추출
        const innerStrong = dataDiv.querySelector('strong')
        if (innerStrong) {
          currentData.panicType = innerStrong.textContent.trim()
        }

        // BR 뒤 요소에서 패닉 설명 추출
        // 구조: SPAN(이미지) → SPAN(패닉 라벨) → BR → DIV(설명 텍스트)
        const br = dataDiv.querySelector('br')
        if (br && br.nextElementSibling) {
          const descText = br.nextElementSibling.textContent.trim()
          if (descText) {
            currentData.panicDesc = descText
          }
        }
        continue
      }

      // ── 정신력 증가 조건 ──
      if (text === '정신력 증가 조건' && currentIdentity) {
        const parentDiv = node.parentElement?.parentElement
        if (!parentDiv) continue
        // children[2] = 데이터 셀만 (해설 details 제외)
        const dataDiv = parentDiv.children[2]
        if (!dataDiv) continue

        const clone = dataDiv.cloneNode(true)
        clone.querySelectorAll('img, noscript, details').forEach(n => n.remove())
        let fullText = clone.textContent.trim()

        // 줄바꿈 정리
        fullText = fullText
          .replace(/(적 처치 시)/g, '\n$1')
          .replace(/(아군이 처치)/g, '\n$1')
          .replace(/(합 패배 시)/g, '\n$1')
          .replace(/(피격 시)/g, '\n$1')
          .trim()

        if (fullText) {
          currentData.sanityIncrease = fullText
        }
        continue
      }

      // ── 정신력 감소 조건 ──
      if (text === '정신력 감소 조건' && currentIdentity) {
        const parentDiv = node.parentElement?.parentElement
        if (!parentDiv) continue
        // children[2] = 데이터 셀만 (해설 details 제외)
        const dataDiv = parentDiv.children[2]
        if (!dataDiv) continue

        const clone = dataDiv.cloneNode(true)
        clone.querySelectorAll('img, noscript, details').forEach(n => n.remove())
        let fullText = clone.textContent.trim()

        // 줄바꿈 정리
        fullText = fullText
          .replace(/(합 승리 시)/g, '\n$1')
          .replace(/(합 패배 시)/g, '\n$1')
          .replace(/(적 처치 시)/g, '\n$1')
          .replace(/(아군 사망 시)/g, '\n$1')
          .replace(/(피격 시)/g, '\n$1')
          .trim()

        if (fullText) {
          currentData.sanityDecrease = fullText
        }
        continue
      }
    }

    // 마지막 인격 저장
    if (currentData && currentIdentity && (currentData.panicType || currentData.sanityIncrease || currentData.sanityDecrease)) {
      results.push({ identity: currentIdentity, ...currentData })
    }

    return results
  })
}

// ── Supabase 헬퍼 ──
async function supaGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers })
  if (!res.ok) throw new Error(`GET ${table}: ${res.status}`)
  return res.json()
}

async function supaPatch(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`PATCH ${table}/${id}: ${res.status} ${await res.text()}`)
}

// ── 메인 ──
async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  나무위키 → 패닉 유형 + 정신력 증감 조건 업데이트   ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  if (dryRun) console.log('DRY RUN 모드 — 실제 DB 수정 없음\n')

  // Playwright import
  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    const pwPath = resolve(ROOT, 'node_modules/playwright/index.mjs')
    ;({ chromium } = await import(pwPath))
  }

  const sinners = sinnerFilter ? [sinnerFilter] : Object.keys(WIKI_URLS)
  let totalUpdated = 0
  let totalSkipped = 0
  let totalNotFound = 0

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  })

  for (const sinnerId of sinners) {
    const url = WIKI_URLS[sinnerId]
    if (!url) { console.warn(`${sinnerId}: URL 없음`); continue }

    console.log(`\n─── ${sinnerId} ───`)

    // DB에서 해당 수감자의 인격 조회
    const identities = await supaGet('identities',
      `sinner_id=eq.${sinnerId}&select=id,name_kr,panic_type,panic_description,sanity_increase,sanity_decrease`
    )
    console.log(`  DB: ${identities.length} 인격`)

    // 인격명 → identity 매핑
    const identMap = {}
    for (const i of identities) identMap[i.name_kr] = i

    // 나무위키 스크래핑
    const page = await context.newPage()
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await sleep(2000)
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true))
      await sleep(1000)

      const wikiData = await extractPanicSanity(page)
      console.log(`  위키: ${wikiData.length} 인격 추출`)

      for (const wd of wikiData) {
        if (!wd.identity) continue

        // 인격 매칭 (정확 → 정규화)
        let dbIdent = identMap[wd.identity]
        if (!dbIdent) {
          const wikiNorm = normalize(wd.identity)
          const match = Object.entries(identMap).find(([k]) => normalize(k) === wikiNorm)
          if (match) dbIdent = match[1]
        }
        if (!dbIdent) {
          console.log(`  !! 인격 매칭 실패: "${wd.identity}"`)
          totalNotFound++
          continue
        }

        // 변경사항 확인
        const updates = {}
        let changed = false

        if (wd.panicType && dbIdent.panic_type !== wd.panicType) {
          updates.panic_type = wd.panicType
          changed = true
        }

        if (wd.panicDesc && dbIdent.panic_description !== wd.panicDesc) {
          updates.panic_description = wd.panicDesc
          changed = true
        }

        if (wd.sanityIncrease && dbIdent.sanity_increase !== wd.sanityIncrease) {
          updates.sanity_increase = wd.sanityIncrease
          changed = true
        }

        if (wd.sanityDecrease && dbIdent.sanity_decrease !== wd.sanityDecrease) {
          updates.sanity_decrease = wd.sanityDecrease
          changed = true
        }

        if (changed) {
          const details = []
          if (updates.panic_type) details.push(`유형=${updates.panic_type}`)
          if (updates.panic_description) details.push(`설명=${updates.panic_description}`)
          if (updates.sanity_increase) details.push(`증가=${updates.sanity_increase.substring(0, 30)}...`)
          if (updates.sanity_decrease) details.push(`감소=${updates.sanity_decrease.substring(0, 30)}...`)

          if (dryRun) {
            console.log(`  >> ${wd.identity}: ${details.join(', ')}`)
          } else {
            await supaPatch('identities', dbIdent.id, updates)
            console.log(`  OK ${wd.identity}: ${details.join(', ')}`)
          }
          totalUpdated++
        } else {
          totalSkipped++
        }
      }
    } catch (err) {
      console.error(`  XX 페이지 로드 실패: ${err.message}`)
    } finally {
      await page.close()
    }

    await sleep(1500) // rate limit
  }

  await browser.close()

  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log(`║  결과: 업데이트 ${totalUpdated} / 스킵 ${totalSkipped} / 매칭실패 ${totalNotFound}`)
  console.log('╚══════════════════════════════════════════════════╝')
}

main().catch(err => { console.error('\n치명적 오류:', err); process.exit(1) })
