#!/usr/bin/env node
// Upload theme pack images to Supabase Storage limbus-assets
// Usage: node --env-file=.env.local scripts/upload/theme-pack-images.mjs

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFile } from 'fs/promises'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const ITEMS = [
  {
    name: '타래 엮기 (id 1126)',
    src: '/Users/iniru/Downloads/Canto_TwiningThread.png',
    dest: 'icons/theme-packs/1126.webp',
  },
  {
    name: '뽕.황 hidden theme (id 3001)',
    src: '/Users/iniru/Documents/Limbus/limbus-archive/.worktrees/task/update-april-a095e5/hidden_theme_dl.png',
    dest: 'icons/theme-packs/HiddenTheme.webp',
  },
]

for (const [i, item] of ITEMS.entries()) {
  console.log(`[${i + 1}/${ITEMS.length}] ${item.name}`)
  const png = await readFile(item.src)
  const buffer = await sharp(png).webp({ quality: 85 }).toBuffer()
  console.log(`  converted: ${buffer.length} bytes`)

  const { error } = await supabase.storage
    .from('limbus-assets')
    .upload(item.dest, buffer, { contentType: 'image/webp', upsert: true })

  if (error) {
    console.error(`  FAILED: ${error.message}`)
    process.exit(1)
  }
  console.log(`  uploaded: ${item.dest}`)
}

console.log('Done.')
