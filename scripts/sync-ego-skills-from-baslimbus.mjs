/**
 * sync-ego-skills-from-baslimbus.mjs
 * 단빵숲 EGO 상세 API에서 스킬/패시브/내성 등 상세 데이터를 가져와 DB 업데이트
 *
 * 추가 필드:
 *   passive_name, passive_content       — 패시브
 *   ego_skills, ego_cor_skills          — 스킬 (JSONB)
 *   resistance, cost                    — 죄악 내성/소모
 *   keywords                            — 키워드
 *   obtaining_method, cor_image_url     — 입수 방법, 부식 CG
 *
 * 사용: node --env-file=.env.local scripts/sync-ego-skills-from-baslimbus.mjs
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BAS_LIST_API   = 'https://baslimbus.store/dictionary/paginated/ego'
const BAS_DETAIL_API = 'https://baslimbus.store/dictionary/ego'

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

const CHAR_EN_NAMES = [
  'Yi_Sang', 'Faust', 'Don_Quixote', 'Ry%C5%8Dsh%C5%AB', 'Ryōshū', 'Ryoshu',
  'Meursault', 'Hong_Lu', 'Heathcliff', 'Ishmael', 'Rodion',
  'Sinclair', 'Outis', 'Gregor',
]

function extractGameId(url) {
  if (!url) return null
  const match = url.match(/\/(\d+)_[^/]+\.webp/)
  return match ? match[1] : null
}

function extractNameFromIcon(url) {
  if (!url || !url.includes('_Icon.webp')) return null
  const filename = url.split('/').pop()
  let name = filename.replace('_Icon.webp', '')
  for (const charEn of CHAR_EN_NAMES) {
    name = name.replace(new RegExp(`_${charEn}$`, 'i'), '')
  }
  return name.replace(/_/g, ' ').trim()
}

async function fetchAllApiEgos() {
  const all = []
  let page = 0
  while (true) {
    const res = await fetch(`${BAS_LIST_API}?minWeight=1&maxWeight=7&size=200&page=${page}`)
    const data = await res.json()
    all.push(...data.list)
    if (data.last) break
    page++
    if (page > 20) break
  }
  return all
}

async function fetchEgoDetail(apiId) {
  const res = await fetch(`${BAS_DETAIL_API}/${apiId}`)
  if (!res.ok) return null
  return res.json()
}

// SQL로 컬럼 추가 (Supabase SQL Editor에서 직접 실행 가능)
const MIGRATION_SQL = `
ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS passive_name     TEXT;
ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS passive_content  TEXT;
ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS ego_skills       JSONB;
ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS ego_cor_skills   JSONB;
ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS resistance       TEXT[];
ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS cost             INT[];
ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS keywords         TEXT[];
ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS obtaining_method TEXT;
ALTER TABLE limbus.ego ADD COLUMN IF NOT EXISTS cor_image_url    TEXT;
`

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ .env.local에서 SUPABASE URL/KEY를 설정해주세요.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // 1. DB 마이그레이션
  console.log('📋 DB 컬럼 추가 중...')
  const { error: migErr } = await supabase.rpc('exec_sql', { sql: MIGRATION_SQL })
  if (migErr) {
    console.log('  ⚠️  RPC 없음 — Supabase SQL Editor에서 직접 실행하세요:')
    console.log(MIGRATION_SQL)
    console.log('  → 계속 진행합니다 (컬럼이 이미 존재하면 정상)\n')
  } else {
    console.log('  ✓ 컬럼 추가 완료\n')
  }

  // 2. 단빵숲 목록 수집
  console.log('📡 단빵숲 API EGO 목록 수집 중...')
  const apiEgos = await fetchAllApiEgos()
  console.log(`  → ${apiEgos.length}개\n`)

  // 3. DB 레코드 조회
  console.log('📋 Supabase ego 레코드 조회 중...')
  const { data: dbEgos, error } = await supabase
    .schema('limbus').from('ego')
    .select('id, sinner_id, name, name_kr, image_url')
  if (error) { console.error('❌ 조회 실패:', error.message); process.exit(1) }
  console.log(`  → ${dbEgos.length}개\n`)

  // DB 매칭용 맵
  const dbByKey = new Map()
  for (const rec of dbEgos) {
    const gameId = extractGameId(rec.image_url)
    if (gameId) dbByKey.set(`${rec.sinner_id}:${gameId}`, rec)
  }

  // 4. 상세 데이터 수집 + 업데이트
  console.log('🔄 상세 데이터 수집 및 업데이트 중...')
  let matched = 0, unmatched = 0, updated = 0, errors = 0
  const unmatchedList = []

  for (const apiEgo of apiEgos) {
    const sinnerId = CHAR_TO_SINNER_ID[apiEgo.character]
    if (!sinnerId) { unmatched++; unmatchedList.push(`[알 수 없는 캐릭터] ${apiEgo.character}`); continue }

    // DB 매칭 (3단계)
    const gameId = extractGameId(apiEgo.zoomImage)
    let dbRec = gameId ? (dbByKey.get(`${sinnerId}:${gameId}`) ?? null) : null
    if (!dbRec) {
      const iconName = extractNameFromIcon(apiEgo.zoomImage)
      if (iconName) dbRec = dbEgos.find(r => r.sinner_id === sinnerId && r.name.toLowerCase() === iconName.toLowerCase()) ?? null
    }
    if (!dbRec) dbRec = dbEgos.find(r => r.sinner_id === sinnerId && r.name_kr === apiEgo.name) ?? null

    if (!dbRec) {
      unmatched++
      unmatchedList.push(`[매칭 실패] ${apiEgo.character} - ${apiEgo.name}`)
      continue
    }

    matched++

    // 상세 API 호출
    const detail = await fetchEgoDetail(apiEgo.id)
    if (!detail) {
      console.error(`\n  ❌ 상세 API 실패: ${apiEgo.name}`)
      errors++
      continue
    }

    const updateData = {
      passive_name:     detail.passive?.name ?? null,
      passive_content:  detail.passive?.content ?? null,
      ego_skills:       detail.egoskills ?? null,
      ego_cor_skills:   detail.egoCorSkills ?? null,
      resistance:       detail.resistance ?? null,
      cost:             detail.cost ?? null,
      keywords:         detail.keyword ?? null,
      obtaining_method: detail.obtainingMethod ?? null,
      cor_image_url:    detail.corImage ?? null,
    }

    const { error: updateErr } = await supabase
      .schema('limbus').from('ego')
      .update(updateData)
      .eq('id', dbRec.id)

    if (updateErr) {
      // 컬럼 없으면 에러 — SQL 먼저 실행 필요
      if (updateErr.message.includes('column')) {
        console.error(`\n\n❌ 컬럼이 없습니다. Supabase SQL Editor에서 먼저 실행하세요:`)
        console.log(MIGRATION_SQL)
        process.exit(1)
      }
      console.error(`\n  ❌ ${apiEgo.name}: ${updateErr.message}`)
      errors++
    } else {
      updated++
    }

    process.stdout.write(`\r  진행: ${matched + unmatched}/${apiEgos.length} (매칭 ${matched} / 업데이트 ${updated} / 미매칭 ${unmatched} / 에러 ${errors})   `)
  }

  console.log(`\n\n✅ 완료!`)
  console.log(`  매칭: ${matched} / 업데이트: ${updated} / 미매칭: ${unmatched} / 에러: ${errors}`)
  if (unmatchedList.length > 0) {
    console.log('\n⚠️  미매칭 목록:')
    unmatchedList.forEach(m => console.log(`  - ${m}`))
  }

  console.log('\n💡 컬럼 추가 SQL (필요시 Supabase SQL Editor에서 실행):')
  console.log(MIGRATION_SQL)
}

main().catch(console.error)
