#!/usr/bin/env node
/**
 * 게임 클라이언트 JSON → DB 스킬 동기화 스크립트
 *
 * 기존 스킬 데이터를 삭제하고 게임 클라이언트 JSON에서 정확한 데이터를 삽입합니다.
 * 코인 수, 위력, 스킬 타입, 죄악 속성, 설명 모두 100% 정확.
 *
 * 사용법:
 *   node --env-file=.env.local scripts/sync-game-data.mjs [옵션]
 *
 * 옵션:
 *   --sinner <slug>   특정 수감자만 (기본: 전체 12명)
 *   --dry-run         비교만 (DB 수정 안 함, 기본값)
 *   --fix             DB 반영 (기존 스킬 삭제 후 재삽입)
 *   --verbose         상세 로그
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
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
const verbose = args.includes('--verbose')

// ── JSON 데이터 경로 ──
const JSON_DIR = resolve(process.env.HOME, 'Downloads/JSON')

// ── 수감자 매핑 ──
const SINNERS = [
  { id: 1, slug: 'yi-sang', name: 'Yi Sang' },
  { id: 2, slug: 'faust', name: 'Faust' },
  { id: 3, slug: 'don-quixote', name: 'Don Quixote' },
  { id: 4, slug: 'ryoshu', name: 'Ryoshu' },
  { id: 5, slug: 'meursault', name: 'Meursault' },
  { id: 6, slug: 'hong-lu', name: 'Hong Lu' },
  { id: 7, slug: 'heathcliff', name: 'Heathcliff' },
  { id: 8, slug: 'ishmael', name: 'Ishmael' },
  { id: 9, slug: 'rodion', name: 'Rodion' },
  { id: 10, slug: 'sinclair', name: 'Sinclair' },
  { id: 11, slug: 'outis', name: 'Outis' },
  { id: 12, slug: 'gregor', name: 'Gregor' },
]

// ── 게임 → DB 매핑 ──
const ATK_TYPE_MAP = { SLASH: 'slash', PENETRATE: 'pierce', HIT: 'blunt' }
const DEF_TYPE_MAP = { GUARD: 'defense', EVADE: 'evade', COUNTER: 'counter' }
const SIN_MAP = {
  CRIMSON: 'wrath', SCARLET: 'lust', AMBER: 'sloth', SHAMROCK: 'gluttony',
  AZURE: 'gloom', INDIGO: 'pride', VIOLET: 'envy',
}

// ── 조건 태그 영→한 매핑 (런타임 로드 + 하드코딩 보충) ──
const CONDITION_TAG_MAP = {
  OnSucceedAttack: '적중시',
  OnSucceedAttackHead: '앞면 적중시',
  OnSucceedAttackTail: '뒷면 적중시',
  CriticalOnSucceedAttack: '크리티컬 적중시',
  CriticalOnSucceedAttackHead: '크리티컬 앞면 적중시',
  CriticalEnemyTargetKill: '크리티컬 적 처치시',
  WhenUse: '사용시',
  WhenUse_Force: '사용시',
  BeforeUse: '사용 전',
  WhenUseEvade: '회피 사용시',
  WinDuel: '합 승리시',
  WinDuelAttack: '합 공격 승리시',
  WinDuelAttackHead: '합 앞면 공격 승리시',
  DefeatDuel: '합 패배시',
  StartDuel: '합 시작시',
  StartBattle: '전투 시작시',
  StartBattle_Force: '전투 시작시',
  EndSkill: '공격 종료시',
  EndSkillAll: '공격 종료시',
  EndBattle: '전투 종료시',
  BeforeAttack: '공격 시작 전',
  BeforeHit: '피격 전',
  EnemyKill: '적 처치시',
  OnSucceedEvade: '회피 성공시',
  OnStartCoin: '코인 시작시',
  OnDirectAttack: '직접 공격시',
  ReUseOnSucceedAttack: '재사용: 적중시',
  ReUseOnSucceedAttackHead: '재사용: 앞면 적중시',
  UnBrokenCoinOnSucceedAttack: '파괴 불가 코인 적중시',
  CantDuel: '합 불가',
  CantIdentify: '피아식별불가',
  CantChangeTarget: '타겟 변경 불가',
  TabExplain: '설명',
  DuelCounter: '합 가능 반격',
  DuelGuard: '합 가능 가드',
  AllyKill: '아군 처치시',
  AllyKillFail: '아군 처치 실패시',
  EnemyKillFail: '적 처치 실패시',
  TargetKill: '대상 처치시',
  CriticalTargetKill: '크리티컬 대상 처치시',
  CriticalEnemyTargetKillFail: '크리티컬 적 처치 실패시',
  CriticalEndSkill: '크리티컬 공격 종료시',
  CriticalActivated: '크리티컬 발동시',
  EndCoin: '이 코인 공격 종료시',
  EndSkillHead: '앞면 공격 종료시',
  EndSkillTail: '뒷면 공격 종료시',
  OnDefeatEvade: '회피 실패시',
  DefeatDuelAttack: '합 공격 패배시',
  AlwaysUse: '항상',
  TurnStartBattle: '턴 시작시',
}

// KR BattleKeywords + Bufs에서 키워드 매핑 런타임 로드
function loadKrTagMap() {
  const map = { ...CONDITION_TAG_MAP }
  // 모든 KR 키워드/버프 파일 로드 (추가 컨텐츠 포함)
  const krDir = resolve(JSON_DIR, 'KR')
  const allKrFiles = existsSync(krDir)
    ? readdirSync(krDir)
        .filter(f => /^KR_(BattleKeywords|Bufs|BuffAbilities)/i.test(f))
        .map(f => `KR/${f}`)
    : []
  const files = allKrFiles
  for (const f of files) {
    const data = readJson(f)
    if (!data) continue
    for (const item of data.dataList || []) {
      if (item.id && item.name && !map[item.id]) {
        map[item.id] = item.name
      }
    }
  }
  return map
}

let TAG_MAP = CONDITION_TAG_MAP  // main()에서 loadKrTagMap()으로 교체

// ── 헬퍼 ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function readJson(filename) {
  const path = resolve(JSON_DIR, filename)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// desc 텍스트 정리: 영문 태그 → 한글, Unity 마크업 태그 제거
function translateDesc(desc) {
  if (!desc) return ''
  let result = desc
    // <style="highlight">...</style> 제거 (내용은 유지)
    .replace(/<style="[^"]*">/g, '')
    .replace(/<\/style>/g, '')
    // Unity 마크업 태그 제거 (noparse, u, color, link, sprite 등)
    .replace(/<\/?noparse>/g, '')
    .replace(/<\/?u>/g, '')
    .replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '')
    .replace(/<link=[^>]*>/g, '').replace(/<\/link>/g, '')
    .replace(/<sprite[^>]*\/?>/g, '')
    // [EnglishTag] → 한글 변환 (키워드는 앞뒤 공백 보장)
    .replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (match, tag, offset, str) => {
      const kr = TAG_MAP[tag]
      if (!kr) return match  // 매핑 없으면 원본 유지
      if (CONDITION_TAG_MAP[tag]) return `[${kr}]`
      // 키워드: 앞 문자가 한글/숫자면 공백 추가 (뒤는 조사가 붙으므로 공백 안 넣음)
      const before = offset > 0 ? str[offset - 1] : ''
      const needSpaceBefore = before && /[가-힣0-9]/.test(before)
      return (needSpaceBefore ? ' ' : '') + kr
    })
    // 조건 태그 앞에 줄바꿈 (텍스트 중간에 나오는 경우, "\n- [태그]" 패턴은 제외)
    .replace(/(?<!^)(?<![\n])(?<!- )\[(?:적중시|앞면 적중시|뒷면 적중시|사용시|합 승리시|합 패배시|전투 시작시|공격 종료시|공격 시작 전|적 처치시|회피 성공시|크리티컬 적중시|사용 전|파괴 불가 코인 적중시|재사용)/gm, '\n[')
    // 조건 태그 뒤에 띄어쓰기 없으면 추가
    .replace(/\]((?:자신|대상|이 |다음|호흡|충전|침잠|출혈|화상|파열|진동|마비|속박|취약|광전|전하침|파괴))/g, '] $1')
    // 수식 띄어쓰기: (75-카르마/2) → ( 75 - 카르마 / 2 )
    .replace(/\((\d+)-([가-힣]+)\/(\d+)\)/g, '( $1 - $2 / $3 )')
    // 게임 JSON에 이미 \n- 포함되어 있으므로 별도 불릿 처리 불필요
  return result.trim()
}

// 동기화 레벨 상속 해결 (targetLevel까지만 병합)
function resolveToLevel(skill, targetLevel) {
  const merged = {}
  const sorted = [...skill.skillData].sort((a, b) => (a.gaksungLevel || 0) - (b.gaksungLevel || 0))
  for (const sd of sorted) {
    if ((sd.gaksungLevel || 0) > targetLevel) break
    for (const [k, v] of Object.entries(sd)) {
      if (k === 'gaksungLevel') continue
      if (k === 'coinList' && Array.isArray(v) && v.length === 0) continue
      if (v === null || v === undefined) continue
      merged[k] = v
    }
  }
  return merged
}

// 하위 호환용
function resolveUptie4(skill) { return resolveToLevel(skill, 4) }

// 스킬 설명 조립
function buildDescription(krText) {
  if (!krText) return ''
  // uptie 4 (가장 높은 level) 텍스트 사용
  const levels = krText.levelList || []
  const best = levels.reduce((a, b) => (b.level > a.level ? b : a), levels[0])
  if (!best) return ''

  const parts = []

  // 전체 효과 (desc)
  const globalDesc = translateDesc(best.desc || '').trim()
  if (globalDesc) parts.push(globalDesc)

  // 코인별 효과
  const coinlist = best.coinlist || []
  for (let i = 0; i < coinlist.length; i++) {
    const coin = coinlist[i]
    const descs = (coin.coindescs || []).map(cd => translateDesc(cd.desc || '').trim()).filter(Boolean)
    if (descs.length > 0) {
      // 첫 효과만 [코인 N] 접두사, 나머지는 줄바꿈만
      parts.push(`[코인 ${i + 1}] ${descs[0]}`)
      for (let j = 1; j < descs.length; j++) {
        parts.push(descs[j])
      }
    }
  }

  return parts.join('\n')
}

// ── Supabase REST ──
async function supaGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers })
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function supaDelete(table, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=minimal' },
  })
  if (!res.ok) throw new Error(`DELETE ${table}: ${res.status} ${await res.text()}`)
}

async function supaInsertBatch(table, rows) {
  // 50개씩 배치 삽입
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(batch),
    })
    if (!res.ok) {
      const text = await res.text()
      if (res.status === 502 || res.status === 429) {
        console.log(`    ⏳ rate limit, 3초 대기 후 재시도...`)
        await sleep(3000)
        const retry = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify(batch),
        })
        if (!retry.ok) throw new Error(`INSERT ${table} retry: ${retry.status} ${await retry.text()}`)
      } else {
        throw new Error(`INSERT ${table}: ${res.status} ${text}`)
      }
    }
    if (rows.length > 50) await sleep(200)
  }
}

// ── 메인 ──
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  게임 클라이언트 JSON → DB 스킬 동기화                   ║')
  console.log('╠══════════════════════════════════════════════════════════╣')
  console.log(`║  모드: ${dryRun ? 'DRY RUN (비교만)' : '🔥 FIX (삭제 후 재삽입)'}`)
  console.log(`║  대상: ${sinnerFilter || '전체 12명'}`)
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  // KR 스킬 텍스트 로드 (모든 파일 병합)
  const krSkillMap = new Map()  // skillId → { levelList }
  const krFiles = [
    'KR/KR_Skills.json',
    'KR/KR_Skills_personality-01.json', 'KR/KR_Skills_personality-02.json',
    'KR/KR_Skills_personality-03.json', 'KR/KR_Skills_personality-04.json',
    'KR/KR_Skills_personality-05.json', 'KR/KR_Skills_personality-06.json',
    'KR/KR_Skills_personality-07.json', 'KR/KR_Skills_personality-08.json',
    'KR/KR_Skills_personality-09.json', 'KR/KR_Skills_personality-10.json',
    'KR/KR_Skills_personality-11.json', 'KR/KR_Skills_personality-12.json',
    'KR_Skills_personality-10.json',  // 루트에도 하나 있음
    // EGO 스킬 텍스트
    'KR/KR_Skills_Ego.json',
    'KR/KR_Skills_Ego-a1c5p2.json',
    'KR/KR_Skills_Ego_Personality-01.json', 'KR/KR_Skills_Ego_Personality-02.json',
    'KR/KR_Skills_Ego_Personality-03.json', 'KR/KR_Skills_Ego_Personality-04.json',
    'KR/KR_Skills_Ego_Personality-05.json', 'KR/KR_Skills_Ego_Personality-06.json',
    'KR/KR_Skills_Ego_Personality-07.json', 'KR/KR_Skills_Ego_Personality-08.json',
    'KR/KR_Skills_Ego_Personality-09.json', 'KR/KR_Skills_Ego_Personality-10.json',
    'KR/KR_Skills_Ego_Personality-11.json', 'KR/KR_Skills_Ego_Personality-12.json',
    'KR/KR_Skills_Ego_Personality-a1c9p2.json',
    // 보조 인격 스킬 텍스트
    'KR/KR_Skills_personality-a1c9p1.json',
    'KR/KR_Skills_personality-a1c9p2.json',
  ]
  for (const f of krFiles) {
    const data = readJson(f)
    if (!data) continue
    for (const item of data.dataList || []) {
      krSkillMap.set(item.id, item)
    }
  }
  console.log(`  KR 스킬 텍스트: ${krSkillMap.size}개 로드`)

  // KR 태그 매핑 로드 (BattleKeywords + Bufs)
  TAG_MAP = loadKrTagMap()
  console.log(`  KR 태그 매핑: ${Object.keys(TAG_MAP).length}개 로드\n`)

  const targetSinners = sinnerFilter
    ? SINNERS.filter(s => s.slug === sinnerFilter)
    : SINNERS

  let totalInserted = 0, totalDeleted = 0, totalSkipped = 0
  let egoInserted = 0, egoDeleted = 0, egoSkipped = 0

  for (const sinner of targetSinners) {
    console.log(`${'═'.repeat(60)}`)
    console.log(`  ${sinner.name.toUpperCase()} (${sinner.slug})`)
    console.log('═'.repeat(60))

    // 게임 데이터 로드 (기본 + 보조 파일)
    const pad = String(sinner.id).padStart(2, '0')
    const personList = []
    const seenPIds = new Set()
    const pFiles = [`personality-${pad}.json`, 'personality-a1c8p1.json', 'personality-a1c8p2.json', 'personality-a1c9p1.json', 'personality-a1c9p2.json']
    for (const f of pFiles) {
      const d = readJson(f)
      if (!d) continue
      for (const p of d.list || []) {
        if (p.characterId === sinner.id && !seenPIds.has(p.id)) {
          personList.push(p)
          seenPIds.add(p.id)
        }
      }
    }
    const personalities = { list: personList }

    const skillList = []
    const seenSIds = new Set()
    const sFiles = [`personality-skill-${pad}.json`, 'personality-skill-a1c8p1.json', 'personality-skill-a1c8p2.json', 'personality-skill-a1c9p1.json', 'personality-skill-a1c9p2.json']
    for (const f of sFiles) {
      const d = readJson(f)
      if (!d) continue
      for (const s of d.list || []) {
        if (!seenSIds.has(s.id)) {
          seenSIds.add(s.id)
          skillList.push(s)
        }
      }
    }

    if (personList.length === 0) {
      console.log(`  [!] 게임 데이터 없음`)
      continue
    }

    // 스킬 ID → uptie4 해결 데이터
    const skillMap = new Map()
    for (const s of skillList) {
      skillMap.set(s.id, { ...s, resolved: resolveUptie4(s) })
    }

    // DB 수감자/인격 로드
    const dbSinner = await supaGet('sinners', `name=eq.${encodeURIComponent(sinner.name)}&select=id`)
    if (!dbSinner.length) { console.log(`  [!] DB에 수감자 없음`); continue }
    const sinnerId = dbSinner[0].id

    const dbIdentities = await supaGet(
      'identities',
      `sinner_id=eq.${sinnerId}&select=id,game_id,name`
    )

    for (const identity of dbIdentities) {
      const gameId = identity.game_id
      if (!gameId) continue

      const gamePerson = personalities.list.find(p => String(p.id) === gameId)
      if (!gamePerson) {
        if (verbose) console.log(`  [!] 게임 데이터에 인격 없음: ${identity.name} (${gameId})`)
        totalSkipped++
        continue
      }

      // 공격 스킬 + 수비 스킬
      const attackSkillIds = (gamePerson.attributeList || []).map(a => a.skillId)
      const defenseSkillIds = gamePerson.defenseSkillIDList || []

      // 새 스킬 행 생성 (uptie 3 + 4)
      const newSkills = []

      // 스킬 데이터를 특정 uptie 레벨로 생성하는 헬퍼
      function makeSkillRow(gs, uptie, skillOrder, vOrder) {
        const r = resolveToLevel(gs, uptie)
        const coinList = r.coinList || []
        const krText = krSkillMap.get(gs.id)
        // 해당 uptie 레벨의 KR 텍스트 (없으면 가장 높은 레벨)
        const levels = krText?.levelList || []
        const bestForLevel = levels.filter(l => l.level <= uptie).sort((a, b) => b.level - a.level)[0] || levels[0]
        const name = bestForLevel?.name || (skillOrder === 4 ? '수비' : `스킬${skillOrder}`)
        const description = buildDescription(krText ? { ...krText, levelList: [bestForLevel].filter(Boolean) } : null)
        const isDefense = r.defType && r.defType !== 'ATTACK'

        return {
          identity_id: identity.id,
          name,
          skill_type: isDefense ? (DEF_TYPE_MAP[r.defType] || null) : (ATK_TYPE_MAP[r.atkType] || null),
          sin_affinity: SIN_MAP[r.attributeType] || null,
          base_power: r.defaultValue ?? null,
          coin_power: coinList.length > 0 ? (coinList[0].operatorType === 'SUB' ? -coinList[0].scale : coinList[0].scale) : null,
          coins: coinList.length || 1,
          offense_level: r.skillLevelCorrection != null ? 60 + r.skillLevelCorrection : null,
          description,
          skill_order: skillOrder,
          atk_weight: r.targetNum || 1,
          variant_order: vOrder,
          uptie_level: uptie,
        }
      }

      const UPTIE_LEVELS = [3, 4]

      // 공격 스킬 (skillTier → skill_order)
      for (const uptie of UPTIE_LEVELS) {
        let variantIdx = 0
        for (const sid of attackSkillIds) {
          const gs = skillMap.get(sid)
          if (!gs) continue
          newSkills.push(makeSkillRow(gs, uptie, gs.skillTier, ++variantIdx))
        }

        // 수비 스킬 (skill_order = 4) — defenseSkillIDList 원래 순서 유지, requireIDList 변형 제외
        const defSkills = defenseSkillIds
          .map(sid => skillMap.get(sid))
          .filter(gs => gs && !(gs.requireIDList && gs.requireIDList.length > 0))

        for (const gs of defSkills) {
          newSkills.push(makeSkillRow(gs, uptie, 4, ++variantIdx))
        }
      }

      if (newSkills.length === 0) {
        if (verbose) console.log(`  [!] ${identity.name}: 게임 스킬 없음`)
        totalSkipped++
        continue
      }

      // 현재 DB 스킬 수
      const dbSkills = await supaGet('skills', `identity_id=eq.${identity.id}&select=id&limit=100`)

      if (dryRun) {
        console.log(`  ${identity.name}: DB ${dbSkills.length}개 → 게임 ${newSkills.length}개`)
        for (const s of newSkills) {
          console.log(`    S${s.skill_order} "${s.name}" [${s.skill_type}/${s.sin_affinity}] 위력${s.base_power}+${s.coin_power}×${s.coins}`)
          if (s.description && verbose) {
            for (const line of s.description.split('\n').slice(0, 5)) {
              console.log(`      ${line}`)
            }
          }
        }
      } else {
        // 기존 스킬 삭제
        if (dbSkills.length > 0) {
          await supaDelete('skills', `identity_id=eq.${identity.id}`)
          totalDeleted += dbSkills.length
        }
        // 새 스킬 삽입
        await supaInsertBatch('skills', newSkills)
        totalInserted += newSkills.length
        console.log(`  ${identity.name}: ${dbSkills.length}개 삭제 → ${newSkills.length}개 삽입`)
        await sleep(100)
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  //  패시브 동기화
  // ══════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  패시브 동기화')
  console.log('═'.repeat(60))

  // KR 패시브 텍스트 로드
  const krPassiveMap = new Map()
  const krPassiveFiles = readdirSync(resolve(JSON_DIR, 'KR'))
    .filter(f => /^KR_Passives/i.test(f) || /^KR_Passive[^s]/i.test(f))
    .map(f => `KR/${f}`)
  for (const f of krPassiveFiles) {
    const data = readJson(f)
    if (!data) continue
    for (const item of data.dataList || []) {
      if (item.id && item.name) krPassiveMap.set(item.id, item)
    }
  }

  // 패시브 상세 데이터 (공명 조건)
  const passiveDetailMap = new Map()
  const passiveFiles = ['passive.json', 'passive-a1c8p1.json', 'passive-a1c8p2.json', 'passive-a1c9p1.json', 'passive-a1c9p2.json', 'passive-extra.json']
  for (const f of passiveFiles) {
    const data = readJson(f)
    if (!data) continue
    for (const item of data.list || []) {
      passiveDetailMap.set(item.id, item)
    }
  }

  let passiveInserted = 0, passiveDeleted = 0

  for (const sinner of targetSinners) {
    const pad = String(sinner.id).padStart(2, '0')
    // 패시브 매핑 로드
    const passiveMapping = []
    const pmFiles = [`personality-passive-${pad}.json`, 'personality-passive-a1c8p1.json', 'personality-passive-a1c8p2.json', 'personality-passive-a1c9p1.json', 'personality-passive-a1c9p2.json', 'personality-passive-extra.json']
    for (const f of pmFiles) {
      const data = readJson(f)
      if (!data) continue
      for (const item of data.list || []) {
        // personality game_id 앞 2자리로 수감자 필터
        const sinnerNum = Math.floor((item.personalityID % 10000) / 100)
        // 실제로는 personalityID / 100의 앞자리가 수감자번호
        // 10101 → sinner 1, 10215 → sinner 2
        const sid = Math.floor(item.personalityID / 100) % 100
        if (sid === sinner.id || Math.floor(item.personalityID / 10000) === sinner.id) {
          passiveMapping.push(item)
        }
      }
    }

    const dbSinner = await supaGet('sinners', `name=eq.${encodeURIComponent(sinner.name)}&select=id`)
    if (!dbSinner.length) continue
    const sinnerId = dbSinner[0].id

    const dbIdentities = await supaGet('identities', `sinner_id=eq.${sinnerId}&select=id,game_id,name`)

    for (const identity of dbIdentities) {
      const gameId = identity.game_id
      if (!gameId) continue

      const pm = passiveMapping.find(p => String(p.personalityID) === gameId)
      if (!pm) continue

      const UPTIE_LEVELS = [3, 4]
      const newPassives = []

      for (const uptie of UPTIE_LEVELS) {
        let passiveOrder = 0

        // 배틀 패시브: 해당 uptie 이하에서 가장 높은 level
        const battleLevel = (pm.battlePassiveList || [])
          .filter(l => l.level <= uptie)
          .sort((a, b) => b.level - a.level)[0]
        if (battleLevel) {
          for (const pid of battleLevel.passiveIDList) {
            const kr = krPassiveMap.get(pid)
            const detail = passiveDetailMap.get(pid)
            const conds = detail?.attributeStockCondition || detail?.attributeResonanceCondition || []
            const sinCond = conds[0]
            const sinAffinity = sinCond ? (SIN_MAP[sinCond.type] || null) : null
            const sinCount = sinCond?.value || null
            let desc = kr?.desc || ''
            desc = translateDesc(desc)

            newPassives.push({
              identity_id: identity.id,
              name: kr?.name || `패시브${pid}`,
              passive_type: 'battle',
              sin_affinity: sinAffinity,
              sin_count: sinCount,
              description: desc,
              passive_order: ++passiveOrder,
              uptie_level: uptie,
            })
          }
        }

        // 서포터 패시브
        const supportLevel = (pm.supporterPassiveList || [])
          .filter(l => l.level <= uptie)
          .sort((a, b) => b.level - a.level)[0]
        if (supportLevel) {
          for (const pid of supportLevel.passiveIDList) {
            const kr = krPassiveMap.get(pid)
            const detail = passiveDetailMap.get(pid)
            const conds = detail?.attributeStockCondition || detail?.attributeResonanceCondition || []
            const sinCond = conds[0]
            const sinAffinity = sinCond ? (SIN_MAP[sinCond.type] || null) : null
            const sinCount = sinCond?.value || null
            let desc = kr?.desc || ''
            desc = translateDesc(desc)

            newPassives.push({
              identity_id: identity.id,
              name: kr?.name || `패시브${pid}`,
              passive_type: 'support',
              sin_affinity: sinAffinity,
              sin_count: sinCount,
              description: desc,
              passive_order: ++passiveOrder,
              uptie_level: uptie,
            })
          }
        }
      }

      if (newPassives.length === 0) continue

      const dbPassives = await supaGet('passives', `identity_id=eq.${identity.id}&select=id&limit=100`)

      if (dryRun) {
        console.log(`  ${identity.name}: DB ${dbPassives.length}개 → 게임 ${newPassives.length}개`)
      } else {
        if (dbPassives.length > 0) {
          await supaDelete('passives', `identity_id=eq.${identity.id}`)
          passiveDeleted += dbPassives.length
        }
        await supaInsertBatch('passives', newPassives)
        passiveInserted += newPassives.length
        await sleep(100)
      }
    }
  }

  if (!dryRun) {
    console.log(`  패시브 삭제: ${passiveDeleted}개 / 삽입: ${passiveInserted}개`)
  }

  // ══════════════════════════════════════════════════════════
  //  EGO 스킬 동기화
  // ══════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  EGO 스킬 동기화')
  console.log('═'.repeat(60))

  for (const sinner of targetSinners) {
    // EGO 기본 + 보조 파일 모두 로드
    const egoList = []
    const egoSkillMap = new Map()
    const egoBaseFiles = [`ego-${sinner.id}.json`, 'ego-a1c5p2.json', 'ego-a1c5p3.json', 'ego-a1c6p2.json', 'ego-a1c8p2.json', 'ego-a1c8p3.json', 'ego-a1c9p2.json', 'ego-a1c9p3.json']
    const egoSkillFiles = [`ego-skill-${sinner.id}.json`, 'ego-skill-a1c5p2.json', 'ego-skill-a1c5p3.json', 'ego-skill-a1c6p2.json', 'ego-skill-a1c6p3.json', 'ego-skill-a1c8p2.json', 'ego-skill-a1c8p3.json', 'ego-skill-a1c9p2.json', 'ego-skill-a1c9p3.json']
    const seenEgoIds = new Set()
    for (const f of egoBaseFiles) {
      const data = readJson(f)
      if (!data) continue
      for (const e of data.list || []) {
        if (e.characterId === sinner.id && !seenEgoIds.has(e.id)) {
          egoList.push(e)
          seenEgoIds.add(e.id)
        }
      }
    }
    const seenSkillIds = new Set()
    for (const f of egoSkillFiles) {
      const data = readJson(f)
      if (!data) continue
      for (const s of data.list || []) {
        if (!seenSkillIds.has(s.id)) {
          egoSkillMap.set(s.id, { ...s, resolved: resolveUptie4(s) })
          seenSkillIds.add(s.id)
        }
      }
    }
    if (egoList.length === 0) {
      if (verbose) console.log(`  [!] ${sinner.name}: EGO 게임 데이터 없음`)
      continue
    }

    // DB에서 이 수감자의 EGO 로드
    const dbSinner = await supaGet('sinners', `name=eq.${encodeURIComponent(sinner.name)}&select=id`)
    if (!dbSinner.length) continue
    const sinnerId = dbSinner[0].id

    const dbEgos = await supaGet('ego', `sinner_id=eq.${sinnerId}&select=id,game_id,name`)

    for (const ego of dbEgos) {
      const gameId = ego.game_id
      if (!gameId) continue

      const gameEgo = egoList.find(e => String(e.id) === gameId)
      if (!gameEgo) {
        if (verbose) console.log(`  [!] ${ego.name}: 게임 데이터 없음 (${gameId})`)
        egoSkipped++
        continue
      }

      // 각성 + 침식 스킬 수집
      // 각성: ego 기본 데이터의 awakeningSkillId
      // 침식: ego-skill 파일에서 skillType === 'EGO_EROSION'이고 ID 앞 5자리가 EGO ID와 일치
      const skillIds = []
      if (gameEgo.awakeningSkillId) skillIds.push({ id: gameEgo.awakeningSkillId, category: 'awakening' })
      // 침식 스킬: ID 패턴 매칭 (XXXXX21 = 침식, XXXXX = ego game_id)
      for (const [sid, gs] of egoSkillMap) {
        if (gs.skillType === 'EGO_EROSION' && String(sid).startsWith(gameId)) {
          skillIds.push({ id: sid, category: 'corrosion' })
        }
      }

      const newEgoSkills = []
      const EGO_LEVELS = [3, 4]  // 3해석 + 4해석
      for (const uptie of EGO_LEVELS) {
        for (const { id: sid, category } of skillIds) {
          const gs = egoSkillMap.get(sid)
          if (!gs) continue
          const r = resolveToLevel(gs, uptie)
          const coinList = r.coinList || []
          const krText = krSkillMap.get(sid)
          const levels = krText?.levelList || []
          const bestForLevel = levels.filter(l => l.level <= uptie).sort((a, b) => b.level - a.level)[0] || levels[0]
          const name = bestForLevel?.name || (category === 'awakening' ? '각성 스킬' : '침식 스킬')
          const description = buildDescription(krText ? { ...krText, levelList: [bestForLevel].filter(Boolean) } : null)

          newEgoSkills.push({
            ego_id: ego.id,
            name,
            skill_type: r.defType === 'ATTACK' ? (ATK_TYPE_MAP[r.atkType] || null) : (DEF_TYPE_MAP[r.defType] || null),
            sin_affinity: SIN_MAP[r.attributeType] || null,
            base_power: r.defaultValue ?? null,
            coin_power: coinList.length > 0 ? (coinList[0].operatorType === 'SUB' ? -coinList[0].scale : coinList[0].scale) : null,
            coins: coinList.length || 1,
            description,
            skill_order: 1,
            atk_weight: r.targetNum || 1,
            category,
            construe_level: uptie,
          })
        }
      }

      if (newEgoSkills.length === 0) {
        egoSkipped++
        continue
      }

      const dbEgoSkills = await supaGet('ego_skills', `ego_id=eq.${ego.id}&select=id&limit=100`)

      if (dryRun) {
        console.log(`  ${ego.name}: DB ${dbEgoSkills.length}개 → 게임 ${newEgoSkills.length}개`)
        for (const s of newEgoSkills) {
          console.log(`    [${s.category}] "${s.name}" [${s.skill_type}/${s.sin_affinity}] 위력${s.base_power}+${s.coin_power}×${s.coins}`)
          if (s.description && verbose) {
            for (const line of s.description.split('\n').slice(0, 5)) {
              console.log(`      ${line}`)
            }
          }
        }
      } else {
        if (dbEgoSkills.length > 0) {
          await supaDelete('ego_skills', `ego_id=eq.${ego.id}`)
          egoDeleted += dbEgoSkills.length
        }
        await supaInsertBatch('ego_skills', newEgoSkills)
        egoInserted += newEgoSkills.length
        console.log(`  ${ego.name}: ${dbEgoSkills.length}개 삭제 → ${newEgoSkills.length}개 삽입`)
        await sleep(100)
      }
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  결과 요약')
  console.log('═'.repeat(60))
  if (dryRun) {
    console.log(`  (DRY RUN — DB 미변경)`)
  } else {
    console.log(`  인격 스킬 삭제: ${totalDeleted}개 / 삽입: ${totalInserted}개`)
    console.log(`  EGO 스킬 삭제: ${egoDeleted}개 / 삽입: ${egoInserted}개`)
  }
  console.log(`  스킵: 인격 ${totalSkipped}개 / EGO ${egoSkipped}개`)
}

main().catch(err => {
  console.error('오류:', err)
  process.exit(1)
})
