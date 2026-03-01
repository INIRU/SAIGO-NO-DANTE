/**
 * 위키 전수조사 스크립트 v3
 * limbuscompany.wiki.gg API → DB 비교 → 수치 불일치 리포트 + SQL 생성
 *
 * 매칭 전략: 수감자(sinner) + 내성 조합 + 등급(rarity) 으로 매칭
 * (DB는 한글 이름, 위키는 영문이라 이름 직접 매칭 불가)
 *
 * DB 기준: identity 스탯은 Lv40 Uptie4, 스킬 수치는 Uptie3
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WIKI_API = 'https://limbuscompany.wiki.gg/api.php'
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'limbus',
  'Content-Profile': 'limbus',
}

const RES_MAP = { Fatal: '취약', Normal: '보통', Ineffective: '내성', Endured: '견딤' }
const SIN_MAP = {
  gloom: 'gloom', envy: 'envy', lust: 'lust', wrath: 'wrath',
  sloth: 'sloth', gluttony: 'gluttony', pride: 'pride',
  Gloom: 'gloom', Envy: 'envy', Lust: 'lust', Wrath: 'wrath',
  Sloth: 'sloth', Gluttony: 'gluttony', Pride: 'pride',
  None: null, none: null, '': null,
}
const TYPE_MAP = {
  Slash: 'slash', Pierce: 'pierce', Blunt: 'blunt',
  Guard: 'defense', Evade: 'evade', Counter: 'counter',
}

// 위키 sinner → DB sinner_id
const SINNER_SLUG = {
  'Yi Sang': 'yi-sang', 'Faust': 'faust', 'Don Quixote': 'don-quixote',
  'Meursault': 'meursault', 'Hong Lu': 'hong-lu', 'Heathcliff': 'heathcliff',
  'Ishmael': 'ishmael', 'Rodion': 'rodion', 'Sinclair': 'sinclair',
  'Outis': 'outis', 'Gregor': 'gregor', 'Ryōshū': 'ryoshu', 'Ryoshu': 'ryoshu',
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── DB 로드 ──
async function fetchDB() {
  const [identRes, skillRes, sinnerRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/identities?select=id,name,name_kr,hp,speed_min,speed_max,def_level,slash_res,pierce_res,blunt_res,game_id,sinner_id,rarity`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/skills?select=id,identity_id,name,skill_type,sin_affinity,coins,base_power,coin_power,offense_level,atk_weight,quantity,skill_order&order=skill_order.asc,id.asc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/sinners?select=id,name,name_kr`, { headers }),
  ])
  const identities = await identRes.json()
  const skills = await skillRes.json()
  const sinners = await sinnerRes.json()

  const skillMap = {}
  for (const sk of skills) {
    if (!skillMap[sk.identity_id]) skillMap[sk.identity_id] = []
    skillMap[sk.identity_id].push(sk)
  }
  const sinnerMap = {}
  for (const s of sinners) sinnerMap[s.id] = s

  // 수감자별 인격 그룹핑
  const dbBySinner = {}
  for (const ident of identities) {
    const sinner = sinnerMap[ident.sinner_id]
    if (!sinner) continue
    if (!dbBySinner[ident.sinner_id]) dbBySinner[ident.sinner_id] = []
    dbBySinner[ident.sinner_id].push({
      ...ident, sinner, skills: skillMap[ident.id] || [],
    })
  }

  return { identities, sinnerMap, dbBySinner }
}

// ── 위키 페이지 목록 ──
async function fetchWikiPages() {
  const pages = []
  let cmcontinue = ''
  while (true) {
    const url = `${WIKI_API}?action=query&list=categorymembers&cmtitle=Category:Identities&cmtype=page&cmlimit=500&format=json${cmcontinue}`
    const res = await fetch(url)
    const data = await res.json()
    pages.push(...data.query.categorymembers.map(m => m.title))
    if (data.continue?.cmcontinue) {
      cmcontinue = `&cmcontinue=${data.continue.cmcontinue}`
    } else break
  }
  return pages
}

async function fetchWikitext(title, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json`
      const res = await fetch(url)
      if (!res.ok) {
        if (attempt < retries - 1) { await sleep(2000); continue }
        return null
      }
      const data = await res.json()
      const text = data?.parse?.wikitext?.['*'] || null
      if (!text && attempt < retries - 1) { await sleep(2000); continue }
      return text
    } catch {
      if (attempt < retries - 1) { await sleep(2000); continue }
      return null
    }
  }
  return null
}

// ── 중첩 {{ }} 안전 추출 ──
function extractTemplate(text, templateName) {
  const marker = `{{${templateName}`
  const start = text.indexOf(marker)
  if (start === -1) return null
  let depth = 0, i = start
  while (i < text.length - 1) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i += 2; continue }
    if (text[i] === '}' && text[i + 1] === '}') {
      depth--; i += 2
      if (depth === 0) return text.substring(start, i)
      continue
    }
    i++
  }
  return null
}

function toInt(v) {
  if (v == null || v === '') return null
  const n = parseInt(String(v).replace(/[+ ]/g, ''))
  return isNaN(n) ? null : n
}

// ── IDPage 파싱 ──
function parseIDPage(wikitext) {
  if (!wikitext) return null
  const idPageText = extractTemplate(wikitext, 'IDPage')
  if (!idPageText) return null

  const result = { skills: [] }

  const getParam = (name) => {
    const re = new RegExp(`\\|${name}=([^\\n|{]*)`)
    const m = idPageText.match(re)
    return m ? m[1].trim() : null
  }

  result.prefix = getParam('prefix')
  result.sinner = getParam('sinner')
  result.rarity = toInt(getParam('rarity'))
  result.slash = getParam('slash')
  result.pierce = getParam('pierce')
  result.blunt = getParam('blunt')

  const speedStr = getParam('speed')
  if (speedStr) {
    const sm = speedStr.match(/(\d+)\s*[~\-]\s*(\d+)/)
    if (sm) {
      result.speed_min = parseInt(sm[1])
      result.speed_max = parseInt(sm[2])
    }
  }

  // 스킬 파싱
  const skillSlots = ['skill1', 'skill2', 'skill3', 'defense']
  for (const slot of skillSlots) {
    const marker = `|${slot}=`
    const slotStart = idPageText.indexOf(marker)
    if (slotStart === -1) continue
    const skillStart = idPageText.indexOf('{{Skill', slotStart)
    if (skillStart === -1 || skillStart > slotStart + marker.length + 5) continue

    let depth = 0, j = skillStart, skillEnd = -1
    while (j < idPageText.length - 1) {
      if (idPageText[j] === '{' && idPageText[j + 1] === '{') { depth++; j += 2; continue }
      if (idPageText[j] === '}' && idPageText[j + 1] === '}') {
        depth--; j += 2
        if (depth === 0) { skillEnd = j; break }
        continue
      }
      j++
    }
    if (skillEnd === -1) continue

    const skillText = idPageText.substring(skillStart, skillEnd)
    const getSP = (name) => {
      const re = new RegExp(`\\|${name}=([^\\n|{]*)`)
      const sm = skillText.match(re)
      return sm ? sm[1].trim() : null
    }

    result.skills.push({
      slot,
      name: getSP('name'),
      sin: getSP('sin'),
      type: getSP('type'),
      coins: toInt(getSP('coin')),
      base_power: toInt(getSP('spower')),
      coin_power: toInt(getSP('cpower')),
      quantity: toInt(getSP('amt')),
      atkweight: toInt(getSP('atkweight')),
    })
  }

  // Uptie3 역추적
  const uptieText = extractTemplate(wikitext, 'Uptie')
  if (uptieText) {
    result.uptie3 = parseUptie3Values(uptieText, result.skills)
  }

  return result
}

function parseUptie3Values(uptieText, skills) {
  const uptie3 = {}
  const prefixMap = { skill1: 's1', skill2: 's2', skill3: 's3', defense: 'd' }

  for (const sk of skills) {
    const prefix = prefixMap[sk.slot]
    if (!prefix) continue

    const u4Re = new RegExp(`\\|${prefix}u4=([\\s\\S]*?)(?=\\n\\|[a-z]|\\}\\})`)
    const u4m = uptieText.match(u4Re)
    if (!u4m) continue

    const u4Content = u4m[1]

    const bpMatch = u4Content.match(/Base Power:\s*'''(\d+)\s*>\s*(\d+)'''/)
    if (bpMatch) {
      if (!uptie3[sk.slot]) uptie3[sk.slot] = {}
      uptie3[sk.slot].base_power = parseInt(bpMatch[1])
    }

    const cpMatch = u4Content.match(/Coin Power:\s*'''\+?(\d+)\s*>\s*\+?(\d+)'''/)
    if (cpMatch) {
      if (!uptie3[sk.slot]) uptie3[sk.slot] = {}
      uptie3[sk.slot].coin_power = parseInt(cpMatch[1])
    }
  }

  return uptie3
}

// DB rarity "3성" → 숫자 3
function dbRarityNum(r) {
  if (r == null) return null
  const m = String(r).match(/(\d+)/)
  return m ? parseInt(m[1]) : null
}

// ── DB 매칭: 다중 전략 스코어링 ──
function findDBMatch(wiki, dbBySinner, matchedDbIds) {
  const sinnerId = SINNER_SLUG[wiki.sinner]
  if (!sinnerId) return null

  const candidates = (dbBySinner[sinnerId] || []).filter(c => !matchedDbIds.has(c.id))
  if (candidates.length === 0) return null

  const wikiRes = {
    slash: RES_MAP[wiki.slash],
    pierce: RES_MAP[wiki.pierce],
    blunt: RES_MAP[wiki.blunt],
  }

  // 1차: 영문 이름 직접 매칭
  const wikiFullName = `${wiki.prefix} ${wiki.sinner}`.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  for (const db of candidates) {
    const dbFullName = `${db.name} ${db.sinner.name}`.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
    if (dbFullName === wikiFullName) return db
  }

  // 2차: 스코어링 기반 매칭
  const orderMap = { skill1: 1, skill2: 2, skill3: 3, defense: 4 }
  const wikiSkillTypes = {}
  const wikiSkillCoins = {}
  for (const sk of (wiki.skills || [])) {
    const ord = orderMap[sk.slot]
    if (!ord) continue
    if (sk.type) wikiSkillTypes[ord] = TYPE_MAP[sk.type] || sk.type
    if (sk.coins != null) wikiSkillCoins[ord] = sk.coins
  }

  let bestScore = -1, bestMatch = null, secondScore = -1
  for (const db of candidates) {
    let score = 0

    // 내성 매칭 (각 +3)
    if (db.slash_res === wikiRes.slash) score += 3
    if (db.pierce_res === wikiRes.pierce) score += 3
    if (db.blunt_res === wikiRes.blunt) score += 3

    // rarity 매칭 (+2)
    if (dbRarityNum(db.rarity) === wiki.rarity) score += 2

    // 스킬 타입 매칭 (각 +4, 가장 식별력 높음)
    const dbSkills = db.skills || []
    for (const ord of [1, 2, 3, 4]) {
      const dbSk = dbSkills.find(s => s.skill_order === ord)
      if (!dbSk) continue
      if (wikiSkillTypes[ord] && dbSk.skill_type === wikiSkillTypes[ord]) score += 4
      if (wikiSkillCoins[ord] != null && dbSk.coins === wikiSkillCoins[ord]) score += 2
    }

    if (score > bestScore) {
      secondScore = bestScore
      bestScore = score
      bestMatch = db
    } else if (score > secondScore) {
      secondScore = score
    }
  }

  // 최소 점수 11 이상이고 2위보다 3점 이상 차이나야 매칭
  if (bestMatch && bestScore >= 11 && bestScore - secondScore >= 3) {
    return bestMatch
  }

  return null
}

// ── 비교 ──
function compareData(wiki, db, discrepancies) {
  const sinnerName = db.sinner?.name_kr || '?'
  const identName = db.name_kr

  // 내성 비교
  const resFields = [
    { wikiKey: 'slash', dbKey: 'slash_res', col: 'slash_res', label: '참격내성' },
    { wikiKey: 'pierce', dbKey: 'pierce_res', col: 'pierce_res', label: '관통내성' },
    { wikiKey: 'blunt', dbKey: 'blunt_res', col: 'blunt_res', label: '타격내성' },
  ]
  for (const rf of resFields) {
    const wikiVal = wiki[rf.wikiKey]
    const dbVal = db[rf.dbKey]
    if (!wikiVal || !dbVal) continue
    const mapped = RES_MAP[wikiVal]
    if (!mapped) continue
    if (mapped !== dbVal) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'identities',
        field: rf.label, column: rf.col, dbValue: dbVal, apiValue: mapped, identityId: db.id,
      })
    }
  }

  // 속도 (위키 메인 = Uptie4 = DB)
  if (wiki.speed_min != null && db.speed_min != null && wiki.speed_min !== db.speed_min) {
    discrepancies.push({
      sinner: sinnerName, identity: identName, table: 'identities',
      field: '최소속도', column: 'speed_min', dbValue: db.speed_min, apiValue: wiki.speed_min, identityId: db.id,
    })
  }
  if (wiki.speed_max != null && db.speed_max != null && wiki.speed_max !== db.speed_max) {
    discrepancies.push({
      sinner: sinnerName, identity: identName, table: 'identities',
      field: '최대속도', column: 'speed_max', dbValue: db.speed_max, apiValue: wiki.speed_max, identityId: db.id,
    })
  }

  // 스킬 비교
  const dbSkills = db.skills || []
  const orderMap = { skill1: 1, skill2: 2, skill3: 3, defense: 4 }

  for (const wikiSk of wiki.skills) {
    if (!wikiSk.name) continue
    const targetOrder = orderMap[wikiSk.slot]
    const dbSk = dbSkills.find(s => s.skill_order === targetOrder)
    if (!dbSk) continue

    const label = (f) => `S${targetOrder} ${f}`

    // skill_type
    const wikiType = TYPE_MAP[wikiSk.type]
    if (wikiType && dbSk.skill_type && wikiType !== dbSk.skill_type) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: label('타입'), column: 'skill_type',
        dbValue: dbSk.skill_type, apiValue: wikiType, skillId: dbSk.id,
      })
    }

    // sin_affinity (수비스킬 제외)
    if (wikiSk.slot !== 'defense') {
      const wikiSin = SIN_MAP[wikiSk.sin]
      if (wikiSin !== undefined && dbSk.sin_affinity !== wikiSin) {
        discrepancies.push({
          sinner: sinnerName, identity: identName, table: 'skills',
          field: label('죄악'), column: 'sin_affinity',
          dbValue: dbSk.sin_affinity, apiValue: wikiSin, skillId: dbSk.id,
        })
      }
    }

    // coins
    if (wikiSk.coins != null && dbSk.coins != null && wikiSk.coins !== dbSk.coins) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: label('코인수'), column: 'coins',
        dbValue: dbSk.coins, apiValue: wikiSk.coins, skillId: dbSk.id,
      })
    }

    // quantity
    if (wikiSk.quantity != null && dbSk.quantity != null && wikiSk.quantity !== dbSk.quantity) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: label('수량'), column: 'quantity',
        dbValue: dbSk.quantity, apiValue: wikiSk.quantity, skillId: dbSk.id,
      })
    }

    // atkweight
    if (wikiSk.atkweight != null && dbSk.atk_weight != null && wikiSk.atkweight !== dbSk.atk_weight) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: label('가중치'), column: 'atk_weight',
        dbValue: dbSk.atk_weight, apiValue: wikiSk.atkweight, skillId: dbSk.id,
      })
    }

    // base_power (Uptie3)
    let expectedBP = wikiSk.base_power
    if (wiki.uptie3?.[wikiSk.slot]?.base_power != null) {
      expectedBP = wiki.uptie3[wikiSk.slot].base_power
    }
    if (expectedBP != null && dbSk.base_power != null && expectedBP !== dbSk.base_power) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: label('위력'), column: 'base_power',
        dbValue: dbSk.base_power, apiValue: expectedBP, skillId: dbSk.id,
      })
    }

    // coin_power (Uptie3)
    let expectedCP = wikiSk.coin_power
    if (wiki.uptie3?.[wikiSk.slot]?.coin_power != null) {
      expectedCP = wiki.uptie3[wikiSk.slot].coin_power
    }
    if (expectedCP != null && dbSk.coin_power != null && expectedCP !== dbSk.coin_power) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: label('코인위력'), column: 'coin_power',
        dbValue: dbSk.coin_power, apiValue: expectedCP, skillId: dbSk.id,
      })
    }
  }
}

function formatSQL(val) {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'string') return `'${val}'`
  return String(val)
}

// ── 메인 ──
async function main() {
  console.log('=== 위키 기반 데이터 전수조사 v3 ===\n')

  // 1. DB 로드
  console.log('DB 데이터 로딩...')
  const { identities, sinnerMap, dbBySinner } = await fetchDB()
  console.log(`  DB 인격: ${identities.length}개\n`)

  // 2. 위키 페이지 목록
  console.log('위키 페이지 목록 로딩...')
  const wikiPages = await fetchWikiPages()
  console.log(`  위키 인격 페이지: ${wikiPages.length}개\n`)

  // 3. 위키 페이지 파싱 (rate limit 대응: 500ms 간격)
  console.log('위키 데이터 파싱 중...')
  const wikiData = []
  let parsed = 0, failed = 0

  for (let i = 0; i < wikiPages.length; i++) {
    const title = wikiPages[i]
    if (i % 20 === 0) console.log(`  진행: ${i}/${wikiPages.length}...`)

    const wikitext = await fetchWikitext(title)
    if (!wikitext) { failed++; continue }

    const wiki = parseIDPage(wikitext)
    if (!wiki) { failed++; continue }
    wiki.pageTitle = title
    wikiData.push(wiki)
    parsed++

    await sleep(500) // rate limit (500ms)
  }

  console.log(`  파싱 완료: ${parsed}개 성공, ${failed}개 실패\n`)

  // 4. DB 매칭 & 비교
  console.log('DB 매칭 및 비교 중...')
  const discrepancies = []
  let matched = 0
  const unmatchedWiki = []
  const matchedDbIds = new Set()

  for (const wiki of wikiData) {
    const db = findDBMatch(wiki, dbBySinner, matchedDbIds)
    if (!db) {
      unmatchedWiki.push(`${wiki.pageTitle} (${wiki.sinner})`)
      continue
    }
    matchedDbIds.add(db.id)
    matched++

    compareData(wiki, db, discrepancies)
  }

  // 매칭 안 된 DB 인격 확인
  const unmatchedDb = identities.filter(i => !matchedDbIds.has(i.id))

  console.log(`\n매칭: ${matched}, 위키미매칭: ${unmatchedWiki.length}, DB미매칭: ${unmatchedDb.length}`)
  if (unmatchedWiki.length > 0) {
    console.log(`\n위키 미매칭 (처음 15개):`)
    for (const t of unmatchedWiki.slice(0, 15)) console.log(`  - ${t}`)
  }
  if (unmatchedDb.length > 0) {
    console.log(`\nDB 미매칭 (처음 15개):`)
    for (const d of unmatchedDb.slice(0, 15)) {
      const sinner = sinnerMap[d.sinner_id]
      console.log(`  - [${sinner?.name_kr}] ${d.name_kr} (${d.slash_res}/${d.pierce_res}/${d.blunt_res})`)
    }
  }
  console.log()

  // 5. 리포트
  if (discrepancies.length === 0) {
    console.log('불일치 없음!')
  } else {
    console.log(`=== 불일치 ${discrepancies.length}건 ===\n`)
    const sqlFixes = []
    for (const d of discrepancies) {
      console.log(`[${d.sinner}] ${d.identity} | ${d.field}: DB="${d.dbValue}" → 위키="${d.apiValue}"`)
      if (d.table === 'identities') {
        sqlFixes.push(`UPDATE limbus.identities SET ${d.column} = ${formatSQL(d.apiValue)} WHERE id = '${d.identityId}';`)
      } else if (d.table === 'skills') {
        sqlFixes.push(`UPDATE limbus.skills SET ${d.column} = ${formatSQL(d.apiValue)} WHERE id = '${d.skillId}';`)
      }
    }
    console.log(`\n=== SQL (${sqlFixes.length}건) ===\n`)
    for (const sql of sqlFixes) console.log(sql)
  }
}

main().catch(console.error)
