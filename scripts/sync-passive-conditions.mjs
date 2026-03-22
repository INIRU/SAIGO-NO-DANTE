/**
 * 패시브 공명/보유 조건 동기화
 * passive.json의 attributeResonanceCondition/attributeStockCondition을
 * DB passives.active_cond에 'resonance' 또는 'stock'으로 저장
 *
 * Usage: node --env-file=.env.local scripts/sync-passive-conditions.mjs [--dry-run|--fix]
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const JSON_DIR = path.join(process.env.HOME, 'Downloads/JSON')
const args = process.argv.slice(2)
const dryRun = !args.includes('--fix')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const limbus = () => supabase.schema('limbus')

// 죄악 타입 매핑 (게임 → DB)
const SIN_MAP = {
  CRIMSON: 'wrath',
  SCARLET: 'lust',
  AMBER: 'sloth',
  SHAMROCK: 'gluttony',
  AZURE: 'gloom',
  INDIGO: 'pride',
  VIOLET: 'envy',
}

async function main() {
  console.log(`[Mode] ${dryRun ? 'DRY RUN' : 'FIX (DB 업데이트)'}`)

  // 1. passive.json 로드 — 패시브 ID → 조건 타입 매핑
  const passiveData = JSON.parse(fs.readFileSync(path.join(JSON_DIR, 'passive.json'), 'utf8'))
  const passiveItems = passiveData.list ?? passiveData

  const conditionMap = new Map() // passiveId → { type: 'resonance'|'stock', sin: string, count: number }
  for (const item of passiveItems) {
    if (item.attributeResonanceCondition) {
      for (const cond of item.attributeResonanceCondition) {
        conditionMap.set(item.id, {
          type: 'resonance',
          sin: SIN_MAP[cond.type] ?? cond.type,
          count: cond.value,
        })
      }
    } else if (item.attributeStockCondition) {
      for (const cond of item.attributeStockCondition) {
        conditionMap.set(item.id, {
          type: 'stock',
          sin: SIN_MAP[cond.type] ?? cond.type,
          count: cond.value,
        })
      }
    }
  }
  console.log(`[Passive] ${conditionMap.size}개 조건 로드 (공명: ${[...conditionMap.values()].filter(v => v.type === 'resonance').length}, 보유: ${[...conditionMap.values()].filter(v => v.type === 'stock').length})`)

  // 2. personality-passive 파일들에서 인격 game_id → 패시브 ID 매핑
  const personalityPassiveFiles = fs.readdirSync(JSON_DIR)
    .filter(f => f.startsWith('personality-passive') && f.endsWith('.json'))
    .sort()

  // personalityID → { battle: passiveId[], support: passiveId[] }
  const identityPassiveMap = new Map()
  for (const fname of personalityPassiveFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(JSON_DIR, fname), 'utf8'))
    const items = data.list ?? data
    for (const item of items) {
      const battleIds = []
      const supportIds = []
      for (const bp of item.battlePassiveList ?? []) {
        battleIds.push(...(bp.passiveIDList ?? []))
      }
      for (const sp of item.supporterPassiveList ?? []) {
        supportIds.push(...(sp.passiveIDList ?? []))
      }
      identityPassiveMap.set(item.personalityID, { battle: battleIds, support: supportIds })
    }
  }
  console.log(`[Personality] ${identityPassiveMap.size}개 인격 패시브 매핑 로드`)

  // 3. DB에서 인격 + 패시브 조회
  const { data: identities } = await limbus().from('identities').select('id, game_id')
  const { data: passives } = await limbus().from('passives').select('id, identity_id, passive_type, sin_affinity, sin_count, active_cond, uptie_level')

  const identityGameIdMap = new Map() // game_id → uuid
  for (const ident of identities ?? []) {
    if (ident.game_id) identityGameIdMap.set(parseInt(ident.game_id), ident.id)
  }

  // 4. 매칭 + 업데이트
  let updated = 0
  let skipped = 0
  let noMatch = 0

  for (const passive of passives ?? []) {
    // DB identity uuid → game_id
    const identEntry = (identities ?? []).find(i => i.id === passive.identity_id)
    if (!identEntry?.game_id) { noMatch++; continue }

    const gameId = parseInt(identEntry.game_id)
    const persPassive = identityPassiveMap.get(gameId)
    if (!persPassive) { noMatch++; continue }

    // 해당 패시브 타입(battle/support)의 패시브 ID 목록
    const passiveIds = passive.passive_type === 'battle' ? persPassive.battle : persPassive.support

    // 패시브 ID 중 조건이 있는 것 찾기
    let matchedCond = null
    for (const pid of passiveIds) {
      const cond = conditionMap.get(pid)
      if (cond && cond.sin === passive.sin_affinity && cond.count === passive.sin_count) {
        matchedCond = cond
        break
      }
    }

    // 조건 없는 패시브 — sin_affinity/sin_count 기반으로 추론
    if (!matchedCond) {
      for (const pid of passiveIds) {
        const cond = conditionMap.get(pid)
        if (cond) {
          matchedCond = cond
          break
        }
      }
    }

    if (!matchedCond) { noMatch++; continue }

    const newCond = matchedCond.type // 'resonance' or 'stock'
    if (passive.active_cond === newCond) { skipped++; continue }

    if (dryRun) {
      console.log(`[DRY] ${passive.id} (${passive.passive_type}): ${passive.active_cond ?? 'null'} → ${newCond}`)
    } else {
      const { error } = await limbus().from('passives').update({ active_cond: newCond }).eq('id', passive.id)
      if (error) console.error(`[ERR] ${passive.id}:`, error.message)
    }
    updated++
  }

  console.log(`\n[Result] 업데이트: ${updated}, 스킵(이미 동일): ${skipped}, 매칭 실패: ${noMatch}`)
  if (dryRun) console.log('[Tip] --fix 옵션으로 실행하면 DB에 반영됩니다')
}

main().catch(console.error)
