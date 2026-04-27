#!/usr/bin/env node
/**
 * 프롤로그 CG 이미지 → Supabase Storage 업로드
 *
 * Usage: node --env-file=.env.local scripts/upload/story-cg.mjs
 */
import { readFile, readdir } from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const CG_DIR = path.join(process.env.HOME, 'Downloads', '프롤로그', 'cg')
const BUCKET = 'limbus-assets'
const STORAGE_PREFIX = 'story/prologue/cg'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
)

async function main() {
  const files = (await readdir(CG_DIR)).filter((f) => f.endsWith('.png'))
  console.log(`Found ${files.length} CG images in ${CG_DIR}\n`)

  let uploaded = 0
  let failed = 0

  for (const file of files) {
    const storagePath = `${STORAGE_PREFIX}/${file}`
    const buffer = await readFile(path.join(CG_DIR, file))

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (error) {
      console.log(`  ✗ ${file}: ${error.message}`)
      failed++
    } else {
      console.log(`  ✓ ${file}`)
      uploaded++
    }
  }

  console.log(`\nDone! ${uploaded} uploaded, ${failed} failed`)
}

main().catch(console.error)
