import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY
const BUCKET = 'limbus-assets'
const SOURCE_DIR = '/Users/iniru/Desktop/skill-frames'
const CONCURRENCY = 6

// 업로드 대상 폴더 → Storage 경로
const FOLDERS = {
  outer:  'icons/skill-frames/outer',
  inner:  'icons/skill-frames/inner',
  extras: 'icons/skill-frames/extras',
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ .env.local에서 SUPABASE URL/KEY를 설정해주세요.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  const files = []
  for (const [folder, storagePath] of Object.entries(FOLDERS)) {
    const dir = join(SOURCE_DIR, folder)
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.webp')) continue
      files.push({
        localPath: join(dir, file),
        storagePath: `${storagePath}/${file}`,
      })
    }
  }

  console.log(`📁 총 ${files.length}개 스킬 프레임 업로드 시작\n`)

  let done = 0
  const errors = []

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async ({ localPath, storagePath }) => {
      try {
        const buffer = readFileSync(localPath)
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, buffer, {
            contentType: 'image/webp',
            upsert: true,
          })
        if (error) {
          errors.push({ storagePath, error: error.message })
        } else {
          done++
        }
      } catch (err) {
        errors.push({ storagePath, error: String(err) })
      }
      process.stdout.write(`\r  진행: ${done + errors.length}/${files.length} (성공 ${done} / 실패 ${errors.length})   `)
    }))
  }

  console.log(`\n\n✅ 완료: ${done}/${files.length}개 업로드`)
  if (errors.length > 0) {
    console.log(`⚠️  실패 ${errors.length}개:`)
    errors.forEach(e => console.log(`   - ${e.storagePath}: ${e.error}`))
  }
}

main().catch(console.error)
