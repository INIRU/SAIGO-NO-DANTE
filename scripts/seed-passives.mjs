/**
 * scripts/seed-passives.mjs
 * 단빵숲 API에서 이상(Yi Sang) 인격 패시브 데이터를 가져와 Supabase에 시드
 *
 * 실행: node --env-file=.env.local scripts/seed-passives.mjs
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ .env.local에서 SUPABASE_URL / SERVICE_ROLE_KEY를 설정해주세요.')
  process.exit(1)
}

const headers = {
  apikey:            SUPABASE_KEY,
  Authorization:     `Bearer ${SUPABASE_KEY}`,
  'Content-Type':    'application/json',
  'Accept-Profile':  'limbus',
  'Content-Profile': 'limbus',
}

// 단빵숲 API ID 목록 (이상 인격)
const BASLIMBUS_API_IDS = [76,77,78,79,80,81,82,86,100,120,133,137,151,157,174]

// 단빵숲 API name → DB name_kr 매핑 (DB identities 테이블과 조인용)
// DB에는 name_kr 필드가 있으므로 그걸로 매칭

async function getIdentities() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/identities?sinner_id=eq.yi-sang&select=id,name,name_kr`,
    { headers }
  )
  if (!res.ok) throw new Error('identities 조회 실패: ' + await res.text())
  return await res.json()
}

async function fetchPassivesFromApi(apiId) {
  const res = await fetch(`https://baslimbus.store/dictionary/identity/${apiId}`)
  if (!res.ok) throw new Error(`단빵숲 API ${apiId} 실패: ${res.status}`)
  const data = await res.json()
  return {
    name: data.name, // 한글 인격명
    passives: data.identityPassives || [],
  }
}

async function deletePassives(identityIds) {
  for (const id of identityIds) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/passives?identity_id=eq.${id}`,
      { method: 'DELETE', headers }
    )
    if (!res.ok) {
      console.error(`❌ DELETE passives 실패 (${id}):`, await res.text())
    }
  }
}

async function insertPassives(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/passives`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    console.error('❌ INSERT passives 실패:', await res.text())
    process.exit(1)
  }
}

async function main() {
  console.log('📥 DB에서 이상 인격 목록 조회...')
  const identities = await getIdentities()
  console.log(`  → ${identities.length}개 인격`)

  // name_kr → UUID 매핑
  const nameToId = {}
  for (const id of identities) {
    if (id.name_kr) nameToId[id.name_kr] = id.id
  }

  console.log('🌐 단빵숲 API에서 패시브 데이터 수집...')
  const allRows = []
  let matched = 0
  let skipped = 0

  for (const apiId of BASLIMBUS_API_IDS) {
    const { name, passives } = await fetchPassivesFromApi(apiId)
    const identityId = nameToId[name]

    if (!identityId) {
      console.warn(`  ⚠ "${name}" (API ${apiId}) → DB 매칭 실패, 건너뜀`)
      skipped++
      continue
    }

    // level 3 (기본) 패시브만 사용
    const basePassives = passives.filter(p => p.level === 3)
    const battlePassives = basePassives.filter(p => p.isMain)
    const supportPassives = basePassives.filter(p => !p.isMain)

    let order = 1
    for (const p of battlePassives) {
      allRows.push({
        identity_id: identityId,
        passive_type: 'battle',
        name: p.name,
        sin_affinity: p.resource === '없음' ? null : p.resource,
        sin_count: p.resQuantity || null,
        active_cond: p.activeCond || null,
        description: p.effect || null,
        passive_order: order++,
      })
    }

    order = 1
    for (const p of supportPassives) {
      allRows.push({
        identity_id: identityId,
        passive_type: 'support',
        name: p.name,
        sin_affinity: p.resource === '없음' ? null : p.resource,
        sin_count: p.resQuantity || null,
        active_cond: p.activeCond || null,
        description: p.effect || null,
        passive_order: order++,
      })
    }

    matched++
    console.log(`  ✓ ${name} → ${battlePassives.length} battle + ${supportPassives.length} support`)
  }

  console.log(`\n📊 합계: ${matched}/${BASLIMBUS_API_IDS.length} 매칭, ${allRows.length}개 패시브`)

  if (allRows.length === 0) {
    console.log('삽입할 패시브가 없습니다.')
    process.exit(0)
  }

  // 기존 패시브 삭제
  const identityIds = [...new Set(allRows.map(r => r.identity_id))]
  console.log('🗑  기존 패시브 삭제...')
  await deletePassives(identityIds)

  // 새 패시브 삽입
  console.log('💾 패시브 삽입...')
  await insertPassives(allRows)

  console.log(`\n✅ 완료! ${allRows.length}개 패시브 시드됨`)
}

main().catch(err => {
  console.error('❌ 오류:', err)
  process.exit(1)
})
