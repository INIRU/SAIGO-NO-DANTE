/**
 * 데이터 전수조사 스크립트
 * 단빵숲 API vs DB 비교 → 불일치 리포트 + 자동 수정
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'limbus',
  'Content-Profile': 'limbus',
}

// 단빵숲 sin 한글→영문 매핑
const SIN_MAP = {
  '분노': 'wrath', '색욕': 'lust', '나태': 'sloth',
  '탐식': 'gluttony', '우울': 'gloom', '오만': 'pride', '질투': 'envy',
  '없음': null, null: null, undefined: null,
}

// 단빵숲 스킬타입 한글→영문 매핑
const TYPE_MAP = {
  '참격': 'slash', '관통': 'pierce', '타격': 'blunt',
  '회피': 'evade', '수비': 'defense', '반격': 'counter',
}

// 단빵숲 내성 한글→DB 매핑
const RES_MAP_REVERSE = {
  '내성': '내성', '보통': '보통', '취약': '취약',
  // 혹시 영문으로 저장된 경우
  'Ineffective': '내성', 'Normal': '보통', 'Fatal': '취약',
}

async function fetchDB() {
  // 모든 인격 + 스킬 조회
  const identRes = await fetch(
    `${SUPABASE_URL}/rest/v1/identities?select=id,name,name_kr,hp,speed_min,speed_max,def_level,slash_res,pierce_res,blunt_res,game_id,sinner_id`,
    { headers }
  )
  const identities = await identRes.json()

  const skillRes = await fetch(
    `${SUPABASE_URL}/rest/v1/skills?select=id,identity_id,name,skill_type,sin_affinity,coins,base_power,coin_power,offense_level,atk_weight,quantity,skill_order&order=skill_order.asc,id.asc`,
    { headers }
  )
  const skills = await skillRes.json()

  const sinnerRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sinners?select=id,name,name_kr,order_num`,
    { headers }
  )
  const sinners = await sinnerRes.json()

  // 인격별 스킬 맵
  const skillMap = {}
  for (const sk of skills) {
    if (!skillMap[sk.identity_id]) skillMap[sk.identity_id] = []
    skillMap[sk.identity_id].push(sk)
  }

  // sinner 맵
  const sinnerMap = {}
  for (const s of sinners) sinnerMap[s.id] = s

  return { identities, skillMap, sinnerMap }
}

async function fetchBaslimbus(id) {
  try {
    const res = await fetch(`https://baslimbus.store/dictionary/identity/${id}`)
    if (!res.ok) return null
    const data = await res.json()
    return data
  } catch {
    return null
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  console.log('=== 데이터 전수조사 시작 ===\n')

  // 1. DB 데이터 로드
  console.log('DB 데이터 로딩...')
  const { identities, skillMap, sinnerMap } = await fetchDB()
  console.log(`  인격: ${identities.length}개, 수감자: ${Object.keys(sinnerMap).length}명\n`)

  // DB name_kr → identity 맵 (매칭용)
  const dbByName = {}
  for (const ident of identities) {
    const sinner = sinnerMap[ident.sinner_id]
    const key = `${sinner?.name_kr}|${ident.name_kr}`
    dbByName[key] = { ...ident, sinner, skills: skillMap[ident.id] || [] }
  }

  // 2. 단빵숲 API에서 전체 인격 fetch (ID 1~300)
  console.log('단빵숲 API 데이터 로딩 (ID 1~300)...')
  const apiData = []
  let notFoundCount = 0

  for (let id = 1; id <= 300; id++) {
    const data = await fetchBaslimbus(id)
    if (!data || !data.name) {
      notFoundCount++
      if (notFoundCount > 15) break // 연속 없으면 끝
      continue
    }
    notFoundCount = 0
    apiData.push({ apiId: id, ...data })

    if (id % 50 === 0) console.log(`  ... ${id}번까지 확인`)
    await sleep(100) // rate limit
  }
  console.log(`  단빵숲 인격 수: ${apiData.length}개\n`)

  // 3. 매칭 및 비교
  const discrepancies = []
  let matchCount = 0
  let unmatchCount = 0

  for (const api of apiData) {
    const charName = api.character // 수감자 한글명
    const identName = api.name    // 인격 한글명

    const key = `${charName}|${identName}`
    const db = dbByName[key]

    if (!db) {
      // 이름 부분 매칭 시도
      const altKey = Object.keys(dbByName).find(k => {
        const [, dbName] = k.split('|')
        return dbName === identName
      })
      if (!altKey) {
        unmatchCount++
        continue
      }
      // found via alt match
      const altDb = dbByName[altKey]
      compareIdentity(api, altDb, discrepancies)
      matchCount++
      continue
    }

    compareIdentity(api, db, discrepancies)
    matchCount++
  }

  console.log(`매칭: ${matchCount}개, 미매칭: ${unmatchCount}개\n`)

  // 4. 리포트 출력
  if (discrepancies.length === 0) {
    console.log('불일치 없음! 모든 데이터가 정확합니다.')
  } else {
    console.log(`=== 불일치 ${discrepancies.length}건 발견 ===\n`)

    // SQL 수정문 생성
    const sqlFixes = []

    for (const d of discrepancies) {
      console.log(`[${d.sinner}] ${d.identity} — ${d.field}: DB=${d.dbValue} → API=${d.apiValue}`)

      if (d.table === 'identities') {
        sqlFixes.push(`UPDATE limbus.identities SET ${d.column} = ${formatSQL(d.apiValue)} WHERE id = '${d.identityId}';`)
      } else if (d.table === 'skills') {
        sqlFixes.push(`UPDATE limbus.skills SET ${d.column} = ${formatSQL(d.apiValue)} WHERE id = '${d.skillId}';`)
      }
    }

    console.log(`\n=== SQL 수정문 (${sqlFixes.length}건) ===\n`)
    console.log(sqlFixes.join('\n'))
  }
}

function formatSQL(val) {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'string') return `'${val}'`
  return String(val)
}

function compareIdentity(api, db, discrepancies) {
  const sinnerName = db.sinner?.name_kr || '?'
  const identName = db.name_kr

  // --- 인격 기본 스탯 비교 ---
  // HP
  if (api.hp != null && db.hp != null && api.hp !== db.hp) {
    discrepancies.push({
      sinner: sinnerName, identity: identName, table: 'identities',
      field: 'HP', column: 'hp', dbValue: db.hp, apiValue: api.hp, identityId: db.id,
    })
  }

  // Speed
  if (api.minSpeed != null && db.speed_min != null && api.minSpeed !== db.speed_min) {
    discrepancies.push({
      sinner: sinnerName, identity: identName, table: 'identities',
      field: 'speed_min', column: 'speed_min', dbValue: db.speed_min, apiValue: api.minSpeed, identityId: db.id,
    })
  }
  if (api.maxSpeed != null && db.speed_max != null && api.maxSpeed !== db.speed_max) {
    discrepancies.push({
      sinner: sinnerName, identity: identName, table: 'identities',
      field: 'speed_max', column: 'speed_max', dbValue: db.speed_max, apiValue: api.maxSpeed, identityId: db.id,
    })
  }

  // Defense Level
  if (api.defenseLevel != null && db.def_level != null && api.defenseLevel !== db.def_level) {
    discrepancies.push({
      sinner: sinnerName, identity: identName, table: 'identities',
      field: 'def_level', column: 'def_level', dbValue: db.def_level, apiValue: api.defenseLevel, identityId: db.id,
    })
  }

  // 내성 비교
  const resFields = [
    { apiKey: 'slashResist', dbKey: 'slash_res', col: 'slash_res', label: 'slash_res' },
    { apiKey: 'pierceResist', dbKey: 'pierce_res', col: 'pierce_res', label: 'pierce_res' },
    { apiKey: 'bluntResist', dbKey: 'blunt_res', col: 'blunt_res', label: 'blunt_res' },
  ]
  for (const rf of resFields) {
    if (api[rf.apiKey] != null && db[rf.dbKey] != null) {
      const apiRes = RES_MAP_REVERSE[api[rf.apiKey]] || api[rf.apiKey]
      if (apiRes !== db[rf.dbKey]) {
        discrepancies.push({
          sinner: sinnerName, identity: identName, table: 'identities',
          field: rf.label, column: rf.col, dbValue: db[rf.dbKey], apiValue: apiRes, identityId: db.id,
        })
      }
    }
  }

  // --- 스킬 비교 ---
  const apiSkills = api.identitySkills || []
  const dbSkills = db.skills || []

  for (const apiSk of apiSkills) {
    // 매칭: 스킬 이름으로
    const dbSk = dbSkills.find(s => s.name === apiSk.name)
    if (!dbSk) continue // 매칭 안 되면 스킵

    // sin_affinity
    const apiSin = SIN_MAP[apiSk.resource] ?? apiSk.resource
    if (apiSin !== undefined && dbSk.sin_affinity !== apiSin) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: `스킬[${apiSk.name}] sin_affinity`, column: 'sin_affinity',
        dbValue: dbSk.sin_affinity, apiValue: apiSin, skillId: dbSk.id,
      })
    }

    // skill_type
    const apiType = TYPE_MAP[apiSk.type] || apiSk.type
    if (apiType && dbSk.skill_type !== apiType) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: `스킬[${apiSk.name}] skill_type`, column: 'skill_type',
        dbValue: dbSk.skill_type, apiValue: apiType, skillId: dbSk.id,
      })
    }

    // coins
    if (apiSk.coinNum != null && dbSk.coins !== apiSk.coinNum) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: `스킬[${apiSk.name}] coins`, column: 'coins',
        dbValue: dbSk.coins, apiValue: apiSk.coinNum, skillId: dbSk.id,
      })
    }

    // base_power
    if (apiSk.basePower != null && dbSk.base_power !== apiSk.basePower) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: `스킬[${apiSk.name}] base_power`, column: 'base_power',
        dbValue: dbSk.base_power, apiValue: apiSk.basePower, skillId: dbSk.id,
      })
    }

    // coin_power
    if (apiSk.coinPower != null && dbSk.coin_power !== apiSk.coinPower) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: `스킬[${apiSk.name}] coin_power`, column: 'coin_power',
        dbValue: dbSk.coin_power, apiValue: apiSk.coinPower, skillId: dbSk.id,
      })
    }

    // offense_level
    if (apiSk.offenseLevel != null && dbSk.offense_level !== apiSk.offenseLevel) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: `스킬[${apiSk.name}] offense_level`, column: 'offense_level',
        dbValue: dbSk.offense_level, apiValue: apiSk.offenseLevel, skillId: dbSk.id,
      })
    }

    // atk_weight
    if (apiSk.atkWeight != null && dbSk.atk_weight !== apiSk.atkWeight) {
      discrepancies.push({
        sinner: sinnerName, identity: identName, table: 'skills',
        field: `스킬[${apiSk.name}] atk_weight`, column: 'atk_weight',
        dbValue: dbSk.atk_weight, apiValue: apiSk.atkWeight, skillId: dbSk.id,
      })
    }
  }
}

main().catch(console.error)
