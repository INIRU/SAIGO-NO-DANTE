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
    // SIN_ORDER: 내성/코스트 데이터 div의 자식 순서 (0~6)
    // ['분노', '색욕', '나태', '탐식', '우울', '오만', '질투']
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
      '전투 패시브', '서포트 패시브', '4동기화 시 변경점', '4해석 시 변경점',
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
      return clone.textContent.trim()
        .replace(/<img[^>]*>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }

    // ── 내성 추출 v2: STRONG "내성 정보" → 다음 데이터 div에서 CSS display:inline-block 활성값 ──
    function extractResistance(strongEl) {
      const res = new Array(7).fill('보통')
      const labelDiv = strongEl.parentElement
      if (!labelDiv) return res

      // labelDiv 이후 첫 번째 DIV (7개 죄악 블록) 찾기
      let dataDiv = null
      let sib = labelDiv.nextElementSibling
      while (sib) {
        if (sib.tagName === 'DIV' && sib.children.length >= 7) {
          dataDiv = sib
          break
        }
        sib = sib.nextElementSibling
      }
      if (!dataDiv) return res

      // 7개 죄악 블록 순회 (순서: 분노, 색욕, 나태, 탐식, 우울, 오만, 질투)
      for (let i = 0; i < 7 && i < dataDiv.children.length; i++) {
        const sinBlock = dataDiv.children[i]
        if (sinBlock.tagName !== 'DIV') continue

        // children[3~7]에서 display:inline-block 활성값 찾기
        for (let j = 3; j < sinBlock.children.length; j++) {
          const opt = sinBlock.children[j]
          if (opt.tagName !== 'DIV') continue
          const style = opt.getAttribute('style') || ''
          if (style.includes('inline-block')) {
            let text = opt.textContent.trim().replace(/\[×[\d.]+\]/, '').trim()
            if (text === '약저') text = '약점' // 위키 오타 보정
            if (text) res[i] = text
            break
          }
        }
      }
      return res
    }

    // ── 코스트 추출 v2: STRONG "코스트" → 다음 데이터 div에서 SUB > STRONG 숫자 ──
    function extractCost(strongEl) {
      const cost = new Array(7).fill(0)
      const labelDiv = strongEl.parentElement
      if (!labelDiv) return cost

      // labelDiv 이후 첫 번째 DIV (7개 죄악 블록) 찾기
      let dataDiv = null
      let sib = labelDiv.nextElementSibling
      while (sib) {
        if (sib.tagName === 'DIV' && sib.children.length >= 7) {
          dataDiv = sib
          break
        }
        sib = sib.nextElementSibling
      }
      if (!dataDiv) return cost

      // 7개 죄악 블록 순회 (순서: 분노, 색욕, 나태, 탐식, 우울, 오만, 질투)
      for (let i = 0; i < 7 && i < dataDiv.children.length; i++) {
        const sinBlock = dataDiv.children[i]
        if (sinBlock.tagName !== 'DIV') continue

        // SUB > STRONG에서 숫자 추출
        const sub = sinBlock.querySelector('sub')
        if (sub) {
          const strong = sub.querySelector('strong')
          if (strong) {
            const num = parseInt(strong.textContent.trim())
            if (!isNaN(num) && num > 0) cost[i] = num
          }
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
          // 셀에 img 2개: 첫 번째는 alt="" → 모든 img 순회
          const imgs = valCell.querySelectorAll('img')
          for (const img of imgs) {
            const atk = extractAtkType(img.getAttribute('alt'))
            if (atk) { result.atkType = atk; break }
          }
        } else if (label === '죄악 속성') {
          const imgs = valCell.querySelectorAll('img')
          for (const img of imgs) {
            const sin = extractSinFromAlt(img.getAttribute('alt'))
            if (sin) { result.resource = sin; break }
          }
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

    // ── 코인 가시성 체크: display:none 조상 확인 ──
    function isCoinVisible(imgEl, boundary) {
      let el = imgEl
      while (el && el !== boundary) {
        if (getComputedStyle(el).display === 'none') return false
        el = el.parentElement
      }
      return true
    }

    // ── 코인 효과 추출 (DETAILS 내부) ──
    // 쓰레기 패턴: 섹션 헤더/반복 텍스트
    const JUNK_PATTERNS = [
      /\[각성스킬\]\s*코인(별\s*스킬\s*효과|전체\s*효과)/,
      /\[침식스킬\]\s*코인(별\s*스킬\s*효과|전체\s*효과)/,
      /\[스킬\s*\d?\]\s*코인(별\s*스킬\s*효과|전체\s*효과|\s*전체\s*효과)/,
      /\[\s*코인별\s*효과\s*\]/,
    ]
    function isJunkText(txt) {
      return JUNK_PATTERNS.some(p => p.test(txt))
    }

    // 텍스트 조각 → 정리: 공백으로 합치고 [액션마커] 앞에만 줄바꿈
    function formatEffectText(arr) {
      let text = arr.join(' ')
        .replace(/<img[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      // 특정 액션 마커 앞에만 줄바꿈 (적중시, 사용시, 합, 피아, 공격, 크리티컬 등)
      text = text.replace(/\s*(\[(적중|앞면|뒷면|사용|합\s|피아|공격\s|크리티컬)[^\]]*\])/g, '\n$1')
      // 첫 줄바꿈 제거
      text = text.replace(/^\n/, '')
      return text.trim()
    }

    function parseCoinEffects(detailsEl) {
      if (!detailsEl) return { normalEffect: '', coins: {}, visibleCoinNum: 0 }
      const coins = {}

      // 1) 가시적 코인 번호 집합 (display:none 숨김 필터)
      const visibleCoins = new Set()
      const allImgs = detailsEl.querySelectorAll('img')
      for (const img of allImgs) {
        const alt = img.getAttribute('alt') || ''
        const coinMatch = alt.match(/림버스컴퍼니\s*(\d)/)
        if (coinMatch && isCoinVisible(img, detailsEl)) {
          visibleCoins.add(parseInt(coinMatch[1]))
        }
      }
      const visibleCoinNum = visibleCoins.size > 0 ? Math.max(...visibleCoins) : 0

      // 2) TreeWalker: normalEffect(코인 마커 전) + 코인별 효과 동시 수집
      const walker = document.createTreeWalker(detailsEl, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
      let currentCoin = 0  // 0 = normalEffect 수집 중, 1~5 = 코인 수집 중
      let collecting = []
      let normalParts = []

      while (walker.nextNode()) {
        const node = walker.currentNode

        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node
          if (el.tagName === 'NOSCRIPT') { walker.nextSibling(); continue }
          if (el.tagName === 'SUMMARY') continue  // summary 텍스트 스킵
          if (el.tagName === 'IMG') {
            const alt = el.getAttribute('alt') || ''
            const coinMatch = alt.match(/림버스컴퍼니\s*(\d)/)
            if (coinMatch) {
              // 이전 코인 저장
              if (currentCoin > 0 && visibleCoins.has(currentCoin) && collecting.length > 0) {
                coins[currentCoin] = formatEffectText(collecting)
              } else if (currentCoin === 0 && collecting.length > 0) {
                normalParts.push(...collecting)
                collecting = []
              }
              currentCoin = parseInt(coinMatch[1])
              collecting = []
              continue
            }
            if (alt.includes('코인값') || alt.includes('코인')) continue
          }
        }

        if (node.nodeType === Node.TEXT_NODE) {
          if (node.parentElement?.tagName === 'NOSCRIPT') continue
          if (node.parentElement?.tagName === 'SUMMARY') continue
          const txt = node.textContent.trim()
          if (!txt) continue
          if (txt.match(/^<img\s/)) continue
          if (isJunkText(txt)) continue

          if (currentCoin === 0) {
            normalParts.push(txt)
          } else if (visibleCoins.has(currentCoin)) {
            collecting.push(txt)
          }
        }
      }

      // 마지막 코인 저장
      if (currentCoin > 0 && visibleCoins.has(currentCoin) && collecting.length > 0) {
        coins[currentCoin] = formatEffectText(collecting)
      } else if (currentCoin === 0 && collecting.length > 0) {
        normalParts.push(...collecting)
      }

      const normalEffect = formatEffectText(normalParts)

      return { normalEffect, coins, visibleCoinNum }
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
          currentEgo.resistance = extractResistance(node)
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
          skillOccurrences = {} // 각성과 별도로 카운트
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
          const labelDiv = node.parentElement
          if (labelDiv) {
            let dataDiv = null
            let sib = labelDiv.nextElementSibling
            while (sib) {
              if (sib.tagName === 'DIV') { dataDiv = sib; break }
              sib = sib.nextElementSibling
            }
            if (dataDiv) {
              // STRONG에서 숫자 추출 ("N / M" 단일 STRONG 또는 개별 STRONG 모두 지원)
              const strongs = dataDiv.querySelectorAll('strong')
              const allNums = []
              for (const s of strongs) {
                const t = s.textContent.trim()
                if (t.includes('/')) {
                  // "25 / 30" 형식이 하나의 STRONG에 들어있는 경우
                  for (const part of t.split('/')) {
                    const n = parseInt(part.trim())
                    if (!isNaN(n)) allNums.push(n)
                  }
                } else {
                  const n = parseInt(t)
                  if (!isNaN(n)) allNums.push(n)
                }
              }
              // CSS 히든 중복 방지: 첫 2개만 사용
              const nums = allNums.slice(0, 2)
              if (nums.length >= 2) {
                currentEgo.mentalConsume = [nums[0], nums[1]]
              } else if (nums.length === 1) {
                currentEgo.mentalConsume = [nums[0], nums[0]]
              }
            }
          }
          continue
        }

        if (text === '코스트') {
          currentState = 'cost'
          skillCollecting = null
          currentEgo.cost = extractCost(node)
          continue
        }

        if (text === '4해석 시 변경점') {
          currentState = 'changepoint'
          skillCollecting = null
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
              let fullText = clone.textContent.trim().replace(/<img[^>]*>/g, '')
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

          // "홍염살"은 모든 EGO 공통 통칭 — 이미 구체적 EGO 이름이 있으면 유지
          if (text === '홍염살' && currentSkillName && currentSkillName !== '홍염살') {
            continue
          }

          currentSkillName = text
          // occurrence는 TABLE 처리 시 증가 (여기선 초기화만)
          if (!skillOccurrences[text]) skillOccurrences[text] = 0
          continue
        }

        continue
      }

      // ── TABLE: 스킬 스탯 테이블 ──
      if (node.tagName === 'TABLE' && skillCollecting && currentSkillName && currentEgo) {
        const tableData = parseSkillTable(node)
        if (!tableData) continue // 파싱 실패 스킵

        // TABLE 처리 시 occurrence 증가: 첫 등장(1) = 4해석, 두 번째(2) = 3해석
        skillOccurrences[currentSkillName] = (skillOccurrences[currentSkillName] || 0) + 1
        const occurrence = skillOccurrences[currentSkillName]
        const construeLevel = occurrence === 1 ? 4 : 3

        const targetList = skillCollecting === 'awaken' ? currentEgo.egoSkills : currentEgo.egoCorSkills

        // skillPower === 0 → 3해석 테이블에 데이터 없음 → 4해석 스킬 클론
        if (tableData.skillPower === 0) {
          const source = targetList.find(s => s.name === currentSkillName && s.construeLevel === 4)
          if (source) {
            const clone = { ...source, construeLevel: 3, _pendingCoinEffects: false }
            targetList.push(clone)
          }
          continue
        }

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

        targetList.push(skillObj)
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

        const { normalEffect, coins, visibleCoinNum } = parseCoinEffects(node)
        lastSkill.coinNum = visibleCoinNum > 0 ? visibleCoinNum : 1
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

      // ── UL: 4해석 시 변경점 파싱 → 3해석 역산 ──
      if (node.tagName === 'UL' && currentState === 'changepoint' && currentEgo) {
        const changes = { common: [], awaken: [], corrosion: [] }
        const topLis = node.querySelectorAll(':scope > li')
        for (const li of topLis) {
          // 스코프 판별: 첫 번째 텍스트 노드 또는 자식 텍스트
          const firstText = (li.firstChild?.nodeType === 3 ? li.firstChild.textContent : li.childNodes[0]?.textContent || '').trim()
          let scope = 'common'
          if (firstText.startsWith('각성') && firstText.includes('스킬')) scope = 'awaken'
          else if (firstText.startsWith('침식') && firstText.includes('스킬')) scope = 'corrosion'
          else if (firstText.startsWith('공통')) scope = 'common'

          // 하위 LI들에서 변경사항 수집
          const subLis = li.querySelectorAll('ul > li')
          if (subLis.length > 0) {
            for (const sli of subLis) {
              const clone = sli.cloneNode(true)
              clone.querySelectorAll('noscript, img, style, script').forEach(n => n.remove())
              changes[scope].push(clone.textContent.trim())
            }
          } else {
            // 하위 UL 없으면 자체 텍스트
            const clone = li.cloneNode(true)
            clone.querySelectorAll('noscript, img, style, script').forEach(n => n.remove())
            changes[scope].push(clone.textContent.trim())
          }
        }

        // 3해석 스킬에 역산 적용 (수치 + 효과 텍스트)
        function applyReverse(skills, texts) {
          // 컨텍스트에서 무시할 일반 명사 (핵심 키워드가 아닌 것)
          const skipNouns = new Set(['부여량', '수치', '상한', '증가', '감소', '획득', '효과', '조건', '비례', '횟수', '조건부', '배율', '인원'])

          for (const skill of skills) {
            if (skill.construeLevel !== 3) continue
            for (const rawT of texts) {
              // 스코프 접두사/각주 제거
              let t = rawT.replace(/^(공통|각성\s*스킬|침식\s*스킬)\s*[:：]?\s*/, '').trim()
              t = t.replace(/\[\d+\]/g, '').trim()
              if (!t) continue

              // --- 1단계: 스탯 수치 변경 ---
              const sp = t.match(/기본\s*위력\s*[:：]?\s*(\d+)\s*→\s*(\d+)/)
              if (sp) { skill.skillPower = parseInt(sp[1]); continue }
              const cp = t.match(/코인\s*위력\s*[:：]?\s*[+]?(-?\d+)\s*→\s*[+]?(-?\d+)/)
              if (cp) { skill.coinPower = parseInt(cp[1]); continue }
              const aw = t.match(/공격\s*가중치\s*[:：]?\s*(\d+)\s*→\s*(\d+)/)
              if (aw) { skill.atkWeight = parseInt(aw[1]); continue }

              // --- 2단계: 효과 텍스트 변경 ---

              // 코인 접두사 감지: "N코인", "N, M코인"
              let targetCoins = []
              const coinPre = t.match(/^(\d)(?:[,\s]*(\d))?코인\s*[:：에]?\s*/)
              if (coinPre) {
                targetCoins.push(parseInt(coinPre[1]))
                if (coinPre[2]) targetCoins.push(parseInt(coinPre[2]))
                t = t.slice(coinPre[0].length)
              }

              const fields = targetCoins.length > 0
                ? targetCoins.map(n => 'coin' + n + 'Effect')
                : ['normalEffect', 'coin1Effect', 'coin2Effect', 'coin3Effect', 'coin4Effect', 'coin5Effect']

              // 패턴 A: '...' 추가 → 인용된 텍스트 제거
              const addQ = t.match(/[''\u2018\u2019]([^''\u2018\u2019]+)[''\u2018\u2019]\s*추가/)
              if (addQ) {
                const rm = addQ[1].trim()
                for (const f of fields) {
                  if (skill[f] && skill[f].includes(rm)) {
                    skill[f] = skill[f].replace(rm, '').replace(/\n\n+/g, '\n').trim()
                    break
                  }
                }
                continue
              }

              // 패턴 B: "... 추가" (인용 없이, 화살표 없이)
              if (t.endsWith('추가') && !t.includes('→')) {
                const addText = t.replace(/\s*추가$/, '').trim()
                if (addText.length > 3) {
                  for (const f of fields) {
                    if (skill[f] && skill[f].includes(addText)) {
                      skill[f] = skill[f].replace(addText, '').replace(/\n\n+/g, '\n').trim()
                      break
                    }
                  }
                }
                continue
              }

              // "(최대 X → Y)" 다중 화살표 전처리
              const maxArrow = t.match(/\(최대\s*(.+?)\s*→\s*(.+?)\)/)
              if (maxArrow) {
                let maxOld = maxArrow[1].trim()
                const maxNew = maxArrow[2].trim()
                // 단위 보정: new에 %가 있고 old에 없으면 추가
                if (maxNew.endsWith('%') && !maxOld.endsWith('%')) maxOld += '%'
                const maxNewStr = '(최대 ' + maxNew + ')'
                const maxOldStr = '(최대 ' + maxOld + ')'
                for (const f of fields) {
                  if (skill[f] && skill[f].includes(maxNewStr)) {
                    skill[f] = skill[f].replace(maxNewStr, maxOldStr)
                    break
                  }
                }
                // 메인 화살표 처리용으로 (최대...) 부분 제거
                t = t.replace(/\s*\(최대\s*.+?\s*→\s*.+?\)/, '').trim()
              }

              // 컨텍스트 기반 숫자 교체 헬퍼
              function contextReplace(ctx, oldVal, newVal) {
                // 짧은 숫자(1-3자리)이면 컨텍스트 키워드 기반 정밀 매칭
                if (/^[\+\-]?\d{1,3}%?$/.test(newVal) && /^[\+\-]?\d{1,3}%?$/.test(oldVal)) {
                  const ctxWords = (ctx.match(/[\uAC00-\uD7A3]{2,}/g) || []).filter(w => !skipNouns.has(w))
                  // 단위 보정
                  let adjOld = oldVal
                  if (newVal.endsWith('%') && !oldVal.endsWith('%')) adjOld += '%'
                  const escNew = newVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

                  // 1단계: 두 명사 앵커 (연쇄 교체 방지 — "실패 호흡" vs "처치 호흡" 구분)
                  for (let i = ctxWords.length - 1; i >= 1; i--) {
                    for (let j = i - 1; j >= 0; j--) {
                      const re = new RegExp('(' + esc(ctxWords[j]) + '.{0,40}' + esc(ctxWords[i]) + '.{0,25}?)' + escNew)
                      for (const f of fields) {
                        if (skill[f] && re.test(skill[f])) {
                          skill[f] = skill[f].replace(re, '$1' + adjOld)
                          return true
                        }
                      }
                    }
                  }

                  // 2단계: 단일 명사 앵커 (폴백)
                  for (let i = ctxWords.length - 1; i >= 0; i--) {
                    const re = new RegExp('(' + esc(ctxWords[i]) + '.{0,25}?)' + escNew)
                    for (const f of fields) {
                      if (skill[f] && re.test(skill[f])) {
                        skill[f] = skill[f].replace(re, '$1' + adjOld)
                        return true
                      }
                    }
                  }
                  return false
                }
                // 긴 값이면 리터럴 교체
                let adjOld = oldVal
                if (newVal.endsWith('%') && !oldVal.endsWith('%')) adjOld += '%'
                for (const f of fields) {
                  if (skill[f] && skill[f].includes(newVal)) {
                    // 중복 생성 방지: old="스킬 1", new="1, 2" → "스킬 1, 2"를 "스킬 스킬 1"로 만들지 않도록
                    const adjWords = adjOld.split(/\s+/)
                    if (adjWords.length >= 2) {
                      const prefix = adjWords[0]
                      const broadMatch = prefix + ' ' + newVal
                      if (skill[f].includes(broadMatch)) {
                        skill[f] = skill[f].replace(broadMatch, adjOld)
                        return true
                      }
                    }
                    skill[f] = skill[f].replace(newVal, adjOld)
                    return true
                  }
                }
                return false
              }

              // 패턴 C: "context: old → new"
              const arrow = t.match(/^(.+?)\s*[:：]\s*(.+?)\s*→\s*(.+)$/)
              if (arrow) {
                contextReplace(arrow[1].trim(), arrow[2].trim(), arrow[3].trim())
                continue
              }

              // 패턴 D: "old → new" (콜론 없이)
              const bareArrow = t.match(/^(.+?)\s*→\s*(.+)$/)
              if (bareArrow) {
                const oldVal = bareArrow[1].trim()
                const newVal = bareArrow[2].trim()
                for (const f of fields) {
                  if (skill[f] && skill[f].includes(newVal)) {
                    // 중복 생성 방지
                    const oldWords = oldVal.split(/\s+/)
                    if (oldWords.length >= 2) {
                      const prefix = oldWords[0]
                      const broadMatch = prefix + ' ' + newVal
                      if (skill[f].includes(broadMatch)) {
                        skill[f] = skill[f].replace(broadMatch, oldVal)
                        break
                      }
                    }
                    skill[f] = skill[f].replace(newVal, oldVal)
                    break
                  }
                }
              }
            }
            // power 재계산
            if (skill.coinNum > 0) {
              const maxPower = skill.skillPower + skill.coinPower * skill.coinNum
              skill.power = `${maxPower}(${skill.coinNum})`
            }
          }
        }

        if (changes.common.length > 0) {
          applyReverse(currentEgo.egoSkills, changes.common)
          applyReverse(currentEgo.egoCorSkills, changes.common)
        }
        if (changes.awaken.length > 0) applyReverse(currentEgo.egoSkills, changes.awaken)
        if (changes.corrosion.length > 0) applyReverse(currentEgo.egoCorSkills, changes.corrosion)

        currentState = null
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

      const matchedIds = new Set() // 중복 매칭 방지
      for (const wd of wikiData) {
        if (!wd.name) continue

        // EGO 매칭 (정확 → 정규화 → 대괄호 제거)
        let dbEgo = egoMap[wd.name]
        if (!dbEgo) {
          const wikiNorm = normalize(wd.name)
          const match = Object.entries(egoMap).find(([k]) => normalize(k) === wikiNorm)
          if (match) dbEgo = match[1]
        }
        // DB name_kr에서 [한자] 부분 제거 후 매칭 (예: "삼천대세계 [三千大世界]" → "삼천대세계")
        if (!dbEgo) {
          const wikiNorm = normalize(wd.name)
          const match = Object.entries(egoMap).find(([k]) => normalize(k.replace(/\s*\[.*?\]/, '')) === wikiNorm)
          if (match) dbEgo = match[1]
        }
        // name (영문) 기반 매칭 fallback
        if (!dbEgo) {
          dbEgo = dbEgos.find(e => normalize(e.name) === normalize(wd.name)) ?? null
        }
        if (!dbEgo) {
          console.log(`  !! EGO 매칭 실패: "${wd.name}" (${wd.grade})`)
          totalNotFound++
          continue
        }

        // 같은 DB EGO에 이미 매칭된 경우: 스킬 데이터가 없으면 스킵, 있으면 허용 (더 완전한 데이터)
        if (matchedIds.has(dbEgo.id)) {
          if (wd.egoSkills.length === 0 && wd.egoCorSkills.length === 0) {
            console.log(`  -- 중복 스킵: "${wd.name}" (${wd.grade}) — 이미 매칭됨`)
            continue
          }
          // 스킬 데이터가 있는 더 완전한 추출 → grade 변경은 방지하되 스킬 업데이트는 허용
        }
        matchedIds.add(dbEgo.id)

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
                console.log(`     각성: ${s.name} (${s.construeLevel}해석) 위력${s.skillPower}+${s.coinPower}x${s.coinNum} ${s.atkType} ${s.resource}`)
              }
            }
            if (updates.ego_cor_skills) {
              for (const s of updates.ego_cor_skills) {
                console.log(`     침식: ${s.name} (${s.construeLevel}해석) 위력${s.skillPower}+${s.coinPower}x${s.coinNum} ${s.atkType} ${s.resource}`)
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
