#!/usr/bin/env node
/**
 * 발푸르기스밤 8회차 신규 인격/EGO 시딩 스크립트
 *
 * 대상:
 *   1. 로보토미 E.G.O::잔향 · 외로움 료슈 (인격, 3성)
 *   2. 로보토미 E.G.O::호넷【변조】 뫼르소 (인격, 3성)
 *   3. E.G.O HE 하모니 싱클레어 (EGO)
 *
 * 사용법:
 *   node --env-file=.env.local scripts/seed-new-walpurgis.mjs
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'limbus',
  'Content-Profile': 'limbus',
}

async function supabasePost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${table} failed: ${res.status} ${text}`)
  }
  return res.json()
}

const WALPURGIS_ACQ = {
  type: 'walpurgis',
  gacha: 'walpurgis',
  fragment_cost: 400,
  release_season: 7,
  walpurgis_edition: 8,
}

// ═══════════════════════════════════════════════════════════
// 1. 료슈 — 로보토미 E.G.O::잔향 · 외로움
// ═══════════════════════════════════════════════════════════
const RYOSHU_IDENTITY = {
  sinner_id: 'ryoshu',
  game_id: '10414',
  folder_name: 'Lobotomy E.G.O Lingering Fragrance Loneliness',
  name: 'Lobotomy E.G.O::Lingering Fragrance - Loneliness',
  name_kr: '로보토미 E.G.O::잔향 · 외로움',
  rarity: '3성',
  tier: 3,
  hp: 205,
  speed_min: 3,
  speed_max: 7,
  def_level: 60,
  slash_res: '내성',
  pierce_res: '보통',
  blunt_res: '내성',
  release_date: '2026-03-05',
  acquisition: '발푸르기스의 밤 Ⅷ',
  acquisition_info: WALPURGIS_ACQ,
}

const RYOSHU_SKILLS = [
  { name: '탕. 탕.', skill_type: 'pierce', sin_affinity: 'sloth', quantity: 3, base_power: 4, coin_power: 4, atk_weight: 1, skill_order: 1, uptie_level: 4 },
  { name: '공허에 피어나는 향기', skill_type: 'pierce', sin_affinity: 'envy', quantity: 2, base_power: 4, coin_power: 4, atk_weight: 1, skill_order: 2, uptie_level: 4 },
  { name: '만개', skill_type: 'pierce', sin_affinity: 'gloom', quantity: 1, base_power: 5, coin_power: 4, atk_weight: 1, skill_order: 3, uptie_level: 4 },
  { name: '예.감.시.', skill_type: 'evade', sin_affinity: 'gloom', base_power: 4, coin_power: 10, atk_weight: 1, skill_order: 4, uptie_level: 4 },
  { name: '멈추지 않는 이야기', skill_type: 'pierce', sin_affinity: 'sloth', base_power: 9, coin_power: 1, atk_weight: 3, skill_order: 3, variant_order: 2, uptie_level: 4 },
  { name: '황홀한 종말', skill_type: 'slash', sin_affinity: 'wrath', base_power: 12, coin_power: 7, atk_weight: 3, skill_order: 3, variant_order: 3, uptie_level: 4 },
]

const RYOSHU_PASSIVES = [
  { passive_type: 'battle', name: '시들지 않는 꽃', sin_affinity: 'sloth', sin_count: 2, active_cond: '보유', passive_order: 1, uptie_level: 4 },
  { passive_type: 'battle', name: '채워지지 않는 공허', sin_affinity: null, sin_count: 0, active_cond: '상시', passive_order: 2, uptie_level: 4 },
  { passive_type: 'support', name: '봄의 탄생', sin_affinity: 'sloth', sin_count: 3, active_cond: '공명', passive_order: 1, uptie_level: 4 },
]

// ═══════════════════════════════════════════════════════════
// 2. 뫼르소 — 로보토미 E.G.O::호넷【변조】
// ═══════════════════════════════════════════════════════════
const MEURSAULT_IDENTITY = {
  sinner_id: 'meursault',
  game_id: '10514',
  folder_name: 'Lobotomy E.G.O Hornet Distorted',
  name: 'Lobotomy E.G.O::Hornet [Distorted]',
  name_kr: '로보토미 E.G.O::호넷【변조】',
  rarity: '3성',
  tier: 3,
  hp: 223,
  speed_min: 4,
  speed_max: 8,
  def_level: 60,
  slash_res: '보통',
  pierce_res: '내성',
  blunt_res: '취약',
  release_date: '2026-03-05',
  acquisition: '발푸르기스의 밤 Ⅷ',
  acquisition_info: WALPURGIS_ACQ,
}

const MEURSAULT_SKILLS = [
  { name: '위협 사격', skill_type: 'pierce', sin_affinity: 'lust', quantity: 3, base_power: 4, coin_power: 4, atk_weight: 1, skill_order: 1, uptie_level: 4 },
  { name: 'E.G.O 변조 - 산탄', skill_type: 'pierce', sin_affinity: 'wrath', quantity: 2, base_power: 4, coin_power: 4, atk_weight: 1, skill_order: 2, uptie_level: 4 },
  { name: '임상 시험 - 분진 작열', skill_type: 'pierce', sin_affinity: 'wrath', quantity: 1, base_power: 4, coin_power: 3, atk_weight: 1, skill_order: 3, uptie_level: 4 },
  { name: '포자 보충', skill_type: 'evade', sin_affinity: 'wrath', base_power: 4, coin_power: 10, atk_weight: 1, skill_order: 4, uptie_level: 4 },
]

const MEURSAULT_PASSIVES = [
  {
    passive_type: 'battle', name: '포자 확산', sin_affinity: 'wrath', sin_count: 3, active_cond: '보유', passive_order: 1, uptie_level: 4,
    description: '포자를 보유한 적 처치 시, 아래 효과 적용\n- 다음 턴 동안 부여하는 포자 수치 2배가 됨\n- 기본 공격 스킬로 처치 시 (해당 스킬에서 소모하는 포자탄 / 2)만큼 포자탄 획득(소수점 올림, 스킬당 1회)',
  },
  {
    passive_type: 'battle', name: 'E.G.O 변조 / 포자탄', sin_affinity: null, sin_count: 0, active_cond: '상시', passive_order: 2, uptie_level: 4,
    description: '상시 적용: 포자탄[기본] 10개, 포자탄[산탄] 6개 보유\n포자탄을 소모하는 코인 적중 시\n- 포자탄[기본]을 소모했으면, 포자 2 부여\n- 포자탄[산탄]을 소모했으면, 포자 3 부여\n포자탄[산탄]을 소모하는 코인 사용 전 포자탄[산탄]이 없으면, 정신력 2, 포자탄[기본] 2 소모하여, 포자탄[산탄] 1 얻음\n포자가 있는 대상 사망 시 충성 페로몬 1 얻음',
  },
  {
    passive_type: 'support', name: '일벌', sin_affinity: 'wrath', sin_count: 4, active_cond: '공명', passive_order: 1, uptie_level: 4,
    description: '아군의 관통 속성 기본 공격 스킬 종료시, 해당 공격으로 입힌 체력 피해량의 10% 만큼 체력 회복(전투 당 최대 2번 발동 가능)\n- 이번 턴 동안 스킬 슬롯에 장착한 모든 기본 공격 스킬이 관통 속성이면, 턴 종료시 모든 아군 정신력 10 회복',
  },
]

// ═══════════════════════════════════════════════════════════
// 3. 싱클레어 — E.G.O HE 하모니
// ═══════════════════════════════════════════════════════════
const SINCLAIR_EGO = {
  sinner_id: 'sinclair',
  game_id: '21009',
  folder_name: 'Harmony',
  name: 'Harmony',
  name_kr: '하모니',
  grade: 'HE',
  sin_affinity: 'wrath',
  obtaining_method: '발푸르기스의 밤 Ⅷ',
  cost: [0, 0, 0, 0, 0, 0, 0],
  keywords: ['리듬'],
  passive_name: '그건, 리듬이었어요',
  passive_content: '턴 시작 시 리듬 2 얻음\n대상 처치 시 자신의 체력을 최대 체력의 5%만큼 회복하고, 자신의 정신력 5 회복(턴당 1회)\n- E.G.O 스킬 - 하모니로 처치했으면 위 수치가 2배로 적용됨\n이번 턴에 자신의 정신력이 감소했으면, 턴 종료 시 자신의 정신력을 (4 + 적 전체의 화상과 출혈 위력의 합 / 10)만큼 회복 (최대 10)',
  ego_skills: {
    name: '홍염살',
    skill_type: 'slash',
    sin_affinity: 'wrath',
    base_power: 6,
    coin_power: 2,
    atk_weight: 3,
    offense_level: 62,
    sanity_cost: 10,
  },
  ego_cor_skills: {
    name: '홍염살',
    skill_type: 'slash',
    sin_affinity: 'wrath',
    base_power: 14,
    coin_power: -2,
    atk_weight: 1,
    offense_level: 64,
    sanity_cost: 30,
  },
}

// ── 메인 ──
async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  발푸르기스밤 8회차 신규 데이터 시딩               ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // 1. 료슈 — 잔향 · 외로움
  console.log('── 1. 료슈: 로보토미 E.G.O::잔향 · 외로움 ──')
  const [ryoshu] = await supabasePost('identities', RYOSHU_IDENTITY)
  console.log('  identity ID:', ryoshu.id)

  for (const skill of RYOSHU_SKILLS) {
    await supabasePost('skills', { ...skill, identity_id: ryoshu.id })
    console.log('  + skill:', skill.name)
  }
  for (const passive of RYOSHU_PASSIVES) {
    await supabasePost('passives', { ...passive, identity_id: ryoshu.id })
    console.log('  + passive:', passive.name, `(${passive.passive_type})`)
  }
  console.log('  => 완료\n')

  // 2. 뫼르소 — 호넷【변조】
  console.log('── 2. 뫼르소: 로보토미 E.G.O::호넷【변조】 ──')
  const [meursault] = await supabasePost('identities', MEURSAULT_IDENTITY)
  console.log('  identity ID:', meursault.id)

  for (const skill of MEURSAULT_SKILLS) {
    await supabasePost('skills', { ...skill, identity_id: meursault.id })
    console.log('  + skill:', skill.name)
  }
  for (const passive of MEURSAULT_PASSIVES) {
    await supabasePost('passives', { ...passive, identity_id: meursault.id })
    console.log('  + passive:', passive.name, `(${passive.passive_type})`)
  }
  console.log('  => 완료\n')

  // 3. 싱클레어 — HE 하모니
  console.log('── 3. 싱클레어: E.G.O HE 하모니 ──')
  const egoData = { ...SINCLAIR_EGO }
  // ego_skills/ego_cor_skills는 JSONB 컬럼
  const [sinclair] = await supabasePost('ego', egoData)
  console.log('  ego ID:', sinclair.id)
  console.log('  => 완료\n')

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  전체 시딩 완료!                                  ║')
  console.log('║  료슈 ID:    ' + ryoshu.id.substring(0, 20) + '...  ║')
  console.log('║  뫼르소 ID:  ' + meursault.id.substring(0, 20) + '...  ║')
  console.log('║  싱클레어 ID: ' + sinclair.id.substring(0, 20) + '...  ║')
  console.log('╚══════════════════════════════════════════════════╝')
}

main().catch(err => {
  console.error('\n치명적 오류:', err)
  process.exit(1)
})
