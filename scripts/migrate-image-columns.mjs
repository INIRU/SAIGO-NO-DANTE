#!/usr/bin/env node
/**
 * identities 테이블의 game_id, folder_name 컬럼을 채우는 마이그레이션
 * - game_id: game-id-map.json에서 로드
 * - folder_name: Supabase Storage 폴더 탐색으로 자동 매핑
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)
const STORAGE_API = `${supabaseUrl}/storage/v1`

// ── game-id-map.json 로드 ─────────────────────────────────────────────────
const gameIdMap = JSON.parse(readFileSync(resolve(ROOT, 'scripts', 'game-id-map.json'), 'utf-8'))

// ── Storage 탐색 ──────────────────────────────────────────────────────────
async function listStorageFolders(sinnerId) {
  const res = await fetch(`${STORAGE_API}/object/list/limbus-assets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prefix: `sinners/${sinnerId}/identities`,
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    }),
  })
  if (!res.ok) return []
  const items = await res.json()
  return items.filter(i => !i.id).map(i => i.name)
}

async function listFilesInFolder(sinnerId, folderName) {
  const res = await fetch(`${STORAGE_API}/object/list/limbus-assets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prefix: `sinners/${sinnerId}/identities/${folderName}`,
      limit: 10,
      sortBy: { column: 'name', order: 'asc' },
    }),
  })
  if (!res.ok) return []
  const items = await res.json()
  return items.filter(i => i.id).map(i => i.name)
}

function extractGameId(filename) {
  const m = filename.match(/^(\d{5,})_/)
  return m ? m[1] : null
}

// ── 메인 ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Migration: game_id + folder_name 채우기 ===\n')

  // 1. 인격 조회
  const { data: identities, error } = await supabase
    .schema('limbus')
    .from('identities')
    .select('id, sinner_id, name, name_kr')
  if (error) { console.error('DB 조회 실패:', error.message); process.exit(1) }
  console.log(`인격: ${identities.length}개\n`)

  // 2. gameId 매핑 (name_kr 기준)
  const gameIdByKey = new Map()
  for (const entry of gameIdMap) {
    gameIdByKey.set(`${entry.sinnerId}::${entry.name}`, entry.gameId)
  }

  // 3. Storage 폴더 탐색 → gameId → folderName
  console.log('Storage 폴더 탐색...')
  const sinnerIds = [...new Set(identities.map(i => i.sinner_id))]
  const gameIdToFolder = new Map()

  for (const sinnerId of sinnerIds) {
    const folders = await listStorageFolders(sinnerId)
    for (const folder of folders) {
      const files = await listFilesInFolder(sinnerId, folder)
      for (const file of files) {
        const gid = extractGameId(file)
        if (gid) { gameIdToFolder.set(gid, folder); break }
      }
    }
    console.log(`  ${sinnerId}: ${folders.length} 폴더`)
  }
  console.log(`  → ${gameIdToFolder.size}개 gameId→folder 매핑\n`)

  // 4. UPDATE
  console.log('DB 업데이트...')
  let updated = 0, noGameId = 0, noFolder = 0

  for (const identity of identities) {
    const nameKey = identity.name_kr || identity.name
    const gameId = gameIdByKey.get(`${identity.sinner_id}::${nameKey}`)
    if (!gameId) { noGameId++; continue }

    const folderName = gameIdToFolder.get(gameId) || null
    if (!folderName) noFolder++

    const { error: updateErr } = await supabase
      .schema('limbus')
      .from('identities')
      .update({ game_id: gameId, folder_name: folderName })
      .eq('id', identity.id)

    if (updateErr) {
      console.error(`  ✗ ${nameKey}: ${updateErr.message}`)
    } else {
      updated++
    }
  }

  console.log(`\n=== 결과 ===`)
  console.log(`  업데이트:      ${updated}`)
  console.log(`  gameId 없음:   ${noGameId}`)
  console.log(`  folder 없음:   ${noFolder}`)
}

main().catch(err => { console.error(err); process.exit(1) })
