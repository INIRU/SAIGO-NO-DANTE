#!/usr/bin/env node
/**
 * baslimbus.store API에서 모든 인격 데이터를 가져와서 Supabase에 저장하는 스크립트
 *
 * 사용법:
 *   node scripts/fetch-identities.mjs
 *
 * 기능:
 *   - 인격 (identities) upsert
 *   - 스킬 (skills) 재생성
 *   - 패시브 (passives) 재생성
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── .env.local 로드 ──────────────────────────────────────────────────────────
const envFile = readFileSync(resolve(ROOT, '.env.local'), 'utf-8')
const env = Object.fromEntries(
  envFile
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ── 매핑 테이블 ──────────────────────────────────────────────────────────────
const CHARACTER_TO_SINNER = {
  '이상': 'yi-sang',
  '파우스트': 'faust',
  '돈키호테': 'don-quixote',
  '료슈': 'ryoshu',
  '뫼르소': 'meursault',
  '홍루': 'hong-lu',
  '히스클리프': 'heathcliff',
  '이스마엘': 'ishmael',
  '로쟈': 'rodion',
  '싱클레어': 'sinclair',
  '오티스': 'outis',
  '그레고르': 'gregor',
}

const SIN_MAP = {
  '분노': 'wrath',
  '색욕': 'lust',
  '나태': 'sloth',
  '탐식': 'gluttony',
  '우울': 'gloom',
  '오만': 'pride',
  '질투': 'envy',
}

const TYPE_MAP = {
  '참격': 'slash',
  '관통': 'pierce',
  '타격': 'blunt',
  '회피': 'evade',
  '방어': 'defense',
  '반격': 'counter',
}

const API_BASE = 'https://baslimbus.store/dictionary/identity'
const MAX_ID = 300
const DELAY_MS = 80

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function parseSpeed(s) {
  const [min, max] = s.split('-').map(Number)
  return { min: min || 0, max: max || 0 }
}

function parseDefLevel(s) {
  const m = String(s).match(/^(\d+)/)
  return m ? parseInt(m[1]) : 0
}

function extractGameId(url) {
  if (!url) return null
  const m = url.match(/(\d{5,})_/)
  return m ? m[1] : null
}

function buildSkillDesc(skill) {
  const parts = []
  if (skill.normalEffect) parts.push(skill.normalEffect)
  for (let i = 1; i <= 9; i++) {
    const eff = skill[`coin${i}Effect`]
    if (eff) parts.push(`[코인 ${i}] ${eff}`)
  }
  return parts.join('\n') || null
}

async function fetchIdentity(id) {
  try {
    const res = await fetch(`${API_BASE}/${id}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Storage 폴더 탐색 (game_id → 영문 폴더명) ──────────────────────────────
const STORAGE_API = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1`

// 죄인별 폴더 캐시 (같은 죄인의 폴더를 반복 조회하지 않도록)
const folderCache = new Map()

async function getFolderName(sinnerId, gameId) {
  if (!gameId) return null
  if (folderCache.has(gameId)) return folderCache.get(gameId)

  // 죄인별 전체 폴더를 한번에 캐시
  if (!folderCache.has(`_loaded_${sinnerId}`)) {
    try {
      const res = await fetch(`${STORAGE_API}/object/list/limbus-assets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: `sinners/${sinnerId}/identities`,
          limit: 100,
          sortBy: { column: 'name', order: 'asc' },
        }),
      })
      if (res.ok) {
        const folders = (await res.json()).filter(i => !i.id).map(i => i.name)
        for (const folder of folders) {
          const fRes = await fetch(`${STORAGE_API}/object/list/limbus-assets`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prefix: `sinners/${sinnerId}/identities/${folder}`,
              limit: 5,
              sortBy: { column: 'name', order: 'asc' },
            }),
          })
          if (!fRes.ok) continue
          const files = (await fRes.json()).filter(i => i.id).map(i => i.name)
          for (const file of files) {
            const m = file.match(/^(\d{5,})_/)
            if (m) { folderCache.set(m[1], folder); break }
          }
        }
      }
    } catch {}
    folderCache.set(`_loaded_${sinnerId}`, true)
  }

  return folderCache.get(gameId) || null
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  Limbus Archive - Identity Data Import       ║')
  console.log('║  Source: baslimbus.store API                  ║')
  console.log('╚══════════════════════════════════════════════╝\n')

  // 1. 기존 인격 조회 (중복 체크용)
  const { data: existingRows, error: fetchErr } = await supabase
    .schema('limbus')
    .from('identities')
    .select('id, sinner_id, name, name_kr')

  if (fetchErr) {
    console.error('DB 조회 실패:', fetchErr.message)
    process.exit(1)
  }

  const existingMap = new Map()
  for (const e of existingRows || []) {
    // name_kr 또는 name 으로 매칭
    const key = `${e.sinner_id}::${e.name_kr || e.name}`
    existingMap.set(key, e)
  }
  console.log(`기존 인격: ${existingMap.size}개\n`)

  // 2. API에서 전체 인격 가져오기
  console.log('baslimbus.store API에서 데이터 수집 중...\n')
  const rawIdentities = []
  let consecutive404 = 0

  for (let id = 1; id <= MAX_ID; id++) {
    const data = await fetchIdentity(id)
    if (!data) {
      consecutive404++
      if (consecutive404 >= 15) {
        console.log(`\n  → ID ${id}에서 중단 (15회 연속 404)`)
        break
      }
      continue
    }
    consecutive404 = 0
    rawIdentities.push({ ...data, _apiId: id })
    process.stdout.write(`  [${id}] ${data.character} - ${data.name} (${data.grade}성)\n`)
    await sleep(DELAY_MS)
  }

  console.log(`\n총 ${rawIdentities.length}개 인격 수집 완료\n`)

  // 3. 원본 데이터 백업 저장
  const backupPath = resolve(ROOT, 'scripts', 'raw-identities.json')
  writeFileSync(backupPath, JSON.stringify(rawIdentities, null, 2), 'utf-8')
  console.log(`원본 데이터 백업: ${backupPath}\n`)

  // 4. Supabase에 저장
  console.log('Supabase에 저장 중...\n')
  let inserted = 0, updated = 0, skipped = 0, errors = 0

  // game_id → identity 매핑 (sinners.ts 업데이트용)
  const gameIdMap = []

  for (const raw of rawIdentities) {
    const sinnerId = CHARACTER_TO_SINNER[raw.character]
    if (!sinnerId) {
      console.warn(`  ⚠ 알 수 없는 캐릭터: "${raw.character}" → 건너뜀`)
      skipped++
      continue
    }

    const speed = parseSpeed(raw.status.speed)
    const gameId = extractGameId(raw.beforeImage)

    // Storage에서 영문 폴더명 탐색
    const folderName = await getFolderName(sinnerId, gameId)

    // 인격 레코드 구성
    const identity = {
      sinner_id: sinnerId,
      name_kr: raw.name,
      rarity: `${raw.grade}성`,
      hp: parseInt(raw.status.life) || 0,
      speed_min: speed.min,
      speed_max: speed.max,
      def_level: parseDefLevel(raw.status.defend),
      keywords: raw.keyword || [],
      affiliation: raw.affiliation || null,
      release_date: raw.releaseDate || null,
      acquisition: raw.obtainingMethod || null,
      slash_res: raw.resistance?.[0] || null,
      pierce_res: raw.resistance?.[1] || null,
      blunt_res: raw.resistance?.[2] || null,
      game_id: gameId || null,
      folder_name: folderName,
    }

    // 기존 인격 체크
    const key = `${sinnerId}::${raw.name}`
    const existing = existingMap.get(key)
    let identityId

    if (existing) {
      // 업데이트 (English name 유지)
      const { error } = await supabase
        .schema('limbus')
        .from('identities')
        .update(identity)
        .eq('id', existing.id)
      if (error) {
        console.error(`  ✗ 업데이트 실패 [${raw.name}]: ${error.message}`)
        errors++
        continue
      }
      identityId = existing.id
      updated++
    } else {
      // 신규 삽입 (name = Korean)
      identity.name = raw.name
      const { data, error } = await supabase
        .schema('limbus')
        .from('identities')
        .insert(identity)
        .select('id')
        .single()
      if (error) {
        console.error(`  ✗ 삽입 실패 [${raw.name}]: ${error.message}`)
        errors++
        continue
      }
      identityId = data.id
      inserted++
    }

    if (gameId) {
      gameIdMap.push({ sinnerId, name: raw.name, gameId, identityId })
    }

    // ── 스킬 재생성 ──────────────────────────────────────────────────────
    await supabase.schema('limbus').from('skills').delete().eq('identity_id', identityId)

    const skillSets = [
      { skills: raw.identitySkill1s, order: 1 },
      { skills: raw.identitySkill2s, order: 2 },
      { skills: raw.identitySkill3s, order: 3 },
      { skills: raw.identityDefSkills, order: 4 },
    ]

    const skillRows = []
    for (const { skills, order } of skillSets) {
      if (!skills?.length) continue
      const level3 = skills.filter(s => s.level === 3)
      const seen = new Set()
      for (const s of level3) {
        if (seen.has(s.name)) continue
        seen.add(s.name)
        skillRows.push({
          identity_id: identityId,
          name: s.name,
          skill_type: TYPE_MAP[s.type] || s.type,
          sin_affinity: SIN_MAP[s.resource] || null,
          coins: s.coinNum,
          base_power: s.skillPower,
          coin_power: s.coinPower,
          description: buildSkillDesc(s),
          skill_order: order,
          atk_weight: s.atkWeight || 1,
          offense_level: parseInt(s.power) || null,
          quantity: s.quantity || null,
        })
      }
    }

    if (skillRows.length > 0) {
      const { error } = await supabase.schema('limbus').from('skills').insert(skillRows)
      if (error) console.error(`  ✗ 스킬 삽입 실패 [${raw.name}]: ${error.message}`)
    }

    // ── 패시브 재생성 ────────────────────────────────────────────────────
    await supabase.schema('limbus').from('passives').delete().eq('identity_id', identityId)

    if (raw.identityPassives?.length) {
      const level3 = raw.identityPassives.filter(p => p.level === 3)
      const passiveRows = level3.map((p, i) => ({
        identity_id: identityId,
        passive_type: p.isMain ? 'battle' : 'support',
        name: p.name,
        sin_affinity: (p.resource && p.resource !== '없음') ? p.resource : null,
        sin_count: p.resQuantity || null,
        active_cond: p.activeCond || null,
        description: p.effect,
        passive_order: i + 1,
      }))

      if (passiveRows.length > 0) {
        const { error } = await supabase.schema('limbus').from('passives').insert(passiveRows)
        if (error) console.error(`  ✗ 패시브 삽입 실패 [${raw.name}]: ${error.message}`)
      }
    }

    process.stdout.write(`  ✓ ${raw.character} - ${raw.name}\n`)
  }

  // 5. Game ID 매핑 파일 저장 (sinners.ts 업데이트용)
  const gameIdPath = resolve(ROOT, 'scripts', 'game-id-map.json')
  writeFileSync(gameIdPath, JSON.stringify(gameIdMap, null, 2), 'utf-8')

  // 6. 결과 출력
  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║  Import 결과                                  ║')
  console.log('╠══════════════════════════════════════════════╣')
  console.log(`║  신규 삽입:  ${String(inserted).padStart(4)}                              ║`)
  console.log(`║  업데이트:   ${String(updated).padStart(4)}                              ║`)
  console.log(`║  건너뜀:     ${String(skipped).padStart(4)}                              ║`)
  console.log(`║  오류:       ${String(errors).padStart(4)}                              ║`)
  console.log(`║  총 처리:    ${String(rawIdentities.length).padStart(4)}                              ║`)
  console.log('╚══════════════════════════════════════════════╝')
  console.log(`\nGame ID 매핑: ${gameIdPath}`)
}

main().catch(err => {
  console.error('\n치명적 오류:', err)
  process.exit(1)
})
