#!/usr/bin/env node
/**
 * 나무위키 → DB 동기화 스크립트 (인격 + EGO 통합)
 *
 * 사용법:
 *   node --env-file=.env.local scripts/sync-wiki-namu.mjs [옵션]
 *
 * 옵션:
 *   --sinner <slug>   특정 수감자만 (기본: 전체 12명)
 *   --dry-run         비교만 (DB 수정 안 함, 기본값)
 *   --fix             불일치 발견 시 DB 자동 수정
 *   --identity-only   인격만 동기화
 *   --ego-only        EGO만 동기화
 *   --verbose         상세 로그
 *
 * 추출 대상 (인격):
 *   - HP, speed_min, speed_max, def_level
 *   - slash_res, pierce_res, blunt_res (내성)
 *   - panic_type, panic_description, sanity_increase, sanity_decrease
 *   - 스킬 (타입, 죄악, 위력, 코인, 가중치, 공격레벨, 설명)
 *   - 패시브 (전투/서포트: 이름, 죄악, 필요수, 발동조건, 설명)
 *   - 대사 (quote)
 *   - 전용 키워드 → keyword_meta 자동 upsert
 *
 * 추출 대상 (EGO):
 *   - 전용 키워드 → keyword_meta 자동 upsert
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
const autoFix = args.includes('--fix')
const dryRun = !autoFix
const identityOnly = args.includes('--identity-only')
const egoOnly = args.includes('--ego-only')
const verbose = args.includes('--verbose')

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

// ── 죄악 img alt → DB값 매핑 ──
const SIN_ALT_MAP = {
  '림버스분노UI': 'wrath',
  '림버스색욕UI': 'lust',
  '림버스나태UI': 'sloth',
  '림버스탐식UI': 'gluttony',
  '림버스우울UI': 'gloom',
  '림버스오만UI': 'pride',
  '림버스질투UI': 'envy',
}

// ── 죄악 한글 → DB값 매핑 ──
const SIN_KR_MAP = {
  '분노': 'wrath', '색욕': 'lust', '나태': 'sloth', '탐식': 'gluttony',
  '우울': 'gloom', '오만': 'pride', '질투': 'envy',
}

// ── 죄악 영문 → 한글 (패시브 sin_affinity용) ──
const SIN_EN_TO_KR = {
  wrath: '분노', lust: '색욕', sloth: '나태', gluttony: '탐식',
  gloom: '우울', pride: '오만', envy: '질투',
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── 이름 정규화 (위키 ↔ DB 매칭용) ──
function normalize(s) {
  return s
    .normalize('NFKC')
    .replace(/【/g, '[').replace(/】/g, ']')
    .replace(/…/g, '...')
    .replace(/[.!?,，。！？·]/g, '')
    .replace(/\s+/g, '')
    .replace(/:/g, '')
    .toLowerCase()
}

// ── Supabase REST 헬퍼 ──
async function supaGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers })
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function supaPatch(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`PATCH ${table}/${id}: ${res.status} ${await res.text()}`)
}

async function supaUpsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'return=minimal,resolution=merge-duplicates',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`UPSERT ${table}: ${res.status} ${await res.text()}`)
}


// ══════════════════════════════════════════════════════════════════════
//  DOM 추출 함수 (page.evaluate 내부에서 실행됨)
// ══════════════════════════════════════════════════════════════════════
async function extractAllData(page) {
  return await page.evaluate(({ SIN_ALT_MAP_ARG, SIN_EN_TO_KR_ARG }) => {
    // ── 헬퍼 ──
    function getTextWithoutImgs(el) {
      if (!el) return ''
      const clone = el.cloneNode(true)
      clone.querySelectorAll('img, noscript, details').forEach(n => n.remove())
      return clone.textContent.trim()
    }

    // br 태그를 줄바꿈으로 보존하는 텍스트 추출
    function getTextWithLineBreaks(el) {
      if (!el) return ''
      const clone = el.cloneNode(true)
      clone.querySelectorAll('img, noscript, details').forEach(n => n.remove())
      clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'))
      return clone.textContent.trim()
    }

    // 스킬 테이블 라벨 (스킬명이 아닌 것들)
    const TABLE_LABELS = new Set([
      '공격 유형', '죄악 속성', '스킬 수량', '스킬 위력', '코인 위력', '공격 가중치',
      '수비 유형', '가중치', '방어 유형',
    ])

    // 섹션 라벨 (스킬명이 아닌 것들)
    const SECTION_LABELS = new Set([
      '스테이터스', '내성 정보', '기본 정보', '인격 동기화', '흐트러짐 구간',
      '전투 패시브', '서포트 패시브', '4동기화 시 변경점', '4해석 시 변경점',
      '패닉 유형', '정신력 증가 조건', '정신력 감소 조건', '전용 키워드',
      '추가 패시브', '추가패시브', '코스트', '각성 스킬', '침식 스킬',
      '환상 해석', '기본 정보', '패시브', '공격 레벨', '정신 소모량',
    ])

    // 코인 효과 내 무시할 패턴
    const COIN_KEYWORDS = ['적중', '앞면', '뒷면', '코인', '크리티컬']

    // 공격/수비 유형 img alt → DB값
    function parseAtkType(imgAlt) {
      if (imgAlt.includes('참격')) return 'slash'
      if (imgAlt.includes('관통')) return 'pierce'
      if (imgAlt.includes('타격')) return 'blunt'
      return null
    }

    // 죄악 속성 img alt → DB값
    function parseSinAffinity(imgAlt) {
      for (const [altKey, dbVal] of Object.entries(SIN_ALT_MAP_ARG)) {
        if (imgAlt.includes(altKey) || imgAlt === altKey) return dbVal
      }
      return null
    }

    // ── 메인 TreeWalker ──
    const identities = []
    const egos = []

    let current = null
    let isEgo = false

    // details 펼침
    document.querySelectorAll('details').forEach(d => { d.open = true })

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)

    while (walker.nextNode()) {
      const node = walker.currentNode

      // ── H2/H3/H4: 인격 vs EGO 섹션 경계 감지 ──
      if (['H2', 'H3', 'H4'].includes(node.tagName)) {
        const headText = node.textContent.trim()

        // "3. E.G.O" 같은 EGO 대섹션 시작
        if (/^\d+\.\s*E\.?G\.?O\s*$/i.test(headText.replace(/\[편집\]/g, '').trim())) {
          if (current) {
            if (isEgo) egos.push(current)
            else identities.push(current)
          }
          current = null
          isEgo = true
          continue
        }

        // "2. 인격" 같은 인격 대섹션
        if (/^\d+\.\s*인격/.test(headText.replace(/\[편집\]/g, '').trim())) {
          isEgo = false
          continue
        }
      }

      // ── 대사(quote) 추출: IDENTITY 감지 직후 leaf div의 "..." 패턴 ──
      if (current && !current.quote && !isEgo && node.tagName === 'DIV' && node.children.length === 0) {
        const qt = node.textContent?.trim() || ''
        if (qt.length > 5 && qt.length < 300 && /^[""\u201C]/.test(qt) && /[""\u201D]$/.test(qt)) {
          // "획득 대사가 출력됩니다." 무시
          if (!qt.includes('획득 대사가 출력됩니다')) {
            const cleaned = qt.replace(/^[""\u201C]+/, '').replace(/[""\u201D]+$/, '').trim()
            if (cleaned.length > 3) {
              current.quote = cleaned
            }
          }
        }
      }

      if (node.tagName !== 'STRONG') continue
      const text = node.textContent.trim()

      // ── 인격/EGO 이름 감지: "[ XXX ] 수감자명" ──
      const identMatch = text.match(/^\[\s*(.+?)\s*\]\s+(.+)/)
      if (identMatch) {
        const bracketName = identMatch[1].trim()

        // 코인 효과 패턴 무시
        if (COIN_KEYWORDS.some(k => bracketName.includes(k))) continue
        // 스킬 N 패턴 무시
        if (/^스킬\s*\d/.test(bracketName)) continue

        // 이전 데이터 저장
        if (current) {
          if (isEgo) egos.push(current)
          else identities.push(current)
        }

        current = {
          name: bracketName,
          sinnerSuffix: identMatch[2].trim(),
          isEgo,
          stats: {},
          resistance: {},
          panic: {},
          skills: [],
          passives: [],
          keywords: [],
          quote: null,
          _skillOrder: 0,
          // EGO 전용
          egoResistance: null, // [7] 분노/색욕/나태/탐식/우울/오만/질투 순
          egoCost: null,       // [7] 분노/색욕/나태/탐식/우울/오만/질투 순
        }

        // 대사는 TreeWalker 순회 중 다음 leaf div에서 추출 (아래 참조)
        continue
      }

      // ── 섹션별 데이터 추출 (current가 있을 때만) ──
      if (!current) continue

      // ── 내성 정보 ──
      if (text === '내성 정보') {
        const labelDiv = node.parentElement
        const gp = labelDiv?.parentElement
        if (!gp) continue

        // dataDiv: 라벨 DIV → BR → 데이터 DIV (형제 관계에서 +2)
        const labelIdx = [...gp.children].indexOf(labelDiv)
        const dataDiv = gp.children[labelIdx + 2]
        if (!dataDiv) continue

        if (!isEgo) {
          // 인격: 참격/관통/타격 3종
          const cellDivs = [...dataDiv.children].filter(c => c.tagName === 'DIV')
          for (const cell of cellDivs) {
            const cellText = getTextWithoutImgs(cell)
            const typeMatch = cellText.match(/(참격|관통|타격)/)
            const valMatch = cellText.match(/(취약|내성|보통)/)
            if (typeMatch && valMatch) {
              if (typeMatch[1] === '참격') current.resistance.slash_res = valMatch[1]
              else if (typeMatch[1] === '관통') current.resistance.pierce_res = valMatch[1]
              else if (typeMatch[1] === '타격') current.resistance.blunt_res = valMatch[1]
            }
          }
        } else {
          // EGO: 7대 죄악별 내성 (분노/색욕/나태/탐식/우울/오만/질투)
          // 각 셀 DIV 안에 5개 값 DIV (취약/약점/보통/견딤/내성)
          // 활성값만 display:inline-block, 나머지는 display:none
          const cellDivs = [...dataDiv.children].filter(c => c.tagName === 'DIV')
          const egoRes = []
          for (const cell of cellDivs) {
            const valueDivs = [...cell.querySelectorAll(':scope > div')]
              .filter(d => d.getAttribute('style')?.includes('margin-top'))
            let found = false
            for (const vd of valueDivs) {
              const style = vd.getAttribute('style') || ''
              // 활성 값: display:inline-block 포함 (display:none 뒤에 오버라이드)
              if (style.includes('inline-block') || style.includes('inline')) {
                const text = vd.textContent.trim()
                const m = text.match(/(취약|내성|보통|견딤|약점)/)
                if (m) {
                  egoRes.push(m[1] === '약점' ? '취약' : m[1])
                  found = true
                  break
                }
              }
            }
            // fallback: computed style 체크 불가, 첫 visible div
            if (!found) {
              for (const vd of valueDivs) {
                const cs = window.getComputedStyle(vd)
                if (cs.display !== 'none') {
                  const text = vd.textContent.trim()
                  const m = text.match(/(취약|내성|보통|견딤|약점)/)
                  if (m) {
                    egoRes.push(m[1] === '약점' ? '취약' : m[1])
                    found = true
                    break
                  }
                }
              }
            }
          }
          if (egoRes.length >= 7) current.egoResistance = egoRes.slice(0, 7)
        }
        continue
      }

      // ── EGO 코스트 ──
      if (text === '코스트' && isEgo) {
        const labelDiv = node.parentElement
        const gp = labelDiv?.parentElement
        if (!gp) continue

        const labelIdx = [...gp.children].indexOf(labelDiv)
        const dataDiv = gp.children[labelIdx + 2]
        if (!dataDiv) continue

        // 7개 셀 DIV (분노/색욕/나태/탐식/우울/오만/질투), 각각 죄악 아이콘 + 비용 숫자
        const cellDivs = [...dataDiv.children].filter(c => c.tagName === 'DIV')
        const costs = []
        for (const cell of cellDivs) {
          const cellText = getTextWithoutImgs(cell)
          const numMatch = cellText.match(/(\d+)/)
          costs.push(numMatch ? parseInt(numMatch[1]) : 0)
        }
        if (costs.length >= 7) current.egoCost = costs.slice(0, 7)
        continue
      }

      // ── 스테이터스 (HP/속도/방어력) ──
      if (text === '스테이터스' && !isEgo) {
        let container = node.parentElement
        for (let i = 0; i < 5 && container; i++) {
          container = container.parentElement
        }
        if (!container) continue

        const hpImg = container.querySelector('img[alt="림버스 컴퍼니 체력"]')
        if (hpImg) {
          const hpDiv = hpImg.closest('div[class]')
          if (hpDiv) {
            const t = getTextWithoutImgs(hpDiv)
            const hp = parseInt(t)
            if (!isNaN(hp) && hp > 50 && hp < 500) current.stats.hp = hp
          }
        }

        const speedImg = container.querySelector('img[alt="림버스 컴퍼니 속도"]')
        if (speedImg) {
          const speedDiv = speedImg.closest('div[class]')
          if (speedDiv) {
            const t = getTextWithoutImgs(speedDiv)
            const m = t.match(/(\d+)\s*-\s*(\d+)/)
            if (m) {
              current.stats.speed_min = parseInt(m[1])
              current.stats.speed_max = parseInt(m[2])
            }
          }
        }

        const defImg = container.querySelector('img[alt="림버스 컴퍼니 방어력"]')
        if (defImg) {
          const defDiv = defImg.closest('div[class]')
          if (defDiv) {
            const t = getTextWithoutImgs(defDiv)
            const m = t.match(/(\d+)/)
            if (m) current.stats.def_level = parseInt(m[1])
          }
        }
        continue
      }

      // ── 패닉 유형 ──
      if (text === '패닉 유형' && !isEgo) {
        const labelDiv = node.parentElement
        const parentDiv = labelDiv?.parentElement
        if (!parentDiv) continue
        const labelIdx = [...parentDiv.children].indexOf(labelDiv)
        const dataDiv = parentDiv.children[labelIdx + 2]
        if (!dataDiv) continue

        const innerStrong = dataDiv.querySelector('strong')
        if (innerStrong) {
          current.panic.panic_type = innerStrong.textContent.trim()
        }

        const br = dataDiv.querySelector('br')
        if (br && br.nextElementSibling) {
          const desc = br.nextElementSibling.textContent.trim()
          if (desc) current.panic.panic_description = desc
        }
        continue
      }

      // ── 정신력 증가 조건 ──
      if (text === '정신력 증가 조건' && !isEgo) {
        const labelDiv = node.parentElement
        const parentDiv = labelDiv?.parentElement
        if (!parentDiv) continue
        const labelIdx = [...parentDiv.children].indexOf(labelDiv)
        const dataDiv = parentDiv.children[labelIdx + 2]
        if (!dataDiv) continue

        let fullText = getTextWithoutImgs(dataDiv)
        fullText = fullText
          .replace(/(적 처치 시)/g, '\n$1')
          .replace(/(아군이 처치)/g, '\n$1')
          .replace(/(합 패배 시)/g, '\n$1')
          .replace(/(피격 시)/g, '\n$1')
          .trim()

        if (fullText) current.panic.sanity_increase = fullText
        continue
      }

      // ── 정신력 감소 조건 ──
      if (text === '정신력 감소 조건' && !isEgo) {
        const labelDiv = node.parentElement
        const parentDiv = labelDiv?.parentElement
        if (!parentDiv) continue
        const labelIdx = [...parentDiv.children].indexOf(labelDiv)
        const dataDiv = parentDiv.children[labelIdx + 2]
        if (!dataDiv) continue

        let fullText = getTextWithoutImgs(dataDiv)
        fullText = fullText
          .replace(/(합 승리 시)/g, '\n$1')
          .replace(/(합 패배 시)/g, '\n$1')
          .replace(/(적 처치 시)/g, '\n$1')
          .replace(/(아군 사망 시)/g, '\n$1')
          .replace(/(피격 시)/g, '\n$1')
          .trim()

        if (fullText) current.panic.sanity_decrease = fullText
        continue
      }

      // ══════════════════════════════════════════════════════════════
      //  스킬 추출
      // ══════════════════════════════════════════════════════════════
      // 스킬명 감지: STRONG 이면서 테이블/섹션 라벨이 아닌 것
      // 스킬은 STRONG(이름) → 바로 다음에 TABLE(6행 스탯) → DETAILS(코인효과) 구조
      if (!isEgo && !TABLE_LABELS.has(text) && !SECTION_LABELS.has(text)) {
        // 스킬인지 판단: 이 STRONG 이후에 스킬 스탯 테이블이 있는지 확인
        // 스킬명 뒤에 공격레벨이 붙는 패턴도 있음: "칠하기 62(+2)"
        const skillNameMatch = text.match(/^(.+?)\s*(\d{2,3})(?:\s*\(\s*[+\-]?\s*\d+\s*\))?\s*$/)
        const rawSkillName = skillNameMatch ? skillNameMatch[1].trim() : text
        const offenseLevel = skillNameMatch ? parseInt(skillNameMatch[2]) : null

        // STRONG 이후 형제/후속 요소에서 TABLE 찾기
        let tableEl = null
        let searchEl = node.parentElement
        // STRONG → parent(DIV) → 다음 형제들에서 TABLE 찾기
        if (searchEl) {
          let sibling = searchEl.nextElementSibling
          // 최대 5개 형제까지 탐색
          for (let tries = 0; tries < 5 && sibling; tries++) {
            if (sibling.tagName === 'TABLE') {
              tableEl = sibling
              break
            }
            const innerTable = sibling.querySelector('table')
            if (innerTable) {
              tableEl = innerTable
              break
            }
            // 다른 STRONG을 만나면 중단
            if (sibling.querySelector('strong')) break
            sibling = sibling.nextElementSibling
          }
        }
        // 부모의 형제에서도 탐색
        if (!tableEl && searchEl?.parentElement) {
          let sibling = searchEl.parentElement.nextElementSibling
          for (let tries = 0; tries < 5 && sibling; tries++) {
            if (sibling.tagName === 'TABLE') {
              tableEl = sibling
              break
            }
            const innerTable = sibling.querySelector('table')
            if (innerTable) {
              tableEl = innerTable
              break
            }
            if (sibling.querySelector('strong')) break
            sibling = sibling.nextElementSibling
          }
        }

        if (!tableEl) continue

        // 테이블이 스킬 스탯 테이블인지 확인: 첫 행 첫 셀이 "공격 유형" 또는 "수비 유형"
        const rows = [...tableEl.querySelectorAll(':scope > tbody > tr, :scope > tr')]
        if (rows.length < 4) continue

        const firstCellText = getTextWithoutImgs(rows[0]?.cells?.[0])
        const isDefenseSkill = firstCellText === '수비 유형' || firstCellText === '방어 유형'
        const isAttackSkill = firstCellText === '공격 유형'
        if (!isAttackSkill && !isDefenseSkill) continue

        // 정크 테이블 필터링: 스킬 위력이 0이면 무시
        const powerRow = rows.find(r => {
          const label = getTextWithoutImgs(r.cells?.[0])
          return label === '스킬 위력'
        })
        if (powerRow) {
          const powerVal = parseInt(getTextWithoutImgs(powerRow.cells?.[1]))
          if (powerVal === 0) continue
        }

        // 스킬 데이터 추출
        const skill = {
          name: rawSkillName,
          skill_type: null,
          sin_affinity: null,
          base_power: null,
          coin_power: null,
          coins: null,
          atk_weight: 1,
          offense_level: offenseLevel,
          description: '',
        }

        for (const row of rows) {
          if (!row.cells || row.cells.length < 2) continue
          const label = getTextWithoutImgs(row.cells[0])
          const valueCell = row.cells[1]
          const valueText = getTextWithoutImgs(valueCell)

          switch (label) {
            case '공격 유형': {
              const imgs = valueCell.querySelectorAll('img')
              for (const img of imgs) {
                const atkType = parseAtkType(img.alt || '')
                if (atkType) { skill.skill_type = atkType; break }
              }
              break
            }
            case '수비 유형':
            case '방어 유형': {
              // 수비 유형: 회피/수비/반격
              const imgs = valueCell.querySelectorAll('img')
              for (const img of imgs) {
                const alt = img.alt || ''
                if (alt.includes('회피')) { skill.skill_type = 'evade'; break }
                if (alt.includes('수비') || alt.includes('방어')) { skill.skill_type = 'defense'; break }
                if (alt.includes('반격')) { skill.skill_type = 'counter'; break }
                const atkType = parseAtkType(alt)
                if (atkType) { skill.skill_type = atkType; break }
              }
              // img로 못 찾으면 텍스트로
              if (!skill.skill_type) {
                if (valueText.includes('회피')) skill.skill_type = 'evade'
                else if (valueText.includes('반격')) skill.skill_type = 'counter'
                else skill.skill_type = 'defense'
              }
              break
            }
            case '죄악 속성': {
              const imgs = valueCell.querySelectorAll('img')
              for (const img of imgs) {
                const sin = parseSinAffinity(img.alt || '')
                if (sin) { skill.sin_affinity = sin; break }
              }
              break
            }
            case '스킬 위력':
              skill.base_power = parseInt(valueText) || null
              break
            case '코인 위력': {
              const m = valueText.match(/[+\-]?\s*(\d+)/)
              skill.coin_power = m ? parseInt(m[1]) : null
              // 코인 수는 코인 위력 셀의 이미지(코인 아이콘) 수로 판단하거나 텍스트에서 추출
              break
            }
            case '공격 가중치':
            case '가중치':
              skill.atk_weight = parseInt(valueText) || 1
              break
            case '스킬 수량': {
              // 코인 수 = "스킬 수량" 행의 값... 아닌, 이건 스킬 개수임
              // 코인 수는 코인 위력 행에서 코인 아이콘 수로 카운트하거나
              // DETAILS 코인별 효과에서 추출
              break
            }
          }
        }

        // 코인 수 추출: 코인 위력 행의 코인 아이콘 수로 카운트
        const coinPowerRow = rows.find(r => getTextWithoutImgs(r.cells?.[0]) === '코인 위력')
        if (coinPowerRow) {
          const coinImgs = coinPowerRow.cells[1].querySelectorAll('img[alt*="코인"]')
          if (coinImgs.length > 0) {
            skill.coins = coinImgs.length
          }
        }
        // 코인 수가 아직 null이면 코인 위력 텍스트의 "+" 수로 추정
        if (!skill.coins) {
          const cpText = coinPowerRow ? getTextWithoutImgs(coinPowerRow.cells[1]) : ''
          const plusCount = (cpText.match(/\+/g) || []).length
          if (plusCount > 0) skill.coins = plusCount
          else skill.coins = 1
        }

        // 공격레벨: 스킬명에서 못 가져왔으면 별도 행이 있을 수 있음
        if (!skill.offense_level) {
          // 테이블 위 STRONG 텍스트 재확인 (숫자 포함)
          const offMatch = text.match(/(\d{2,3})/)
          if (offMatch) skill.offense_level = parseInt(offMatch[1])
        }

        // 코인별 효과 (DETAILS) 추출
        // 테이블 다음 형제에서 details 찾기
        let descParts = []
        let detailsEl = null

        // 테이블의 형제에서 details 찾기
        let nextSib = tableEl.nextElementSibling
        for (let tries = 0; tries < 5 && nextSib; tries++) {
          if (nextSib.tagName === 'DETAILS') {
            detailsEl = nextSib
            break
          }
          const innerDetails = nextSib.querySelector('details')
          if (innerDetails) {
            detailsEl = innerDetails
            break
          }
          // 다른 STRONG(다음 스킬)을 만나면 중단
          if (nextSib.querySelector?.('strong')?.textContent?.trim() &&
              !TABLE_LABELS.has(nextSib.querySelector('strong').textContent.trim())) break
          nextSib = nextSib.nextElementSibling
        }

        if (detailsEl) {
          // 코인별 효과 파싱: TreeWalker로 detailsEl 내부를 순회
          const dWalker = document.createTreeWalker(detailsEl, NodeFilter.SHOW_ALL)
          let coinNum = 0
          let currentCoinText = []
          let globalEffectText = []
          let inGlobalSection = false

          while (dWalker.nextNode()) {
            const dNode = dWalker.currentNode

            if (dNode.nodeType === 1) { // ELEMENT
              if (dNode.tagName === 'SUMMARY') continue
              if (dNode.tagName === 'IMG') {
                const alt = dNode.getAttribute('alt') || ''
                // 코인 번호 이미지: "림버스컴퍼니 1", "림버스컴퍼니 2" 등
                const coinNumMatch = alt.match(/림버스컴퍼니\s*(\d+)/)
                if (coinNumMatch) {
                  // 이전 코인 텍스트 저장
                  if (coinNum > 0 && currentCoinText.length > 0) {
                    descParts.push(`[코인 ${coinNum}] ${currentCoinText.join('').trim()}`)
                  }
                  coinNum = parseInt(coinNumMatch[1])
                  currentCoinText = []
                  inGlobalSection = false
                  continue
                }
              }
            }

            if (dNode.nodeType === 3) { // TEXT
              let t = dNode.textContent.trim()
              if (!t) continue
              // noscript 내부 제외
              if (dNode.parentElement?.tagName === 'NOSCRIPT') continue

              // "[스킬 N] 코인 전체 효과" / "[스킬 N] 코인별 스킬 효과" 패턴 필터
              if (/\[스킬\s*\d+\]\s*코인\s*(전체|별\s*스킬)\s*효과/.test(t)) {
                // 코인 전체 효과는 전역 효과 섹션
                if (t.includes('전체')) inGlobalSection = true
                continue
              }

              // 파괴 불가 코인 레이블
              if (/^파괴 불가 코인$/.test(t)) {
                if (coinNum > 0) currentCoinText.push('파괴 불가 코인\n')
                continue
              }

              if (coinNum > 0) {
                currentCoinText.push(t)
              } else if (inGlobalSection) {
                globalEffectText.push(t)
              }
            }
          }

          // 마지막 코인 텍스트 저장
          if (coinNum > 0 && currentCoinText.length > 0) {
            descParts.push(`[코인 ${coinNum}] ${currentCoinText.join('').trim()}`)
          }

          // 전역 효과가 있으면 맨 앞에 추가
          if (globalEffectText.length > 0) {
            descParts.unshift(globalEffectText.join('').trim())
          }
        }

        skill.description = descParts.join('\n') || ''

        // 스킬 순서 결정
        current._skillOrder++
        const skillOrder = isDefenseSkill ? 4 : current._skillOrder

        // 수비 스킬이면 _skillOrder 되돌리기 (수비는 order 4 고정)
        if (isDefenseSkill) current._skillOrder--

        current.skills.push({
          ...skill,
          skill_order: skillOrder,
        })
        continue
      }

      // ══════════════════════════════════════════════════════════════
      //  패시브 추출
      // ══════════════════════════════════════════════════════════════
      if ((text === '전투 패시브' || text === '서포트 패시브') && !isEgo) {
        const passiveType = text === '전투 패시브' ? 'battle' : 'support'

        // 패시브 데이터는 STRONG("전투 패시브") → 부모의 grandparent 구조
        // grandparent.children[2]에 데이터가 있음
        const gp = node.parentElement?.parentElement
        if (!gp) continue

        // dataDiv: 패시브명, 죄악 아이콘, 조건, 설명이 포함된 영역
        const dataDiv = gp.children[2]
        if (!dataDiv) continue

        // 패시브 파싱: 이름, 죄악 아이콘, "N 공명/보유", 설명
        // 구조가 다양할 수 있으므로 텍스트 기반으로 추출

        // 죄악 아이콘 (패시브는 한국어로 저장, 복수 죄악 지원)
        // dataDiv.children[1]에 죄악 아이콘이 위치 (children[4],[5]는 별도 UI 요소)
        const sins = []
        const sinContainer = dataDiv.children[1]
        if (sinContainer) {
          const sinImgs = sinContainer.querySelectorAll('img')
          for (const img of sinImgs) {
            const alt = img.getAttribute('alt') || ''
            const sin = parseSinAffinity(alt)
            if (sin) {
              const kr = SIN_EN_TO_KR_ARG[sin] || sin
              if (!sins.includes(kr)) sins.push(kr)
            }
          }
        }
        const sinAffinity = sins.length > 0 ? sins.join(', ') : null

        // 전체 텍스트에서 패시브명, 조건, 설명 추출
        const fullText = getTextWithoutImgs(dataDiv)

        // 패턴: "패시브명 N 공명|보유 설명..."
        // 또는: "패시브명 설명..." (조건 없음)
        const condMatch = fullText.match(/^(.+?)\s+(\d+)\s*(공명|보유)\s*(.*)$/s)
        if (condMatch) {
          current.passives.push({
            passive_type: passiveType,
            name: condMatch[1].trim().replace(/(\s+\d+)+$/, '').trim(),
            sin_affinity: sinAffinity,
            sin_count: parseInt(condMatch[2]),
            active_cond: condMatch[3],
            description: condMatch[4].trim().replace(/^\s*0\s*0\s*/, '').trim(),
          })
        } else {
          // 조건 없는 패시브 (무조건 발동 등)
          // 첫 줄이 이름, 나머지가 설명
          const lines = fullText.split(/\n/).filter(l => l.trim())
          const name = lines[0]?.trim() || text
          const desc = lines.slice(1).join('\n').trim()
          if (name && name !== text) {
            current.passives.push({
              passive_type: passiveType,
              name,
              sin_affinity: sinAffinity,
              sin_count: null,
              active_cond: null,
              description: desc,
            })
          }
        }
        continue
      }

      // ── 전용 키워드 ──
      if (text === '전용 키워드') {
        const tbody = node.closest('tbody')
        if (!tbody) continue

        const rows = [...tbody.querySelectorAll(':scope > tr')]
        for (let ri = 1; ri < rows.length; ri++) {
          const cells = [...rows[ri].querySelectorAll(':scope > td')]
          if (cells.length < 2) continue

          const kwName = getTextWithoutImgs(cells[0]).trim()
          const kwDesc = getTextWithLineBreaks(cells[1]).trim()
          if (!kwName || kwName === '전용 키워드') continue

          let maxStack = null
          const maxMatch = kwDesc.match(/최대?[값갯]?\s*[:：]\s*(\d+)/)
          if (maxMatch) maxStack = parseInt(maxMatch[1])

          current.keywords.push({ name: kwName, description: kwDesc, maxStack })
        }
        continue
      }
    }

    // 마지막 항목 저장
    if (current) {
      if (isEgo) egos.push(current)
      else identities.push(current)
    }

    return { identities, egos }
  }, { SIN_ALT_MAP_ARG: SIN_ALT_MAP, SIN_EN_TO_KR_ARG: SIN_EN_TO_KR })
}

// ══════════════════════════════════════════════════════════════════════
//  비교/수정 로직
// ══════════════════════════════════════════════════════════════════════

function compareSkills(wikiSkills, dbSkills) {
  const diffs = []

  // DB 스킬을 (name, skill_order) 기준으로 매핑
  const dbMap = new Map()
  for (const ds of dbSkills) {
    const key = `${ds.skill_order}:${normalize(ds.name)}`
    dbMap.set(key, ds)
  }

  for (const ws of wikiSkills) {
    const key = `${ws.skill_order}:${normalize(ws.name)}`
    let dbSkill = dbMap.get(key)

    // 이름 정규화 매칭 시도
    if (!dbSkill) {
      for (const [k, v] of dbMap) {
        if (k.startsWith(`${ws.skill_order}:`)) {
          dbSkill = v
          break
        }
      }
    }

    if (!dbSkill) {
      diffs.push({ type: 'missing', wiki: ws })
      continue
    }

    const fieldDiffs = []
    const fields = [
      { field: 'skill_type', wiki: ws.skill_type, db: dbSkill.skill_type },
      { field: 'sin_affinity', wiki: ws.sin_affinity, db: dbSkill.sin_affinity },
      { field: 'base_power', wiki: ws.base_power, db: dbSkill.base_power },
      { field: 'coin_power', wiki: ws.coin_power, db: dbSkill.coin_power },
      { field: 'coins', wiki: ws.coins, db: dbSkill.coins },
      { field: 'atk_weight', wiki: ws.atk_weight, db: dbSkill.atk_weight },
    ]

    if (ws.offense_level) {
      fields.push({ field: 'offense_level', wiki: ws.offense_level, db: dbSkill.offense_level })
    }

    // 스킬 설명(코인 효과) 비교
    if (ws.description && dbSkill.description) {
      const wikiDesc = ws.description.trim()
      const dbDesc = dbSkill.description.trim()
      if (wikiDesc !== dbDesc) {
        fieldDiffs.push({ field: 'description', wiki: wikiDesc, db: dbDesc })
      }
    } else if (ws.description && !dbSkill.description) {
      fieldDiffs.push({ field: 'description', wiki: ws.description.trim(), db: '(없음)' })
    }

    for (const f of fields) {
      if (f.wiki != null && f.db != null && String(f.wiki) !== String(f.db)) {
        fieldDiffs.push(f)
      }
    }

    if (fieldDiffs.length > 0) {
      diffs.push({ type: 'diff', dbId: dbSkill.id, name: ws.name, order: ws.skill_order, fields: fieldDiffs })
    }
  }

  return diffs
}

function comparePassives(wikiPassives, dbPassives) {
  const diffs = []

  for (const wp of wikiPassives) {
    const dbPassive = dbPassives.find(dp =>
      dp.passive_type === wp.passive_type && normalize(dp.name) === normalize(wp.name)
    ) || dbPassives.find(dp => dp.passive_type === wp.passive_type)

    if (!dbPassive) {
      diffs.push({ type: 'missing', wiki: wp })
      continue
    }

    const fieldDiffs = []
    const fields = [
      { field: 'sin_affinity', wiki: wp.sin_affinity, db: dbPassive.sin_affinity },
      { field: 'sin_count', wiki: wp.sin_count, db: dbPassive.sin_count },
      { field: 'active_cond', wiki: wp.active_cond, db: dbPassive.active_cond },
    ]

    for (const f of fields) {
      if (f.wiki != null && f.db != null && String(f.wiki) !== String(f.db)) {
        fieldDiffs.push(f)
      }
    }

    // 이름 불일치
    if (normalize(dbPassive.name) !== normalize(wp.name)) {
      fieldDiffs.push({ field: 'name', wiki: wp.name, db: dbPassive.name })
    }

    if (fieldDiffs.length > 0) {
      diffs.push({ type: 'diff', dbId: dbPassive.id, name: wp.name, ptype: wp.passive_type, fields: fieldDiffs })
    }
  }

  return diffs
}

// ══════════════════════════════════════════════════════════════════════
//  메인
// ══════════════════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  나무위키 → DB 동기화 (인격 + EGO 통합)               ║')
  console.log('╠══════════════════════════════════════════════════════╣')
  console.log(`║  모드: ${dryRun ? 'DRY RUN (비교만)' : 'FIX (DB 수정)'}`)
  console.log(`║  대상: ${identityOnly ? '인격만' : egoOnly ? 'EGO만' : '인격 + EGO'}`)
  if (sinnerFilter) console.log(`║  수감자: ${sinnerFilter}`)
  console.log('╚══════════════════════════════════════════════════════╝\n')

  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    const pwPath = resolve(ROOT, 'node_modules/playwright/index.mjs')
    ;({ chromium } = await import(pwPath))
  }

  const sinners = sinnerFilter ? [sinnerFilter] : Object.keys(WIKI_URLS)
  const summary = {
    matched: 0, diffFound: 0, fixed: 0, notFound: 0,
    kwAdded: 0, skillDiffs: 0, passiveDiffs: 0, egoDiffs: 0,
  }
  const allDiffs = []

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  })

  for (const sinnerId of sinners) {
    const url = WIKI_URLS[sinnerId]
    if (!url) { console.warn(`  ${sinnerId}: URL 없음`); continue }

    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  ${sinnerId.toUpperCase()}`)
    console.log(`${'═'.repeat(60)}`)

    // DB에서 인격/EGO + 관련 데이터 조회
    const [dbIdentities, dbEgos] = await Promise.all([
      !egoOnly ? supaGet('identities',
        `sinner_id=eq.${sinnerId}&select=id,name_kr,hp,speed_min,speed_max,def_level,slash_res,pierce_res,blunt_res,panic_type,panic_description,sanity_increase,sanity_decrease,quote`
      ) : Promise.resolve([]),
      !identityOnly ? supaGet('ego',
        `sinner_id=eq.${sinnerId}&select=id,name_kr,resistance,cost`
      ) : Promise.resolve([]),
    ])

    // 나무위키 스크래핑
    const page = await context.newPage()
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await sleep(2500)
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true }))
      await sleep(1000)

      const { identities: wikiIdents, egos: wikiEgos } = await extractAllData(page)

      if (verbose) {
        console.log(`  위키 인격: ${wikiIdents.length}개, EGO: ${wikiEgos.length}개`)
        console.log(`  DB 인격: ${dbIdentities.length}개, EGO: ${dbEgos.length}개`)
      }

      // ── 인격 비교 ──
      if (!egoOnly) {
        console.log(`\n  -- 인격 (${wikiIdents.length}개 추출) --`)

        const identMap = {}
        for (const di of dbIdentities) identMap[di.name_kr] = di

        for (const wi of wikiIdents) {
          // DB 매칭
          let dbIdent = identMap[wi.name]
          if (!dbIdent) {
            const wikiNorm = normalize(wi.name)
            const match = Object.entries(identMap).find(([k]) => normalize(k) === wikiNorm)
            if (match) dbIdent = match[1]
          }
          if (!dbIdent) {
            const match = Object.entries(identMap).find(([k]) => {
              return k.includes(wi.name) || wi.name.includes(k)
            })
            if (match) dbIdent = match[1]
          }

          if (!dbIdent) {
            console.log(`    [!] 매칭 실패: "${wi.name}"`)
            summary.notFound++
            continue
          }

          summary.matched++

          // ─── 기본 스탯 비교 ───
          const diffs = []
          const compareFields = [
            { wiki: wi.stats.hp, db: dbIdent.hp, field: 'hp' },
            { wiki: wi.stats.speed_min, db: dbIdent.speed_min, field: 'speed_min' },
            { wiki: wi.stats.speed_max, db: dbIdent.speed_max, field: 'speed_max' },
            { wiki: wi.stats.def_level, db: dbIdent.def_level, field: 'def_level' },
            { wiki: wi.resistance.slash_res, db: dbIdent.slash_res, field: 'slash_res' },
            { wiki: wi.resistance.pierce_res, db: dbIdent.pierce_res, field: 'pierce_res' },
            { wiki: wi.resistance.blunt_res, db: dbIdent.blunt_res, field: 'blunt_res' },
            { wiki: wi.panic.panic_type, db: dbIdent.panic_type, field: 'panic_type' },
          ]

          for (const { wiki, db, field } of compareFields) {
            if (wiki != null && String(db) !== String(wiki)) {
              diffs.push({ field, db, wiki })
            }
          }

          // 대사 비교
          if (wi.quote && !dbIdent.quote) {
            diffs.push({ field: 'quote', db: dbIdent.quote, wiki: wi.quote })
          }

          if (diffs.length > 0) {
            summary.diffFound++
            console.log(`    [x] ${wi.name}:`)
            for (const d of diffs) {
              const dbVal = d.db == null ? '(없음)' : String(d.db).substring(0, 50)
              const wikiVal = String(d.wiki).substring(0, 50)
              console.log(`        ${d.field}: ${dbVal} -> ${wikiVal}`)
            }
            allDiffs.push({ sinnerId, table: 'identities', id: dbIdent.id, name: wi.name, diffs })

            if (autoFix) {
              const updates = {}
              for (const d of diffs) updates[d.field] = d.wiki
              try {
                await supaPatch('identities', dbIdent.id, updates)
                console.log(`        -> 수정 완료`)
                summary.fixed++
              } catch (err) {
                console.log(`        -> 수정 실패: ${err.message}`)
              }
            }
          } else {
            if (verbose) console.log(`    [v] ${wi.name}`)
          }

          // ─── 스킬 비교 ───
          if (wi.skills.length > 0) {
            const dbSkills = await supaGet('skills',
              `identity_id=eq.${dbIdent.id}&uptie_level=eq.4&select=id,name,skill_type,sin_affinity,base_power,coin_power,coins,atk_weight,offense_level,skill_order,description&order=skill_order`
            )
            // uptie 4가 없으면 기본(3) 가져오기
            const skills = dbSkills.length > 0 ? dbSkills : await supaGet('skills',
              `identity_id=eq.${dbIdent.id}&select=id,name,skill_type,sin_affinity,base_power,coin_power,coins,atk_weight,offense_level,skill_order,description&order=skill_order`
            )

            const skillDiffs = compareSkills(wi.skills, skills)
            if (skillDiffs.length > 0) {
              summary.skillDiffs += skillDiffs.length
              for (const sd of skillDiffs) {
                if (sd.type === 'missing') {
                  console.log(`    [!] 스킬 DB에 없음: S${sd.wiki.skill_order} "${sd.wiki.name}"`)
                } else {
                  console.log(`    [x] 스킬 S${sd.order} "${sd.name}":`)
                  for (const f of sd.fields) {
                    console.log(`        ${f.field}: ${f.db} -> ${f.wiki}`)
                  }
                  if (autoFix) {
                    const updates = {}
                    for (const f of sd.fields) updates[f.field] = f.wiki
                    try {
                      await supaPatch('skills', sd.dbId, updates)
                      console.log(`        -> 스킬 수정 완료`)
                    } catch (err) {
                      console.log(`        -> 스킬 수정 실패: ${err.message}`)
                    }
                  }
                }
              }
            } else if (verbose) {
              console.log(`    [v] 스킬 ${wi.skills.length}개 일치`)
            }
          }

          // ─── 패시브 비교 ───
          if (wi.passives.length > 0) {
            const dbPassives = await supaGet('passives',
              `identity_id=eq.${dbIdent.id}&uptie_level=eq.4&select=id,name,passive_type,sin_affinity,sin_count,active_cond,description&order=passive_order`
            )
            const passives = dbPassives.length > 0 ? dbPassives : await supaGet('passives',
              `identity_id=eq.${dbIdent.id}&select=id,name,passive_type,sin_affinity,sin_count,active_cond,description&order=passive_order`
            )

            const passiveDiffs = comparePassives(wi.passives, passives)
            if (passiveDiffs.length > 0) {
              summary.passiveDiffs += passiveDiffs.length
              for (const pd of passiveDiffs) {
                if (pd.type === 'missing') {
                  console.log(`    [!] 패시브 DB에 없음: ${pd.wiki.passive_type} "${pd.wiki.name}"`)
                } else {
                  console.log(`    [x] 패시브 ${pd.ptype} "${pd.name}":`)
                  for (const f of pd.fields) {
                    console.log(`        ${f.field}: ${f.db} -> ${f.wiki}`)
                  }
                  if (autoFix) {
                    const updates = {}
                    for (const f of pd.fields) updates[f.field] = f.wiki
                    try {
                      await supaPatch('passives', pd.dbId, updates)
                      console.log(`        -> 패시브 수정 완료`)
                    } catch (err) {
                      console.log(`        -> 패시브 수정 실패: ${err.message}`)
                    }
                  }
                }
              }
            } else if (verbose) {
              console.log(`    [v] 패시브 ${wi.passives.length}개 일치`)
            }
          }

          // ─── 전용 키워드 → keyword_meta upsert ───
          if (wi.keywords.length > 0) {
            for (const kw of wi.keywords) {
              if (verbose) console.log(`    [kw] ${kw.name}: ${kw.description.substring(0, 60)}...`)
              if (autoFix) {
                try {
                  await supaUpsert('keyword_meta', {
                    name: kw.name,
                    description: kw.description,
                    ...(kw.maxStack != null ? { max_stack: kw.maxStack } : {}),
                  })
                  summary.kwAdded++
                } catch (err) {
                  console.log(`        -> 키워드 저장 실패: ${err.message}`)
                }
              }
            }
          }
        }
      }

      // ── EGO 비교 ──
      if (!identityOnly && wikiEgos.length > 0) {
        console.log(`\n  -- EGO (${wikiEgos.length}개 추출) --`)
        for (const we of wikiEgos) {
          const dbEgo = dbEgos.find(e => e.name_kr === we.name) ||
            dbEgos.find(e => normalize(e.name_kr) === normalize(we.name))

          if (!dbEgo) {
            if (verbose) console.log(`    [!] EGO 매칭 실패: "${we.name}"`)
            summary.notFound++
            // 키워드만 처리하고 다음으로
            if (we.keywords.length > 0) {
              for (const kw of we.keywords) {
                if (verbose) console.log(`    [kw] ${kw.name}: ${kw.description.substring(0, 60)}...`)
                if (autoFix) {
                  try {
                    await supaUpsert('keyword_meta', {
                      name: kw.name,
                      description: kw.description,
                      ...(kw.maxStack != null ? { max_stack: kw.maxStack } : {}),
                    })
                    summary.kwAdded++
                  } catch (err) {
                    console.log(`        -> 키워드 저장 실패: ${err.message}`)
                  }
                }
              }
            }
            continue
          }

          summary.matched++

          // EGO 내성/코스트 비교
          const egoDiffs = []
          if (we.egoResistance && dbEgo.resistance) {
            const dbRes = Array.isArray(dbEgo.resistance) ? dbEgo.resistance : JSON.parse(dbEgo.resistance || '[]')
            const wikiRes = we.egoResistance
            if (wikiRes.length === 7 && dbRes.length === 7) {
              const resMismatch = wikiRes.some((v, i) => v !== dbRes[i])
              if (resMismatch) {
                egoDiffs.push({ field: 'resistance', db: dbRes.join(','), wiki: wikiRes.join(',') })
              }
            }
          } else if (we.egoResistance && !dbEgo.resistance) {
            egoDiffs.push({ field: 'resistance', db: '(없음)', wiki: we.egoResistance.join(',') })
          }

          if (we.egoCost && dbEgo.cost) {
            const dbCost = Array.isArray(dbEgo.cost) ? dbEgo.cost : JSON.parse(dbEgo.cost || '[]')
            const wikiCost = we.egoCost
            if (wikiCost.length === 7 && dbCost.length === 7) {
              const costMismatch = wikiCost.some((v, i) => v !== dbCost[i])
              if (costMismatch) {
                egoDiffs.push({ field: 'cost', db: dbCost.join(','), wiki: wikiCost.join(',') })
              }
            }
          } else if (we.egoCost && !dbEgo.cost) {
            egoDiffs.push({ field: 'cost', db: '(없음)', wiki: we.egoCost.join(',') })
          }

          if (egoDiffs.length > 0) {
            summary.egoDiffs++
            console.log(`    [x] EGO ${we.name}:`)
            for (const d of egoDiffs) {
              console.log(`        ${d.field}: ${d.db} -> ${d.wiki}`)
            }
            if (autoFix) {
              const updates = {}
              for (const d of egoDiffs) {
                if (d.field === 'resistance') updates.resistance = we.egoResistance
                if (d.field === 'cost') updates.cost = we.egoCost
              }
              try {
                await supaPatch('ego', dbEgo.id, updates)
                console.log(`        -> EGO 수정 완료`)
                summary.fixed++
              } catch (err) {
                console.log(`        -> EGO 수정 실패: ${err.message}`)
              }
            }
          } else {
            if (verbose) console.log(`    [v] EGO: ${we.name}`)
          }

          // 전용 키워드
          if (we.keywords.length > 0) {
            for (const kw of we.keywords) {
              if (verbose) console.log(`    [kw] ${kw.name}: ${kw.description.substring(0, 60)}...`)
              if (autoFix) {
                try {
                  await supaUpsert('keyword_meta', {
                    name: kw.name,
                    description: kw.description,
                    ...(kw.maxStack != null ? { max_stack: kw.maxStack } : {}),
                  })
                  summary.kwAdded++
                } catch (err) {
                  console.log(`        -> 키워드 저장 실패: ${err.message}`)
                }
              }
            }
          }
        }
      }

    } catch (err) {
      console.error(`  [!] 페이지 로드 실패: ${err.message}`)
    } finally {
      await page.close()
    }

    await sleep(1500) // 나무위키 rate limit
  }

  await browser.close()

  // ── 결과 요약 ──
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  결과 요약')
  console.log('═'.repeat(60))
  console.log(`  매칭 성공:     ${summary.matched}`)
  console.log(`  스탯 불일치:   ${summary.diffFound}`)
  console.log(`  스킬 불일치:   ${summary.skillDiffs}`)
  console.log(`  패시브 불일치: ${summary.passiveDiffs}`)
  console.log(`  EGO 불일치:    ${summary.egoDiffs}`)
  if (autoFix) {
    console.log(`  DB 수정:       ${summary.fixed}`)
    console.log(`  키워드 추가:   ${summary.kwAdded}`)
  }
  console.log(`  매칭 실패:     ${summary.notFound}`)

  if (!autoFix && allDiffs.length > 0) {
    console.log(`\n  -> --fix 플래그로 자동 수정 가능`)
  }

  console.log('')
}

main().catch(err => { console.error('\n치명적 오류:', err); process.exit(1) })
