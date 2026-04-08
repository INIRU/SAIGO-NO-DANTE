#!/usr/bin/env node
/**
 * 누락된 스킬 아이콘 + 인격 이미지를 Supabase Storage에 업로드
 * - 스킬 아이콘: PNG → webp 변환 후 icons/skills/ 에 업로드
 * - 인격 이미지: PNG → webp 변환 후 sinners/{id}/identities/{folder}/ 에 업로드
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const envFile = readFileSync(resolve(ROOT, '.env.local'), 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const idx = l.indexOf('='); return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] })
)

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY
const STORAGE_API = `${supabaseUrl}/storage/v1`

const ASSETS_BASE = '/Users/iniru/Documents/Limbus/assets'
const SKILL_BASE = `${ASSETS_BASE}/Icons/skill/Sinners`
const IDENTITY_BASE = `${ASSETS_BASE}/Identities & EGO Art`

// 죄인 폴더명 → sinner_id 매핑
const SINNER_MAP = {
  'Yi Sang': 'yi-sang',
  'Faust': 'faust',
  'Don Quixote': 'don-quixote',
  'Ryoshu': 'ryoshu',
  'Meursault': 'meursault',
  'Hong Lu': 'hong-lu',
  'Heathcliff': 'heathcliff',
  'Ishmael': 'ishmael',
  'Rodion': 'rodion',
  'Sinclair': 'sinclair',
  'Outis': 'outis',
  'Gregor': 'gregor',
}

async function convertToWebp(pngPath) {
  return sharp(pngPath).webp({ quality: 85 }).toBuffer()
}

async function uploadToStorage(storagePath, buffer, contentType = 'image/webp') {
  const res = await fetch(`${STORAGE_API}/object/limbus-assets/${storagePath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  })
  return res.ok
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('=== Supabase Storage 에셋 업로드 ===\n')

  // ── 1. 스킬 아이콘 업로드 (이상 제외) ────────────────────────────────
  console.log('1. 스킬 아이콘 업로드...\n')
  let skillUploaded = 0, skillSkipped = 0, skillErrors = 0

  const sinnerDirs = readdirSync(SKILL_BASE)
  for (const sinnerDir of sinnerDirs) {
    const sinnerId = SINNER_MAP[sinnerDir]
    if (!sinnerId) continue
    // 이상은 이미 업로드됨 - 건너뜀
    if (sinnerId === 'yi-sang') { console.log(`  ${sinnerDir}: 이미 업로드됨 → 건너뜀`); continue }

    const sinnerPath = join(SKILL_BASE, sinnerDir)
    if (!statSync(sinnerPath).isDirectory()) continue

    const identityDirs = readdirSync(sinnerPath)
    let count = 0

    for (const identityDir of identityDirs) {
      const identityPath = join(sinnerPath, identityDir)
      if (!statSync(identityPath).isDirectory()) continue

      const files = readdirSync(identityPath).filter(f => f.endsWith('.png'))
      for (const file of files) {
        const name = basename(file, '.png')
        const storagePath = `icons/skills/${name}.webp`
        const filePath = join(identityPath, file)

        try {
          const webpBuffer = await convertToWebp(filePath)
          const ok = await uploadToStorage(storagePath, webpBuffer)
          if (ok) { skillUploaded++; count++ }
          else { skillErrors++ }
        } catch (err) {
          console.error(`    ✗ ${file}: ${err.message}`)
          skillErrors++
        }
      }
    }
    console.log(`  ${sinnerDir}: ${count}개 업로드`)
    await sleep(100)
  }

  console.log(`\n  스킬 아이콘 결과: 업로드 ${skillUploaded}, 오류 ${skillErrors}\n`)

  // ── 2. 누락 인격 이미지 업로드 ───────────────────────────────────────
  console.log('2. 누락 인격 이미지 업로드...\n')

  const missingIdentities = [
    { sinnerId: 'faust', sinnerDir: 'Faust', folder: 'The Index Proselyte 【Paper Slip】' },
    { sinnerId: 'meursault', sinnerDir: 'Meursault', folder: 'N Corp. Großhammer' },
    { sinnerId: 'hong-lu', sinnerDir: 'Hong Lu', folder: 'Fanghunt Office Fixer' },
    { sinnerId: 'gregor', sinnerDir: 'Gregor', folder: 'The Priest of La Manchaland' },
    { sinnerId: 'gregor', sinnerDir: 'Gregor', folder: 'Edgar Family Heir' },
  ]

  let idUploaded = 0, idErrors = 0

  for (const { sinnerId, sinnerDir, folder } of missingIdentities) {
    const localPath = join(IDENTITY_BASE, sinnerDir, 'Identities', folder)
    const files = readdirSync(localPath).filter(f => f.endsWith('.png'))

    // 필요한 파일만: gameId_normal.png, gameId_normal_info.png, gameId_gacksung.png, gameId_gacksung_info.png
    const needed = files.filter(f => /^\d{5}_(normal|gacksung)/.test(f))

    console.log(`  ${sinnerId}/${folder}: ${needed.length}개 파일`)

    for (const file of needed) {
      const name = basename(file, '.png')
      const storagePath = `sinners/${sinnerId}/identities/${folder}/${name}.webp`
      const filePath = join(localPath, file)

      try {
        const webpBuffer = await convertToWebp(filePath)
        const ok = await uploadToStorage(storagePath, webpBuffer)
        if (ok) { idUploaded++ }
        else {
          console.error(`    ✗ 업로드 실패: ${storagePath}`)
          idErrors++
        }
      } catch (err) {
        console.error(`    ✗ ${file}: ${err.message}`)
        idErrors++
      }
    }
  }

  console.log(`\n  인격 이미지 결과: 업로드 ${idUploaded}, 오류 ${idErrors}\n`)

  // ── 3. DB 업데이트 (folder_name, game_id) ────────────────────────────
  console.log('3. DB folder_name/game_id 업데이트...\n')

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  const dbUpdates = [
    { sinnerId: 'faust', nameKr: '검지 수행자: [쪽지]', gameId: '10214', folderName: 'The Index Proselyte 【Paper Slip】' },
    { sinnerId: 'meursault', nameKr: 'N사 큰 망치', gameId: '10504', folderName: 'N Corp. Großhammer' },
    { sinnerId: 'hong-lu', nameKr: '송곳니 사냥 사무소 해결사', gameId: '10610', folderName: 'Fanghunt Office Fixer' },
    { sinnerId: 'gregor', nameKr: '라만차랜드 신부', gameId: '11210', folderName: 'The Priest of La Manchaland' },
    { sinnerId: 'gregor', nameKr: '에드가 가문 승계자', gameId: '11209', folderName: 'Edgar Family Heir' },
  ]

  for (const { sinnerId, nameKr, gameId, folderName } of dbUpdates) {
    const { error } = await supabase
      .schema('limbus')
      .from('identities')
      .update({ game_id: gameId, folder_name: folderName })
      .eq('sinner_id', sinnerId)
      .eq('name_kr', nameKr)

    if (error) {
      console.error(`  ✗ ${nameKr}: ${error.message}`)
    } else {
      console.log(`  ✓ ${sinnerId} - ${nameKr}`)
    }
  }

  console.log('\n=== 완료 ===')
}

main().catch(err => { console.error(err); process.exit(1) })
