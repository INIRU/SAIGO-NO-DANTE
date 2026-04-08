#!/usr/bin/env node
/**
 * 수감자 넘버 이미지를 Supabase Storage에 업로드
 * PNG → webp 변환 후 sinners/{sinner-id}/number.webp 에 업로드
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
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

const ASSETS_BASE = '/Users/iniru/Documents/Limbus/assets/Sinner Intros'

const SINNER_MAP = {
  'Yi Sang':      { id: 'yi-sang',     num: '01' },
  'Faust':        { id: 'faust',       num: '02' },
  'Don Quixote':  { id: 'don-quixote', num: '03' },
  'Ryoshu':       { id: 'ryoshu',      num: '04' },
  'Meursault':    { id: 'meursault',   num: '05' },
  'Hong Lu':      { id: 'hong-lu',     num: '06' },
  'Heathcliff':   { id: 'heathcliff',  num: '07' },
  'Ishmael':      { id: 'ishmael',     num: '08' },
  'Rodion':       { id: 'rodion',      num: '09' },
  'Sinclair':     { id: 'sinclair',    num: '11' },
  'Outis':        { id: 'outis',       num: '12' },
  'Gregor':       { id: 'gregor',      num: '13' },
}

async function uploadToStorage(storagePath, buffer) {
  const res = await fetch(`${STORAGE_API}/object/limbus-assets/${storagePath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
    },
    body: buffer,
  })
  return res.ok
}

async function main() {
  console.log('=== 수감자 넘버 이미지 업로드 ===\n')

  let uploaded = 0, errors = 0

  for (const [dirName, { id, num }] of Object.entries(SINNER_MAP)) {
    const pngPath = join(ASSETS_BASE, dirName, `${num}_number.png`)
    const storagePath = `sinners/${id}/number.webp`

    try {
      const webpBuffer = await sharp(pngPath).webp({ quality: 90 }).toBuffer()
      const ok = await uploadToStorage(storagePath, webpBuffer)
      if (ok) {
        console.log(`  ✓ ${id} (${num}_number.png → ${storagePath})`)
        uploaded++
      } else {
        console.error(`  ✗ ${id}: 업로드 실패`)
        errors++
      }
    } catch (err) {
      console.error(`  ✗ ${id}: ${err.message}`)
      errors++
    }
  }

  console.log(`\n결과: 업로드 ${uploaded}, 오류 ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
