/**
 * sync-ego-from-baslimbus.mjs
 * 단빵숲 API(baslimbus.store)에서 EGO 데이터를 가져와 Supabase DB 업데이트
 *
 * 매칭 방법: image_url에서 게임 파일 ID 추출 (예: 20409) → API zoomImage와 매칭
 * 업데이트 필드: name_kr, grade, sin_affinity
 *
 * 사용: node --env-file=.env.local scripts/sync-ego-from-baslimbus.mjs
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BAS_API = 'https://baslimbus.store/dictionary/paginated/ego'

const CHAR_TO_SINNER_ID = {
  '이상':    'yi-sang',
  '파우스트': 'faust',
  '돈키호테': 'don-quixote',
  '료슈':    'ryoshu',
  '뫼르소':  'meursault',
  '홍루':    'hong-lu',
  '히스클리프': 'heathcliff',
  '이스마엘': 'ishmael',
  '로쟈':    'rodion',
  '싱클레어': 'sinclair',
  '오티스':  'outis',
  '그레고르': 'gregor',
}

const SIN_KR_TO_EN = {
  '분노': 'wrath',
  '색욕': 'lust',
  '나태': 'sloth',
  '탐식': 'gluttony',
  '우울': 'gloom',
  '오만': 'pride',
  '질투': 'envy',
}

// URL에서 게임 파일 번호 추출: .../20409_awaken_profile.webp → '20409'
function extractGameId(url) {
  if (!url) return null
  const match = url.match(/\/(\d+)_[^/]+\.webp/)
  return match ? match[1] : null
}

// _Icon.webp URL에서 EGO 영문명 추출
// e.g. .../Hex_Nail_Rodion_Icon.webp → 'Hex Nail' (캐릭터명 제거)
const CHAR_EN_NAMES = [
  'Yi_Sang', 'Faust', 'Don_Quixote', 'Ry%C5%8Dsh%C5%AB', 'Ryōshū', 'Ryoshu',
  'Meursault', 'Hong_Lu', 'Heathcliff', 'Ishmael', 'Rodion',
  'Sinclair', 'Outis', 'Gregor',
]
function extractNameFromIcon(url) {
  if (!url || !url.includes('_Icon.webp')) return null
  const filename = url.split('/').pop()            // "Hex_Nail_Rodion_Icon.webp"
  let name = filename.replace('_Icon.webp', '')    // "Hex_Nail_Rodion"
  for (const charEn of CHAR_EN_NAMES) {
    name = name.replace(new RegExp(`_${charEn}$`, 'i'), '')
  }
  return name.replace(/_/g, ' ').trim()            // "Hex Nail"
}

async function fetchAllApiEgos() {
  const all = []
  let page = 0
  while (true) {
    const res = await fetch(`${BAS_API}?minWeight=1&maxWeight=7&size=200&page=${page}`)
    const data = await res.json()
    all.push(...data.list)
    if (data.last) break
    page++
    if (page > 20) break // 안전장치
  }
  return all
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ .env.local에서 SUPABASE URL/KEY를 설정해주세요.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // 1. 단빵숲 API에서 전체 EGO 수집
  console.log('📡 단빵숲 API에서 EGO 데이터 수집 중...')
  const apiEgos = await fetchAllApiEgos()
  console.log(`  → ${apiEgos.length}개 수신`)

  // 2. Supabase에서 기존 ego 레코드 조회
  console.log('\n📋 Supabase ego 레코드 조회 중...')
  const { data: dbEgos, error } = await supabase
    .schema('limbus').from('ego')
    .select('id, sinner_id, name, name_kr, image_url, grade, sin_affinity')
  if (error) { console.error('❌ 조회 실패:', error.message); process.exit(1) }
  console.log(`  → ${dbEgos.length}개 조회`)

  // 3. DB 레코드를 "sinner_id:gameId" → record 맵으로
  const dbByKey = new Map()
  for (const rec of dbEgos) {
    const gameId = extractGameId(rec.image_url)
    if (gameId) dbByKey.set(`${rec.sinner_id}:${gameId}`, rec)
  }

  // 4. API EGO와 매칭 → 업데이트
  console.log('\n🔄 매칭 및 업데이트 중...')
  let matched = 0, unmatched = 0, updated = 0, errors = 0
  const unmatchedList = []

  for (const apiEgo of apiEgos) {
    const sinnerId = CHAR_TO_SINNER_ID[apiEgo.character]
    if (!sinnerId) { unmatched++; unmatchedList.push(`[알 수 없는 캐릭터] ${apiEgo.character}`); continue }

    // 1순위: game ID로 매칭
    const gameId = extractGameId(apiEgo.zoomImage)
    let dbRec = gameId ? dbByKey.get(`${sinnerId}:${gameId}`) ?? null : null

    // 2순위: _Icon.webp 파일명에서 영문명 추출 → DB name 매칭
    if (!dbRec) {
      const iconName = extractNameFromIcon(apiEgo.zoomImage)
      if (iconName) {
        dbRec = dbEgos.find(r =>
          r.sinner_id === sinnerId &&
          r.name.toLowerCase() === iconName.toLowerCase()
        ) ?? null
      }
    }

    // 3순위: name_kr 직접 매칭
    if (!dbRec) {
      dbRec = dbEgos.find(r =>
        r.sinner_id === sinnerId &&
        r.name_kr === apiEgo.name
      ) ?? null
    }

    if (!dbRec) {
      unmatched++
      unmatchedList.push(`[매칭 실패] ${apiEgo.character} - ${apiEgo.name} (gameId: ${gameId})`)
      continue
    }

    matched++
    const sinAffinity = SIN_KR_TO_EN[apiEgo.resources?.[0]] ?? null
    const { error: updateErr } = await supabase
      .schema('limbus').from('ego')
      .update({
        name_kr:      apiEgo.name,
        grade:        apiEgo.grade,
        sin_affinity: sinAffinity,
      })
      .eq('id', dbRec.id)

    if (updateErr) { console.error(`\n  ❌ ${apiEgo.name}: ${updateErr.message}`); errors++ }
    else updated++

    process.stdout.write(`\r  진행: ${matched + unmatched}/${apiEgos.length} (매칭 ${matched} / 업데이트 ${updated} / 미매칭 ${unmatched})   `)
  }

  console.log(`\n\n✅ 완료!`)
  console.log(`  매칭: ${matched} / 업데이트: ${updated} / 미매칭: ${unmatched} / 에러: ${errors}`)

  if (unmatchedList.length > 0) {
    console.log('\n⚠️  미매칭 목록:')
    unmatchedList.forEach(m => console.log(`  - ${m}`))
  }
}

main().catch(console.error)
