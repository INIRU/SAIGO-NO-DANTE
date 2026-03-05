import { createClient } from '@supabase/supabase-js'
import { readdirSync } from 'fs'
import { join, extname, basename } from 'path'
import sharp from 'sharp'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'limbus-assets'
const WEBP_QUALITY = 85
const DL = '/Users/iniru/Downloads'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// 업로드할 파일 정의
const uploads = []

// ── 료슈 인격 이미지 ──
const RYOSHU_FOLDER = 'Lobotomy E.G.O Faint Aroma Solitude'
const RYOSHU_SRC = join(DL, 'Lobotomy E.G.O Faint Aroma & Solitude')
const RYOSHU_SKILL_SRC = join(DL, 'Lobotomy E.G.O Faint Aroma & Solitude-2')
const RYOSHU_STORAGE = `sinners/ryoshu/identities/${RYOSHU_FOLDER}`

// ── 뫼르소 인격 이미지 ──
const MEUR_FOLDER = 'Lobotomy E.G.O Hornet Alteration'
const MEUR_SRC = join(DL, 'Lobotomy E.G.O Hornet 【Alteration】')
const MEUR_SKILL_SRC = join(DL, 'Lobotomy E.G.O Hornet 【Alteration】-2')
const MEUR_STORAGE = `sinners/meursault/identities/${MEUR_FOLDER}`

// ── 싱클레어 하모니 EGO 이미지 ──
const HARMONY_SRC = join(DL, 'Harmony')
const HARMONY_STORAGE = 'sinners/sinclair/ego/Harmony'

function collectPngs(dir, storageBase) {
  const files = []
  for (const entry of readdirSync(dir)) {
    if (['.png', '.jpg', '.jpeg'].includes(extname(entry).toLowerCase())) {
      const nameNoExt = basename(entry, extname(entry))
      files.push({
        localPath: join(dir, entry),
        storagePath: `${storageBase}/${nameNoExt}.webp`,
      })
    }
  }
  return files
}

// 인격 이미지 수집
uploads.push(...collectPngs(RYOSHU_SRC, RYOSHU_STORAGE))
uploads.push(...collectPngs(MEUR_SRC, MEUR_STORAGE))

// 스킬 이미지 → icons/skills/
uploads.push(...collectPngs(RYOSHU_SKILL_SRC, 'icons/skills'))
uploads.push(...collectPngs(MEUR_SKILL_SRC, 'icons/skills'))

// EGO 이미지
uploads.push(...collectPngs(HARMONY_SRC, HARMONY_STORAGE))

console.log(`총 ${uploads.length}개 파일 업로드 예정\n`)

let done = 0
let errors = []

for (const { localPath, storagePath } of uploads) {
  try {
    const webpBuffer = await sharp(localPath)
      .webp({ quality: WEBP_QUALITY, lossless: false })
      .toBuffer()

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, webpBuffer, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (error) {
      errors.push({ storagePath, error: error.message })
      console.log(`  ✗ ${storagePath}: ${error.message}`)
    } else {
      done++
      console.log(`  ✓ ${storagePath}`)
    }
  } catch (err) {
    errors.push({ storagePath, error: String(err) })
    console.log(`  ✗ ${storagePath}: ${err}`)
  }
}

console.log(`\n완료: ${done}/${uploads.length} 성공, ${errors.length} 실패`)

// ── DB folder_name 업데이트 ──
const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'limbus',
  'Content-Profile': 'limbus',
}

// 료슈 folder_name
const r1 = await fetch(
  `${SUPABASE_URL}/rest/v1/identities?id=eq.508224a9-eb40-4a42-a49d-d2f80a96e71f`,
  { method: 'PATCH', headers: HEADERS, body: JSON.stringify({ folder_name: RYOSHU_FOLDER }) }
)
console.log(`\n료슈 folder_name → ${RYOSHU_FOLDER}: ${r1.ok ? '✓' : '✗'}`)

// 뫼르소 folder_name
const r2 = await fetch(
  `${SUPABASE_URL}/rest/v1/identities?id=eq.d095dfc3-502f-4985-8202-7e1e5b319374`,
  { method: 'PATCH', headers: HEADERS, body: JSON.stringify({ folder_name: MEUR_FOLDER }) }
)
console.log(`뫼르소 folder_name → ${MEUR_FOLDER}: ${r2.ok ? '✓' : '✗'}`)

// 하모니 EGO folder_name은 이미 Harmony로 설정됨
console.log(`하모니 folder_name → Harmony: 이미 설정됨 ✓`)
