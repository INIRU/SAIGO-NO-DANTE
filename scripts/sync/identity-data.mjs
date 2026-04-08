#!/usr/bin/env node
/**
 * 게임 클라이언트 JSON → DB 인격/스킬 동기화 스크립트
 *
 * Json (Text)/ 폴더의 .txt 파일(JSON with BOM)을 읽어:
 *   1. DB와 비교해 diff 리포트 출력 (--dry-run, 기본값)
 *   2. 기존 인격의 변경 필드만 업데이트 (--fix)
 *   3. DB에 없는 신규 인격 + 스킬을 삽입 (--fix)
 *
 * 사용법:
 *   node --env-file=.env.local scripts/sync/identity-data.mjs [options]
 *
 * 옵션:
 *   --dry-run        비교만, DB 수정 안 함 (기본값)
 *   --fix            DB에 변경/삽입 반영
 *   --sinner <slug>  특정 수감자만 처리 (e.g. --sinner yi-sang)
 *   --verbose        모든 필드 표시 (변경 없는 필드 포함)
 *   --new-only       신규 인격만 표시/처리 (기존 비교 스킵)
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// ── .env.local 로드 ──────────────────────────────────────────────────────────
const ROOT = process.cwd()
const envFile = readFileSync(resolve(ROOT, '.env.local'), 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[ERROR] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 없음')
  process.exit(1)
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'limbus',
  'Content-Profile': 'limbus',
}

// ── CLI 인자 ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const sinnerFilter = args.includes('--sinner') ? args[args.indexOf('--sinner') + 1] : null
const autoFix = args.includes('--fix')
const dryRun = !autoFix
const verbose = args.includes('--verbose')
const newOnly = args.includes('--new-only')

// ── 데이터 경로 ──────────────────────────────────────────────────────────────
const HOME = process.env.HOME
const TXT_DIR = resolve(HOME, 'Documents/Limbus/assets/data/Json (Text)')
const KR_DIR = resolve(TXT_DIR, 'KR')

// ── 색상 헬퍼 ────────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
}

function green(s) { return `${C.green}${s}${C.reset}` }
function yellow(s) { return `${C.yellow}${s}${C.reset}` }
function gray(s) { return `${C.gray}${s}${C.reset}` }
function cyan(s) { return `${C.cyan}${s}${C.reset}` }
function red(s) { return `${C.red}${s}${C.reset}` }
function bold(s) { return `${C.bold}${s}${C.reset}` }

// ── 수감자 매핑 ──────────────────────────────────────────────────────────────
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

// ── 게임→DB 변환 매핑 ────────────────────────────────────────────────────────
const ATK_TYPE_MAP = { SLASH: 'slash', PENETRATE: 'pierce', HIT: 'blunt' }
const DEF_TYPE_MAP = { GUARD: 'defense', EVADE: 'evade', COUNTER: 'counter' }
const SIN_MAP = {
  CRIMSON: 'wrath', SCARLET: 'lust', AMBER: 'sloth', SHAMROCK: 'gluttony',
  AZURE: 'gloom', INDIGO: 'pride', VIOLET: 'envy',
}
// resistInfo value → DB 저항 문자열 (DB는 한글 저장)
const RES_VALUE_MAP = { 0.5: '내성', 1: '보통', 1.5: '저항', 2: '취약', 999: '면역' }

// 소속 코드 → 한글명
const ASSOCIATION_MAP = {
  LIMBUS_COMPANY: '림버스 컴퍼니',
  LIMBUS_COMPANY_LCB: '림버스 컴퍼니',
  SEVEN: '세븐',
  BLADE_LINEAGE: '검계',
  SHI: '시',
  N_CORP: 'N사',
  NCORP: 'N사',
  MIDDLE_FINGER: '중지',
  RING_FINGER: '약지',
  INDEX_FINGER: '검지',
  LITTLE_FINGER: '소지',
  THUMB_FINGER: '엄지',
  KUROKUMO: '흑운회',
  T_CORP: 'T사',
  SWORD_GROUP: '칼잡이',
  SPIDER_HOUSE: '거미집',
  LEGO: '레고',
  CINQ: '다섯손가락',
  CINQ_EAST: '다섯손가락',
  HEISHOU: '흑수',
  BLOODFIEND: '피멍울',
  FULLSTOP: '마침표',
  BLACKWATER: '흑강',
  XICHUN: '씻김',
}

// 소속 판별 — 단순 소속 코드 (조직/그룹), 개인 특성 키워드 제외
const AFFILIATION_KEYS = new Set(Object.keys(ASSOCIATION_MAP))

// ── 조건 태그 → 한글 (translateDesc에서 재사용) ──────────────────────────────
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

// TAG_MAP은 런타임에 KR_BattleKeywords 로드 후 교체
let TAG_MAP = { ...CONDITION_TAG_MAP }

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/**
 * .txt 파일 읽기 (JSON with BOM)
 * @param {string} filePath 절대 경로
 */
function readTxt(filePath) {
  if (!existsSync(filePath)) return null
  try {
    const raw = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '')
    return JSON.parse(raw)
  } catch (e) {
    console.warn(yellow(`  [경고] 파일 파싱 실패: ${filePath} — ${e.message}`))
    return null
  }
}

/**
 * KR_BattleKeywords*.txt 파일을 모두 읽어 id→name 맵 구축
 */
function loadKrTagMap() {
  const map = { ...CONDITION_TAG_MAP }
  if (!existsSync(KR_DIR)) return map

  const kwFiles = readdirSync(KR_DIR)
    .filter(f => /^KR_(BattleKeywords|Bufs|BuffAbilities)/i.test(f) && f.endsWith('.txt'))

  for (const f of kwFiles) {
    const data = readTxt(resolve(KR_DIR, f))
    if (!data) continue
    for (const item of data.dataList ?? []) {
      if (item.id && item.name && !map[item.id]) {
        map[item.id] = item.name
      }
    }
  }
  return map
}

/**
 * KR_Personalities*.txt 파일을 모두 읽어 id→{name, title, nameWithTitle} 맵 구축
 */
function loadKrPersonalities() {
  const map = new Map()
  if (!existsSync(KR_DIR)) return map

  const files = readdirSync(KR_DIR)
    .filter(f => /^KR_Personalities.*\.txt$/.test(f) && !f.includes('x1p1c1'))
    .sort()  // 기본 파일 먼저, -a1c9p2 등 패치 파일은 뒤에서 덮어쓸 것

  for (const f of files) {
    const data = readTxt(resolve(KR_DIR, f))
    if (!data) continue
    for (const item of data.dataList ?? []) {
      if (item.id == null) continue
      map.set(String(item.id), {
        name: item.name ?? '',
        title: item.title ?? '',
        nameWithTitle: item.nameWithTitle ?? item.name ?? '',
      })
    }
  }
  return map
}

/**
 * KR_Skills_personality-{NN}*.txt 파일을 모두 읽어 skillId→levelList 맵 구축
 */
function loadKrSkills() {
  const map = new Map()
  if (!existsSync(KR_DIR)) return map

  const files = readdirSync(KR_DIR)
    .filter(f => /^KR_Skills_personality.*\.txt$/.test(f))

  for (const f of files) {
    const data = readTxt(resolve(KR_DIR, f))
    if (!data) continue
    for (const item of data.dataList ?? []) {
      if (item.id == null) continue
      // 나중에 로드되는 파일(패치)이 기존 항목을 덮어씀
      map.set(item.id, item)
    }
  }
  return map
}

/**
 * personality-{01~12}.txt 파일을 모두 읽어 gameId→personality 맵 구축
 * a1c*, nextupdate, x1p1c1 변형 파일은 스킵
 */
function loadPersonalities() {
  const map = new Map()

  for (const sinner of SINNERS) {
    const pad = String(sinner.id).padStart(2, '0')
    const filePath = resolve(TXT_DIR, `personality-${pad}.txt`)
    const data = readTxt(filePath)
    if (!data) {
      console.warn(yellow(`  [경고] personality-${pad}.txt 없음`))
      continue
    }
    for (const p of data.list ?? []) {
      if (p.id == null) continue
      map.set(String(p.id), p)
    }
  }
  return map
}

/**
 * personality-skill-{01~12}.txt 파일을 모두 읽어 skillId→skill 맵 구축
 */
function loadPersonalitySkills() {
  const map = new Map()

  for (const sinner of SINNERS) {
    const pad = String(sinner.id).padStart(2, '0')
    const filePath = resolve(TXT_DIR, `personality-skill-${pad}.txt`)
    const data = readTxt(filePath)
    if (!data) continue
    for (const s of data.list ?? []) {
      if (s.id == null) continue
      if (!map.has(s.id)) map.set(s.id, s)
    }
  }
  return map
}

// ── 인격 스탯 계산 ───────────────────────────────────────────────────────────

/**
 * resistInfo 배열에서 특정 atkType의 저항값 → DB 문자열 변환
 */
function getResistance(resistInfo, atkType) {
  if (!resistInfo?.atkResistList) return null
  const entry = resistInfo.atkResistList.find(r => r.type === atkType)
  if (!entry) return null
  return RES_VALUE_MAP[entry.value] ?? null
}

/**
 * skillKeywordList → KR 이름 배열 (TAG_MAP 사용)
 */
function translateKeywords(keywordList) {
  const result = []
  for (const kw of keywordList ?? []) {
    const kr = TAG_MAP[kw]
    if (kr && !CONDITION_TAG_MAP[kw]) result.push(kr)
  }
  return result
}

/**
 * personality JSON → DB identities 행 데이터 계산
 */
function calcIdentityStats(p, krName) {
  // base_hp = defaultStat (레벨 1 기준)
  // hp = level 60 계산값
  const base_hp = p.hp?.defaultStat ?? null
  const hp = base_hp != null ? Math.round(base_hp + (p.hp?.incrementByLevel ?? 0) * 60) : null
  const hp_per_level = p.hp?.incrementByLevel ?? null
  const speed_min = p.minSpeedList?.[3] ?? null   // index 3 = uptie 4
  const speed_max = p.maxSpeedList?.[3] ?? null
  const def_level = p.defCorrection != null ? 60 + p.defCorrection : null
  const rarity = p.rank ?? null
  const slash_res = getResistance(p.resistInfo, 'SLASH')
  const pierce_res = getResistance(p.resistInfo, 'PENETRATE')
  const blunt_res = getResistance(p.resistInfo, 'HIT')
  const break_section = p.breakSection?.sectionList ?? null
  const keywords = translateKeywords(p.skillKeywordList)

  // folder_name: appearance에서 gameId 접두사 제거 (e.g. "10101_YiSang_BaseAppearance" → "YiSang_BaseAppearance")
  const folder_name = p.appearance
    ? p.appearance.replace(/^\d+_/, '')
    : null

  // name / name_kr
  // name_kr = identity title (e.g. "LCB 수감자"), not bare sinner name
  // name = same as name_kr (English-facing label, gets overridden by hand if needed)
  const name_kr = krName?.nameWithTitle ?? krName?.name ?? null
  const name = krName?.nameWithTitle || krName?.name || null

  // sinner_id: characterId → slug
  const sinner = SINNERS.find(s => s.id === p.characterId)
  const sinner_slug = sinner?.slug ?? null

  // affiliation: associationList에서 소속 한글명 추출 (첫 번째 매칭)
  const affiliationEntry = (p.associationList ?? []).find(a => AFFILIATION_KEYS.has(a))
  const affiliation = affiliationEntry ? (ASSOCIATION_MAP[affiliationEntry] ?? null) : null

  return {
    game_id: String(p.id),
    sinner_slug,
    name,
    name_kr,
    hp,
    base_hp,
    hp_per_level,
    speed_min,
    speed_max,
    def_level,
    rarity,
    slash_res,
    pierce_res,
    blunt_res,
    break_section,
    keywords,
    folder_name,
    affiliation,
  }
}

/**
 * gaksungLevel 기반 누적 병합 (sync-game-data.mjs의 resolveToLevel과 동일 로직)
 */
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

/**
 * KR levelList에서 targetLevel 이하 최고 레벨 항목 반환
 */
function getBestLevelEntry(levelList = [], targetLevel = Infinity) {
  return levelList
    .filter(l => l.level <= targetLevel)
    .sort((a, b) => b.level - a.level)[0] ?? levelList[0] ?? null
}

/**
 * Unity 마크업 태그 제거 + [EnglishTag] → 한글 변환
 */
function translateDesc(desc) {
  if (!desc) return ''
  return desc
    .replace(/<style="[^"]*">/g, '').replace(/<\/style>/g, '')
    .replace(/<\/?noparse>/g, '')
    .replace(/<\/?u>/g, '')
    .replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '')
    .replace(/<link=[^>]*>/g, '').replace(/<\/link>/g, '')
    .replace(/<sprite[^>]*\/?>/g, '')
    .replace(/<size=[^>]*>/g, '').replace(/<\/size>/g, '')
    .replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (match, tag, offset, str) => {
      const kr = TAG_MAP[tag]
      if (!kr) return match
      if (CONDITION_TAG_MAP[tag]) return `[${kr}]`
      const before = offset > 0 ? str[offset - 1] : ''
      const needSpaceBefore = before && /[가-힣0-9]/.test(before)
      return (needSpaceBefore ? ' ' : '') + kr
    })
    .trim()
}

/**
 * KR 스킬 텍스트 → description 문자열 조립
 */
function buildDescription(krSkillItem, targetLevel) {
  if (!krSkillItem) return ''
  const best = getBestLevelEntry(krSkillItem.levelList ?? [], targetLevel)
  if (!best) return ''

  const parts = []
  const globalDesc = translateDesc(best.desc ?? '').trim()
  if (globalDesc) parts.push(globalDesc)

  const coinlist = best.coinlist ?? []
  for (let i = 0; i < coinlist.length; i++) {
    const coin = coinlist[i]
    const descs = (coin.coindescs ?? [])
      .map(cd => translateDesc(cd.desc ?? '').trim())
      .filter(Boolean)
    if (descs.length > 0) {
      parts.push(`[코인 ${i + 1}] ${descs[0]}`)
      for (let j = 1; j < descs.length; j++) parts.push(descs[j])
    }
  }
  return parts.join('\n')
}

/**
 * 인격의 스킬 행 배열 생성 (uptie 3 + 4)
 * @param {object} gamePerson   personality JSON 항목
 * @param {Map}    skillMap     skillId → personality-skill JSON 항목
 * @param {Map}    krSkillMap   skillId → KR_Skills_personality JSON 항목
 * @param {string} identityId  DB identity UUID (신규면 null)
 * @returns {Array}
 */
function buildSkillRows(gamePerson, skillMap, krSkillMap, identityId) {
  const attackSkillIds = (gamePerson.attributeList ?? []).map(a => a.skillId)
  const defenseSkillIds = gamePerson.defenseSkillIDList ?? []
  const UPTIE_LEVELS = [3, 4]

  const rows = []
  for (const uptie of UPTIE_LEVELS) {
    let variantIdx = 0

    // 공격 스킬
    for (const sid of attackSkillIds) {
      const gs = skillMap.get(sid)
      if (!gs) continue
      const r = resolveToLevel(gs, uptie)
      const coinList = r.coinList ?? []
      const krItem = krSkillMap.get(sid)
      const best = getBestLevelEntry(krItem?.levelList ?? [], uptie)
      const skillOrder = gs.skillTier ?? 1
      const name = best?.name ?? `스킬${skillOrder}`
      const description = buildDescription(krItem, uptie)
      const isDefense = r.defType && r.defType !== 'ATTACK'

      rows.push({
        identity_id: identityId,
        name,
        skill_type: isDefense
          ? (DEF_TYPE_MAP[r.defType] ?? null)
          : (ATK_TYPE_MAP[r.atkType] ?? null),
        sin_affinity: SIN_MAP[r.attributeType] ?? null,
        base_power: r.defaultValue ?? null,
        coin_power: coinList.length > 0
          ? (coinList[0].operatorType === 'SUB' ? -coinList[0].scale : coinList[0].scale)
          : null,
        coins: coinList.length || 1,
        offense_level: r.skillLevelCorrection != null ? 60 + r.skillLevelCorrection : null,
        description,
        skill_order: skillOrder,
        atk_weight: r.targetNum ?? 1,
        variant_order: ++variantIdx,
        uptie_level: uptie,
      })
    }

    // 수비 스킬 (requireIDList 있는 변형 제외)
    const defSkills = defenseSkillIds
      .map(sid => skillMap.get(sid))
      .filter(gs => gs && !(gs.requireIDList && gs.requireIDList.length > 0))

    for (const gs of defSkills) {
      const r = resolveToLevel(gs, uptie)
      const coinList = r.coinList ?? []
      const krItem = krSkillMap.get(gs.id)
      const best = getBestLevelEntry(krItem?.levelList ?? [], uptie)
      const name = best?.name ?? '수비'
      const description = buildDescription(krItem, uptie)
      const isDefense = r.defType && r.defType !== 'ATTACK'

      rows.push({
        identity_id: identityId,
        name,
        skill_type: isDefense
          ? (DEF_TYPE_MAP[r.defType] ?? null)
          : (ATK_TYPE_MAP[r.atkType] ?? null),
        sin_affinity: SIN_MAP[r.attributeType] ?? null,
        base_power: r.defaultValue ?? null,
        coin_power: coinList.length > 0
          ? (coinList[0].operatorType === 'SUB' ? -coinList[0].scale : coinList[0].scale)
          : null,
        coins: coinList.length || 1,
        offense_level: r.skillLevelCorrection != null ? 60 + r.skillLevelCorrection : null,
        description,
        skill_order: 4,
        atk_weight: r.targetNum ?? 1,
        variant_order: ++variantIdx,
        uptie_level: uptie,
      })
    }
  }
  return rows
}

// ── Supabase REST ─────────────────────────────────────────────────────────────
async function supaGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers })
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function supaPatch(table, params, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`PATCH ${table}: ${res.status} ${await res.text()}`)
}

async function supaInsert(table, rows) {
  // 50개 배치
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
        console.log(yellow('    rate limit, 3초 대기 후 재시도...'))
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

async function supaDelete(table, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=minimal' },
  })
  if (!res.ok) throw new Error(`DELETE ${table}: ${res.status} ${await res.text()}`)
}

// ── diff 출력 헬퍼 ────────────────────────────────────────────────────────────

/**
 * 두 값이 DB 비교 목적으로 동일한지 검사
 * - 배열은 JSON 직렬화 비교
 * - null/undefined 동일 취급
 */
function valuesEqual(a, b) {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return a === b
}

// Fields compared for EXISTING identities — only game-sourced numeric/resistance stats.
// name_kr, folder_name, keywords, affiliation are hand-curated in DB and must NOT be overwritten.
const STAT_FIELDS = [
  'hp', 'base_hp', 'hp_per_level', 'speed_min', 'speed_max', 'def_level',
  'rarity', 'slash_res', 'pierce_res', 'blunt_res',
  'break_section',
]

/**
 * 게임 계산값 vs DB 행 비교 → 변경 필드 목록 반환
 */
function diffIdentity(computed, dbRow) {
  const changes = {}
  for (const field of STAT_FIELDS) {
    const newVal = computed[field]
    const oldVal = dbRow[field]
    if (!valuesEqual(newVal, oldVal)) {
      changes[field] = { from: oldVal, to: newVal }
    }
  }
  return changes
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(bold('╔══════════════════════════════════════════════════════════╗'))
  console.log(bold('║  인격/스킬 게임 데이터 → DB 동기화                       ║'))
  console.log(bold('╠══════════════════════════════════════════════════════════╣'))
  console.log(bold(`║  모드: ${dryRun ? '  DRY RUN (비교만)' : red('  FIX (DB 반영)')}                          `))
  console.log(bold(`║  대상: ${sinnerFilter ? `  ${sinnerFilter}` : '  전체 12명'}                             `))
  console.log(bold('╚══════════════════════════════════════════════════════════╝\n'))

  // ── 데이터 로드 ────────────────────────────────────────────────────────────
  console.log('  게임 데이터 로드 중...')

  TAG_MAP = loadKrTagMap()
  console.log(`  KR 태그 맵: ${Object.keys(TAG_MAP).length}개`)

  const krPersonMap = loadKrPersonalities()
  console.log(`  KR 인격 이름: ${krPersonMap.size}개`)

  const krSkillMap = loadKrSkills()
  console.log(`  KR 스킬 텍스트: ${krSkillMap.size}개`)

  const gamePersonMap = loadPersonalities()
  console.log(`  게임 인격 JSON: ${gamePersonMap.size}개\n`)

  const gameSkillMap = loadPersonalitySkills()
  console.log(`  게임 스킬 JSON: ${gameSkillMap.size}개\n`)

  // ── DB 로드 ────────────────────────────────────────────────────────────────
  console.log('  DB 데이터 로드 중...')
  const dbIdentityRows = await supaGet(
    'identities',
    `select=id,game_id,sinner_id,name,name_kr,hp,base_hp,hp_per_level,speed_min,speed_max,def_level,rarity,slash_res,pierce_res,blunt_res,break_section,keywords,folder_name,affiliation&limit=2000`
  )
  const dbIdentityMap = new Map()
  for (const row of dbIdentityRows) {
    if (row.game_id) dbIdentityMap.set(String(row.game_id), row)
  }
  console.log(`  DB 인격: ${dbIdentityMap.size}개 로드\n`)

  // ── 수감자별 처리 ─────────────────────────────────────────────────────────
  const targetSinners = sinnerFilter
    ? SINNERS.filter(s => s.slug === sinnerFilter)
    : SINNERS

  if (sinnerFilter && targetSinners.length === 0) {
    console.error(red(`[ERROR] 알 수 없는 sinner slug: ${sinnerFilter}`))
    console.error(`유효한 slug: ${SINNERS.map(s => s.slug).join(', ')}`)
    process.exit(1)
  }

  // DB sinner_id(uuid) 조회 캐시
  const sinnerUuidCache = new Map()

  // 집계
  let totalNew = 0, totalChanged = 0, totalUnchanged = 0, totalSkipped = 0
  let totalSkillsInserted = 0

  for (const sinner of targetSinners) {
    console.log(`${'═'.repeat(60)}`)
    console.log(bold(`  ${sinner.name.toUpperCase()} (${sinner.slug})`))
    console.log('═'.repeat(60))

    // 이 수감자의 인격 목록 (game personality JSON에서 characterId로 필터)
    const sinnerPersonalities = [...gamePersonMap.values()]
      .filter(p => p.characterId === sinner.id)

    if (sinnerPersonalities.length === 0) {
      console.log(gray(`  [스킵] 게임 데이터 없음`))
      totalSkipped++
      continue
    }

    console.log(gray(`  게임 인격 ${sinnerPersonalities.length}개`))

    // DB sinner UUID 확보
    // sinners.id is the slug (text PK, e.g. "yi-sang")
    let sinnerUuid = sinnerUuidCache.get(sinner.slug)
    if (!sinnerUuid) {
      const rows = await supaGet('sinners', `id=eq.${encodeURIComponent(sinner.slug)}&select=id&limit=1`)
      if (!rows.length) {
        console.warn(yellow(`  [경고] DB에 수감자 없음: ${sinner.slug} — 스킵`))
        continue
      }
      sinnerUuid = rows[0].id  // this is the slug itself
      sinnerUuidCache.set(sinner.slug, sinnerUuid)
    }

    for (let i = 0; i < sinnerPersonalities.length; i++) {
      const p = sinnerPersonalities[i]
      const gameId = String(p.id)
      const krName = krPersonMap.get(gameId)
      const computed = calcIdentityStats(p, krName)
      const displayName = krName?.nameWithTitle ?? krName?.name ?? gameId

      const dbRow = dbIdentityMap.get(gameId)

      // ── 신규 인격 ───────────────────────────────────────────────────────
      if (!dbRow) {
        totalNew++
        console.log(green(`  [${i + 1}/${sinnerPersonalities.length}] [NEW] ${displayName} (game_id: ${gameId})`))
        if (verbose || true) {
          // 항상 신규 인격의 핵심 스탯 출력
          console.log(green(`    rank=${computed.rarity} sin=${computed.sin_affinity} hp=${computed.hp} spd=${computed.speed_min}~${computed.speed_max}`))
          console.log(green(`    folder: ${computed.folder_name}`))
          console.log(green(`    affiliation: ${computed.affiliation ?? '(없음)' }`))
          console.log(green(`    keywords: [${computed.keywords?.join(', ') ?? ''}]`))
        }

        if (!dryRun) {
          // 스킬 먼저 제외하고 인격 행 삽입
          const identityRow = {
            sinner_id: sinnerUuid,
            name: computed.name,
            name_kr: computed.name_kr,
            tier: computed.rarity ?? 1,
            hp: computed.hp,
            base_hp: computed.base_hp,
            hp_per_level: computed.hp_per_level,
            speed_min: computed.speed_min,
            speed_max: computed.speed_max,
            def_level: computed.def_level,
            rarity: computed.rarity,
            game_id: computed.game_id,
            folder_name: computed.folder_name,
            affiliation: computed.affiliation,
            slash_res: computed.slash_res,
            pierce_res: computed.pierce_res,
            blunt_res: computed.blunt_res,
            break_section: computed.break_section,
            keywords: computed.keywords,
          }

          const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/identities`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'return=representation' },
            body: JSON.stringify([identityRow]),
          })
          if (!insertRes.ok) {
            const text = await insertRes.text()
            console.error(red(`    [ERROR] 인격 삽입 실패: ${text}`))
            continue
          }
          const inserted = await insertRes.json()
          const newIdentityId = inserted[0]?.id
          if (!newIdentityId) {
            console.error(red(`    [ERROR] 삽입된 identity id 반환 없음`))
            continue
          }

          console.log(green(`    인격 삽입 완료: ${newIdentityId}`))

          // 스킬 삽입
          if (!newOnly) {
            const skillRows = buildSkillRows(p, gameSkillMap, krSkillMap, newIdentityId)
            if (skillRows.length > 0) {
              await supaInsert('skills', skillRows)
              totalSkillsInserted += skillRows.length
              console.log(green(`    스킬 삽입: ${skillRows.length}개 (uptie 3+4)`))
            }
          }

          // 캐시 업데이트
          dbIdentityMap.set(gameId, { ...identityRow, id: newIdentityId })
          await sleep(150)
        } else {
          // dry-run: 스킬 미리보기
          if (!newOnly) {
            const skillRows = buildSkillRows(p, gameSkillMap, krSkillMap, null)
            console.log(green(`    스킬 예정: ${skillRows.length}개 (uptie 3+4)`))
            if (verbose) {
              for (const s of skillRows.filter(r => r.uptie_level === 4)) {
                console.log(green(`      S${s.skill_order} uptie${s.uptie_level} "${s.name}" [${s.skill_type}/${s.sin_affinity}] 위력${s.base_power}+${s.coin_power}×${s.coins}`))
              }
            }
          }
        }
        continue
      }

      // ── 기존 인격 비교 ───────────────────────────────────────────────────
      if (newOnly) continue

      const changes = diffIdentity(computed, dbRow)
      const changeCount = Object.keys(changes).length

      if (changeCount === 0) {
        totalUnchanged++
        if (verbose) {
          console.log(gray(`  [${i + 1}/${sinnerPersonalities.length}] [OK] ${displayName} (변경 없음)`))
        }
        continue
      }

      totalChanged++
      console.log(yellow(`  [${i + 1}/${sinnerPersonalities.length}] [CHANGED] ${displayName} (game_id: ${gameId})`))
      for (const [field, { from, to }] of Object.entries(changes)) {
        const fromStr = Array.isArray(from) ? JSON.stringify(from) : String(from ?? 'null')
        const toStr = Array.isArray(to) ? JSON.stringify(to) : String(to ?? 'null')
        console.log(yellow(`    ${field}: ${fromStr} → ${toStr}`))
      }

      if (!dryRun) {
        // 변경 필드만 업데이트
        const updatePayload = {}
        for (const [field, { to }] of Object.entries(changes)) {
          updatePayload[field] = to
        }
        await supaPatch('identities', `id=eq.${dbRow.id}`, updatePayload)
        console.log(yellow(`    업데이트 완료`))
        await sleep(80)
      }
    }
  }

  // ── 최종 요약 ──────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`)
  console.log(bold('  요약'))
  console.log('═'.repeat(60))
  console.log(green(`  신규 인격:     ${totalNew}개`))
  console.log(yellow(`  변경된 인격:   ${totalChanged}개`))
  console.log(gray(`  변경 없음:     ${totalUnchanged}개`))
  if (totalSkipped > 0) console.log(gray(`  스킵:          ${totalSkipped}개`))
  if (!dryRun && totalSkillsInserted > 0) {
    console.log(green(`  삽입된 스킬:   ${totalSkillsInserted}개`))
  }
  if (dryRun) {
    console.log(cyan('\n  (DRY RUN — DB 미변경. 반영하려면 --fix 옵션 사용)'))
  } else {
    console.log(cyan('\n  DB 반영 완료'))
  }

  // 신규 인격이 있을 때 수동 입력 안내
  if (totalNew > 0 && !dryRun) {
    console.log(yellow('\n  [수동 입력 필요 필드]'))
    console.log(yellow('  다음 필드는 자동으로 채워지지 않습니다:'))
    console.log(yellow('    • acquisition      — 획득 방법 (가챠/파편 교환)'))
    console.log(yellow('    • acquisition_info — JSONB (type, gacha, fragment_cost, release_season)'))
    console.log(yellow('    • quote            — 특색 있는 대사 (KR_Voice_*.json → smalltalk)'))
    console.log(yellow('    • keywords         — 스킬 설명 기반 추가 키워드 확인 필요'))
  }
}

main().catch(err => {
  console.error(red(`\n[FATAL] ${err.message}`))
  if (verbose) console.error(err.stack)
  process.exit(1)
})
