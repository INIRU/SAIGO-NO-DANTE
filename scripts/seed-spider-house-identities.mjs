#!/usr/bin/env node
/**
 * 거미집 약지 인격 + 신규 키워드 삽입 스크립트
 * 대상: 파우스트 10215 (약지 제자), 홍루 10614 (약지 아비)
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-spider-house-identities.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-spider-house-identities.mjs --fix
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const TEXT_DIR  = '/Users/iniru/Documents/Limbus/assets/data/Json (Text)'
const KR_DIR    = '/Users/iniru/Documents/Limbus/assets/data/kr'
const JSON2_KR  = '/Users/iniru/Documents/Limbus/assets/data/Json-2/KR'
const dryRun    = !process.argv.includes('--fix')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

function readJson(filePath) {
  if (!existsSync(filePath)) { console.warn(`  ⚠️  없음: ${filePath}`); return null }
  const text = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '')
  return JSON.parse(text)
}

// ── 매핑 ──────────────────────────────────────────────────────────────────
const SIN_MAP = {
  CRIMSON: 'wrath', SCARLET: 'lust', AMBER: 'sloth', SHAMROCK: 'gluttony',
  AZURE: 'gloom', INDIGO: 'pride', VIOLET: 'envy',
}
const ATK_MAP  = { SLASH: 'slash', PENETRATE: 'pierce', HIT: 'blunt' }
const DEF_MAP  = { GUARD: 'defense', EVADE: 'evade', COUNTER: 'counter' }
const RES_MAP  = { 0.5: '취약', 1: '보통', 2: '내성' }

// sync-game-data.mjs와 동일한 CONDITION_TAG_MAP
const CONDITION_TAG_MAP = {
  OnSucceedAttack: '적중시', OnSucceedAttackHead: '앞면 적중시', OnSucceedAttackTail: '뒷면 적중시',
  CriticalOnSucceedAttack: '크리티컬 적중시', CriticalOnSucceedAttackHead: '크리티컬 앞면 적중시',
  CriticalEnemyTargetKill: '크리티컬 적 처치시', WhenUse: '사용시', WhenUse_Force: '사용시',
  BeforeUse: '사용 전', WhenUseEvade: '회피 사용시', WinDuel: '합 승리시',
  WinDuelAttack: '합 공격 승리시', WinDuelAttackHead: '합 앞면 공격 승리시', DefeatDuel: '합 패배시',
  StartDuel: '합 시작시', StartBattle: '전투 시작시', StartBattle_Force: '전투 시작시',
  EndSkill: '공격 종료시', EndSkillAll: '공격 종료시', EndBattle: '전투 종료시',
  BeforeAttack: '공격 시작 전', BeforeHit: '피격 전', EnemyKill: '적 처치시',
  OnSucceedEvade: '회피 성공시', OnStartCoin: '코인 시작시', OnDirectAttack: '직접 공격시',
  ReUseOnSucceedAttack: '재사용: 적중시', ReUseOnSucceedAttackHead: '재사용: 앞면 적중시',
  UnBrokenCoinOnSucceedAttack: '파괴 불가 코인 적중시', CantDuel: '합 불가',
  TabExplain: '설명', DuelCounter: '합 가능 반격', DuelGuard: '합 가능 가드',
  AllyKill: '아군 처치시', EnemyKillFail: '적 처치 실패시', TargetKill: '대상 처치시',
  CriticalTargetKill: '크리티컬 대상 처치시', CriticalEndSkill: '크리티컬 공격 종료시',
  CriticalActivated: '크리티컬 발동시', EndCoin: '이 코인 공격 종료시',
  EndSkillHead: '앞면 공격 종료시', EndSkillTail: '뒷면 공격 종료시',
  OnDefeatEvade: '회피 실패시', DefeatDuelAttack: '합 공격 패배시',
  AlwaysUse: '항상', TurnStartBattle: '턴 시작시', CantIdentify: '피아식별불가',
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function buildTagMap() {
  const map = { ...CONDITION_TAG_MAP }
  for (const dir of [JSON2_KR, KR_DIR]) {
    for (const fname of readdirSync(dir).filter(f => /^KR_(BattleKeywords|Bufs|BuffAbilities)/i.test(f) && f.endsWith('.json'))) {
      try {
        const d = readJson(resolve(dir, fname))
        for (const item of d?.dataList || []) if (item.id && item.name && !map[item.id]) map[item.id] = item.name
      } catch { /* 파싱 실패 파일 무시 */ }
    }
  }
  return map
}

// sync-game-data.mjs translateDesc와 동일한 로직
function translateDesc(desc, tagMap) {
  if (!desc) return ''
  let result = desc
    .replace(/<style="[^"]*">/g, '').replace(/<\/style>/g, '')
    .replace(/<\/?noparse>/g, '').replace(/<\/?u>/g, '')
    .replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '')
    .replace(/<link=[^>]*>/g, '').replace(/<\/link>/g, '')
    .replace(/<sprite[^>]*\/?>/g, '')
    .replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (match, tag, offset, str) => {
      const kr = tagMap[tag]
      if (!kr) return match
      if (CONDITION_TAG_MAP[tag]) return `[${kr}]`
      const before = offset > 0 ? str[offset - 1] : ''
      const needSpaceBefore = before && /[가-힣0-9]/.test(before)
      return (needSpaceBefore ? ' ' : '') + kr
    })
    .replace(/(?<!^)(?<![\n])(?<!- )\[(?:적중시|앞면 적중시|뒷면 적중시|사용시|합 승리시|합 패배시|전투 시작시|공격 종료시|공격 시작 전|적 처치시|회피 성공시|크리티컬 적중시|사용 전|파괴 불가 코인 적중시|재사용)/gm, '\n[')
    .replace(/\]((?:자신|대상|이 |다음|호흡|충전|침잠|출혈|화상|파열|진동|마비|속박|취약|광전|전하침|파괴))/g, '] $1')
    .replace(/\((\d+)-([가-힣]+)\/(\d+)\)/g, '( $1 - $2 / $3 )')
  return result.trim()
}

function buildDescription(krSkill, uptie, tagMap) {
  if (!krSkill) return ''
  const levels = krSkill.levelList || []
  const best = levels.filter(l => l.level <= uptie).sort((a, b) => b.level - a.level)[0] || levels[0]
  if (!best) return ''
  const parts = []
  const g = translateDesc(best.desc || '', tagMap)
  if (g) parts.push(g)
  for (let i = 0; i < (best.coinlist || []).length; i++) {
    const descs = (best.coinlist[i].coindescs || [])
      .map(cd => translateDesc(cd.desc || '', tagMap)).filter(Boolean)
    if (descs.length) {
      parts.push(`[코인 ${i + 1}] ${descs[0]}`)
      for (let j = 1; j < descs.length; j++) parts.push(descs[j])
    }
  }
  return parts.join('\n')
}

// sync-game-data.mjs resolveToLevel와 동일한 로직 (오름차순 정렬 + 조기 종료)
function resolveToLevel(skill, targetLevel) {
  const merged = {}
  const sorted = [...(skill.skillData || [])].sort((a, b) => (a.gaksungLevel || 0) - (b.gaksungLevel || 0))
  for (const sd of sorted) {
    if ((sd.gaksungLevel || 0) > targetLevel) break
    for (const [k, v] of Object.entries(sd)) {
      if (k === 'gaksungLevel') continue
      if (k === 'coinList' && Array.isArray(v) && v.length === 0) continue
      if (v !== null && v !== undefined) merged[k] = v
    }
  }
  return merged
}

// ── 데이터 로드 ───────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  거미집 약지 인격 삽입 (10215 파우스트 / 10614 홍루)  ║')
  console.log(`║  모드: ${dryRun ? 'DRY RUN (삽입 없음)' : '🔥 FIX (실제 삽입)'}`)
  console.log('╚══════════════════════════════════════════════════════╝\n')

  const tagMap = buildTagMap()

  // KR 텍스트 맵 (kr 폴더 우선, Json-2/KR 보완)
  const krSkillMap   = new Map()
  const krPassiveMap = new Map()
  const krPersonMap  = new Map()

  for (const dir of [JSON2_KR, KR_DIR]) {
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      let d
      try { d = readJson(resolve(dir, f)) } catch { continue }
      if (!d) continue
      if (/KR_Skills_personality/i.test(f))
        for (const item of d.dataList || []) krSkillMap.set(item.id, item)
      if (/KR_Passives/i.test(f) && !/Enemy|Abnormality/i.test(f))
        for (const item of d.dataList || []) if (item.id && item.name) krPassiveMap.set(item.id, item)
      if (/KR_Personalities/i.test(f))
        for (const item of d.dataList || []) krPersonMap.set(item.id, item)
    }
  }

  // 패시브 상세 (sin 코스트)
  const passiveDetailMap = new Map()
  for (const fname of ['passive.txt', 'passive_check4.txt']) {
    const d = readJson(resolve(TEXT_DIR, fname))
    for (const item of d?.list || []) passiveDetailMap.set(item.id, item)
  }

  // ── 인격 처리 ────────────────────────────────────────────────────────────
  const TARGETS = [
    { gameId: 10215, sinnerSlug: 'faust',   sinnerName: 'Faust',   sinNum: 2 },
    { gameId: 10614, sinnerSlug: 'hong-lu', sinnerName: 'Hong Lu', sinNum: 6 },
  ]

  for (const target of TARGETS) {
    const { gameId, sinnerSlug, sinNum } = target
    const pad = String(sinNum).padStart(2, '0')

    console.log(`\n${'═'.repeat(54)}`)
    console.log(`  ${gameId} — ${sinnerSlug}`)
    console.log('═'.repeat(54))

    // 이미 존재 확인
    const { data: existing } = await sb.schema('limbus').from('identities')
      .select('id, name_kr').eq('game_id', String(gameId)).maybeSingle()
    if (existing) {
      console.log(`  ⏭️  이미 존재: ${existing.name_kr}`)
      continue
    }

    // 인격 스탯 로드
    const personality = readJson(resolve(TEXT_DIR, `personality-${pad}.txt`))
      ?.list?.find(p => p.id === gameId)
    if (!personality) { console.error(`  ❌ personality 데이터 없음`); continue }

    const kr = krPersonMap.get(gameId)
    const title = (kr?.title || '').replace(/\n/g, ' ')
    const getRes = (type) => RES_MAP[personality.resistInfo.atkResistList.find(r => r.type === type)?.value] || '보통'

    const identityRow = {
      sinner_id:    sinnerSlug,
      name:         title,
      name_kr:      title,
      tier:         1,
      rarity:       personality.rank,
      game_id:      String(gameId),
      folder_name:  personality.appearance,
      base_hp:      personality.hp.defaultStat,
      hp_per_level: personality.hp.incrementByLevel,
      hp:           Math.round(personality.hp.defaultStat + personality.hp.incrementByLevel * 60),
      speed_min:    personality.minSpeedList[3],
      speed_max:    personality.maxSpeedList[3],
      def_level:    60 + (personality.defCorrection || 0),
      slash_res:    getRes('SLASH'),
      pierce_res:   getRes('PENETRATE'),
      blunt_res:    getRes('HIT'),
      break_section: personality.breakSection?.sectionList ?? [],
      keywords:     [],
      release_date: '2026-04-02',
    }

    console.log(`  인격: ${title}  (rank ${personality.rank}, ${identityRow.slash_res}/${identityRow.pierce_res}/${identityRow.blunt_res})`)
    console.log(`  HP: ${identityRow.hp} | 속도: ${identityRow.speed_min}~${identityRow.speed_max} | DEF: ${identityRow.def_level}`)

    // ── 스킬 ──────────────────────────────────────────────────────────────
    const skillDataFile = readJson(resolve(TEXT_DIR, `personality-skill-${pad}.txt`))
    const skillMap = new Map((skillDataFile?.list || []).map(s => [s.id, s]))

    const attackSkillIds  = (personality.attributeList || []).map(a => a.skillId)
    const defenseSkillIds = (personality.defenseSkillIDList || [])

    const skillRows = []
    for (const uptie of [3, 4]) {
      let variantIdx = 0

      for (const sid of attackSkillIds) {
        const gs = skillMap.get(sid)
        if (!gs) continue
        const r = resolveToLevel(gs, uptie)
        const coinList = r.coinList || []
        const krSkill  = krSkillMap.get(sid)
        const levels   = krSkill?.levelList || []
        const best     = levels.filter(l => l.level <= uptie).sort((a, b) => b.level - a.level)[0] || levels[0]
        const isDefense = r.defType && r.defType !== 'ATTACK'
        skillRows.push({
          name:          best?.name || `스킬${gs.skillTier}`,
          skill_type:    isDefense ? (DEF_MAP[r.defType] || null) : (ATK_MAP[r.atkType] || null),
          sin_affinity:  SIN_MAP[r.attributeType] || null,
          base_power:    r.defaultValue ?? null,
          coin_power:    coinList.length > 0 ? (coinList[0].operatorType === 'SUB' ? -coinList[0].scale : coinList[0].scale) : null,
          coins:         coinList.length || 1,
          offense_level: r.skillLevelCorrection != null ? 60 + r.skillLevelCorrection : null,
          description:   buildDescription(best ? { ...krSkill, levelList: [best] } : null, uptie, tagMap),
          skill_order:   gs.skillTier,
          atk_weight:    r.targetNum || 1,
          variant_order: ++variantIdx,
          uptie_level:   uptie,
        })
      }

      const defSkills = defenseSkillIds
        .map(sid => skillMap.get(sid))
        .filter(gs => gs && !(gs.requireIDList?.length > 0))

      for (const gs of defSkills) {
        const r = resolveToLevel(gs, uptie)
        const coinList = r.coinList || []
        const krSkill  = krSkillMap.get(gs.id)
        const levels   = krSkill?.levelList || []
        const best     = levels.filter(l => l.level <= uptie).sort((a, b) => b.level - a.level)[0] || levels[0]
        skillRows.push({
          name:          best?.name || '수비',
          skill_type:    r.defType && r.defType !== 'ATTACK' ? (DEF_MAP[r.defType] || null) : (ATK_MAP[r.atkType] || null),
          sin_affinity:  SIN_MAP[r.attributeType] || null,
          base_power:    r.defaultValue ?? null,
          coin_power:    coinList.length > 0 ? (coinList[0].operatorType === 'SUB' ? -coinList[0].scale : coinList[0].scale) : null,
          coins:         coinList.length || 1,
          offense_level: r.skillLevelCorrection != null ? 60 + r.skillLevelCorrection : null,
          description:   buildDescription(best ? { ...krSkill, levelList: [best] } : null, uptie, tagMap),
          skill_order:   4,
          atk_weight:    r.targetNum || 1,
          variant_order: ++variantIdx,
          uptie_level:   uptie,
        })
      }
    }

    console.log(`  스킬: ${skillRows.length / 2}종 × 2 = ${skillRows.length}행`)
    for (const s of skillRows.filter(r => r.uptie_level === 3)) {
      console.log(`    S${s.skill_order} "${s.name}" [${s.skill_type}/${s.sin_affinity}] 위력${s.base_power}+${s.coin_power}×${s.coins}`)
    }

    // ── 패시브 ────────────────────────────────────────────────────────────
    const passiveMapping = readJson(resolve(TEXT_DIR, `personality-passive-${pad}.txt`))
      ?.list?.find(p => p.personalityID === gameId)

    const passiveRows = []
    for (const uptie of [3, 4]) {
      let order = 0

      const battleLevel = (passiveMapping?.battlePassiveList || [])
        .filter(l => l.level <= uptie).sort((a, b) => b.level - a.level)[0]
      if (battleLevel) {
        for (const pid of battleLevel.passiveIDList) {
          const kr     = krPassiveMap.get(pid)
          const detail = passiveDetailMap.get(pid)
          const conds  = detail?.attributeStockCondition || detail?.attributeResonanceCondition || []
          const sinC   = conds[0]
          passiveRows.push({
            passive_type:  'battle',
            name:          kr?.name || `패시브${pid}`,
            description:   translateDesc(kr?.desc || '', tagMap),
            sin_affinity:  sinC ? (SIN_MAP[sinC.type] || null) : null,
            sin_count:     sinC?.value || null,
            active_cond:   null,
            passive_order: ++order,
            uptie_level:   uptie,
          })
        }
      }

      const supportLevel = (passiveMapping?.supporterPassiveList || [])
        .filter(l => l.level <= uptie).sort((a, b) => b.level - a.level)[0]
      if (supportLevel) {
        for (const pid of supportLevel.passiveIDList) {
          const kr     = krPassiveMap.get(pid)
          const detail = passiveDetailMap.get(pid)
          const conds  = detail?.attributeStockCondition || detail?.attributeResonanceCondition || []
          const sinC   = conds[0]
          passiveRows.push({
            passive_type:  'support',
            name:          kr?.name || `패시브${pid}`,
            description:   translateDesc(kr?.desc || '', tagMap),
            sin_affinity:  sinC ? (SIN_MAP[sinC.type] || null) : null,
            sin_count:     sinC?.value || null,
            active_cond:   null,
            passive_order: ++order,
            uptie_level:   uptie,
          })
        }
      }
    }

    console.log(`  패시브: ${passiveRows.length / 2}종 × 2 = ${passiveRows.length}행`)

    if (!dryRun) {
      const { data: ins, error: ie } = await sb.schema('limbus').from('identities')
        .insert(identityRow).select('id').single()
      if (ie) { console.error(`  ❌ 인격 삽입 실패: ${ie.message}`); continue }
      const identityId = ins.id

      const { error: se } = await sb.schema('limbus').from('skills')
        .insert(skillRows.map(r => ({ ...r, identity_id: identityId })))
      if (se) console.error(`  ❌ 스킬 삽입 실패: ${se.message}`)

      const { error: pe } = await sb.schema('limbus').from('passives')
        .insert(passiveRows.map(r => ({ ...r, identity_id: identityId })))
      if (pe) console.error(`  ❌ 패시브 삽입 실패: ${pe.message}`)

      console.log(`  ✅ ${title} 삽입 완료`)
    }
  }

  // ── 신규 키워드 ───────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(54)}`)
  console.log('  신규 keyword_meta 삽입')
  console.log('═'.repeat(54))

  // KR_BattleKeywords에서 신규 키워드 수집
  const newKeywordIds = [
    'ChargeBodyArt', 'FasciaPersonality', 'GoldenOpportunity', 'IronMaidenPersonality',
    'LivingSpecimenPersonality', 'MelodyBodyArt', 'MelodyBodyArtChebello',
    'SilverOpportunity', 'TibiaPersonality',
  ]

  const kwMap = new Map()
  for (const dir of [JSON2_KR, KR_DIR]) {
    for (const fname of readdirSync(dir).filter(f => /KR_BattleKeywords/i.test(f))) {
      const d = readJson(resolve(dir, fname))
      for (const item of d?.dataList || []) {
        if (item.name && item.desc !== undefined) kwMap.set(item.id, item)
      }
    }
  }

  const kwRows = []
  for (const kwId of newKeywordIds) {
    const item = kwMap.get(kwId)
    if (!item) { console.warn(`  ⚠️  키워드 없음: ${kwId}`); continue }

    // DB에 이미 있는지 확인
    const { data: existing } = await sb.schema('limbus').from('keyword_meta')
      .select('name').eq('name', item.name).maybeSingle()
    if (existing) { console.log(`  ⏭️  이미 있음: ${item.name}`); continue }

    // max_stack 파싱 (desc에서 "횟수 최댓값: N" 추출)
    const maxStackMatch = item.desc?.match(/횟수 최댓값[:\s]+(\d+)/)
    const maxStack = maxStackMatch ? parseInt(maxStackMatch[1]) : null

    kwRows.push({
      name:        item.name,
      description: item.desc || '',
      max_stack:   maxStack,
      icon_slug:   null,
      sin_affinity: null,
    })
    console.log(`  ${dryRun ? '🔍' : '✅'} ${kwId}: ${item.name} (max_stack=${maxStack})`)
  }

  if (!dryRun && kwRows.length > 0) {
    const { error } = await sb.schema('limbus').from('keyword_meta').insert(kwRows)
    if (error) console.error(`  ❌ 키워드 삽입 실패: ${error.message}`)
    else console.log(`\n  키워드 ${kwRows.length}개 삽입 완료`)
  }

  if (dryRun) {
    console.log('\n  ※ 실제 반영: --fix 옵션으로 재실행하세요')
  } else {
    console.log('\n✅ 완료')
  }
}

main().catch(console.error)
