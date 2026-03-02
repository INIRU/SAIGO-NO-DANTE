#!/usr/bin/env node
/**
 * sync-ego-wiki.mjs
 * 나무위키에서 EGO 데이터(스킬, 패시브, 내성, 코스트 등) 추출 → DB 업데이트
 *
 * 사용법:
 *   node --env-file=.env.local scripts/sync-ego-wiki.mjs [--sinner yi-sang] [--dry-run]
 *
 * 추출 대상 (DB limbus.ego 컬럼):
 *   - grade           — EGO 등급 (ZAYIN/TETH/HE/WAW/ALEPH)
 *   - sin_affinity    — 죄악 속성
 *   - resistance      — TEXT[7] 내성 [분노,색욕,나태,탐식,우울,오만,질투]
 *   - cost            — INT[7] 코스트
 *   - ego_skills      — JSONB 각성 스킬 배열
 *   - ego_cor_skills   — JSONB 침식 스킬 배열
 *   - passive_name    — 패시브 이름
 *   - passive_content — 패시브 효과 설명
 *   - keywords        — TEXT[] 키워드
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

// ── 페이지에서 EGO 데이터 추출 ──
async function extractEgoData(page) {
  return await page.evaluate(() => {
    // details 펼침
    document.querySelectorAll('details').forEach(d => d.open = true)

    // ── 상수 ──
    const SIN_ALT_MAP = {
      '림버스분노UI': '분노', '림버스색욕UI': '색욕', '림버스나태UI': '나태',
      '림버스탐식UI': '탐식', '림버스우울UI': '우울', '림버스오만UI': '오만',
      '림버스질투UI': '질투',
    }
    const SIN_ORDER = ['분노', '색욕', '나태', '탐식', '우울', '오만', '질투']
    const ATK_ALT_MAP = {
      '참격': 'slash', '관통': 'pierce', '타격': 'blunt',
    }
    const GRADE_MAP = { 'ZAYIN': 'ZAYIN', 'TETH': 'TETH', 'HE': 'HE', 'WAW': 'WAW', 'ALEPH': 'ALEPH' }

    // 테이블/섹션 라벨 (스킬명 아님)
    const TABLE_LABELS = new Set([
      '공격 유형', '죄악 속성', '스킬 수량', '스킬 위력', '코인 위력',
      '공격 가중치', '수비 유형', '가중치',
    ])
    const SECTION_LABELS = new Set([
      '스테이터스', '내성 정보', '기본 정보', '인격 동기화', '흐트러짐 구간',
      '전투 패시브', '서포트 패시브', '4동기화 시 변경점',
      '패닉 유형', '정신력 증가 조건', '정신력 감소 조건',
    ])

    // ── 유틸리티 ──
    function extractSinFromAlt(alt) {
      if (!alt) return null
      for (const [key, val] of Object.entries(SIN_ALT_MAP)) {
        if (alt.includes(key.replace('림버스', '').replace('UI', '')) && alt.includes('림버스')) return val
        if (alt === key) return val
      }
      // 패턴: 림버스{죄악}UI
      const m = alt.match(/림버스(.+?)UI/)
      return m ? (SIN_ALT_MAP[`림버스${m[1]}UI`] ?? m[1]) : null
    }

    function extractAtkType(alt) {
      if (!alt) return null
      for (const [kr, en] of Object.entries(ATK_ALT_MAP)) {
        if (alt.includes(kr)) return en
      }
      return null
    }

    function getCleanText(el) {
      if (!el) return ''
      const clone = el.cloneNode(true)
      clone.querySelectorAll('img, noscript, script, style').forEach(n => n.remove())
      return clone.textContent.trim().replace(/<img[^>]*>/g, '')
    }

    // ── 내성 추출: 7죄악 내성값 반환 ──
    function extractResistance(container) {
      const res = new Array(7).fill('보통')
      // 죄악 이미지들 찾기
      const imgs = container.querySelectorAll('img')
      for (const img of imgs) {
        const alt = img.getAttribute('alt') || ''
        const sin = extractSinFromAlt(alt)
        if (!sin) continue
        const idx = SIN_ORDER.indexOf(sin)
        if (idx === -1) continue

        // 이미지 부모에서 내성값 텍스트 추출
        let parent = img.parentElement
        for (let depth = 0; depth < 5 && parent; depth++) {
          const text = getCleanText(parent)
          const match = text.match(/(취약|보통|내성|견딤)/)
          if (match) {
            res[idx] = match[1]
            break
          }
          parent = parent.parentElement
        }
      }
      return res
    }

    // ── 코스트 추출: 7죄악 코스트값 반환 ──
    function extractCost(container) {
      const cost = new Array(7).fill(0)
      const imgs = container.querySelectorAll('img')
      for (const img of imgs) {
        const alt = img.getAttribute('alt') || ''
        const sin = extractSinFromAlt(alt)
        if (!sin) continue
        const idx = SIN_ORDER.indexOf(sin)
        if (idx === -1) continue

        // 이미지 인접한 STRONG이나 텍스트에서 숫자 추출
        let parent = img.parentElement
        for (let depth = 0; depth < 4 && parent; depth++) {
          const strongs = parent.querySelectorAll('strong')
          for (const s of strongs) {
            const num = parseInt(s.textContent.trim())
            if (!isNaN(num) && num > 0 && num < 20) {
              cost[idx] = num
              break
            }
          }
          if (cost[idx] > 0) break
          // STRONG이 없으면 텍스트에서 찾기
          const text = getCleanText(parent)
          const m = text.match(/(\d+)/)
          if (m) {
            const num = parseInt(m[1])
            if (num > 0 && num < 20) { cost[idx] = num; break }
          }
          parent = parent.parentElement
        }
      }
      return cost
    }

    // ── 스킬 테이블 파싱 ──
    function parseSkillTable(table) {
      const rows = table.querySelectorAll('tr')
      if (rows.length < 4) return null

      const result = { atkType: null, resource: null, skillPower: 0, coinPower: 0, atkWeight: 1 }
      for (const row of rows) {
        const cells = row.querySelectorAll('td, th')
        if (cells.length < 2) continue
        const label = getCleanText(cells[0]).trim()
        const valCell = cells[cells.length - 1]

        if (label === '공격 유형' || label === '수비 유형') {
          const img = valCell.querySelector('img')
          if (img) result.atkType = extractAtkType(img.getAttribute('alt'))
        } else if (label === '죄악 속성') {
          const img = valCell.querySelector('img')
          if (img) result.resource = extractSinFromAlt(img.getAttribute('alt'))
        } else if (label === '스킬 위력') {
          result.skillPower = parseInt(getCleanText(valCell)) || 0
        } else if (label === '코인 위력') {
          const txt = getCleanText(valCell).replace('+', '')
          result.coinPower = parseInt(txt) || 0
        } else if (label === '공격 가중치' || label === '가중치') {
          result.atkWeight = parseInt(getCleanText(valCell)) || 1
        }
      }
      return result
    }

    // ── 코인 효과 추출 (DETAILS 내부) ──
    function parseCoinEffects(detailsEl) {
      if (!detailsEl) return { normalEffect: '', coins: {} }
      const coins = {}
      let normalEffect = ''

      // TreeWalker로 순회
      const walker = document.createTreeWalker(detailsEl, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
      let currentCoin = 0
      let collecting = []

      while (walker.nextNode()) {
        const node = walker.currentNode

        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node
          if (el.tagName === 'IMG') {
            const alt = el.getAttribute('alt') || ''
            // 코인 번호 마커: 림버스컴퍼니 N
            const coinMatch = alt.match(/림버스컴퍼니\s*(\d)/)
            if (coinMatch) {
              // 이전 코인 저장
              if (currentCoin > 0 && collecting.length > 0) {
                coins[currentCoin] = collecting.join('').trim()
              }
              currentCoin = parseInt(coinMatch[1])
              collecting = []
              continue
            }
            // 코인값 이미지 (숫자 카운트용으로 쓸 수 있지만 스킵)
            if (alt.includes('코인값') || alt.includes('코인')) continue
          }
        }

        if (node.nodeType === Node.TEXT_NODE && currentCoin > 0) {
          const txt = node.textContent.trim()
          // 섹션 헤더 스킵
          if (txt.match(/^\[스킬\s*\d\]\s*코인/)) continue
          if (txt) collecting.push(txt)
        }
      }

      // 마지막 코인 저장
      if (currentCoin > 0 && collecting.length > 0) {
        coins[currentCoin] = collecting.join('').trim()
      }

      // normalEffect: 코인 마커 전의 텍스트 (있으면)
      // details 안에서 첫 코인 마커 전 텍스트
      const allText = getCleanText(detailsEl)
      const firstCoinIdx = allText.search(/\[스킬\s*\d\]/)
      if (firstCoinIdx > 0) {
        normalEffect = allText.substring(0, firstCoinIdx).trim()
        // summary 텍스트 제거
        normalEffect = normalEffect.replace(/\[\s*코인별\s*효과\s*\]/, '').trim()
      }

      return { normalEffect, coins }
    }

    // ── 메인 파싱: TreeWalker로 EGO 섹션 순회 ──
    const results = []
    let inEgoSection = false
    let currentGrade = null
    let currentEgo = null
    let currentState = null // 'resistance' | 'awaken' | 'corrosion' | 'passive' | 'cost' | 'mentalconsume' | 'atklevel'

    // EGO 스킬 수집 상태
    let skillCollecting = null // 'awaken' | 'corrosion'
    let currentSkillName = null
    let skillOccurrences = {} // 같은 이름 등장 횟수 (4해석=1번째, 3해석=2번째)

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)

    function flushEgo() {
      if (currentEgo && currentEgo.name) {
        results.push({ ...currentEgo })
      }
    }

    function initEgo(name) {
      return {
        name,
        grade: currentGrade,
        sinAffinity: null,
        resistance: new Array(7).fill('보통'),
        cost: new Array(7).fill(0),
        egoSkills: [],
        egoCorSkills: [],
        passiveName: null,
        passiveContent: null,
        keywords: [],
        mentalConsume: [0, 0], // [각성, 침식]
        atkLevel: null,
      }
    }

    while (walker.nextNode()) {
      const node = walker.currentNode

      // ── H2: EGO 섹션 감지 ──
      if (node.tagName === 'H2') {
        const h2Text = node.textContent.trim()
        if (/E\.?G\.?O/i.test(h2Text) && !h2Text.includes('E.G.O::')) {
          inEgoSection = true
        } else if (inEgoSection) {
          // EGO 섹션 종료
          flushEgo()
          inEgoSection = false
        }
        continue
      }

      if (!inEgoSection) continue

      // ── H3: 등급 ──
      if (node.tagName === 'H3') {
        const h3Text = node.textContent.trim()
        for (const [grade] of Object.entries(GRADE_MAP)) {
          if (h3Text.includes(grade)) {
            currentGrade = grade
            break
          }
        }
        continue
      }

      // ── H4: 개별 EGO 시작 ──
      if (node.tagName === 'H4') {
        flushEgo()
        currentEgo = null
        currentState = null
        skillCollecting = null
        currentSkillName = null
        skillOccurrences = {}
        continue
      }

      // ── STRONG 요소 처리 ──
      if (node.tagName === 'STRONG') {
        const text = node.textContent.trim()

        // EGO 이름: "[ EGO명 ] 수감자명"
        const egoMatch = text.match(/^\[\s*(.+?)\s*\]\s+(.+)/)
        if (egoMatch) {
          const name = egoMatch[1].trim()
          // 코인 효과 패턴 필터
          const COIN_KW = ['적중', '앞면', '뒷면', '코인', '크리티컬']
          if (COIN_KW.some(k => name.includes(k))) continue

          flushEgo()
          currentEgo = initEgo(name)
          currentState = null
          skillCollecting = null
          skillOccurrences = {}
          continue
        }

        if (!currentEgo) continue

        // ── 섹션 감지 ──
        if (text === '내성 정보') {
          currentState = 'resistance'
          skillCollecting = null
          // 부모 컨테이너에서 내성 추출
          const container = node.parentElement?.parentElement
          if (container) {
            currentEgo.resistance = extractResistance(container)
          }
          continue
        }

        if (text === '각성 스킬') {
          currentState = 'awaken'
          skillCollecting = 'awaken'
          currentSkillName = null
          continue
        }

        if (text === '침식 스킬') {
          currentState = 'corrosion'
          skillCollecting = 'corrosion'
          currentSkillName = null
          continue
        }

        if (text === '패시브') {
          currentState = 'passive'
          skillCollecting = null
          continue
        }

        if (text === '공격 레벨') {
          currentState = 'atklevel'
          skillCollecting = null
          const parentDiv = node.parentElement?.parentElement
          if (parentDiv) {
            const dataDiv = parentDiv.children[2]
            if (dataDiv) {
              const num = parseInt(getCleanText(dataDiv))
              if (!isNaN(num)) currentEgo.atkLevel = num
            }
          }
          continue
        }

        if (text === '정신 소모량') {
          currentState = 'mentalconsume'
          skillCollecting = null
          const parentDiv = node.parentElement?.parentElement
          if (parentDiv) {
            const dataDiv = parentDiv.children[2]
            if (dataDiv) {
              const txt = getCleanText(dataDiv)
              const nums = txt.match(/(\d+)/g)
              if (nums && nums.length >= 2) {
                currentEgo.mentalConsume = [parseInt(nums[0]), parseInt(nums[1])]
              } else if (nums && nums.length === 1) {
                currentEgo.mentalConsume = [parseInt(nums[0]), parseInt(nums[0])]
              }
            }
          }
          continue
        }

        if (text === '코스트') {
          currentState = 'cost'
          skillCollecting = null
          const container = node.parentElement?.parentElement
          if (container) {
            currentEgo.cost = extractCost(container)
          }
          continue
        }

        if (text === '기본 정보') {
          currentState = 'basic'
          skillCollecting = null
          continue
        }

        // ── 패시브명 (패시브 상태에서 처음 만나는 비라벨 STRONG) ──
        if (currentState === 'passive' && !currentEgo.passiveName) {
          if (!SECTION_LABELS.has(text) && !TABLE_LABELS.has(text) && !text.startsWith('[')) {
            currentEgo.passiveName = text
            // 패시브 효과: 같은 부모의 텍스트
            const parentDiv = node.parentElement?.parentElement
            if (parentDiv) {
              const clone = parentDiv.cloneNode(true)
              clone.querySelectorAll('img, noscript, style, script').forEach(n => n.remove())
              // 패시브명 텍스트 제거
              let fullText = clone.textContent.trim()
              fullText = fullText.replace(text, '').trim()
              // 죄악 조건 텍스트 정리
              fullText = fullText
                .replace(/^\s*[×x]\s*\d+\s*/, '')
                .replace(/^(보유|공명)\s*/, '')
                .trim()
              if (fullText) currentEgo.passiveContent = fullText
            }
            continue
          }
        }

        // ── 스킬명 감지 (각성/침식 스킬 수집 중) ──
        if (skillCollecting && !SECTION_LABELS.has(text) && !TABLE_LABELS.has(text) && !text.startsWith('[')) {
          // 다른 섹션 키워드면 스킬 수집 종료
          if (['패시브', '공격 레벨', '정신 소모량', '코스트', '기본 정보', '내성 정보'].includes(text)) {
            skillCollecting = null
            continue
          }

          currentSkillName = text
          if (!skillOccurrences[text]) skillOccurrences[text] = 0
          skillOccurrences[text]++
          continue
        }

        continue
      }

      // ── TABLE: 스킬 스탯 테이블 ──
      if (node.tagName === 'TABLE' && skillCollecting && currentSkillName && currentEgo) {
        const tableData = parseSkillTable(node)
        if (!tableData || tableData.skillPower === 0) continue // 빈 데이터 스킵

        // 첫 등장(occurrence 1) = 4해석, 두 번째(2) = 3해석
        const occurrence = skillOccurrences[currentSkillName] || 1
        const construeLevel = occurrence === 1 ? 4 : 3

        // sin_affinity 첫 등장 시 설정
        if (tableData.resource && !currentEgo.sinAffinity && skillCollecting === 'awaken') {
          currentEgo.sinAffinity = tableData.resource
        }

        // 스킬 객체 임시 저장 (details에서 코인효과 보완)
        const skillObj = {
          name: currentSkillName,
          power: '', // 나중에 계산
          mentalConsume: skillCollecting === 'awaken' ? currentEgo.mentalConsume[0] : currentEgo.mentalConsume[1],
          atkType: tableData.atkType || 'slash',
          resource: tableData.resource || '',
          skillPower: tableData.skillPower,
          coinPower: tableData.coinPower,
          coinNum: 0, // details에서 보완
          atkWeight: tableData.atkWeight,
          construeLevel,
          normalEffect: '',
          coin1Effect: '', coin2Effect: '', coin3Effect: '',
          coin4Effect: '', coin5Effect: '',
          _pendingCoinEffects: true, // 마커
        }

        if (skillCollecting === 'awaken') {
          currentEgo.egoSkills.push(skillObj)
        } else {
          currentEgo.egoCorSkills.push(skillObj)
        }
        continue
      }

      // ── DETAILS: 코인별 효과 ──
      if (node.tagName === 'DETAILS' && currentEgo) {
        const summary = node.querySelector('summary')
        if (!summary) continue
        const sumText = summary.textContent.trim()
        if (!sumText.includes('코인별 효과')) continue

        // 가장 최근 추가된 스킬에 코인 효과 보완
        const targetList = skillCollecting === 'corrosion' ? currentEgo.egoCorSkills : currentEgo.egoSkills
        const lastSkill = targetList[targetList.length - 1]
        if (!lastSkill || !lastSkill._pendingCoinEffects) continue

        const { normalEffect, coins } = parseCoinEffects(node)
        const coinKeys = Object.keys(coins).map(Number).sort((a, b) => a - b)
        lastSkill.coinNum = coinKeys.length > 0 ? Math.max(...coinKeys) : 1
        lastSkill.normalEffect = normalEffect
        if (coins[1]) lastSkill.coin1Effect = coins[1]
        if (coins[2]) lastSkill.coin2Effect = coins[2]
        if (coins[3]) lastSkill.coin3Effect = coins[3]
        if (coins[4]) lastSkill.coin4Effect = coins[4]
        if (coins[5]) lastSkill.coin5Effect = coins[5]

        // power 계산: skillPower + coinPower * coinNum
        const maxPower = lastSkill.skillPower + lastSkill.coinPower * lastSkill.coinNum
        lastSkill.power = `${maxPower}(${lastSkill.coinNum})`

        delete lastSkill._pendingCoinEffects
        continue
      }
    }

    // 마지막 EGO flush
    flushEgo()

    // pending 마커 정리 + power 계산
    for (const ego of results) {
      for (const skill of [...ego.egoSkills, ...ego.egoCorSkills]) {
        if (skill._pendingCoinEffects) {
          // 코인 효과 없는 스킬: coinNum=1 기본
          if (skill.coinNum === 0) skill.coinNum = 1
          const maxPower = skill.skillPower + skill.coinPower * skill.coinNum
          skill.power = `${maxPower}(${skill.coinNum})`
          delete skill._pendingCoinEffects
        }
      }
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

// ── 죄악 한글 → 영문 매핑 ──
const SIN_KR_TO_EN = {
  '분노': 'wrath', '색욕': 'lust', '나태': 'sloth',
  '탐식': 'gluttony', '우울': 'gloom', '오만': 'pride', '질투': 'envy',
}

// ── 메인 ──
async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  나무위키 → EGO 데이터 (스킬/패시브/내성) 업데이트  ║')
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

    // DB에서 해당 수감자의 EGO 조회
    const dbEgos = await supaGet('ego',
      `sinner_id=eq.${sinnerId}&select=id,name_kr,name,grade,sin_affinity,resistance,cost,ego_skills,ego_cor_skills,passive_name,passive_content,keywords`
    )
    console.log(`  DB: ${dbEgos.length} EGO`)

    // name_kr → ego 매핑
    const egoMap = {}
    for (const e of dbEgos) {
      if (e.name_kr) egoMap[e.name_kr] = e
    }

    // 나무위키 스크래핑
    const page = await context.newPage()
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await sleep(2000)
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true))
      await sleep(1000)

      const wikiData = await extractEgoData(page)
      console.log(`  위키: ${wikiData.length} EGO 추출`)

      for (const wd of wikiData) {
        if (!wd.name) continue

        // EGO 매칭 (정확 → 정규화)
        let dbEgo = egoMap[wd.name]
        if (!dbEgo) {
          const wikiNorm = normalize(wd.name)
          const match = Object.entries(egoMap).find(([k]) => normalize(k) === wikiNorm)
          if (match) dbEgo = match[1]
        }
        // name (영문) 기반 매칭 fallback
        if (!dbEgo) {
          dbEgo = dbEgos.find(e => normalize(e.name) === normalize(wd.name)) ?? null
        }
        if (!dbEgo) {
          console.log(`  !! EGO 매칭 실패: "${wd.name}"`)
          totalNotFound++
          continue
        }

        // 업데이트 데이터 구성
        const updates = {}
        let changed = false

        // grade
        if (wd.grade && dbEgo.grade !== wd.grade) {
          updates.grade = wd.grade
          changed = true
        }

        // sin_affinity
        if (wd.sinAffinity) {
          const sinEn = SIN_KR_TO_EN[wd.sinAffinity] || wd.sinAffinity
          if (dbEgo.sin_affinity !== sinEn) {
            updates.sin_affinity = sinEn
            changed = true
          }
        }

        // resistance
        if (wd.resistance && wd.resistance.some(r => r !== '보통')) {
          const resStr = JSON.stringify(wd.resistance)
          if (JSON.stringify(dbEgo.resistance) !== resStr) {
            updates.resistance = wd.resistance
            changed = true
          }
        }

        // cost
        if (wd.cost && wd.cost.some(c => c > 0)) {
          const costStr = JSON.stringify(wd.cost)
          if (JSON.stringify(dbEgo.cost) !== costStr) {
            updates.cost = wd.cost
            changed = true
          }
        }

        // ego_skills
        if (wd.egoSkills && wd.egoSkills.length > 0) {
          // mentalConsume 보완 (나중에 파싱된 값)
          for (const s of wd.egoSkills) {
            if (s.mentalConsume === 0) s.mentalConsume = wd.mentalConsume?.[0] ?? 0
          }
          updates.ego_skills = wd.egoSkills
          changed = true
        }

        // ego_cor_skills
        if (wd.egoCorSkills && wd.egoCorSkills.length > 0) {
          for (const s of wd.egoCorSkills) {
            if (s.mentalConsume === 0) s.mentalConsume = wd.mentalConsume?.[1] ?? 0
          }
          updates.ego_cor_skills = wd.egoCorSkills
          changed = true
        }

        // passive
        if (wd.passiveName && dbEgo.passive_name !== wd.passiveName) {
          updates.passive_name = wd.passiveName
          changed = true
        }
        if (wd.passiveContent && dbEgo.passive_content !== wd.passiveContent) {
          updates.passive_content = wd.passiveContent
          changed = true
        }

        if (changed) {
          const details = []
          if (updates.grade) details.push(`등급=${updates.grade}`)
          if (updates.sin_affinity) details.push(`속성=${updates.sin_affinity}`)
          if (updates.resistance) details.push(`내성=${updates.resistance.join(',')}`)
          if (updates.cost) details.push(`코스트=${updates.cost.filter(c => c > 0).join(',')}`)
          if (updates.ego_skills) details.push(`각성스킬=${updates.ego_skills.length}개`)
          if (updates.ego_cor_skills) details.push(`침식스킬=${updates.ego_cor_skills.length}개`)
          if (updates.passive_name) details.push(`패시브=${updates.passive_name}`)

          if (dryRun) {
            console.log(`  >> ${wd.name}: ${details.join(', ')}`)
            if (updates.ego_skills) {
              for (const s of updates.ego_skills) {
                console.log(`     각성: ${s.name} (${s.construeLevel}동기화) 위력${s.skillPower}+${s.coinPower}x${s.coinNum} ${s.atkType} ${s.resource}`)
              }
            }
            if (updates.ego_cor_skills) {
              for (const s of updates.ego_cor_skills) {
                console.log(`     침식: ${s.name} (${s.construeLevel}동기화) 위력${s.skillPower}+${s.coinPower}x${s.coinNum} ${s.atkType} ${s.resource}`)
              }
            }
          } else {
            await supaPatch('ego', dbEgo.id, updates)
            console.log(`  OK ${wd.name}: ${details.join(', ')}`)
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
