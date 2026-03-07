#!/usr/bin/env node
/**
 * 나무위키 → DB EGO 기프트 동기화 스크립트
 *
 * 사용법:
 *   node --env-file=.env.local scripts/sync-ego-gifts.mjs [옵션]
 *
 * 옵션:
 *   --dry-run       비교만 (DB 수정 안 함, 기본값)
 *   --fix           불일치 발견 시 DB 자동 수정
 *   --verbose       상세 로그
 *   --keyword-only  전용 키워드만 동기화
 *
 * 추출 대상:
 *   - 이름, 키워드, 등급, 가격, 강화 여부, 첫 등장, 연관
 *   - 효과 (기본/+/++)
 *   - 조합식
 *   - 획득 조건 (테이블 뒤 텍스트에서 추출)
 *   - 전용 키워드 → keyword_meta 자동 upsert + 아이콘 다운로드/업로드
 */

import { readFileSync, writeFileSync } from 'node:fs'
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
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object`

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'limbus',
  'Content-Profile': 'limbus',
}

// ── CLI 인자 ──
const args = process.argv.slice(2)
const autoFix = args.includes('--fix')
const dryRun = !autoFix
const verbose = args.includes('--verbose')
const keywordOnly = args.includes('--keyword-only')

const WIKI_URL = 'https://namu.wiki/w/Limbus%20Company/%EA%B1%B0%EC%9A%B8%20%EB%8D%98%EC%A0%84/E.G.O%20%EA%B8%B0%ED%94%84%ED%8A%B8'


// ── Playwright 스크래핑 ──
async function scrapeWiki() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  console.log('나무위키 페이지 로딩...')
  await page.goto(WIKI_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)

  // 모든 details 펼치기
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach(d => { d.open = true })
  })
  await page.waitForTimeout(500)

  console.log('기프트 데이터 추출 중...')

  const data = await page.evaluate(() => {
    const tables = document.querySelectorAll('table')
    const gifts = []
    const keywords = []

    // ── 기프트 테이블 파싱 ──
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i]
      const hasDetailRow = [...t.rows].some(r =>
        r.cells[0]?.textContent?.trim() === '기프트 상세 정보'
      )
      if (!hasDetailRow) continue

      const gift = {}

      // Row 0: 헤더 (이미지 + 기본 정보)
      const leftCell = t.rows[0]?.cells[0]
      const rightCell = t.rows[0]?.cells[1]

      if (!rightCell) continue

      // 이름, 등급, 키워드, 가격 추출
      const strongs = [...rightCell.querySelectorAll('strong')]
      const gradeRoman = strongs[0]?.textContent?.trim() || ''
      gift.name = strongs[1]?.textContent?.trim() || ''
      const kwStrong = strongs[2]?.textContent?.trim() || ''
      const priceStr = strongs[3]?.textContent?.trim() || ''

      if (!gift.name) continue

      // 등급
      const romanMap = { 'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5' }
      gift.grade = romanMap[gradeRoman] || gradeRoman

      // 키워드 (strong 또는 이미지 alt에서)
      const kwImg = [...rightCell.querySelectorAll('img')].find(img =>
        img.alt?.startsWith('림버스컴퍼니') && !img.alt?.includes('코스트')
      )
      const kwFromAlt = kwImg?.alt?.replace(/^림버스컴퍼니\s+/, '').trim()
      gift.keyword = kwStrong || kwFromAlt || ''

      // 범용 → 공통
      if (gift.keyword === '범용') gift.keyword = '공통'

      // 가격
      gift.price = priceStr ? parseInt(priceStr) || null : null

      // 하드 난이도 한정 체크
      const fullHeaderText = rightCell.textContent || ''
      gift.buy_disabled = fullHeaderText.includes('하드 난이도 한정')

      // 기프트 이미지 (좌측 셀)
      if (leftCell) {
        const giftImgs = [...leftCell.querySelectorAll('img')].filter(img =>
          img.alt && !img.alt.includes('틀') && !img.alt.includes('UI') &&
          img.src?.startsWith('https://i.namu.wiki')
        )
        const giftImg = giftImgs.find(img => img.alt.includes(gift.name)) || giftImgs[giftImgs.length - 1]
        gift.wiki_image_url = giftImg?.src || null
      }

      // 나머지 행 파싱 (label → value)
      for (let r = 1; r < t.rows.length; r++) {
        const label = t.rows[r].cells[0]?.textContent?.trim()
        const valueCell = t.rows[r].cells[1] || t.rows[r].cells[0]

        switch (label) {
          case '연관':
            gift.related = valueCell.textContent?.trim() || null
            break

          case '등급': {
            const gradeNum = valueCell.textContent?.trim()
            if (gradeNum && !gift.grade) gift.grade = gradeNum
            // EX 등급 체크
            if (gradeNum === 'EX' || gradeNum?.includes('EX')) gift.grade = 'EX'
            break
          }

          case '첫 등장':
            gift.first_appearance = valueCell.textContent?.trim() || null
            break

          case '강화 여부':
            gift.enhancement = valueCell.textContent?.trim() === '가능'
            break

          case '효과': {
            // 효과 파싱: <ul><li> 구조 (기본/+/++)
            const lis = valueCell.querySelectorAll('li')
            if (lis.length > 0) {
              // 줄바꿈 보존하여 텍스트 추출
              const extractText = (el) => {
                let text = ''
                for (const node of el.childNodes) {
                  if (node.tagName === 'BR') {
                    text += '\n'
                  } else if (node.tagName === 'DIV') {
                    text += extractText(node)
                  } else if (node.tagName === 'STRONG') {
                    // 기본 효과, +, ++ 라벨은 건너뜀
                    const t = node.textContent?.trim()
                    if (t === '기본 효과' || t === '+' || t === '++') continue
                    text += node.textContent || ''
                  } else if (node.tagName === 'SPAN') {
                    const t = node.textContent?.trim()
                    if (t === '+' || t === '++') continue
                    text += node.textContent || ''
                  } else if (node.nodeType === 3) {
                    text += node.textContent || ''
                  } else if (node.tagName === 'IMG' || node.tagName === 'NOSCRIPT') {
                    // noscript/이미지 무시
                  } else if (node.childNodes?.length > 0) {
                    text += extractText(node)
                  }
                }
                return text
              }

              const effects = [...lis].map(li => extractText(li).trim())
              gift.effect_base = effects[0] || null
              gift.effect_plus = effects[1] || null
              gift.effect_plusplus = effects[2] || null
            } else {
              // 단일 효과 (강화 불가 기프트)
              const extractText = (el) => {
                let text = ''
                for (const node of el.childNodes) {
                  if (node.tagName === 'BR') text += '\n'
                  else if (node.tagName === 'IMG' || node.tagName === 'NOSCRIPT') continue
                  else if (node.tagName === 'DIV') text += extractText(node)
                  else if (node.nodeType === 3) text += node.textContent || ''
                  else if (node.childNodes?.length > 0) text += extractText(node)
                }
                return text
              }
              gift.effect_base = extractText(valueCell).trim() || null
              gift.effect_plus = null
              gift.effect_plusplus = null
            }
            break
          }

          case '조합식':
          case '조합식[특별]': {
            gift.is_synthesis = true
            gift.recipe_text = valueCell.textContent?.trim() || null
            break
          }
        }
      }

      if (!gift.is_synthesis) gift.is_synthesis = false
      if (!gift.enhancement) gift.enhancement = false

      // 테이블 뒤 텍스트 (설명/획득 조건)
      let nextEl = t.parentElement?.nextElementSibling || t.nextElementSibling
      const afterTexts = []
      let scanCount = 0
      while (nextEl && scanCount < 5) {
        if (nextEl.querySelector?.('table')) break
        const txt = nextEl.textContent?.trim()
        if (txt && txt.length > 5) {
          // 전용 키워드 섹션은 건너뜀
          if (!txt.startsWith('전용 키워드')) {
            afterTexts.push(txt)
          }
        }
        nextEl = nextEl.nextElementSibling
        scanCount++
      }

      const afterText = afterTexts.join('\n').trim()

      // 획득 조건 추출 — "이벤트에서...획득" 문장 추출
      gift.acquisition = null
      const acqText = afterText.replace(/\n/g, '')
      const evtIdx = acqText.lastIndexOf('이벤트에서')
      if (evtIdx > 0) {
        const acqEnd = acqText.indexOf('획득', evtIdx)
        if (acqEnd > 0) {
          // "이벤트에서" 앞쪽에서 문장 시작점 찾기
          // "로 시작하는 이벤트에서" 패턴이면 그 앞의 인용 이벤트명까지 포함
          const beforeEvt = acqText.slice(0, evtIdx)
          let sentStart = evtIdx

          // "~로 시작하는" 패턴 체크
          const startMatch = beforeEvt.match(/[""'\u201C\u201D\u2018\u2019][^""'\u201C\u201D\u2018\u2019]+[""'\u201C\u201D\u2018\u2019]\s*(?:으?로\s*시작하는\s*)?$/)
          if (startMatch) {
            sentStart = evtIdx - startMatch[0].length
          } else {
            // 이벤트명이 직접 (인용 없이) 나오는 경우: 직전 마침표 이후부터
            const lastDot = beforeEvt.lastIndexOf('.')
            sentStart = lastDot >= 0 ? lastDot + 1 : 0
          }

          // "획득" 이후 마침표까지 포함
          const endPos = acqText.indexOf('.', acqEnd)
          gift.acquisition = acqText.slice(sentStart, endPos > 0 ? endPos + 1 : acqEnd + 2).trim()
        }
      }

      gifts.push(gift)
    }

    // ── 전용 키워드 파싱 ──
    const kwDivs = document.querySelectorAll('div')
    for (const div of kwDivs) {
      const text = div.textContent?.trim()
      if (!text?.startsWith('전용 키워드')) continue
      if (text.length > 800) continue

      const kwTable = div.querySelector('table')
      if (!kwTable) continue

      // 키워드 이미지
      const kwImgs = [...div.querySelectorAll('img')].filter(i =>
        i.alt?.startsWith('림버스컴퍼니') && i.src?.startsWith('https://i.namu.wiki')
      )

      // 키워드 테이블 파싱
      const rows = kwTable.rows
      if (!rows || rows.length < 2) continue

      // 첫 행: 헤더 (키워드명 + 아이콘)
      const headerCell = rows[0]?.cells[0]
      if (!headerCell) continue

      const kwImg = kwImgs[0]
      const kwName = kwImg?.alt?.replace(/^림버스컴퍼니\s+/, '').replace(/\.\.\.$/, '').trim()

      if (!kwName) continue

      // 설명 추출 (2행 이하)
      const descParts = []
      for (let r = 1; r < rows.length; r++) {
        const cell = rows[r]?.cells[1] || rows[r]?.cells[0]
        if (!cell) continue

        // 줄바꿈 보존 (noscript/img 필터링)
        const extractClean = (el) => {
          let out = ''
          for (const node of el.childNodes) {
            if (node.tagName === 'BR') out += '\n'
            else if (node.tagName === 'NOSCRIPT' || node.tagName === 'IMG') continue
            else if (node.tagName === 'DIV' || node.tagName === 'SPAN' || node.tagName === 'P') {
              out += extractClean(node)
            } else if (node.nodeType === 3) out += node.textContent || ''
            else if (node.childNodes?.length > 0) out += extractClean(node)
          }
          return out
        }
        let cellText = extractClean(cell)
        const trimmed = cellText.trim()
        if (trimmed) descParts.push(trimmed)
      }

      // 전체 설명에서 "전용 키워드" 뒤의 텍스트를 파싱
      const fullText = text.replace(/^전용 키워드/, '').trim()
      // 이미지 태그 제거 후 줄바꿈으로 정리
      const descFromText = fullText.replace(kwName, '').trim()

      keywords.push({
        name: kwName,
        description: descParts.join('\n') || descFromText || null,
        icon_url: kwImg?.src || null,
      })
    }

    return { gifts, keywords }
  })

  await browser.close()
  return data
}

// ── DB 조회 ──
async function fetchDB(table, select = '*') {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=${select}`,
    { headers }
  )
  if (!res.ok) throw new Error(`DB fetch ${table}: ${await res.text()}`)
  return res.json()
}

// ── DB Upsert ──
async function upsertDB(table, rows) {
  const BATCH = 50
  let total = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: `return=minimal,resolution=merge-duplicates`,
      },
      body: JSON.stringify(batch),
    })
    if (!res.ok) {
      console.error(`  Upsert ${table} batch ${i} 실패:`, await res.text())
    } else {
      total += batch.length
    }
  }
  return total
}

// ── 키워드 아이콘 다운로드 + Storage 업로드 ──
async function uploadKeywordIcon(name, iconUrl) {
  if (!iconUrl) return null

  const slug = name
    .replace(/\s+/g, '_')
    .replace(/[^가-힣a-zA-Z0-9_-]/g, '')
    .toLowerCase()

  const storagePath = `limbus-assets/icons/keywords/${slug}.webp`

  // 이미 존재하는지 확인
  const checkRes = await fetch(`${STORAGE_BASE}/public/${storagePath}`, { method: 'HEAD' })
  if (checkRes.ok) {
    if (verbose) console.log(`  아이콘 이미 존재: ${slug}`)
    return slug
  }

  // 다운로드
  const imgRes = await fetch(iconUrl)
  if (!imgRes.ok) {
    console.error(`  아이콘 다운로드 실패: ${name}`)
    return null
  }
  const imgBuffer = await imgRes.arrayBuffer()

  // 업로드
  const uploadRes = await fetch(`${STORAGE_BASE}/${storagePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
    },
    body: imgBuffer,
  })

  if (!uploadRes.ok) {
    console.error(`  아이콘 업로드 실패: ${name}`, await uploadRes.text())
    return null
  }

  console.log(`  아이콘 업로드: ${slug}.webp`)
  return slug
}

// ── 비교 + 동기화 ──
async function sync(scraped) {
  const { gifts: wikiGifts, keywords: wikiKeywords } = scraped

  console.log(`\n위키에서 ${wikiGifts.length}개 기프트, ${wikiKeywords.length}개 전용 키워드 추출`)

  // DB 데이터 조회
  const dbGifts = await fetchDB('ego_gifts')
  const dbKeywords = await fetchDB('keyword_meta')

  const dbGiftMap = new Map(dbGifts.map(g => [g.name, g]))
  const dbKwMap = new Map(dbKeywords.map(k => [k.name, k]))

  // ── 키워드 비교 ──
  console.log('\n── 전용 키워드 ──')
  const newKeywords = []
  const updatedKeywords = []

  for (const wk of wikiKeywords) {
    const dbKw = dbKwMap.get(wk.name)
    if (!dbKw) {
      newKeywords.push(wk)
      console.log(`  [NEW] ${wk.name}`)
    } else if (wk.description && dbKw.description !== wk.description) {
      updatedKeywords.push(wk)
      if (verbose) {
        console.log(`  [UPD] ${wk.name}`)
        console.log(`    DB:   ${dbKw.description?.slice(0, 60)}...`)
        console.log(`    Wiki: ${wk.description?.slice(0, 60)}...`)
      }
    }
  }

  console.log(`  새 키워드: ${newKeywords.length}, 수정: ${updatedKeywords.length}`)

  // ── 기프트 비교 ──
  if (!keywordOnly) {
    console.log('\n── EGO 기프트 ──')
    const newGifts = []
    const updatedGifts = []
    const compareFields = [
      'keyword', 'grade', 'effect_base', 'effect_plus', 'effect_plusplus',
      'enhancement', 'first_appearance', 'related', 'is_synthesis', 'acquisition',
    ]

    for (const wg of wikiGifts) {
      const dbG = dbGiftMap.get(wg.name)
      if (!dbG) {
        newGifts.push(wg)
        console.log(`  [NEW] ${wg.name} (${wg.keyword} ${wg.grade})`)
      } else {
        const diffs = []
        for (const field of compareFields) {
          const wVal = wg[field] ?? null
          const dVal = dbG[field] ?? null
          if (String(wVal) !== String(dVal)) {
            diffs.push({ field, wiki: wVal, db: dVal })
          }
        }
        if (diffs.length > 0) {
          updatedGifts.push({ ...wg, id: dbG.id, diffs })
          if (verbose) {
            console.log(`  [UPD] ${wg.name}`)
            for (const d of diffs) {
              console.log(`    ${d.field}: "${String(d.db).slice(0, 40)}" → "${String(d.wiki).slice(0, 40)}"`)
            }
          }
        }
      }
    }

    // DB에만 있는 기프트 (위키에 없음)
    const wikiNames = new Set(wikiGifts.map(g => g.name))
    const onlyInDB = dbGifts.filter(g => !wikiNames.has(g.name))

    console.log(`  새 기프트: ${newGifts.length}`)
    console.log(`  수정 필요: ${updatedGifts.length}`)
    console.log(`  DB에만 있음: ${onlyInDB.length}`)
    if (onlyInDB.length > 0 && verbose) {
      for (const g of onlyInDB) console.log(`    [DB-ONLY] ${g.name}`)
    }

    // ── Fix 모드 ──
    if (autoFix) {
      console.log('\n── 수정 적용 ──')

      // 1) 키워드 아이콘 업로드 + keyword_meta upsert
      if (newKeywords.length > 0 || updatedKeywords.length > 0) {
        const allKw = [...newKeywords, ...updatedKeywords]
        for (const kw of allKw) {
          const slug = await uploadKeywordIcon(kw.name, kw.icon_url)
          const row = {
            name: kw.name,
            description: kw.description,
          }
          if (slug) row.icon_slug = slug

          const res = await fetch(`${SUPABASE_URL}/rest/v1/keyword_meta`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'return=minimal,resolution=merge-duplicates' },
            body: JSON.stringify(row),
          })
          if (!res.ok) console.error(`  keyword_meta upsert 실패: ${kw.name}`, await res.text())
          else console.log(`  keyword_meta: ${kw.name}`)
        }
      }

      // 2) 새 기프트 INSERT
      if (newGifts.length > 0) {
        const rows = newGifts.map(g => ({
          name: g.name,
          keyword: g.keyword,
          grade: g.grade,
          enhancement: g.enhancement,
          price: g.price,
          sell_price: null,
          buy_disabled: g.buy_disabled || false,
          effect_base: g.effect_base,
          effect_plus: g.effect_plus,
          effect_plusplus: g.effect_plusplus,
          is_synthesis: g.is_synthesis,
          first_appearance: g.first_appearance,
          related: g.related,
          acquisition: g.acquisition,
          image_url: null, // 이미지는 별도 처리 필요
        }))
        const cnt = await upsertDB('ego_gifts', rows, 'name')
        console.log(`  새 기프트 ${cnt}개 추가`)
      }

      // 3) 기존 기프트 UPDATE
      if (updatedGifts.length > 0) {
        for (const ug of updatedGifts) {
          const update = {}
          for (const d of ug.diffs) {
            update[d.field] = d.wiki
          }
          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/ego_gifts?id=eq.${ug.id}`,
            {
              method: 'PATCH',
              headers: { ...headers, Prefer: 'return=minimal' },
              body: JSON.stringify(update),
            }
          )
          if (!res.ok) console.error(`  기프트 업데이트 실패: ${ug.name}`, await res.text())
          else if (verbose) console.log(`  업데이트: ${ug.name}`)
        }
        console.log(`  기프트 ${updatedGifts.length}개 업데이트`)
      }
    } else {
      console.log('\n(dry-run 모드 — --fix 옵션으로 DB에 반영)')
    }
  }

  // 결과 JSON 저장
  const outPath = resolve(ROOT, 'scripts/ego-gifts-scraped.json')
  writeFileSync(outPath, JSON.stringify(wikiGifts, null, 2), 'utf-8')
  console.log(`\n스크래핑 결과 저장: ${outPath}`)
}

// ── 실행 ──
console.log(`\nEGO 기프트 동기화 (${dryRun ? 'dry-run' : 'fix'} 모드)\n`)

const scraped = await scrapeWiki()
await sync(scraped)

console.log('\n완료!')
