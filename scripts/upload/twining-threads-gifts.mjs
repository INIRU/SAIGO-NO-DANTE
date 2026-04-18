#!/usr/bin/env node
// Upload 9 Twining Threads gift images from Google Drive → Supabase Storage
// Then update ego_gifts.image_url in DB
// Usage: node --env-file=.env.local scripts/upload/twining-threads-gifts.mjs

import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { readFile } from 'fs/promises'
import sharp from 'sharp'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'limbus-assets'
const TMP_DIR = '/Users/iniru/Documents/Limbus/limbus-archive/.worktrees/task/update-april-a095e5/.twining-tmp'
const WEBP_QUALITY = 85

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'limbus' } })

// Hash convention: MD5(Korean name).slice(0,8) — confirmed by reverse-engineering existing rows
function giftStoragePath(koreanName) {
  const hash = createHash('md5').update(koreanName).digest('hex').slice(0, 8)
  return `ego-gifts/ego-gift-${hash}.webp`
}

const PUBLIC_BASE = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`

const GIFTS = [
  { game_id: 9260, name_kr: '작품 : 약동',         drive_id: '162j82rwIs07xCtT5eZTGN1KxVozSbhBE' },
  { game_id: 9261, name_kr: '작품 : 야성',          drive_id: '1043XVczXo3JSwZnBThlsFw2I6hLQD6wC' },
  { game_id: 9262, name_kr: '모든 것의 뼈대',       drive_id: '1OhoEWzgPr0KB6h9ifoMV-oiGVw2b8hSE' },
  { game_id: 9263, name_kr: '수작 : 진화하는 약동', drive_id: '1_WFsgjgA9h8zjs_akF-U9pD8b_oqKPTN' },
  { game_id: 9264, name_kr: '수작 : 박제된 야성',   drive_id: '18xjPyw1zZWW1ImwhvAP9wv22gpk35As1' },
  { game_id: 9265, name_kr: '중지식 너클',          drive_id: '1DLFx_olkkoyQByHtE3oufnKDZdrdKZy1' },
  { game_id: 9266, name_kr: '텅 빈 새장',           drive_id: '1yWLvecqjDHMfd4Zqqsa3fft8FWKdg7ZF' },
  { game_id: 9267, name_kr: '달궈진 놋쇠',          drive_id: '1RAoJMJ4iP3LU6oF3VpFHI7BbjlLcn9Wd' },
  { game_id: 9268, name_kr: '모든 것의 본능',       drive_id: '1omObgFhniW6_97qvDUZZGDzIzz0awmHQ' },
]

mkdirSync(TMP_DIR, { recursive: true })

function downloadDrive(fileId, destPath) {
  if (existsSync(destPath)) {
    console.log(`  [skip download] ${destPath} already exists`)
    return
  }
  // execFileSync avoids shell injection — fileId is a hardcoded constant, not user input
  // gws syntax: --params takes all query params including fileId and alt
  execFileSync('gws', [
    'drive', 'files', 'get',
    '--params', JSON.stringify({ fileId, alt: 'media' }),
    '--output', destPath,
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
}

async function processGift(gift, idx, total) {
  const { game_id, name_kr, drive_id } = gift
  const storagePath = giftStoragePath(name_kr)
  const publicUrl = `${PUBLIC_BASE}/${storagePath}`
  const tmpPng = `${TMP_DIR}/${game_id}.png`

  console.log(`[${idx + 1}/${total}] game_id=${game_id} → ${storagePath}`)

  // 1. Check if already in Storage (idempotent)
  const hashPart = createHash('md5').update(name_kr).digest('hex').slice(0, 8)
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .list('ego-gifts', { search: `ego-gift-${hashPart}.webp` })

  if (existing && existing.length > 0) {
    console.log(`  [skip upload] already in Storage`)
  } else {
    // 2. Download from Drive
    console.log(`  Downloading from Drive...`)
    downloadDrive(drive_id, tmpPng)

    // 3. Convert to WebP
    console.log(`  Converting to WebP...`)
    const pngBuf = await readFile(tmpPng)
    const webpBuf = await sharp(pngBuf)
      .webp({ quality: WEBP_QUALITY, lossless: false })
      .toBuffer()

    // 4. Upload to Supabase Storage
    console.log(`  Uploading to Storage...`)
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, webpBuf, { contentType: 'image/webp', upsert: true })
    if (uploadErr) {
      throw new Error(`Upload failed for game_id=${game_id}: ${uploadErr.message}`)
    }
  }

  // 5. Update DB
  const { error: dbErr } = await supabase
    .from('ego_gifts')
    .update({ image_url: publicUrl })
    .eq('game_id', game_id)
  if (dbErr) {
    throw new Error(`DB update failed for game_id=${game_id}: ${dbErr.message}`)
  }
  console.log(`  DB updated → ${publicUrl}`)

  return { game_id, storagePath, publicUrl }
}

async function main() {
  const total = GIFTS.length
  const results = []
  const failures = []

  for (let i = 0; i < total; i++) {
    try {
      const result = await processGift(GIFTS[i], i, total)
      results.push(result)
    } catch (err) {
      console.error(`  ERROR: ${err.message}`)
      failures.push({ game_id: GIFTS[i].game_id, error: err.message })
    }
  }

  // 6. Verify HTTP 200 for uploaded URLs
  console.log('\nVerifying uploaded URLs...')
  for (const { game_id, publicUrl } of results) {
    try {
      const res = await fetch(publicUrl, { method: 'HEAD' })
      console.log(`  game_id=${game_id} → HTTP ${res.status} ${res.ok ? 'OK' : 'FAIL'}`)
    } catch (err) {
      console.error(`  game_id=${game_id} fetch error: ${err.message}`)
    }
  }

  // 7. Final DB verification
  console.log('\nDB verification:')
  const ids = [9260, 9261, 9262, 9263, 9264, 9265, 9266, 9267, 9268]
  const { data: rows, error: qErr } = await supabase
    .from('ego_gifts')
    .select('game_id,name,image_url')
    .in('game_id', ids)
    .order('game_id')
  if (qErr) {
    console.error('DB query error:', qErr.message)
  } else {
    for (const row of rows) {
      console.log(`  game_id=${row.game_id} ${row.name} → ${row.image_url ? 'SET' : 'NULL'}`)
    }
    const withUrl = rows.filter(r => r.image_url).length
    console.log(`\nDB rows with image_url: ${withUrl}/${rows.length}`)
  }

  if (failures.length > 0) {
    console.error('\nFailures:')
    for (const f of failures) console.error(`  game_id=${f.game_id}: ${f.error}`)
    process.exit(1)
  }
  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
