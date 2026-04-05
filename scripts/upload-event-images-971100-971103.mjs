/**
 * Upload 4 event images from Desktop to Supabase Storage and update DB image_url.
 * Events: 971100, 971101, 971102, 971103
 *
 * Run: node --env-file=.env.local scripts/upload-event-images-971100-971103.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { homedir } from 'os'

const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'
const BUCKET = 'limbus-assets'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const FILES = [
  { localPath: '~/Desktop/홍염살 이벤트.webp',  eventId: 971100 },
  { localPath: '~/Desktop/초롱 이벤트 .webp',   eventId: 971101 },
  { localPath: '~/Desktop/충격지네 이벤트.webp', eventId: 971102 },
  { localPath: '~/Desktop/사원증 이벤트.webp',   eventId: 971103 },
]

const total = FILES.length

for (let i = 0; i < total; i++) {
  const { localPath, eventId } = FILES[i]
  const absPath = resolve(localPath.replace('~', homedir()))
  const storagePath = `icons/events/${eventId}.webp`
  const imageUrl = `${STORAGE_BASE}/${storagePath}`

  console.log(`[${i + 1}/${total}] event ${eventId} — uploading ${storagePath}`)

  // Read file
  let buffer
  try {
    buffer = readFileSync(absPath)
  } catch (err) {
    console.error(`  ERROR reading file: ${absPath}`, err.message)
    continue
  }

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'image/webp', upsert: true })

  if (uploadError) {
    console.error(`  ERROR uploading to storage:`, uploadError.message)
    // Retry once
    const { error: retryError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: 'image/webp', upsert: true })
    if (retryError) {
      console.error(`  RETRY FAILED — skipping:`, retryError.message)
      continue
    }
    console.log(`  Retry succeeded.`)
  }

  console.log(`  Uploaded OK → ${imageUrl}`)

  // Update DB image_url
  const { error: dbError } = await supabase
    .schema('limbus')
    .from('mirror_dungeon_events')
    .update({ image_url: imageUrl })
    .eq('id', eventId)

  if (dbError) {
    console.error(`  ERROR updating DB for event ${eventId}:`, dbError.message)
    continue
  }

  console.log(`  DB updated OK`)
}

console.log('\nDone.')
