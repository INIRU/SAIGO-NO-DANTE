#!/usr/bin/env node
/**
 * 정신력 데이터 FK 마이그레이션
 *
 * KR_MentalCondition.json → mental_condition_templates 시드
 * 게임 JSON personality → identity_sanity_conditions 삽입
 *
 * 사용법:
 *   node --env-file=.env.local scripts/migrate-sanity-to-fk.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-sanity-to-fk.mjs --fix
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── env ──
const ROOT = process.cwd()
const envFile = readFileSync(resolve(ROOT, '.env.local'), 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const idx = l.indexOf('=')
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
  })
)

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const FIX = process.argv.includes('--fix')
const JSON_DIR = resolve(process.env.HOME, 'Downloads/Json')

// ── 1. mental_condition_templates 시드 ──
async function seedTemplates() {
  const raw = readFileSync(resolve(JSON_DIR, 'KR/KR_MentalCondition.json'), 'utf-8').replace(/^\uFEFF/, '')
  const items = JSON.parse(raw).dataList

  console.log(`\n[Templates] ${items.length}개 조건 템플릿 발견`)

  const rows = items.map(item => ({
    id: item.id,
    add_text: item.add,
    min_text: item.min,
  }))

  if (FIX) {
    const { error } = await supabase
      .schema('limbus')
      .from('mental_condition_templates')
      .upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(`Templates upsert failed: ${error.message}`)
    console.log(`  ✓ ${rows.length}개 upsert 완료`)
  } else {
    for (const r of rows.slice(0, 3)) {
      console.log(`  ${r.id}`)
      console.log(`    add: ${r.add_text.slice(0, 60)}...`)
    }
    console.log(`  ... (총 ${rows.length}개)`)
  }

  return new Set(rows.map(r => r.id))
}

// ── 2. conditionID 파싱 ──
// "OnKillEnemyAsLevelRatioMultiply10" → { template: "OnKillEnemyAsLevelRatioMultiply", params: [10] }
function parseConditionID(conditionID, templateIds) {
  // 숫자를 제거하여 template ID 매칭
  const stripped = conditionID.replace(/\d+/g, '')

  if (templateIds.has(stripped)) {
    const params = []
    const regex = /\d+/g
    let m
    while ((m = regex.exec(conditionID)) !== null) {
      params.push(parseInt(m[0], 10))
    }
    return { template: stripped, params }
  }

  // 직접 매칭 시도 (숫자 없는 conditionID)
  if (templateIds.has(conditionID)) {
    return { template: conditionID, params: [] }
  }

  return null
}

// ── 3. 게임 JSON 로드 헬퍼 ──
function loadPersonalityFile(filePath) {
  let raw
  try {
    raw = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '')
  } catch {
    return null
  }
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ── 4. 게임 JSON → identity_sanity_conditions ──
async function migrateConditions(templateIds) {
  const files = readdirSync(JSON_DIR)
    .filter(f => /^personality-\d+\.json$/.test(f))
    .sort()

  const allRows = []
  const warnings = []

  // DB에 있는 identity: game_id → uuid 매핑
  const { data: dbIdentities } = await supabase
    .schema('limbus')
    .from('identities')
    .select('id, game_id')
  const gameIdToUuid = new Map()
  for (const i of dbIdentities || []) {
    if (i.game_id) gameIdToUuid.set(String(i.game_id), i.id)
  }
  console.log(`  DB 인격 ${gameIdToUuid.size}개 로드`)

  for (const file of files) {
    const data = loadPersonalityFile(resolve(JSON_DIR, file))
    if (!data) {
      console.warn(`  ⚠ ${file} 로드 실패`)
      continue
    }

    const items = data.list || (Array.isArray(data) ? data : [])

    for (const p of items) {
      const gameId = String(p.id)
      const identityId = gameIdToUuid.get(gameId)
      if (!identityId) continue

      const mci = p.mentalConditionInfo
      if (!mci) continue

      // add (increase) 조건
      for (const group of mci.add || []) {
        const condList = group.conditionIDList || []
        for (let i = 0; i < condList.length; i++) {
          const cid = condList[i].conditionID
          const parsed = parseConditionID(cid, templateIds)
          if (!parsed) {
            warnings.push(`${identityId}: unmatched ADD conditionID "${cid}"`)
            continue
          }
          allRows.push({
            identity_id: identityId,
            template_id: parsed.template,
            condition_type: 'increase',
            params: parsed.params,
            sort_order: i,
          })
        }
      }

      // min (decrease) 조건
      for (const group of mci.min || []) {
        const condList = group.conditionIDList || []
        for (let i = 0; i < condList.length; i++) {
          const cid = condList[i].conditionID
          const parsed = parseConditionID(cid, templateIds)
          if (!parsed) {
            warnings.push(`${identityId}: unmatched MIN conditionID "${cid}"`)
            continue
          }
          allRows.push({
            identity_id: identityId,
            template_id: parsed.template,
            condition_type: 'decrease',
            params: parsed.params,
            sort_order: i,
          })
        }
      }
    }
  }

  console.log(`\n[Conditions] ${allRows.length}개 조건 행 (${files.length}개 파일)`)
  if (warnings.length > 0) {
    console.warn(`  ⚠ ${warnings.length}개 매칭 실패:`)
    for (const w of warnings) console.warn(`    ${w}`)
  }

  // 유니크 패턴 통계
  const patterns = new Map()
  for (const r of allRows) {
    const key = r.identity_id
    if (!patterns.has(key)) patterns.set(key, { inc: 0, dec: 0 })
    if (r.condition_type === 'increase') patterns.get(key).inc++
    else patterns.get(key).dec++
  }
  console.log(`  인격 ${patterns.size}개에 조건 배정`)

  if (FIX) {
    // 기존 데이터 삭제 후 삽입
    const { error: delErr } = await supabase
      .schema('limbus')
      .from('identity_sanity_conditions')
      .delete()
      .neq('id', 0) // delete all
    if (delErr) console.warn(`  ⚠ 기존 데이터 삭제 실패: ${delErr.message}`)

    // 배치 삽입 (500개씩)
    for (let i = 0; i < allRows.length; i += 500) {
      const batch = allRows.slice(i, i + 500)
      const { error } = await supabase
        .schema('limbus')
        .from('identity_sanity_conditions')
        .insert(batch)
      if (error) throw new Error(`Batch insert failed at ${i}: ${error.message}`)
    }
    console.log(`  ✓ ${allRows.length}개 삽입 완료`)
  } else {
    for (const r of allRows.slice(0, 5)) {
      console.log(`  ${r.identity_id} | ${r.condition_type} | ${r.template_id} | params=${JSON.stringify(r.params)}`)
    }
    console.log(`  ... (총 ${allRows.length}개)`)
  }
}

// ── 5. panic_type 업데이트 ──
async function updatePanicTypes() {
  const files = readdirSync(JSON_DIR)
    .filter(f => /^personality-\d+\.json$/.test(f))
    .sort()

  const updates = new Map() // uuid → panicType (int)

  const { data: dbIdentities } = await supabase
    .schema('limbus')
    .from('identities')
    .select('id, game_id')
  const gameIdToUuid = new Map()
  for (const i of dbIdentities || []) {
    if (i.game_id) gameIdToUuid.set(String(i.game_id), i.id)
  }

  for (const file of files) {
    const data = loadPersonalityFile(resolve(JSON_DIR, file))
    if (!data) continue

    const items = data.list || (Array.isArray(data) ? data : [])
    for (const p of items) {
      const uuid = gameIdToUuid.get(String(p.id))
      if (!uuid) continue
      if (p.panicType != null) {
        updates.set(uuid, p.panicType)
      }
    }
  }

  console.log(`\n[PanicType] ${updates.size}개 인격 panic_type 업데이트`)

  const dist = new Map()
  for (const [, pt] of updates) {
    dist.set(pt, (dist.get(pt) || 0) + 1)
  }
  for (const [pt, cnt] of dist) {
    console.log(`  panicType ${pt}: ${cnt}개`)
  }

  if (FIX) {
    let updated = 0
    for (const [id, pt] of updates) {
      const { error } = await supabase
        .schema('limbus')
        .from('identities')
        .update({ panic_type: pt })
        .eq('id', id)
      if (error) console.warn(`  ⚠ ${id} 업데이트 실패: ${error.message}`)
      else updated++
    }
    console.log(`  ✓ ${updated}개 업데이트 완료`)
  }
}

// ── main ──
async function main() {
  console.log(`=== 정신력 FK 마이그레이션 (${FIX ? '--fix' : '--dry-run'}) ===`)

  const templateIds = await seedTemplates()
  await migrateConditions(templateIds)
  await updatePanicTypes()

  console.log(`\n${FIX ? '✓ 마이그레이션 완료' : '▶ --fix 플래그로 실행하면 DB에 반영됩니다'}`)
}

main().catch(e => { console.error(e); process.exit(1) })
