#!/usr/bin/env node
/**
 * 발푸르기스밤 8회차 스킬 상세 업데이트 스크립트
 *
 * 업데이트 내용:
 *   - 료슈 잔향·외로움: offense_level, coins, description 추가 + 황홀한 종말 skill_type/sin_affinity 수정
 *   - 뫼르소 호넷【변조】: offense_level, coins, description 추가
 *   - 싱클레어 하모니 EGO: ego_skills/ego_cor_skills JSONB에 coins, description 추가
 *
 * 사용법:
 *   node --env-file=.env.local scripts/update-walpurgis-details.mjs
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

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function supabasePatch(table, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${table}/${id} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

// ═══════════════════════════════════════════════════════════
// 료슈 — 로보토미 E.G.O::잔향 · 외로움
// ═══════════════════════════════════════════════════════════
const RYOSHU_ID = '508224a9-eb40-4a42-a49d-d2f80a96e71f'

const RYOSHU_UPDATES = [
  {
    name: '탕. 탕.',
    offense_level: 62,
    coins: 2,
    description: `[사용시] 대상의 진동과 침잠의 합 6당 코인 위력 +1 (최대 2)
[코인 1] 탄환-고독 1 소모
[적중시] 침잠 횟수 2 증가
[코인 2] 탄환-고독 1 소모
[적중시] 진동 3 부여`,
  },
  {
    name: '공허에 피어나는 향기',
    offense_level: 62,
    coins: 3,
    description: `[사용시] 대상의 진동과 침잠의 합 6당 코인 위력 +1 (최대 2)
[사용시] 대상의 잔향 1당 피해량 +1%
[코인 1] 탄환-고독 1 소모
[적중시] 침잠 횟수 3 증가
[코인 2] [적중시] 잔향 3 부여
[적중시] 진동 횟수 2 증가
[코인 3] [적중시] 잔향 3 부여
[적중시] 진동 횟수 2 증가`,
  },
  {
    name: '만개',
    offense_level: 63,
    coins: 3,
    description: `[사용시] 대상의 진동과 침잠의 합 6당 코인 위력 +1 (최대 2)
[사용시] 대상의 잔향 1당 피해량 +1%
[코인 1] [적중시] 잔향 1 부여
[적중시] 침잠 횟수 3 증가
[코인 2] [적중시] 잔향 1 부여
[적중시] 침잠 4 부여
[코인 3] [적중시] 잔향 1 부여
[적중시] 진동 2 부여
[적중시] 진동 폭발. 대상의 진동 횟수 1 감소
[적중시] 대상의 침잠만큼 우울 피해`,
  },
  {
    name: '예.감.시.',
    offense_level: 63,
    coins: 1,
    description: `[턴 종료시] 꽃잎 10 얻음 (턴당 1회)
[턴 종료시] 다음 턴에 취약 2, 공격 위력 증가 2 얻음 (턴당 1회)`,
  },
  {
    name: '멈추지 않는 이야기',
    offense_level: 63,
    coins: 3,
    description: `[합 불가능]
광역 난사
이 스킬에서 고독을 부여할 때, 대상이 이번 턴 또는 다음 턴에 부여될 고독이 있으면 대신 진동 폭발. 대상의 진동 횟수 1 감소
[코인 1] [적중시] 침잠 횟수 1 증가
[적중시] 다음 턴에 고독 2 부여
[코인 2] [적중시] 진동 2 부여
[적중시] 다음 턴에 고독 2 부여
[코인 3] [적중시] 진동 2 부여
[적중시] 다음 턴에 고독 2 부여`,
  },
  {
    // FIX: skill_type was 'slash' → 'pierce', sin_affinity was 'wrath' → 'gloom'
    name: '황홀한 종말',
    offense_level: 65,
    coins: 1,
    skill_type: 'pierce',
    sin_affinity: 'gloom',
    description: `[합 불가능]
이 스킬은 외부 효과로 재사용할 수 없음
이 스킬 공격 가중치보다 낮은 공격 대상 1당 피해량 +30%(집중 전투인 경우, 부위로 판정)
[사용시] 모든 대상의 잔향 합 5당 최종 위력 +1 (최대 6)
[공격 종료시] 자신의 꽃잎 소멸
[코인 1] [적중시] 잔향 5 부여
[적중시] 침잠 3 부여
[적중시] 진동 3 부여
[적중시] 진동 폭발. 대상의 진동 횟수 1 감소
[적중시] 대상의 침잠만큼 우울 피해`,
  },
]

// ═══════════════════════════════════════════════════════════
// 뫼르소 — 로보토미 E.G.O::호넷【변조】
// ═══════════════════════════════════════════════════════════
const MEURSAULT_ID = 'd095dfc3-502f-4985-8202-7e1e5b319374'

const MEURSAULT_UPDATES = [
  {
    name: '위협 사격',
    offense_level: 63,
    coins: 2,
    description: `대상의 포자 5당 피해량 +10%(최대 30%)
[사용 전] 자신의 포자탄[기본]이 최댓값이면, 적중 시 관통 취약 1 부여(턴당 1회)
[사용시] 대상의 화상과 출혈의 합 6당 코인 위력 +1 (최대 2)
[코인 1] 포자탄[기본] 1 소모
[적중시] 화상 2 부여
[코인 2] 포자탄[기본] 1 소모
[적중시] 출혈 2 부여`,
  },
  {
    name: 'E.G.O 변조 - 산탄',
    offense_level: 64,
    coins: 3,
    description: `서브 타겟에게 가하는 피해량 -50%
대상의 포자 5당 피해량 +15%(최대 45%)
[사용시] 메인 타겟의 화상과 출혈의 합 6당 코인 위력 +1 (최대 1)
[사용시] 자신에게 충성 페로몬이 있으면, 합 위력 +1
[사용시] 자신의 충성 페로몬만큼 마지막 코인부터 파괴 불가 코인으로 변경됨
[공격 종료시] 자신의 포자탄[기본]이 1개 이하면, 재장전[포자보충]
[코인 1] 포자탄[산탄] 1 소모
[적중시] 화상 횟수 1 증가
[코인 2] 포자탄[산탄] 1 소모
[적중시] 출혈 횟수 2 증가
[코인 3] 포자탄[산탄] 1 소모
[적중시] 화상 횟수 1 증가`,
  },
  {
    name: '임상 시험 - 분진 작열',
    offense_level: 65,
    coins: 4,
    description: `이 스킬 공격 가중치보다 낮은 공격 대상 1당 피해량 +50%(집중 전투인 경우, 부위로 판정)
대상의 포자 5당 피해량 +10%
[사용 전] 자신의 포자탄[기본]이 2 이하면, 정신력 6 소모하여 포자탄[기본] 3 얻음
[사용시] 메인 타겟의 화상과 출혈의 합 6당 코인 위력 +1 (최대 3)
[사용시] 자신에게 충성 페로몬이 있으면, 합 위력 +1
[사용시] 자신의 충성 페로몬만큼 3코인부터 파괴 불가 코인으로 변경됨
[사용시] 자신의 충성 페로몬이 3이면, 가중치 +1
[공격 종료시] 재장전[포자보충]
[코인 1] 이 코인은 1명의 대상에게만 적중함(메인 타겟 우선 적용)
포자탄[기본] 1 소모
[적중시] 화상 3 부여
[코인 2] 이 코인은 1명의 대상에게만 적중함(메인 타겟 우선 적용)
포자탄[기본] 1 소모
[적중시] 출혈 2 부여
[코인 3] 이 코인은 1명의 대상에게만 적중함(메인 타겟 우선 적용)
포자탄[기본] 1 소모
[적중시] 출혈 2 부여
[코인 4] 파괴 불가 코인
포자탄[산탄] 1 소모
서브 타겟에게 가하는 피해량 -50%
자신의 충성 페로몬 1당 이 코인 피해량 +5%(최대 15%)
[파괴되지 않고 적중시] 대상의 포자가 최댓값이면, 아래 효과 적용
- (화상 위력*포자 수치 / 10)만큼 분노 속성 피해를 입힘 (이 효과로 분노 피해를 입혔으면 화상이 발동한 것으로 취급함)
- 화상 횟수 1 감소
- 포자 소멸
[적중시] 화상 횟수 1 증가, 출혈 횟수 2 증가`,
  },
  {
    name: '포자 보충',
    offense_level: 63,
    coins: 1,
    description: `[전투 시작시] 재장전[포자보충](턴당 1회)
[회피 사용시] 공격자의 화상과 출혈의 합 6당 코인 위력 +1 (최대 3)
[회피 성공시] 자신의 체력 10 회복 (턴당 1회)
- 충성 페로몬 보유 중이면, 수치당 5씩 회복량 추가`,
  },
]

// ═══════════════════════════════════════════════════════════
// 싱클레어 — E.G.O HE 하모니
// ═══════════════════════════════════════════════════════════
const SINCLAIR_EGO_ID = 'c0f630da-c4ab-4132-b372-f1f003dd2978'

const HARMONY_AWAKENING_DESC = `메인 타겟의 출혈과 화상의 합 2당, 합 위력 +1 (최대 10)
자신의 잃은 체력 비율만큼 피해량 증가(최대 20%)
서브 타겟에게 가하는 피해량 -50%
[대상 처치시] 모든 아군이 다음 턴에 리듬 2 얻음(스킬 당 1회)
[공격 종료시] 자신을 제외한 정신력이 가장 낮은 아군 (1 + 최대 공명 수)명의 정신력 12 회복(최대 4명)
[공격 종료시] 2턴 동안 전투 종료 시 정신력 8 감소
[코인 1] [적중시] 출혈 2 부여
[코인 2] [적중시] 화상 2 부여
[코인 3] [앞면 적중시] 자신의 체력이 10% 이상이면, 4 ~ 8 만큼 체력 피해 입음 (코인당 1회)
- 이후 이 코인 재사용(스킬당 최대 4회)
- 이 효과로 흐트러짐 상태가 되거나 체력이 1미만으로 감소하지 않음
[적중시] 화상 1 부여
[적중시] 출혈 1 부여
[적중시] 무작위 아군 1명이 다음 턴에 리듬 1 ~ 3 얻음(코인당 1회)`

const HARMONY_CORROSION_DESC = `[피아식별불가] 무작위 대상 공격
메인 타겟의 출혈과 화상의 합 2당, 합 위력 +1 (최대 10)
자신의 잃은 체력 비율만큼 피해량 증가(최대 20%)
서브 타겟에게 가하는 피해량 -50%
[공격 시작 전] (최대 공명 수 / 2)만큼 공격 가중치 증가 (최대 2, 소수점 버림)
[공격 시작 전] 파괴된 코인 수당 기본 위력 -2(최대 -6)
[공격 종료시] 정신력이 가장 낮은 아군 4명의 정신력 15 회복
[공격 종료시] 모든 아군이 다음 턴에 리듬 2, 분노 피해량 증가 1, 색욕 피해량 증가 1, 질투 피해량 증가 1, 취약 1 얻음
- 대상을 처치했으면, 이 효과 한 번 더 발동
[코인 1] 파괴 불가 코인
[적중시] 출혈 2 부여
[코인 2] 파괴 불가 코인
[적중시] 화상 2 부여
[코인 3] 파괴 불가 코인
[적중시] 자신의 체력이 10% 이상이면, 10 ~ 20 만큼 체력 피해 입음 (코인당 1회)
- 이후 이 코인 재사용
- 이 효과로 흐트러짐 상태가 되거나 체력이 1미만으로 감소하지 않음
[적중시] 화상 1 부여
[적중시] 출혈 1 부여
[적중시] 무작위 아군 1명이 다음 턴에 리듬 1 ~ 3 얻음(코인당 1회)`

const HARMONY_PASSIVE_DESC = `턴 시작 시 리듬 2 얻음
대상 처치 시 자신의 체력을 최대 체력의 5%만큼 회복하고, 자신의 정신력 5 회복(턴당 1회)
- E.G.O 스킬 - 하모니로 처치했으면 위 수치가 2배로 적용됨
이번 턴에 자신의 정신력이 감소했으면, 턴 종료 시 자신의 정신력을 (4 + 적 전체의 화상과 출혈 위력의 합 / 10)만큼 회복 (최대 10, 소수점 버림)`

// ── 메인 ──
async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  발푸르기스밤 8회차 스킬 상세 업데이트             ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // 1. 료슈 스킬 업데이트
  console.log('── 1. 료슈: 잔향 · 외로움 스킬 업데이트 ──')
  const ryoshuSkills = await supabaseGet(`skills?identity_id=eq.${RYOSHU_ID}&order=skill_order,variant_order`)
  console.log(`  현재 스킬 ${ryoshuSkills.length}개`)

  for (const update of RYOSHU_UPDATES) {
    const skill = ryoshuSkills.find(s => s.name === update.name)
    if (!skill) {
      console.log(`  ⚠ "${update.name}" 스킬을 찾을 수 없음`)
      continue
    }

    const patch = {}
    if (update.offense_level) patch.offense_level = update.offense_level
    // defense skills also use offense_level in DB
    if (update.coins) patch.coins = update.coins
    if (update.description) patch.description = update.description
    if (update.skill_type) patch.skill_type = update.skill_type
    if (update.sin_affinity) patch.sin_affinity = update.sin_affinity

    await supabasePatch('skills', skill.id, patch)

    const fixes = []
    if (update.skill_type) fixes.push(`skill_type: ${update.skill_type}`)
    if (update.sin_affinity) fixes.push(`sin_affinity: ${update.sin_affinity}`)
    const fixStr = fixes.length ? ` [FIX: ${fixes.join(', ')}]` : ''
    console.log(`  + ${update.name}: ${update.offense_level}, ${update.coins}코인${fixStr}`)
  }
  console.log('  => 완료\n')

  // 2. 뫼르소 스킬 업데이트
  console.log('── 2. 뫼르소: 호넷【변조】 스킬 업데이트 ──')
  const meursaultSkills = await supabaseGet(`skills?identity_id=eq.${MEURSAULT_ID}&order=skill_order,variant_order`)
  console.log(`  현재 스킬 ${meursaultSkills.length}개`)

  for (const update of MEURSAULT_UPDATES) {
    const skill = meursaultSkills.find(s => s.name === update.name)
    if (!skill) {
      console.log(`  ⚠ "${update.name}" 스킬을 찾을 수 없음`)
      continue
    }

    const patch = {}
    if (update.offense_level) patch.offense_level = update.offense_level
    // defense skills also use offense_level in DB
    if (update.coins) patch.coins = update.coins
    if (update.description) patch.description = update.description

    await supabasePatch('skills', skill.id, patch)
    console.log(`  + ${update.name}: ${update.offense_level}, ${update.coins}코인`)
  }
  console.log('  => 완료\n')

  // 3. 싱클레어 EGO 업데이트 — EGOSkill 타입에 맞게 JSONB 재구성
  console.log('── 3. 싱클레어: 하모니 EGO 업데이트 ──')

  // 각성 스킬: 참격/분노, bp=6, cp=+2, wt=3, 5코인, 정신력 -10, 공격레벨 62
  const awakeningSkill = {
    name: '홍염살',
    power: '16(+10)',        // base_power + coins * coin_power = 6 + 5*2 = 16
    mentalConsume: 10,
    atkType: '참격',
    resource: '분노',
    skillPower: 6,
    coinPower: 2,
    coinNum: 5,
    atkWeight: 3,
    construeLevel: 4,
    normalEffect: `메인 타겟의 출혈과 화상의 합 2당, 합 위력 +1 (최대 10)\n자신의 잃은 체력 비율만큼 피해량 증가(최대 20%)\n서브 타겟에게 가하는 피해량 -50%\n[대상 처치시] 모든 아군이 다음 턴에 리듬 2 얻음(스킬 당 1회)\n[공격 종료시] 자신을 제외한 정신력이 가장 낮은 아군 (1 + 최대 공명 수)명의 정신력 12 회복(최대 4명)\n[공격 종료시] 2턴 동안 전투 종료 시 정신력 8 감소`,
    coin1Effect: '[적중시] 출혈 2 부여',
    coin2Effect: '[적중시] 화상 2 부여',
    coin3Effect: '[앞면 적중시] 자신의 체력이 10% 이상이면, 4 ~ 8 만큼 체력 피해 입음 (코인당 1회)\n- 이후 이 코인 재사용(스킬당 최대 4회)\n- 이 효과로 흐트러짐 상태가 되거나 체력이 1미만으로 감소하지 않음\n[적중시] 화상 1 부여\n[적중시] 출혈 1 부여\n[적중시] 무작위 아군 1명이 다음 턴에 리듬 1 ~ 3 얻음(코인당 1회)',
    coin4Effect: '',
    coin5Effect: '',
  }

  // 침식 스킬: 참격/분노, bp=14, cp=-2, wt=1, 5코인, 정신력 -30, 공격레벨 64
  const corrosionSkill = {
    name: '홍염살',
    power: '4(-10)',         // base_power + coins * coin_power = 14 + 5*(-2) = 4
    mentalConsume: 30,
    atkType: '참격',
    resource: '분노',
    skillPower: 14,
    coinPower: -2,
    coinNum: 5,
    atkWeight: 1,
    construeLevel: 4,
    normalEffect: `[피아식별불가] 무작위 대상 공격\n메인 타겟의 출혈과 화상의 합 2당, 합 위력 +1 (최대 10)\n자신의 잃은 체력 비율만큼 피해량 증가(최대 20%)\n서브 타겟에게 가하는 피해량 -50%\n[공격 시작 전] (최대 공명 수 / 2)만큼 공격 가중치 증가 (최대 2, 소수점 버림)\n[공격 시작 전] 파괴된 코인 수당 기본 위력 -2(최대 -6)\n[공격 종료시] 정신력이 가장 낮은 아군 4명의 정신력 15 회복\n[공격 종료시] 모든 아군이 다음 턴에 리듬 2, 분노 피해량 증가 1, 색욕 피해량 증가 1, 질투 피해량 증가 1, 취약 1 얻음\n- 대상을 처치했으면, 이 효과 한 번 더 발동`,
    coin1Effect: '파괴 불가 코인\n[적중시] 출혈 2 부여',
    coin2Effect: '파괴 불가 코인\n[적중시] 화상 2 부여',
    coin3Effect: '파괴 불가 코인\n[적중시] 자신의 체력이 10% 이상이면, 10 ~ 20 만큼 체력 피해 입음 (코인당 1회)\n- 이후 이 코인 재사용\n- 이 효과로 흐트러짐 상태가 되거나 체력이 1미만으로 감소하지 않음\n[적중시] 화상 1 부여\n[적중시] 출혈 1 부여\n[적중시] 무작위 아군 1명이 다음 턴에 리듬 1 ~ 3 얻음(코인당 1회)',
    coin4Effect: '',
    coin5Effect: '',
  }

  await supabasePatch('ego', SINCLAIR_EGO_ID, {
    ego_skills: [awakeningSkill],
    ego_cor_skills: [corrosionSkill],
    passive_content: HARMONY_PASSIVE_DESC,
  })
  console.log('  + 각성 스킬: EGOSkill 형식으로 재구성 (참격/분노, 5코인)')
  console.log('  + 침식 스킬: EGOSkill 형식으로 재구성 (참격/분노, 5코인)')
  console.log('  + 패시브 설명 업데이트')
  console.log('  => 완료\n')

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  전체 업데이트 완료!                              ║')
  console.log('╚══════════════════════════════════════════════════╝')
}

main().catch(err => {
  console.error('\n치명적 오류:', err)
  process.exit(1)
})
