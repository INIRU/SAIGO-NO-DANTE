#!/usr/bin/env node
/**
 * 스토리 CG 이미지 → WebP 변환 + Supabase Storage 업로드
 * 기존 PNG 삭제 후 WebP로 교체
 *
 * Usage: node --env-file=.env.local scripts/upload/story-cg-webp.mjs --chapter prologue
 *        node --env-file=.env.local scripts/upload/story-cg-webp.mjs --all
 */
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'limbus-assets'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const CHAPTERS = {
  prologue: { dir: 'Prologue', storagePath: 'story/prologue/cg' },
  'canto-1': { dir: 'Canto I', storagePath: 'story/canto-1/cg' },
  'canto-2': { dir: 'Canto II', storagePath: 'story/canto-2/cg' },
}

async function processChapter(chapterId) {
  const config = CHAPTERS[chapterId]
  if (!config) {
    console.error(`Unknown chapter: ${chapterId}`)
    return
  }

  const srcDir = path.join(process.env.HOME, 'Downloads', config.dir)
  const files = (await readdir(srcDir)).filter((f) =>
    /\.(png|jpg|jpeg)$/i.test(f),
  )

  console.log(`\n[${chapterId}] ${files.length} images in ${srcDir}`)

  // 1. 기존 PNG 파일 목록 가져오기
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .list(config.storagePath, { limit: 500 })

  const oldPngs = (existing || []).filter((f) => f.name.endsWith('.png'))
  if (oldPngs.length > 0) {
    console.log(`  Deleting ${oldPngs.length} old PNG files...`)
    const paths = oldPngs.map((f) => `${config.storagePath}/${f.name}`)
    const { error } = await supabase.storage.from(BUCKET).remove(paths)
    if (error) console.log(`  ⚠ Delete error: ${error.message}`)
    else console.log(`  ✓ Deleted ${oldPngs.length} PNGs`)
  }

  // 2. WebP 변환 + 업로드
  let ok = 0
  let fail = 0
  for (const file of files) {
    const srcPath = path.join(srcDir, file)
    const webpName = file.replace(/\.(png|jpg|jpeg)$/i, '.webp')
    const storagePath = `${config.storagePath}/${webpName}`

    try {
      const buf = await readFile(srcPath)
      const webpBuf = await sharp(buf).webp({ quality: 85 }).toBuffer()

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, webpBuf, {
          contentType: 'image/webp',
          upsert: true,
        })

      if (error) {
        console.log(`  ✗ ${webpName}: ${error.message}`)
        fail++
      } else {
        const savings = Math.round((1 - webpBuf.length / buf.length) * 100)
        ok++
        if (ok % 10 === 0) process.stdout.write(`  ${ok}/${files.length}...\n`)
      }
    } catch (err) {
      console.log(`  ✗ ${file}: ${err.message}`)
      fail++
    }
  }

  console.log(`  → ${ok} uploaded, ${fail} failed`)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--all')) {
    for (const id of Object.keys(CHAPTERS)) {
      await processChapter(id)
    }
  } else if (args.includes('--chapter')) {
    const idx = args.indexOf('--chapter')
    await processChapter(args[idx + 1])
  } else {
    console.log('Usage:')
    console.log('  node --env-file=.env.local scripts/upload/story-cg-webp.mjs --chapter canto-1')
    console.log('  node --env-file=.env.local scripts/upload/story-cg-webp.mjs --all')
    console.log(`\nAvailable: ${Object.keys(CHAPTERS).join(', ')}`)
  }
}

main().catch(console.error)
