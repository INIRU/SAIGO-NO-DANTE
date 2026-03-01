/**
 * scripts/seed-yi-sang.mjs
 * 이상(Yi Sang) 인격 15개 + EGO 8개를 Supabase limbus 스키마에 시드
 *
 * 실행: node --env-file=.env.local scripts/seed-yi-sang.mjs
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

async function del(table, column, value) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`,
    { method: 'DELETE', headers }
  )
  if (!res.ok) {
    console.error(`❌ DELETE ${table} 실패:`, await res.text())
    process.exit(1)
  }
}

async function insert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    console.error(`❌ INSERT ${table} 실패:`, await res.text())
    process.exit(1)
  }
}

// ── 이상 인격 15개 ──────────────────────────────────────────

const identities = [
  // 1성
  { sinner_id: 'yi-sang', name: 'LCB Sinner',                                name_kr: 'LCB 수감자',                 tier: 1, hp: 221, speed_min: 4, speed_max: 8, def_level: 58, sin_affinity: 'sloth',    keywords: ['LCB', '림버스 컴퍼니'],  rarity: '1성' },
  // 2성
  { sinner_id: 'yi-sang', name: 'Seven Assoc. South Section 6',              name_kr: '남부 세븐 협회 6과',         tier: 1, hp: 178, speed_min: 3, speed_max: 7, def_level: 42, sin_affinity: 'pride',    keywords: ['세븐 협회'],             rarity: '2성' },
  { sinner_id: 'yi-sang', name: 'Molar Office Fixer',                        name_kr: '어금니 사무소 해결사',       tier: 1, hp: 192, speed_min: 3, speed_max: 7, def_level: 48, sin_affinity: 'envy',     keywords: ['어금니 사무소'],          rarity: '2성' },
  { sinner_id: 'yi-sang', name: 'The Pequod First Mate',                     name_kr: '피쿼드호 일등 항해사',       tier: 1, hp: 203, speed_min: 4, speed_max: 7, def_level: 52, sin_affinity: 'gloom',    keywords: ['피쿼드호'],              rarity: '2성' },
  { sinner_id: 'yi-sang', name: 'Dieci Assoc. South Section 4',              name_kr: '남부 디에치 협회 4과',       tier: 1, hp: 185, speed_min: 3, speed_max: 6, def_level: 45, sin_affinity: 'sloth',    keywords: ['디에치 협회'],            rarity: '2성' },
  { sinner_id: 'yi-sang', name: 'LCE E.G.O Lantern',                         name_kr: 'LCE E.G.O::초롱',           tier: 1, hp: 190, speed_min: 3, speed_max: 7, def_level: 46, sin_affinity: 'pride',    keywords: ['LCE'],                   rarity: '2성' },
  // 3성
  { sinner_id: 'yi-sang', name: 'Blade Lineage Salsu',                       name_kr: '검계 살수',                  tier: 1, hp: 172, speed_min: 3, speed_max: 7, def_level: 40, sin_affinity: 'gloom',    keywords: ['검계'],                  rarity: '3성' },
  { sinner_id: 'yi-sang', name: 'Effloresced E.G.O Spicebush',               name_kr: '개화 E.G.O::동백',           tier: 1, hp: 195, speed_min: 2, speed_max: 5, def_level: 50, sin_affinity: 'sloth',    keywords: ['개화 E.G.O'],             rarity: '3성' },
  { sinner_id: 'yi-sang', name: 'W Corp. L3 Cleanup Agent',                  name_kr: 'W사 3등급 정리 요원',        tier: 1, hp: 243, speed_min: 4, speed_max: 7, def_level: 62, sin_affinity: 'pride',    keywords: ['W사'],                   rarity: '3성' },
  { sinner_id: 'yi-sang', name: 'The Ring Pointillist Student',               name_kr: '약지 점묘파 스튜던트',       tier: 1, hp: 188, speed_min: 3, speed_max: 6, def_level: 48, sin_affinity: 'gluttony', keywords: ['약지', '점묘파'],         rarity: '3성' },
  { sinner_id: 'yi-sang', name: 'Lobotomy E.G.O Solemn Lament',              name_kr: '로보토미 E.G.O::엄숙한 애도', tier: 1, hp: 210, speed_min: 3, speed_max: 7, def_level: 55, sin_affinity: 'sloth',   keywords: ['로보토미 E.G.O'],         rarity: '3성' },
  { sinner_id: 'yi-sang', name: 'Liu Assoc. South Section 3',                name_kr: '남부 리우 협회 3과',         tier: 1, hp: 200, speed_min: 3, speed_max: 8, def_level: 52, sin_affinity: 'wrath',    keywords: ['리우 협회'],              rarity: '3성' },
  { sinner_id: 'yi-sang', name: 'N Corp. E.G.O Fell Bullet',                 name_kr: 'N사 E.G.O::흉탄',           tier: 1, hp: 218, speed_min: 3, speed_max: 7, def_level: 56, sin_affinity: 'pride',    keywords: ['N사'],                   rarity: '3성' },
  { sinner_id: 'yi-sang', name: 'Heishou Pack - Wu Branch Adept',            name_kr: '흑수 - 오 필두',             tier: 1, hp: 230, speed_min: 3, speed_max: 7, def_level: 58, sin_affinity: 'sloth',    keywords: ['흑수', '홍원'],           rarity: '3성' },
  { sinner_id: 'yi-sang', name: 'The House of Spiders The Index Nursefather', name_kr: '거미집 검지 아비',           tier: 1, hp: 225, speed_min: 2, speed_max: 5, def_level: 60, sin_affinity: 'gloom',   keywords: ['거미집', '검지'],         rarity: '3성' },
]

// ── 이상 EGO 8개 ────────────────────────────────────────────

const egos = [
  // ZAYIN
  { sinner_id: 'yi-sang', name: 'Crow_s Eye View',     name_kr: '오감도',       grade: 'ZAYIN', sin_affinity: 'sloth',    description: '까마귀의 눈으로 바라본 세계', corrosion_risk: '낮음' },
  { sinner_id: 'yi-sang', name: 'Bygone Days',          name_kr: '지난 날',      grade: 'ZAYIN', sin_affinity: 'gloom',    description: '지나간 날들의 기억',          corrosion_risk: '낮음' },
  // TETH
  { sinner_id: 'yi-sang', name: '4th Match Flame',      name_kr: '4번째 성냥불', grade: 'TETH',  sin_affinity: 'wrath',    description: '네 번째 성냥의 불꽃',         corrosion_risk: '보통' },
  { sinner_id: 'yi-sang', name: 'Wishing Cairn',        name_kr: '소망석',       grade: 'TETH',  sin_affinity: 'gluttony', description: '소망을 담은 돌탑',            corrosion_risk: '보통' },
  // HE
  { sinner_id: 'yi-sang', name: 'Dimension Shredder',   name_kr: '차원찢개',     grade: 'HE',    sin_affinity: 'envy',     description: '차원을 찢는 힘',              corrosion_risk: '높음' },
  { sinner_id: 'yi-sang', name: 'Fell Bullet',          name_kr: '흉탄',         grade: 'HE',    sin_affinity: 'pride',    description: 'N사의 흉악한 탄환',           corrosion_risk: '높음' },
  // WAW
  { sinner_id: 'yi-sang', name: 'Sunshower',            name_kr: '여우비',       grade: 'WAW',   sin_affinity: 'lust',     description: '해가 떠 있는데 내리는 비',    corrosion_risk: '매우 높음' },
  { sinner_id: 'yi-sang', name: 'Great Trichiliocosm',  name_kr: '삼천대세계',   grade: 'WAW',   sin_affinity: 'gloom',    description: '삼천 개의 세계를 아우르는 힘', corrosion_risk: '매우 높음' },
]

// ── 실행 ────────────────────────────────────────────────────

console.log('🗑️  기존 이상 인격/EGO 삭제 중...')
await del('identities', 'sinner_id', 'yi-sang')
await del('ego', 'sinner_id', 'yi-sang')

console.log(`📋 인격 ${identities.length}개 삽입 중...`)
await insert('identities', identities)

console.log(`📋 EGO ${egos.length}개 삽입 중...`)
await insert('ego', egos)

console.log('\n✅ 이상 시드 완료!')
console.log('\n인격:')
identities.forEach(i => console.log(`  [${i.rarity}] ${i.name_kr} (${i.name})`))
console.log('\nEGO:')
egos.forEach(e => console.log(`  [${e.grade}] ${e.name_kr} (${e.name})`))
