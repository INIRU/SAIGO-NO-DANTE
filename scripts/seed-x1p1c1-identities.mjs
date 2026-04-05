#!/usr/bin/env node
/**
 * x1p1c1 KidAppearance 인격 삽입 스크립트
 * 대상: 400025~400036 (12명 전원, hidden:true)
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-x1p1c1-identities.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-x1p1c1-identities.mjs --fix
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const JSON_DIR = '/Users/iniru/Documents/Limbus/assets/data/Json-2'
const dryRun = !process.argv.includes('--fix')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

function readJson(filename) {
  const path = resolve(JSON_DIR, filename)
  if (!existsSync(path)) { console.warn(`  ⚠️  파일 없음: ${filename}`); return null }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// ── 매핑 ──
const SINNER_SLUGS = {
  1: 'yi-sang', 2: 'faust', 3: 'don-quixote', 4: 'ryoshu', 5: 'meursault',
  6: 'hong-lu', 7: 'heathcliff', 8: 'ishmael', 9: 'rodion', 10: 'sinclair',
  11: 'outis', 12: 'gregor',
}
const RES_MAP = { 0.5: '취약', 1: '보통', 2: '내성' }
const ATK_MAP = { SLASH: 'slash', PENETRATE: 'pierce', HIT: 'blunt' }
const DEF_MAP = { GUARD: 'defense', EVADE: 'evade', COUNTER: 'counter' }
const SIN_MAP = {
  CRIMSON: 'wrath', SCARLET: 'lust', AMBER: 'sloth', SHAMROCK: 'gluttony',
  AZURE: 'gloom', INDIGO: 'pride', VIOLET: 'envy',
}

// KR 태그 → 한글 (sync-game-data.mjs와 동일)
const TAG_MAP = {
  OnSucceedAttack: '적중시', OnSucceedAttackHead: '앞면 적중시', OnSucceedAttackTail: '뒷면 적중시',
  CriticalOnSucceedAttack: '크리티컬 적중시', WinDuel: '합 승리시', WinDuelAttack: '합 승리시(공격)',
  WinDuelAttackHead: '합 승리시(공격, 앞면)', DefeatDuel: '합 패배시', EndSkill: '스킬 종료 후',
  EnemyKill: '처치시', OnSucceedEvade: '회피 성공시', OnFailedEvade: '회피 실패시',
  OnDead: '사망시', OnHit: '피격시', OnParrying: '방어 중',
  BattleStart: '전투 시작시', RoundStart: '라운드 시작시', RoundEnd: '라운드 종료시',
  TurnStart: '턴 시작시', TurnEnd: '턴 종료시',
}

function loadKrTags() {
  const bk = readJson('KR/KR_BattleKeywords-x1p1c1.json') || readJson('KR/KR_BattleKeywords.json')
  const bufs = readJson('KR/KR_Bufs-x1p1c1.json') || readJson('KR/KR_Bufs.json')
  const map = { ...TAG_MAP }
  for (const item of bk?.dataList || []) { if (item.id && item.name) map[item.id] = item.name }
  for (const item of bufs?.dataList || []) { if (item.id && item.name) map[item.id] = item.name }
  return map
}

function translateDesc(desc, tagMap) {
  if (!desc) return ''
  return desc
    .replace(/<style="[^"]*">/g, '').replace(/<\/style>/g, '')
    .replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '')
    .replace(/<b>/g, '').replace(/<\/b>/g, '')
    .replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (match, tag) => tagMap[tag] || match)
    .trim()
}

function buildDescription(krSkill, tagMap) {
  if (!krSkill) return ''
  const levels = krSkill.levelList || []
  const best = levels.reduce((a, b) => (b.level > a.level ? b : a), levels[0])
  if (!best) return ''
  const parts = []
  const globalDesc = translateDesc(best.desc || '', tagMap)
  if (globalDesc) parts.push(globalDesc)
  for (let i = 0; i < (best.coinlist || []).length; i++) {
    const descs = (best.coinlist[i].coindescs || [])
      .map(cd => translateDesc(cd.desc || '', tagMap)).filter(Boolean)
    if (descs.length > 0) {
      parts.push(`[코인 ${i + 1}] ${descs[0]}`)
      for (let j = 1; j < descs.length; j++) parts.push(descs[j])
    }
  }
  return parts.join('\n')
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  x1p1c1 KidAppearance 인격 삽입                      ║')
  console.log(`║  모드: ${dryRun ? 'DRY RUN (삽입 없음)' : '🔥 FIX (실제 삽입)'}`)
  console.log('╚══════════════════════════════════════════════════════╝\n')

  const tagMap = loadKrTags()

  const personalities = readJson('personality-x1p1c1.json')?.list || []
  const krPersonalities = new Map(
    (readJson('KR/KR_Personalities-x1p1c1.json')?.dataList || []).map(p => [p.id, p])
  )
  const skillDataMap = new Map(
    (readJson('personality-skill-x1p1c1.json')?.list || []).map(s => [s.id, s])
  )
  const krSkillMap = new Map(
    (readJson('KR/KR_Skills_personality-x1p1c1.json')?.dataList || []).map(s => [s.id, s])
  )
  const passiveAssignMap = new Map(
    (readJson('personality-passive-x1p1c1.json')?.list || []).map(p => [p.personalityID, p])
  )
  const krPassiveMap = new Map(
    (readJson('KR/KR_Passives-x1p1c1.json')?.dataList || []).map(p => [p.id, p])
  )

  // 400025~400036 만 처리
  const kidPersonalities = personalities.filter(p => p.id >= 400025 && p.id <= 400036)
  console.log(`처리 대상: ${kidPersonalities.length}명\n`)

  let inserted = 0, skipped = 0

  for (const p of kidPersonalities) {
    const kr = krPersonalities.get(p.id)
    const slug = SINNER_SLUGS[p.characterId]
    const title = kr?.title || `???`
    const gameId = String(p.id)

    // 이미 있는지 확인
    const { data: existing } = await sb.schema('limbus').from('identities')
      .select('id').eq('game_id', gameId).maybeSingle()
    if (existing) {
      console.log(`  ⏭️  ${gameId} (${title}) 이미 존재 — 건너뜀`)
      skipped++
      continue
    }

    // 저항 매핑
    const getRes = (type) => RES_MAP[p.resistInfo.atkResistList.find(r => r.type === type)?.value] || '보통'

    const identityRow = {
      sinner_id:    slug,
      name:         title,
      name_kr:      title,
      tier:         1,
      rarity:       1,
      game_id:      gameId,
      folder_name:  p.appearance,
      base_hp:      p.hp.defaultStat,
      hp_per_level: p.hp.incrementByLevel,
      hp:           Math.round(p.hp.defaultStat + p.hp.incrementByLevel * 60),
      speed_min:    p.minSpeedList[3],
      speed_max:    p.maxSpeedList[3],
      def_level:    60 + (p.defCorrection || 0),
      slash_res:    getRes('SLASH'),
      pierce_res:   getRes('PENETRATE'),
      blunt_res:    getRes('HIT'),
      break_section: p.breakSection?.sectionList ?? [],
      keywords:     [],
      release_date: '2026-03-26',
    }

    // 스킬 목록 구성 (attributeList + defenseSkillIDList)
    const skillEntries = [
      ...p.attributeList.map((a, i) => ({ skillId: a.skillId, order: i + 1 })),
      ...p.defenseSkillIDList.map(id => ({ skillId: id, order: 4 })),
    ]

    const skillRows = []
    for (const { skillId, order } of skillEntries) {
      const skill = skillDataMap.get(skillId)
      if (!skill) { console.warn(`    스킬 없음: ${skillId}`); continue }
      const krSkill = krSkillMap.get(skillId)
      const sd = skill.skillData[0]
      if (!sd) continue

      const isDefenseSlot = p.defenseSkillIDList.includes(skillId)
      const skillType = isDefenseSlot && DEF_MAP[sd.defType]
        ? DEF_MAP[sd.defType]
        : ATK_MAP[sd.atkType] || 'slash'

      const coinCount = (sd.coinList || []).length
      const coinPower = sd.coinList?.[0]?.scale ?? 0
      const desc = buildDescription(krSkill, tagMap)

      for (const uptie of [3, 4]) {
        skillRows.push({
          name:         krSkill?.levelList?.[0]?.name || '',
          skill_type:   skillType,
          sin_affinity: SIN_MAP[sd.attributeType] || null,
          coins:        coinCount,
          base_power:   sd.defaultValue ?? 0,
          coin_power:   coinPower,
          description:  desc,
          skill_order:  order,
          atk_weight:   1,
          offense_level: 60 + (sd.skillLevelCorrection || 0),
          uptie_level:  uptie,
          variant_order: order,
        })
      }
    }

    // 패시브 목록 구성
    const passiveAssign = passiveAssignMap.get(p.id)
    const passiveRows = []
    for (const [type, list] of [
      ['battle', passiveAssign?.battlePassiveList || []],
      ['support', passiveAssign?.supporterPassiveList || []],
    ]) {
      for (let oi = 0; oi < list.length; oi++) {
        for (const pid of list[oi].passiveIDList || []) {
          const krP = krPassiveMap.get(pid)
          for (const uptie of [3, 4]) {
            passiveRows.push({
              passive_type:  type,
              name:          krP?.name || '',
              description:   translateDesc(krP?.desc || '', tagMap),
              sin_affinity:  null,
              sin_count:     null,
              active_cond:   null,
              passive_order: oi + 1,
              uptie_level:   uptie,
            })
          }
        }
      }
    }

    console.log(`  ${dryRun ? '🔍' : '✅'} ${gameId} ${slug} [${title}]`)
    console.log(`     스킬 ${skillRows.length / 2}종 × 2업타이 = ${skillRows.length}행`)
    console.log(`     패시브 ${passiveRows.length / 2}종 × 2업타이 = ${passiveRows.length}행`)

    if (!dryRun) {
      // 인격 삽입
      const { data: ins, error: ie } = await sb.schema('limbus').from('identities')
        .insert(identityRow).select('id').single()
      if (ie) { console.error(`     ❌ 인격 삽입 실패: ${ie.message}`); continue }
      const identityId = ins.id

      // 스킬 삽입
      const withId = skillRows.map(r => ({ ...r, identity_id: identityId }))
      const { error: se } = await sb.schema('limbus').from('skills').insert(withId)
      if (se) console.error(`     ❌ 스킬 삽입 실패: ${se.message}`)

      // 패시브 삽입
      const passWithId = passiveRows.map(r => ({ ...r, identity_id: identityId }))
      const { error: pe } = await sb.schema('limbus').from('passives').insert(passWithId)
      if (pe) console.error(`     ❌ 패시브 삽입 실패: ${pe.message}`)
    }
    inserted++
  }

  console.log(`\n${'─'.repeat(54)}`)
  console.log(`  삽입${dryRun ? ' 예정' : ''}: ${inserted}명  /  건너뜀: ${skipped}명`)
  if (dryRun) console.log('\n  ※ 실제 반영: --fix 옵션으로 재실행하세요')
}

main().catch(console.error)
