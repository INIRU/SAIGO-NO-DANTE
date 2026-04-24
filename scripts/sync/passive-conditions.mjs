/**
 * 패시브 공명/보유 조건 동기화
 * passive.json의 attributeResonanceCondition/attributeStockCondition을
 * DB passives.active_cond + sin_affinity + sin_count에 반영
 *
 * Usage: node --env-file=.env.local scripts/sync/passive-conditions.mjs [--dry-run|--fix]
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { triggerRevalidation } from './_revalidate.mjs'

const JSON_DIR = path.join(process.env.HOME, 'Documents/Limbus/assets/data/Json-2')
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

  // 1. passive.json 로드 — 패시브 ID → 조건 매핑
  const passiveData = JSON.parse(fs.readFileSync(path.join(JSON_DIR, 'passive.json'), 'utf8'))
  const passiveItems = passiveData.list ?? passiveData

  // passiveId → { type, sin, count }
  const conditionMap = new Map()
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

  // 2. personality-passive 파일들에서 인격 game_id → uptie_level별 패시브 ID 매핑
  const personalityPassiveFiles = fs.readdirSync(JSON_DIR)
    .filter(f => f.startsWith('personality-passive') && f.endsWith('.json'))
    .sort()

  // personalityID → { battle: Map<level, passiveId[]>, support: Map<level, passiveId[]> }
  const identityPassiveMap = new Map()
  for (const fname of personalityPassiveFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(JSON_DIR, fname), 'utf8'))
    const items = data.list ?? data
    for (const item of items) {
      const battleByLevel = new Map()
      const supportByLevel = new Map()
      for (const bp of item.battlePassiveList ?? []) {
        battleByLevel.set(bp.level, bp.passiveIDList ?? [])
      }
      for (const sp of item.supporterPassiveList ?? []) {
        supportByLevel.set(sp.level, sp.passiveIDList ?? [])
      }
      identityPassiveMap.set(item.personalityID, { battle: battleByLevel, support: supportByLevel })
    }
  }
  console.log(`[Personality] ${identityPassiveMap.size}개 인격 패시브 매핑 로드`)

  // 3. DB에서 인격 + 패시브 조회
  const { data: identities } = await limbus().from('identities').select('id, game_id')
  const { data: passives } = await limbus().from('passives').select('id, identity_id, passive_type, sin_affinity, sin_count, active_cond, uptie_level')

  // 4. 매칭 + 업데이트
  let updated = 0
  let skipped = 0
  let noMatch = 0

  for (const passive of passives ?? []) {
    const identEntry = (identities ?? []).find(i => i.id === passive.identity_id)
    if (!identEntry?.game_id) { noMatch++; continue }

    const gameId = parseInt(identEntry.game_id)
    const persPassive = identityPassiveMap.get(gameId)
    if (!persPassive) { noMatch++; continue }

    // uptie_level에 해당하는 패시브 ID 목록 가져오기
    // personality-passive의 level: 1=uptie3 이전, 2=uptie3(3동기화), 3=uptie4(4동기화) 등
    // DB uptie_level 3 → game level 1~2, DB uptie_level 4 → game level 3+
    const levelMap = passive.passive_type === 'battle' ? persPassive.battle : persPassive.support

    // 모든 레벨에서 패시브 ID를 찾아서 조건 매칭
    let matchedCond = null
    for (const [, passiveIds] of levelMap) {
      for (const pid of passiveIds) {
        const cond = conditionMap.get(pid)
        if (cond) {
          matchedCond = cond
          break
        }
      }
      if (matchedCond) break
    }

    if (!matchedCond) { noMatch++; continue }

    const newCond = matchedCond.type
    const newSin = matchedCond.sin
    const newCount = matchedCond.count

    // 변경 사항 확인
    const sinChanged = passive.sin_affinity !== newSin
    const countChanged = passive.sin_count !== newCount
    const condChanged = passive.active_cond !== newCond

    if (!sinChanged && !countChanged && !condChanged) { skipped++; continue }

    if (dryRun) {
      const changes = []
      if (condChanged) changes.push(`cond: ${passive.active_cond ?? 'null'} → ${newCond}`)
      if (sinChanged) changes.push(`sin: ${passive.sin_affinity ?? 'null'} → ${newSin}`)
      if (countChanged) changes.push(`count: ${passive.sin_count ?? 'null'} → ${newCount}`)
      console.log(`[DRY] ${passive.id} (uptie${passive.uptie_level} ${passive.passive_type}): ${changes.join(', ')}`)
    } else {
      const { error } = await limbus().from('passives').update({
        active_cond: newCond,
        sin_affinity: newSin,
        sin_count: newCount,
      }).eq('id', passive.id)
      if (error) console.error(`[ERR] ${passive.id}:`, error.message)
    }
    updated++
  }

  console.log(`\n[Result] 업데이트: ${updated}, 스킵(이미 동일): ${skipped}, 매칭 실패: ${noMatch}`)
  if (dryRun) console.log('[Tip] --fix 옵션으로 실행하면 DB에 반영됩니다')
}

main().catch(console.error)
