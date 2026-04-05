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
const syncSanityOnly = args.includes('--sync-sanity')

// ── JSON 데이터 경로 ──
const JSON_DIR = resolve(process.env.HOME, 'Downloads/JSON')
const UPTIE_LEVELS = [3, 4]
const TAG_PATTERN = /\[([A-Za-z_][A-Za-z0-9_]*)\]/g

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
  // kr/ 폴더 (신규 패치 KR 데이터)도 로드
  const newKrDir2 = resolve(process.env.HOME, 'Downloads/kr')
  if (existsSync(newKrDir2)) {
    for (const f of readdirSync(newKrDir2).filter(f => /^KR_(BattleKeywords|Bufs|BuffAbilities)/i.test(f))) {
      try {
        const raw = readFileSync(resolve(newKrDir2, f), 'utf-8').replace(/^\uFEFF/, '')
        const parsed = JSON.parse(raw)
        for (const item of parsed?.dataList ?? []) {
          if (item.id && item.name && !map[item.id]) map[item.id] = item.name
        }
      } catch { /* skip */ }
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

function collectJsonEntries(files, listKey = 'list') {
  const items = []
  for (const file of files) {
    const data = readJson(file)
    if (!data?.[listKey]) continue
    items.push(...data[listKey])
  }
  return items
}

function collectUniqueJsonEntries(files, { listKey = 'list', keyFn = item => item?.id, filterFn = () => true } = {}) {
  const items = []
  const seen = new Set()

  for (const item of collectJsonEntries(files, listKey)) {
    if (!filterFn(item)) continue
    const key = keyFn(item)
    if (key == null || seen.has(key)) continue
    seen.add(key)
    items.push(item)
  }

  return items
}

function buildIdMap(items) {
  const map = new Map()
  for (const item of items) {
    if (item?.id == null) continue
    map.set(item.id, item)
  }
  return map
}

// desc 텍스트 정리: 영문 태그 → 한글, Unity 마크업 태그 제거
function translateDesc(desc) {
  if (!desc) return ''
  let result = desc
    // <style="highlight">...</style> 제거 (내용은 유지)
    .replace(/<style="[^"]*">/g, '')
    .replace(/<\/style>/g, '')
    // Unity 마크업 태그 제거 (noparse, u, color, link, sprite, size 등)
    .replace(/<\/?noparse>/g, '')
    .replace(/<\/?u>/g, '')
    .replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '')
    .replace(/<link=[^>]*>/g, '').replace(/<\/link>/g, '')
    .replace(/<sprite[^>]*\/?>/g, '')
    .replace(/<size=[^>]*>/g, '').replace(/<\/size>/g, '')
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

function getBestLevelEntry(levels = [], targetLevel = Infinity) {
  return levels
    .filter(level => level.level <= targetLevel)
    .sort((a, b) => b.level - a.level)[0] || levels[0] || null
}

function collectKrDescriptions(target, krText) {
  if (!krText) return

  if (krText.desc) target.push(krText.desc)

  for (const coinDesc of krText.coindescs || []) {
    if (coinDesc?.desc) target.push(coinDesc.desc)
  }

  for (const level of krText.levelList || []) {
    if (level?.desc) target.push(level.desc)
    for (const coin of level.coinlist || []) {
      for (const coinDesc of coin.coindescs || []) {
        if (coinDesc?.desc) target.push(coinDesc.desc)
      }
    }
  }
}

function addMappedKeyword(keywords, tag) {
  const keyword = TAG_MAP[tag]
  if (keyword) keywords.add(keyword)
}

function collectBuffKeywords(value, keywords) {
  if (!value) return

  if (Array.isArray(value)) {
    for (const item of value) {
      collectBuffKeywords(item, keywords)
    }
    return
  }

  if (typeof value !== 'object') return

  if (typeof value.buffKeyword === 'string') {
    addMappedKeyword(keywords, value.buffKeyword)
  }

  // scriptName에서 키워드 태그 추출
  // e.g. "SinkingSurgeOnSucceedAttackViaBuffCheck" contains "SinkingSurge"
  if (typeof value.scriptName === 'string') {
    const sn = value.scriptName
    for (const tag of Object.keys(TAG_MAP)) {
      if (CONDITION_TAG_MAP[tag]) continue  // 조건 태그 제외
      if (tag.length < 6) continue  // 짧은 태그 오탐 방지
      if (EXCLUDED_TAGS.has(tag)) continue  // scriptName 흔한 단어 제외
      if (sn.includes(tag)) {
        addMappedKeyword(keywords, tag)
      }
    }
  }

  for (const child of Object.values(value)) {
    collectBuffKeywords(child, keywords)
  }
}

const EXCLUDED_TAGS = new Set(['Target', 'Result', 'Damage', 'Attack', 'Return', 'Recover', 'Shield'])

function collectBracketKeywords(rawTexts, keywords) {
  const rawText = rawTexts.join('\n')
  for (const match of rawText.matchAll(TAG_PATTERN)) {
    const tag = match[1]
    if (CONDITION_TAG_MAP[tag]) continue
    if (EXCLUDED_TAGS.has(tag)) continue
    addMappedKeyword(keywords, tag)
  }
}

function getIdentityKeywordContext(store, gameId) {
  if (!store.has(gameId)) {
    store.set(gameId, {
      gamePerson: null,
      skillMap: new Map(),
      rawKrTexts: [],
      passiveDetails: [],
    })
  }

  return store.get(gameId)
}

function getPersonalitySkillIds(gamePerson) {
  return [
    ...(gamePerson.attributeList || []).map(attribute => attribute.skillId),
    ...(gamePerson.defenseSkillIDList || []),
  ]
}

// 스킬 설명 조립
function buildDescription(krText) {
  if (!krText) return ''
  // uptie 4 (가장 높은 level) 텍스트 사용
  const levels = krText.levelList || []
  const best = getBestLevelEntry(levels)
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

async function supaPatch(table, params, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`PATCH ${table}: ${res.status} ${await res.text()}`)
}

/**
 * 인격의 키워드를 게임 데이터에서 추출합니다.
 * 소스:
 *   1. skillKeywordList (인격 JSON 최상위)
 *   2. buffKeyword (스킬 coinList abilityScriptList)
 *   3. 스킬/패시브 KR 원본 텍스트의 [EnglishTag] 중 CONDITION이 아닌 것
 *
 * 핵심 로직: KR 설명 원본에 [Sinking], [KarmaOfIndexAlly] 등 대괄호 태그가 있고,
 * 발동 타이밍은 [OnSucceedAttack] 등으로 CONDITION_TAG_MAP에 정의되어 있으므로
 * CONDITION에 없는 [Tag]만 추출하면 키워드만 남음.
 */
function extractKeywords({ gamePerson, skillMap, rawKrTexts = [], passiveDetails = [] }) {
  const keywords = new Set()

  // 1. 인격 JSON 최상위 키워드들
  for (const keyword of [...(gamePerson.skillKeywordList || []), ...(gamePerson.unitKeywordList || [])]) {
    addMappedKeyword(keywords, keyword)
  }

  // 2. 스킬 coinList의 buffKeyword에서 추출
  for (const skillId of getPersonalitySkillIds(gamePerson)) {
    collectBuffKeywords(skillMap.get(skillId)?.skillData, keywords)
  }

  // 3. 패시브 상세 데이터 내 buffKeyword에서 추출
  for (const passiveDetail of passiveDetails) {
    collectBuffKeywords(passiveDetail, keywords)
  }

  // 4. KR 원본 텍스트에서 [EnglishTag] 패턴 추출
  collectBracketKeywords(rawKrTexts, keywords)

  return [...keywords].sort()
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

// ── 정신력 조건 동기화 ──
async function syncSanityConditions() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  정신력 조건 동기화 (panic_types + identity_sanity_conditions)')
  console.log('═'.repeat(60))

  // 1. KR_MentalCondition*.json → mental_condition_templates 업서트
  const mentalTemplateMap = new Map() // templateId → { add_text, min_text }
  for (const f of readdirSync(resolve(JSON_DIR, 'KR')).filter(n => n.startsWith('KR_MentalCondition') && n.endsWith('.json'))) {
    const data = readJson(`KR/${f}`)
    if (!data) continue
    for (const item of data.dataList || []) {
      if (!item.id) continue
      if (!mentalTemplateMap.has(item.id)) {
        mentalTemplateMap.set(item.id, { add_text: item.add || '', min_text: item.min || '' })
      }
    }
  }
  console.log(`  KR_MentalCondition: ${mentalTemplateMap.size}개 템플릿 로드`)

  if (dryRun) {
    console.log(`  [DRY RUN] mental_condition_templates 업서트 예정: ${mentalTemplateMap.size}개`)
    for (const [id, { add_text, min_text }] of mentalTemplateMap) {
      console.log(`    ${id}: add="${add_text.slice(0, 50)}" min="${min_text.slice(0, 50)}"`)
    }
  } else {
    const templateRows = [...mentalTemplateMap.entries()].map(([id, { add_text, min_text }]) => ({
      id,
      add_text,
      min_text,
    }))
    // 50개씩 업서트 (id PK, merge-duplicates)
    for (let i = 0; i < templateRows.length; i += 50) {
      const batch = templateRows.slice(i, i + 50)
      const res = await fetch(`${SUPABASE_URL}/rest/v1/mental_condition_templates`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(batch),
      })
      if (!res.ok) throw new Error(`UPSERT mental_condition_templates: ${res.status} ${await res.text()}`)
      if (templateRows.length > 50) await sleep(200)
    }
    console.log(`  mental_condition_templates 업서트: ${templateRows.length}개`)
  }

  // 2. personality JSON → game_id별 mentalConditionInfo 수집
  const gameMentalMap = new Map() // game_id (string) → mentalConditionInfo
  const gamePanicTypeMap = new Map() // game_id (string) → panicType (int)
  for (const sinner of SINNERS) {
    const pad = String(sinner.id).padStart(2, '0')
    const pFiles = [`personality-${pad}.json`]
    for (const extra of readdirSync(JSON_DIR).filter(f => f.startsWith('personality-a1c') && f.endsWith('.json'))) {
      if (!pFiles.includes(extra)) pFiles.push(extra)
    }
    for (const f of pFiles) {
      const data = readJson(f)
      if (!data) continue
      for (const p of data.list || []) {
        if (p.id == null) continue
        const gid = String(p.id)
        if (p.mentalConditionInfo != null && !gameMentalMap.has(gid)) {
          gameMentalMap.set(gid, p.mentalConditionInfo)
        }
        if (p.panicType != null && !gamePanicTypeMap.has(gid)) {
          gamePanicTypeMap.set(gid, p.panicType)
        }
      }
    }
  }
  console.log(`  personality JSON: ${gameMentalMap.size}개 인격 mentalConditionInfo 로드`)

  // 3. DB identities → game_id → uuid 매핑
  const dbIdentitiesAll = await supaGet('identities', 'select=id,game_id&limit=1000')
  const identityUuidMap = new Map() // game_id (string) → uuid
  for (const row of dbIdentitiesAll) {
    if (row.game_id) identityUuidMap.set(String(row.game_id), row.id)
  }
  console.log(`  DB identities: ${identityUuidMap.size}개 로드`)

  // conditionID → templateId + params 파싱 헬퍼
  function parseConditionId(conditionID) {
    const templateId = conditionID.replace(/\d+/g, '')
    const params = (conditionID.match(/\d+/g) || []).map(Number)
    return { templateId, params }
  }

  // 4. identity별 identity_sanity_conditions 삭제 후 재삽입
  // --sinner 지정 시 해당 sinner의 game_id만 처리
  let filteredUuidMap = identityUuidMap
  if (sinnerFilter) {
    const targetSinner = SINNERS.find(s => s.slug === sinnerFilter)
    if (targetSinner) {
      const sinnerGameIds = new Set()
      const pad = String(targetSinner.id).padStart(2, '0')
      const pFiles = [`personality-${pad}.json`]
      for (const extra of readdirSync(JSON_DIR).filter(f => f.startsWith('personality-a1c') && f.endsWith('.json'))) {
        if (!pFiles.includes(extra)) pFiles.push(extra)
      }
      for (const f of pFiles) {
        const data = readJson(f)
        if (!data) continue
        for (const p of data.list || []) {
          if (p.characterId === targetSinner.id && p.id != null) {
            sinnerGameIds.add(String(p.id))
          }
        }
      }
      filteredUuidMap = new Map([...identityUuidMap].filter(([gid]) => sinnerGameIds.has(gid)))
      console.log(`  --sinner ${sinnerFilter} 필터: ${filteredUuidMap.size}개 인격 대상`)
    } else {
      console.warn(`  [경고] 알 수 없는 sinner slug: ${sinnerFilter} — 전체 처리`)
    }
  }

  let totalInserted = 0
  let totalDeleted = 0
  let totalSkipped = 0
  let processed = 0
  const total = filteredUuidMap.size

  for (const [gameId, identityId] of filteredUuidMap) {
    processed++
    const mentalInfo = gameMentalMap.get(gameId)
    if (!mentalInfo) {
      totalSkipped++
      continue
    }

    // 모든 level의 조건 수집 (add → 'increase', min → 'decrease')
    const newRows = []
    let sortOrder = 0

    for (const addEntry of (mentalInfo.add || [])) {
      for (const c of addEntry?.conditionIDList || []) {
        const { templateId, params } = parseConditionId(c.conditionID)
        if (!mentalTemplateMap.has(templateId)) {
          if (verbose) console.log(`    [경고] 템플릿 없음: ${templateId} (conditionID: ${c.conditionID})`)
          continue
        }
        newRows.push({
          identity_id: identityId,
          template_id: templateId,
          condition_type: 'increase',
          params,
          sort_order: ++sortOrder,
        })
      }
    }

    for (const minEntry of (mentalInfo.min || [])) {
      for (const c of minEntry?.conditionIDList || []) {
        const { templateId, params } = parseConditionId(c.conditionID)
        if (!mentalTemplateMap.has(templateId)) {
          if (verbose) console.log(`    [경고] 템플릿 없음: ${templateId} (conditionID: ${c.conditionID})`)
          continue
        }
        newRows.push({
          identity_id: identityId,
          template_id: templateId,
          condition_type: 'decrease',
          params,
          sort_order: ++sortOrder,
        })
      }
    }

    if (newRows.length === 0) {
      totalSkipped++
      continue
    }

    if (dryRun) {
      console.log(`  [${processed}/${total}] game_id=${gameId}: ${newRows.length}개 조건`)
      if (verbose) {
        for (const r of newRows) {
          console.log(`    [${r.condition_type}] ${r.template_id} params=[${r.params.join(',')}]`)
        }
      }
    } else {
      // 기존 조건 삭제 후 재삽입
      const existing = await supaGet('identity_sanity_conditions', `identity_id=eq.${identityId}&select=id&limit=100`)
      if (existing.length > 0) {
        await supaDelete('identity_sanity_conditions', `identity_id=eq.${identityId}`)
        totalDeleted += existing.length
      }
      await supaInsertBatch('identity_sanity_conditions', newRows)
      totalInserted += newRows.length
      console.log(`  [${processed}/${total}] game_id=${gameId}: ${existing.length}개 삭제 → ${newRows.length}개 삽입`)
      await sleep(80)
    }
  }

  if (dryRun) {
    console.log(`\n  (DRY RUN — DB 미변경)`)
    console.log(`  처리: ${processed - totalSkipped}개 인격 / 스킵: ${totalSkipped}개`)
  } else {
    console.log(`\n  삭제: ${totalDeleted}개 / 삽입: ${totalInserted}개 / 스킵: ${totalSkipped}개`)
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
  const krSkillMap = buildIdMap(collectJsonEntries(krFiles, 'dataList'))
  console.log(`  KR 스킬 텍스트: ${krSkillMap.size}개 로드`)

  // KR 태그 매핑 로드 (BattleKeywords + Bufs)
  TAG_MAP = loadKrTagMap()
  console.log(`  KR 태그 매핑: ${Object.keys(TAG_MAP).length}개 로드\n`)

  const targetSinners = sinnerFilter
    ? SINNERS.filter(s => s.slug === sinnerFilter)
    : SINNERS

  let totalInserted = 0, totalDeleted = 0, totalSkipped = 0
  let egoInserted = 0, egoDeleted = 0, egoSkipped = 0

  // 키워드 추출용 — 스킬/패시브 단계에서 필요한 원본 컨텍스트를 game_id 단위로 축적
  const keywordContexts = new Map()

  for (const sinner of targetSinners) {
    console.log(`${'═'.repeat(60)}`)
    console.log(`  ${sinner.name.toUpperCase()} (${sinner.slug})`)
    console.log('═'.repeat(60))

    // 게임 데이터 로드 (기본 + 보조 파일)
    const pad = String(sinner.id).padStart(2, '0')
    const pFiles = [`personality-${pad}.json`, 'personality-a1c8p1.json', 'personality-a1c8p2.json', 'personality-a1c9p1.json', 'personality-a1c9p2.json']
    const personList = collectUniqueJsonEntries(pFiles, {
      filterFn: person => person.characterId === sinner.id,
    })

    const sFiles = [`personality-skill-${pad}.json`, 'personality-skill-a1c8p1.json', 'personality-skill-a1c8p2.json', 'personality-skill-a1c9p1.json', 'personality-skill-a1c9p2.json']
    const skillList = collectUniqueJsonEntries(sFiles)

    if (personList.length === 0) {
      console.log(`  [!] 게임 데이터 없음`)
      continue
    }

    // 스킬 ID → uptie4 해결 데이터
    const skillMap = new Map()
    for (const s of skillList) {
      skillMap.set(s.id, s)
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

      const gamePerson = personList.find(person => String(person.id) === gameId)
      if (!gamePerson) {
        if (verbose) console.log(`  [!] 게임 데이터에 인격 없음: ${identity.name} (${gameId})`)
        totalSkipped++
        continue
      }

      // 공격 스킬 + 수비 스킬
      const attackSkillIds = (gamePerson.attributeList || []).map(attribute => attribute.skillId)
      const defenseSkillIds = gamePerson.defenseSkillIDList || []

      // 새 스킬 행 생성 (uptie 3 + 4)
      const newSkills = []

      // 스킬 데이터를 특정 uptie 레벨로 생성하는 헬퍼
      function makeSkillRow(gs, uptie, skillOrder, vOrder) {
        const r = resolveToLevel(gs, uptie)
        const coinList = r.coinList || []
        const krText = krSkillMap.get(gs.id)
        // 해당 uptie 레벨의 KR 텍스트 (없으면 가장 높은 레벨)
        const bestForLevel = getBestLevelEntry(krText?.levelList || [], uptie)
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

      // KR 원본 텍스트 수집 (키워드 추출은 패시브 동기화 후 일괄 처리)
      const keywordContext = getIdentityKeywordContext(keywordContexts, identity.game_id)
      keywordContext.gamePerson = gamePerson
      keywordContext.skillMap = skillMap

      // 스킬 KR 원본 (번역 전 [Tag] 포함)
      for (const sid of getPersonalitySkillIds(gamePerson)) {
        const kr = krSkillMap.get(sid)
        if (!kr) continue
        collectKrDescriptions(keywordContext.rawKrTexts, kr)
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
  const krPassiveFiles = readdirSync(resolve(JSON_DIR, 'KR'))
    .filter(f => /^KR_Passives/i.test(f) || /^KR_Passive[^s]/i.test(f))
    .map(f => `KR/${f}`)
  const krPassiveEntries = collectJsonEntries(krPassiveFiles, 'dataList')
  // kr/ 폴더 (신규 패치 KR 데이터)도 로드
  const newKrDir = resolve(process.env.HOME, 'Downloads/kr')
  if (existsSync(newKrDir)) {
    for (const f of readdirSync(newKrDir).filter(f => /^KR_Passives/i.test(f) && !/_Abnormality/i.test(f) && !/_Enemy/i.test(f) && !/_Assist/i.test(f))) {
      try {
        const raw = readFileSync(resolve(newKrDir, f), 'utf-8').replace(/^\uFEFF/, '')
        const parsed = JSON.parse(raw)
        krPassiveEntries.push(...(parsed?.dataList ?? []))
      } catch { /* skip */ }
    }
  }
  const krPassiveMap = buildIdMap(
    krPassiveEntries.filter(item => item?.id && item?.name)
  )

  // 패시브 상세 데이터 (공명 조건)
  const passiveFiles = ['passive.json', 'passive-a1c8p1.json', 'passive-a1c8p2.json', 'passive-a1c9p1.json', 'passive-a1c9p2.json', 'passive-extra.json']
  const passiveEntries = collectJsonEntries(passiveFiles)
  // Json (Text) 폴더의 패시브 데이터도 로드 (신규 패치 데이터)
  const txtDir = resolve(process.env.HOME, 'Downloads/Json (Text)')
  for (const txtFile of ['passive.txt', 'passive_check4.txt']) {
    const txtPath = resolve(txtDir, txtFile)
    if (existsSync(txtPath)) {
      try {
        const raw = readFileSync(txtPath, 'utf-8').replace(/^\uFEFF/, '')
        const parsed = JSON.parse(raw)
        const list = parsed?.list ?? (Array.isArray(parsed) ? parsed : [])
        passiveEntries.push(...list)
      } catch { /* skip */ }
    }
  }
  const passiveDetailMap = buildIdMap(passiveEntries)

  let passiveInserted = 0, passiveDeleted = 0

  for (const sinner of targetSinners) {
    const pad = String(sinner.id).padStart(2, '0')
    // 패시브 매핑 로드
    const passiveMapping = []
    const pmFiles = [`personality-passive-${pad}.json`, 'personality-passive-a1c8p1.json', 'personality-passive-a1c8p2.json', 'personality-passive-a1c9p1.json', 'personality-passive-a1c9p2.json', 'personality-passive-extra.json']
    const addToMapping = (items) => {
      for (const item of items) {
        // personality game_id 앞 2자리로 수감자 필터
        // 실제로는 personalityID / 100의 앞자리가 수감자번호
        // 10101 → sinner 1, 10215 → sinner 2
        const sid = Math.floor(item.personalityID / 100) % 100
        if (sid === sinner.id || Math.floor(item.personalityID / 10000) === sinner.id) {
          passiveMapping.push(item)
        }
      }
    }
    for (const f of pmFiles) {
      const data = readJson(f)
      if (!data) continue
      addToMapping(data.list || [])
    }
    // Json (Text) 폴더의 신규 패치 personality-passive 파일도 로드
    for (const txtFile of readdirSync(txtDir).filter(f => f.startsWith('personality-passive') && f.endsWith('.txt'))) {
      try {
        const raw = readFileSync(resolve(txtDir, txtFile), 'utf-8').replace(/^\uFEFF/, '')
        const parsed = JSON.parse(raw)
        addToMapping(parsed?.list ?? (Array.isArray(parsed) ? parsed : []))
      } catch { /* skip */ }
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
            const hasStock = detail?.attributeStockCondition?.length > 0
            const hasResonance = detail?.attributeResonanceCondition?.length > 0
            const conds = detail?.attributeStockCondition || detail?.attributeResonanceCondition || []
            const sinCond = conds[0]
            const sinAffinity = sinCond ? (SIN_MAP[sinCond.type] || null) : null
            const sinCount = sinCond?.value || null
            const activeCond = hasStock ? 'stock' : hasResonance ? 'resonance' : null
            let desc = kr?.desc || ''
            desc = translateDesc(desc)

            newPassives.push({
              identity_id: identity.id,
              name: kr?.name || `패시브${pid}`,
              passive_type: 'battle',
              sin_affinity: sinAffinity,
              sin_count: sinCount,
              active_cond: activeCond,
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
            const hasStock = detail?.attributeStockCondition?.length > 0
            const hasResonance = detail?.attributeResonanceCondition?.length > 0
            const conds = detail?.attributeStockCondition || detail?.attributeResonanceCondition || []
            const sinCond = conds[0]
            const sinAffinity = sinCond ? (SIN_MAP[sinCond.type] || null) : null
            const sinCount = sinCond?.value || null
            const activeCond = hasStock ? 'stock' : hasResonance ? 'resonance' : null
            let desc = kr?.desc || ''
            desc = translateDesc(desc)

            newPassives.push({
              identity_id: identity.id,
              name: kr?.name || `패시브${pid}`,
              passive_type: 'support',
              sin_affinity: sinAffinity,
              sin_count: sinCount,
              active_cond: activeCond,
              description: desc,
              passive_order: ++passiveOrder,
              uptie_level: uptie,
            })
          }
        }
      }

      if (newPassives.length === 0) continue

      // 패시브 KR 원본 텍스트 수집 (키워드 추출용)
      const keywordContext = getIdentityKeywordContext(keywordContexts, identity.game_id)
      // pm의 모든 패시브 ID에서 KR 원본 텍스트 수집
      const allPassiveIds = [
        ...(pm.battlePassiveList || []).flatMap(l => l.passiveIDList || []),
        ...(pm.supporterPassiveList || []).flatMap(l => l.passiveIDList || []),
      ]
      for (const pid of allPassiveIds) {
        const kr = krPassiveMap.get(pid)
        collectKrDescriptions(keywordContext.rawKrTexts, kr)

        const detail = passiveDetailMap.get(pid)
        if (detail) keywordContext.passiveDetails.push(detail)
      }

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
  //  키워드 일괄 추출 + DB 업데이트
  // ══════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  키워드 추출 (스킬 + 패시브 설명)')
  console.log('═'.repeat(60))

  let kwUpdated = 0
  for (const [gameId, context] of keywordContexts) {
    if (!context.gamePerson) continue

    const keywords = extractKeywords(context)
    if (keywords.length === 0) continue

    // identity id 찾기
    const identities = await supaGet('identities', `game_id=eq.${gameId}&select=id,name`)
    if (identities.length === 0) continue

    const identity = identities[0]
    if (dryRun) {
      console.log(`  ${identity.name}: [${keywords.join(', ')}]`)
    } else {
      await supaPatch('identities', `id=eq.${identity.id}`, { keywords })
      kwUpdated++
    }
  }

  if (dryRun) {
    console.log(`  총 ${keywordContexts.size}개 인격 키워드 추출 완료`)
  } else {
    console.log(`  키워드 업데이트: ${kwUpdated}개`)
  }

  // ══════════════════════════════════════════════════════════
  //  EGO 스킬 동기화
  // ══════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  EGO 스킬 동기화')
  console.log('═'.repeat(60))

  // EGO 패시브 KR 텍스트 로드
  const krEgoPassiveMap = new Map()
  const krPassiveEgoDir = resolve(process.env.HOME, 'Downloads/kr')
  if (existsSync(krPassiveEgoDir)) {
    for (const f of readdirSync(krPassiveEgoDir).filter(f => f.startsWith('KR_Passive_Ego'))) {
      try {
        const raw = readFileSync(resolve(krPassiveEgoDir, f), 'utf-8').replace(/^\uFEFF/, '')
        const parsed = JSON.parse(raw)
        for (const item of parsed?.dataList ?? []) {
          if (item.id && item.name) krEgoPassiveMap.set(item.id, item)
        }
      } catch { /* skip */ }
    }
  }
  const krEgoPassiveFiles = ['KR/KR_Passive_Ego.json']
  for (const f of krEgoPassiveFiles) {
    const data = readJson(f)
    if (!data) continue
    for (const item of data.dataList || []) {
      if (item.id && item.name && !krEgoPassiveMap.has(item.id)) {
        krEgoPassiveMap.set(item.id, item)
      }
    }
  }
  console.log(`  KR_Passive_Ego: ${krEgoPassiveMap.size}개 항목 로드`)

  const allEgoKeywords = new Set()

  for (const sinner of targetSinners) {
    // EGO 기본 + 보조 파일 모두 로드
    const egoBaseFiles = [`ego-${sinner.id}.json`, 'ego-a1c5p2.json', 'ego-a1c5p3.json', 'ego-a1c6p2.json', 'ego-a1c8p2.json', 'ego-a1c8p3.json', 'ego-a1c9p2.json', 'ego-a1c9p3.json']
    const egoSkillFiles = [`ego-skill-${sinner.id}.json`, 'ego-skill-a1c5p2.json', 'ego-skill-a1c5p3.json', 'ego-skill-a1c6p2.json', 'ego-skill-a1c6p3.json', 'ego-skill-a1c8p2.json', 'ego-skill-a1c8p3.json', 'ego-skill-a1c9p2.json', 'ego-skill-a1c9p3.json']
    const egoList = collectUniqueJsonEntries(egoBaseFiles, {
      filterFn: egoData => egoData.characterId === sinner.id,
    })
    const egoSkillMap = buildIdMap(collectUniqueJsonEntries(egoSkillFiles))
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
      for (const uptie of UPTIE_LEVELS) {
        for (const { id: sid, category } of skillIds) {
          const gs = egoSkillMap.get(sid)
          if (!gs) continue
          const r = resolveToLevel(gs, uptie)
          const coinList = r.coinList || []
          const krText = krSkillMap.get(sid)
          const bestForLevel = getBestLevelEntry(krText?.levelList || [], uptie)
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
            offense_level: r.skillLevelCorrection != null ? 60 + r.skillLevelCorrection : null,
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

      // ── EGO 패시브 동기화 ──
      const passiveIds = gameEgo.awakeningPassiveList || []
      if (passiveIds.length > 0) {
        const passiveId = passiveIds[0] // 첫 번째 패시브 사용
        const krPassive = krEgoPassiveMap.get(passiveId)
        if (krPassive) {
          const passiveName = krPassive.name
          const passiveContent = translateDesc(krPassive.desc || '')
          if (dryRun) {
            console.log(`    패시브: "${passiveName}" — ${passiveContent.slice(0, 60)}...`)
          } else {
            await supaPatch('ego', `id=eq.${ego.id}`, {
              passive_name: passiveName,
              passive_content: passiveContent,
            })
          }
        }
      }

      // ── EGO 키워드 추출 ──
      const egoKeywords = new Set()
      // 1. EGO 스킬 데이터에서 buffKeyword 수집 (재귀적으로 전체 객체 탐색)
      for (const { id: sid } of skillIds) {
        const gs = egoSkillMap.get(sid)
        if (gs) collectBuffKeywords(gs, egoKeywords)
      }
      // 2. KR 스킬 텍스트에서 [Tag] 패턴 추출
      for (const { id: sid } of skillIds) {
        const krText = krSkillMap.get(sid)
        if (krText) {
          const texts = []
          for (const level of krText.levelList || []) {
            if (level.desc) texts.push(level.desc)
            for (const coin of level.coinlist || []) {
              for (const cd of coin.coindescs || []) {
                if (cd.desc) texts.push(cd.desc)
              }
            }
          }
          collectBracketKeywords(texts, egoKeywords)
        }
      }

      if (egoKeywords.size > 0) {
        const kwArray = [...egoKeywords].sort()
        for (const kw of kwArray) allEgoKeywords.add(kw)
        if (dryRun) {
          console.log(`    키워드: [${kwArray.join(', ')}]`)
        } else {
          await supaPatch('ego', `id=eq.${ego.id}`, { keywords: kwArray })
        }
      }
    }
  }

  // ── EGO 키워드 → keyword_meta 자동 upsert ──
  if (allEgoKeywords.size > 0) {
    const existingMeta = await supaGet('keyword_meta', 'select=name')
    const existingNames = new Set(existingMeta.map(m => m.name))
    const newKws = [...allEgoKeywords].filter(kw => !existingNames.has(kw))
    if (newKws.length > 0) {
      if (dryRun) {
        console.log(`\n  EGO keyword_meta 신규: [${newKws.join(', ')}]`)
      } else {
        const rows = newKws.map(name => ({ name }))
        await supaInsertBatch('keyword_meta', rows)
        console.log(`  EGO keyword_meta 신규 등록: ${newKws.length}개`)
      }
    } else {
      if (dryRun) console.log(`\n  EGO keyword_meta: 신규 키워드 없음`)
    }
  }

  // ── 패닉 타입 동기화 ──
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  패닉 타입 동기화')
  console.log('═'.repeat(60))

  // KR_PanicInfo*.json 전체 로드 → panicTypeId → { name, description } 맵 구성
  const panicInfoMap = new Map()
  const krDir2 = resolve(JSON_DIR, 'KR')
  const panicFiles = existsSync(krDir2)
    ? readdirSync(krDir2).filter(f => f.startsWith('KR_PanicInfo')).map(f => `KR/${f}`)
    : []
  for (const f of panicFiles) {
    const data = readJson(f)
    if (!data) continue
    for (const item of data.dataList || []) {
      panicInfoMap.set(item.id, {
        name: item.panicName,
        description: translateDesc(item.panicDescription),
        lowMoraleDesc: translateDesc(item.lowMoraleDescription),
      })
    }
  }
  console.log(`  KR_PanicInfo: ${panicInfoMap.size}개 항목 로드`)

  // personality-NN.json + personality-a1c*.json 로드 → game_id → panicType 맵 + mentalConditionInfo 맵 구성
  const gamePanicMap = new Map()
  const gameMentalMap = new Map() // game_id → mentalConditionInfo
  for (const sinner of SINNERS) {
    const pad = String(sinner.id).padStart(2, '0')
    const pFiles = [`personality-${pad}.json`]
    for (const extra of readdirSync(JSON_DIR).filter(f => f.startsWith('personality-a1c') && f.endsWith('.json'))) {
      pFiles.push(extra)
    }
    for (const f of pFiles) {
      const data = readJson(f)
      if (!data) continue
      for (const p of data.list || []) {
        if (p.id != null && p.panicType != null) {
          gamePanicMap.set(String(p.id), p.panicType)
        }
        if (p.id != null && p.mentalConditionInfo != null) {
          gameMentalMap.set(String(p.id), p.mentalConditionInfo)
        }
      }
    }
  }
  console.log(`  personality JSON: ${gamePanicMap.size}개 인격 panicType 로드, ${gameMentalMap.size}개 인격 mentalConditionInfo 로드`)

  // KR_MentalCondition*.json 로드 → templateId → { add, min } 맵 구성
  const mentalConditionTemplates = new Map()
  for (const f of readdirSync(resolve(JSON_DIR, 'KR')).filter(n => n.startsWith('KR_MentalCondition') && n.endsWith('.json'))) {
    const data = readJson(`KR/${f}`)
    if (!data) continue
    for (const item of data.dataList || []) {
      if (item.id) mentalConditionTemplates.set(item.id, { add: item.add || '', min: item.min || '' })
    }
  }
  console.log(`  KR_MentalCondition: ${mentalConditionTemplates.size}개 템플릿 로드`)

  /**
   * conditionID 를 한국어 텍스트로 변환
   * @param {string} conditionID - e.g. "OnWinDuelAsParryingCountMultiply10AndPlus20Percent"
   * @param {'add'|'min'} mode
   * @returns {string}
   */
  // DB에서 모든 인격의 game_id, panic_type 조회
  const dbIdentitiesAll = await supaGet('identities', 'select=id,game_id,panic_type&limit=1000')

  let panicUpdated = 0
  let panicSkipped = 0

  for (const identity of dbIdentitiesAll) {
    const gameId = identity.game_id
    if (!gameId) { panicSkipped++; continue }

    const panicTypeId = gamePanicMap.get(String(gameId))
    if (panicTypeId == null) { panicSkipped++; continue }

    // panic_type 컬럼은 panic_types.id (int) FK — name이 아니라 numeric ID를 저장
    const newPanicType = panicTypeId

    const panicChanged = identity.panic_type !== newPanicType

    if (!panicChanged) {
      continue
    }

    const patchBody = { panic_type: newPanicType }

    if (dryRun) {
      const panicInfo = panicInfoMap.get(panicTypeId)
      console.log(`  [변경] game_id=${gameId}: panic_type ${identity.panic_type} → ${newPanicType} (${panicInfo?.name || '?'})`)
    } else {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/identities?game_id=eq.${gameId}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(patchBody),
      })
      if (!res.ok) {
        console.error(`  [오류] game_id=${gameId} PATCH 실패: ${res.status} ${await res.text()}`)
      } else {
        const panicInfo = panicInfoMap.get(panicTypeId)
        console.log(`  [업데이트] game_id=${gameId}: panic_type ${identity.panic_type} → ${newPanicType} (${panicInfo?.name || '?'})`)
        panicUpdated++
      }
      await sleep(50)
    }
  }

  if (dryRun) {
    console.log(`  (DRY RUN — 변경 예정 항목 위에 표시됨)`)
  } else {
    console.log(`  패닉 타입 업데이트: ${panicUpdated}개`)
  }
  console.log(`  스킵: ${panicSkipped}개`)

  // ── 정신력 조건 동기화 (identity_sanity_conditions) ──
  if (!dryRun || syncSanityOnly) {
    await syncSanityConditions()
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  결과 요약')
  console.log('═'.repeat(60))
  if (dryRun) {
    console.log(`  (DRY RUN — DB 미변경)`)
  } else {
    console.log(`  인격 스킬 삭제: ${totalDeleted}개 / 삽입: ${totalInserted}개`)
    console.log(`  EGO 스킬 삭제: ${egoDeleted}개 / 삽입: ${egoInserted}개`)
    console.log(`  패닉 타입 업데이트: ${panicUpdated}개`)
  }
  console.log(`  스킵: 인격 ${totalSkipped}개 / EGO ${egoSkipped}개`)

  if (!dryRun) {
    await revalidateCache()
  }
}

// Revalidate homepage cache after sync
async function revalidateCache() {
  const secret = process.env.REVALIDATION_SECRET
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://saigo-no-dante.com'
  if (!secret) {
    console.log('⚠️  REVALIDATION_SECRET not set, skipping cache revalidation')
    return
  }
  try {
    const res = await fetch(`${siteUrl}/api/revalidate?secret=${secret}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: ['/', '/sinners', '/mirror-dungeon'] }),
    })
    if (res.ok) {
      const data = await res.json()
      console.log('✅ Cache revalidated:', data.revalidated)
    } else {
      console.log('⚠️  Cache revalidation failed:', res.status)
    }
  } catch (err) {
    console.log('⚠️  Cache revalidation error:', err.message)
  }
}

main().catch(err => {
  console.error('오류:', err)
  process.exit(1)
})
