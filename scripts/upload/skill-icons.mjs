#!/usr/bin/env node
/**
 * 스킬 아이콘을 수감자별 폴더 구조로 Supabase Storage에 업로드
 * 경로: icons/skills/{sinnerId}/{gameId}{NN}.webp
 *
 * Usage:
 *   node --env-file=.env.local scripts/upload/skill-icons.mjs [--dry-run] [--force]
 *
 * --dry-run: 업로드하지 않고 파일 목록만 출력
 * --force:   이미 존재하는 파일도 덮어쓰기
 */

import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, extname, basename } from 'path'
import sharp from 'sharp'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'limbus-assets'
const SOURCE_DIR = '/Users/iniru/Documents/Limbus/assets/Icons/skill/Sinners'
const CONCURRENCY = 4
const WEBP_QUALITY = 85

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')

const SINNER_ID_MAP = {
  'Yi Sang':     'yi-sang',
  'Faust':       'faust',
  'Don Quixote': 'don-quixote',
  'Ryoshu':      'ryoshu',
  'Meursault':   'meursault',
  'Hong Lu':     'hong-lu',
  'Heathcliff':  'heathcliff',
  'Ishmael':     'ishmael',
  'Rodion':      'rodion',
  'Sinclair':    'sinclair',
  'Outis':       'outis',
  'Gregor':      'gregor',
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// 파일 수집: Sinners/{Sinner Name}/{Identity Name}/{file}.png
function collectFiles() {
  const files = []
  const sinnerDirs = readdirSync(SOURCE_DIR)

  for (const sinnerName of sinnerDirs) {
    const sinnerId = SINNER_ID_MAP[sinnerName]
    if (!sinnerId) {
      console.warn(`  [SKIP] 알 수 없는 수감자: ${sinnerName}`)
      continue
    }

    const sinnerPath = join(SOURCE_DIR, sinnerName)
    if (!statSync(sinnerPath).isDirectory()) continue

    const identityDirs = readdirSync(sinnerPath)
    for (const identityName of identityDirs) {
      const identityPath = join(sinnerPath, identityName)
      if (!statSync(identityPath).isDirectory()) continue

      const entries = readdirSync(identityPath)
      for (const file of entries) {
        if (!['.png', '.jpg', '.jpeg'].includes(extname(file).toLowerCase())) continue
        const nameNoExt = basename(file, extname(file))
        files.push({
          localPath: join(identityPath, file),
          storagePath: `icons/skills/${sinnerId}/${nameNoExt}.webp`,
          sinnerId,
          fileName: nameNoExt,
        })
      }
    }
  }

  return files
}

// 기존 파일 목록 가져오기
async function getExistingFiles() {
  const existing = new Set()
  for (const [, sinnerId] of Object.entries(SINNER_ID_MAP)) {
    const { data } = await supabase.storage
      .from(BUCKET)
      .list(`icons/skills/${sinnerId}`, { limit: 1000 })
    if (data) {
      for (const f of data) {
        existing.add(`icons/skills/${sinnerId}/${f.name}`)
      }
    }
  }
  return existing
}

// 업로드
async function uploadFile(file) {
  const buf = readFileSync(file.localPath)
  const webpBuf = await sharp(buf).webp({ quality: WEBP_QUALITY }).toBuffer()

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(file.storagePath, webpBuf, {
      contentType: 'image/webp',
      upsert: true,
    })

  if (error) {
    console.error(`  [ERROR] ${file.storagePath}: ${error.message}`)
    return false
  }
  return true
}

async function main() {
  console.log('스킬 아이콘 업로드 (수감자별 폴더)')
  console.log(`  소스: ${SOURCE_DIR}`)
  console.log(`  대상: ${BUCKET}/icons/skills/{sinnerId}/`)
  console.log(`  모드: ${DRY_RUN ? 'DRY RUN' : FORCE ? 'FORCE (전체 덮어쓰기)' : '신규만'}`)
  console.log()

  const files = collectFiles()
  console.log(`  수집된 파일: ${files.length}개`)

  // 수감자별 카운트
  const sinnerCounts = {}
  for (const f of files) {
    sinnerCounts[f.sinnerId] = (sinnerCounts[f.sinnerId] || 0) + 1
  }
  for (const [sid, cnt] of Object.entries(sinnerCounts).sort()) {
    console.log(`    ${sid}: ${cnt}개`)
  }
  console.log()

  if (DRY_RUN) {
    console.log('DRY RUN — 업로드하지 않음')
    for (const f of files) {
      console.log(`  ${f.storagePath}`)
    }
    return
  }

  // 기존 파일 확인
  let toUpload = files
  if (!FORCE) {
    console.log('기존 파일 확인 중...')
    const existing = await getExistingFiles()
    console.log(`  기존 파일: ${existing.size}개`)
    toUpload = files.filter(f => !existing.has(f.storagePath))
    console.log(`  업로드 대상: ${toUpload.length}개 (신규)`)
  } else {
    console.log(`  업로드 대상: ${toUpload.length}개 (전체)`)
  }

  if (toUpload.length === 0) {
    console.log('\n모든 파일이 이미 존재합니다.')
    return
  }

  // 병렬 업로드
  let uploaded = 0
  let failed = 0
  for (let i = 0; i < toUpload.length; i += CONCURRENCY) {
    const batch = toUpload.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(f => uploadFile(f)))
    for (const ok of results) {
      if (ok) uploaded++
      else failed++
    }
    process.stdout.write(`\r  진행: ${uploaded + failed}/${toUpload.length} (성공: ${uploaded}, 실패: ${failed})`)
  }

  console.log(`\n\n완료: ${uploaded}개 업로드, ${failed}개 실패`)
}

main().catch(err => { console.error(err); process.exit(1) })
