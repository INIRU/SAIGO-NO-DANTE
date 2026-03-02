#!/usr/bin/env node
/**
 * 나무위키 감사 스크립트 — DB 데이터를 나무위키와 비교하여 불일치 리포트 생성
 *
 * 사용법:
 *   node --env-file=.env.local scripts/audit-wiki-namu.mjs [--sinner yi-sang] [--fix]
 *
 * 옵션:
 *   --sinner <slug>  특정 수감자만 감사 (기본: 전체 12명)
 *   --fix            불일치 발견 시 DB 자동 수정
 *
 * 추출 대상:
 *   - HP, speed_min/max, def_level
 *   - 참격/관통/타격 내성
 *   - 패닉 유형 (공격/방어)
 *   - 정신력 증감 조건
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── .env.local 로드 ──────────────────────────────────────────────────────────
const envFile = readFileSync(resolve(ROOT, '.env.local'), 'utf-8')
const env = Object.fromEntries(
  envFile
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ── CLI 인자 파싱 ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const sinnerFilter = args.includes('--sinner') ? args[args.indexOf('--sinner') + 1] : null
const autoFix = args.includes('--fix')

// ── 수감자별 나무위키 URL ────────────────────────────────────────────────────
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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ── DOM 추출 함수 (page.evaluate 내부에서 실행) ──────────────────────────────
async function extractIdentityStats(page) {
  return await page.evaluate(() => {
    const results = []

    // details 요소 전부 펼침
    document.querySelectorAll('details').forEach(d => d.open = true)

    // 체력 아이콘으로 인격 섹션 찾기
    const hpImgs = document.querySelectorAll('img[alt="림버스 컴퍼니 체력"]')

    for (const hpImg of hpImgs) {
      try {
        const entry = {}

        // HP 추출
        const hpDiv = hpImg.closest('div[class]')
        if (hpDiv) {
          const clone = hpDiv.cloneNode(true)
          clone.querySelectorAll('img').forEach(img => img.remove())
          const hp = parseInt(clone.textContent.trim())
          if (!isNaN(hp)) entry.hp = hp
        }

        // 속도 추출
        const speedImg = hpImg.closest('table')?.querySelector('img[alt="림버스 컴퍼니 속도"]')
        if (speedImg) {
          const speedDiv = speedImg.closest('div[class]')
          if (speedDiv) {
            const clone = speedDiv.cloneNode(true)
            clone.querySelectorAll('img').forEach(img => img.remove())
            const m = clone.textContent.trim().match(/(\d+)\s*-\s*(\d+)/)
            if (m) {
              entry.speed_min = parseInt(m[1])
              entry.speed_max = parseInt(m[2])
            }
          }
        }

        // 방어 레벨 추출
        const defImg = hpImg.closest('table')?.querySelector('img[alt="림버스 컴퍼니 방어력"]')
        if (defImg) {
          const defDiv = defImg.closest('div[class]')
          if (defDiv) {
            const clone = defDiv.cloneNode(true)
            clone.querySelectorAll('img').forEach(img => img.remove())
            const m = clone.textContent.trim().match(/(\d+)/)
            if (m) entry.def_level = parseInt(m[1])
          }
        }

        // 내성 추출 (참격/관통/타격)
        let parent = hpImg.parentElement
        for (let i = 0; i < 12 && parent; i++) {
          const resImgs = parent.querySelectorAll('img[alt*="참격"], img[alt*="관통"], img[alt*="타격"]')
          if (resImgs.length >= 3) {
            for (const resImg of resImgs) {
              const resDiv = resImg.closest('div[class]')
              if (!resDiv) continue
              const clone = resDiv.cloneNode(true)
              clone.querySelectorAll('img').forEach(img => img.remove())
              const text = clone.textContent.trim()
              const resValue = text.match(/(취약|내성|보통)/)
              if (resValue) {
                if (resImg.alt.includes('참격')) entry.slash_res = resValue[1]
                else if (resImg.alt.includes('관통')) entry.pierce_res = resValue[1]
                else if (resImg.alt.includes('타격')) entry.blunt_res = resValue[1]
              }
            }
            break
          }
          parent = parent.parentElement
        }

        // 인격 이름 추출 (가장 가까운 제목 요소)
        let heading = hpImg.closest('div')
        for (let i = 0; i < 20 && heading; i++) {
          const prev = heading.previousElementSibling
          if (prev && (prev.tagName === 'H2' || prev.tagName === 'H3' || prev.tagName === 'H4')) {
            entry.name = prev.textContent.trim().replace(/\[편집\]/g, '').trim()
            break
          }
          heading = heading.parentElement
        }

        if (entry.hp || entry.speed_min || entry.def_level) {
          results.push(entry)
        }
      } catch {
        // 개별 인격 추출 실패 시 건너뜀
      }
    }

    return results
  })
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  나무위키 감사 스크립트                        ║')
  console.log('║  DB ↔ 나무위키 데이터 비교                     ║')
  console.log('╚══════════════════════════════════════════════╝\n')

  const sinners = sinnerFilter ? [sinnerFilter] : Object.keys(WIKI_URLS)
  const allDiffs = []

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  })

  for (const sinnerId of sinners) {
    const url = WIKI_URLS[sinnerId]
    if (!url) {
      console.warn(`⚠ ${sinnerId}: URL 없음, 건너뜀`)
      continue
    }

    console.log(`\n─── ${sinnerId} ───`)
    console.log(`  URL: ${url}`)

    // DB에서 현재 인격 조회
    const { data: dbIdentities, error } = await supabase
      .schema('limbus')
      .from('identities')
      .select('id, name_kr, hp, speed_min, speed_max, def_level, slash_res, pierce_res, blunt_res, panic_type, sanity_increase, sanity_decrease')
      .eq('sinner_id', sinnerId)

    if (error) {
      console.error(`  DB 조회 실패: ${error.message}`)
      continue
    }

    console.log(`  DB 인격: ${dbIdentities.length}개`)

    // 나무위키 페이지 스크래핑
    const page = await context.newPage()
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await sleep(2000)

      // details 요소 펼침
      await page.evaluate(() => {
        document.querySelectorAll('details').forEach(d => d.open = true)
      })
      await sleep(1000)

      const wikiStats = await extractIdentityStats(page)
      console.log(`  위키 추출: ${wikiStats.length}개 인격 스탯`)

      // DB 인격과 위키 데이터 매칭 및 비교
      for (const dbIdent of dbIdentities) {
        const wikiMatch = wikiStats.find(w => w.name && dbIdent.name_kr && w.name.includes(dbIdent.name_kr))

        if (!wikiMatch) {
          console.log(`  ⚠ ${dbIdent.name_kr}: 위키에서 매칭 실패`)
          continue
        }

        const diffs = []
        const fields = ['hp', 'speed_min', 'speed_max', 'def_level', 'slash_res', 'pierce_res', 'blunt_res']
        for (const field of fields) {
          if (wikiMatch[field] != null && String(dbIdent[field]) !== String(wikiMatch[field])) {
            diffs.push({ field, db: dbIdent[field], wiki: wikiMatch[field] })
          }
        }

        if (diffs.length > 0) {
          console.log(`  ✗ ${dbIdent.name_kr}:`)
          for (const d of diffs) {
            console.log(`      ${d.field}: DB=${d.db} → 위키=${d.wiki}`)
          }
          allDiffs.push({ sinnerId, identityId: dbIdent.id, name: dbIdent.name_kr, diffs })

          if (autoFix) {
            const updates = {}
            for (const d of diffs) updates[d.field] = d.wiki
            const { error: updateErr } = await supabase
              .schema('limbus')
              .from('identities')
              .update(updates)
              .eq('id', dbIdent.id)
            if (updateErr) {
              console.log(`      → 수정 실패: ${updateErr.message}`)
            } else {
              console.log(`      → 수정 완료`)
            }
          }
        } else {
          console.log(`  ✓ ${dbIdent.name_kr}: 일치`)
        }
      }
    } catch (err) {
      console.error(`  페이지 로드 실패: ${err.message}`)
    } finally {
      await page.close()
    }

    await sleep(1500) // 나무위키 rate limit 방지
  }

  await browser.close()

  // 결과 요약
  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║  감사 결과                                    ║')
  console.log('╠══════════════════════════════════════════════╣')
  console.log(`║  불일치 인격: ${String(allDiffs.length).padStart(4)}                              ║`)
  if (autoFix) {
    console.log('║  → --fix 모드: 자동 수정 적용됨               ║')
  } else if (allDiffs.length > 0) {
    console.log('║  → --fix 플래그로 자동 수정 가능               ║')
  }
  console.log('╚══════════════════════════════════════════════╝')

  // 수정 SQL 출력 (--fix 아닐 때)
  if (allDiffs.length > 0 && !autoFix) {
    console.log('\n── 수정 SQL ──')
    for (const { identityId, name, diffs } of allDiffs) {
      const sets = diffs.map(d => `${d.field} = '${d.wiki}'`).join(', ')
      console.log(`UPDATE limbus.identities SET ${sets} WHERE id = '${identityId}'; -- ${name}`)
    }
  }
}

main().catch(err => {
  console.error('\n치명적 오류:', err)
  process.exit(1)
})
