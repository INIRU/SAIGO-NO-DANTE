#!/usr/bin/env node
/**
 * generate-thumbhashes.mjs
 * Generates ThumbHash blur placeholders for all images in Supabase Storage
 * and writes them to lib/data/thumbhash-map.json.
 *
 * Usage: node --env-file=.env.local scripts/generate-thumbhashes.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { rgbaToThumbHash } from 'thumbhash'
import sharp from 'sharp'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public'
const CONCURRENCY = 10
const OUTPUT_PATH = join(ROOT, 'lib', 'data', 'thumbhash-map.json')

// ---------------------------------------------------------------------------
// Supabase client (read-only, anon key is sufficient for public storage URLs)
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey).schema('limbus')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the relative storage path from a full Supabase Storage URL.
 * e.g. "https://.../public/limbus-assets/sinners/yi-sang/..." -> "sinners/yi-sang/..."
 */
function toStoragePath(fullUrl) {
  const marker = '/limbus-assets/'
  const idx = fullUrl.indexOf(marker)
  if (idx === -1) return fullUrl
  return fullUrl.slice(idx + marker.length)
}

/** Generate a ThumbHash base64 string from an image buffer. */
async function generateThumbHash(buffer) {
  const { data, info } = await sharp(buffer)
    .resize(100, 100, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const hash = rgbaToThumbHash(info.width, info.height, data)
  return Buffer.from(hash).toString('base64')
}

/** Download an image buffer from a public URL. Returns null on failure. */
async function fetchBuffer(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`  [WARN] HTTP ${res.status} for ${url}`)
      return null
    }
    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  } catch (err) {
    console.warn(`  [WARN] Fetch failed for ${url}: ${err.message}`)
    return null
  }
}

/**
 * Process a batch of { path, url } entries with limited concurrency.
 * Returns a partial map of path -> base64 thumbhash.
 */
async function processBatch(entries, label, startIdx, total) {
  const result = {}
  let i = 0

  while (i < entries.length) {
    const chunk = entries.slice(i, i + CONCURRENCY)
    await Promise.all(
      chunk.map(async ({ path, url }, chunkIdx) => {
        const globalIdx = startIdx + i + chunkIdx
        process.stdout.write(`\r  ${label} (${globalIdx + 1}/${total})`)

        const buffer = await fetchBuffer(url)
        if (!buffer) return

        try {
          const hash = await generateThumbHash(buffer)
          result[path] = hash
        } catch (err) {
          console.warn(`\n  [WARN] ThumbHash failed for ${path}: ${err.message}`)
        }
      })
    )
    i += CONCURRENCY
  }
  process.stdout.write('\n')
  return result
}

/** Fetch all rows from a table with pagination. */
async function fetchAllRows(table, columns) {
  const PAGE_SIZE = 1000
  let rows = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw new Error(`Failed to query ${table}: ${error.message}`)
    if (!data || data.length === 0) break

    rows = rows.concat(data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return rows
}

// ---------------------------------------------------------------------------
// Per-table collectors
// ---------------------------------------------------------------------------

async function collectIdentities() {
  console.log('Fetching identities...')
  const rows = await fetchAllRows('identities', 'id, sinner_id, game_id, folder_name')

  const entries = []
  for (const row of rows) {
    if (!row.game_id || !row.folder_name) continue
    // sinner_id is already the slug (e.g. "yi-sang")
    const encoded = encodeURIComponent(row.folder_name)
    const path = `sinners/${row.sinner_id}/identities/${encoded}/${row.game_id}_normal_info.webp`
    const url = `${STORAGE_BASE}/limbus-assets/${path}`
    entries.push({ path, url })
  }

  console.log(`  ${entries.length} identity images to process`)
  return entries
}

async function collectEgo() {
  console.log('Fetching ego...')
  const rows = await fetchAllRows('ego', 'id, image_url, cor_image_url')

  const entries = []
  for (const row of rows) {
    if (row.image_url) {
      entries.push({ path: toStoragePath(row.image_url), url: row.image_url })
    }
    if (row.cor_image_url) {
      entries.push({ path: toStoragePath(row.cor_image_url), url: row.cor_image_url })
    }
  }

  console.log(`  ${entries.length} ego images to process`)
  return entries
}

async function collectEgoGifts() {
  console.log('Fetching ego_gifts...')
  const rows = await fetchAllRows('ego_gifts', 'id, image_url')

  const entries = []
  for (const row of rows) {
    if (row.image_url) {
      entries.push({ path: toStoragePath(row.image_url), url: row.image_url })
    }
  }

  console.log(`  ${entries.length} ego gift images to process`)
  return entries
}

async function collectEgoGiftThemes() {
  console.log('Fetching ego_gift_themes...')
  const rows = await fetchAllRows('ego_gift_themes', 'id, image_url, boss_image_url')

  const entries = []
  for (const row of rows) {
    if (row.image_url) {
      entries.push({ path: toStoragePath(row.image_url), url: row.image_url })
    }
    if (row.boss_image_url) {
      entries.push({ path: toStoragePath(row.boss_image_url), url: row.boss_image_url })
    }
  }

  console.log(`  ${entries.length} theme pack images to process`)
  return entries
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== generate-thumbhashes ===\n')

  // Ensure output directory exists
  const outDir = join(ROOT, 'lib', 'data')
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true })
  }

  // Load existing map so we can skip already-processed entries
  let existingMap = {}
  if (existsSync(OUTPUT_PATH)) {
    try {
      const raw = (await import('fs')).readFileSync(OUTPUT_PATH, 'utf-8')
      existingMap = JSON.parse(raw)
      console.log(`Loaded ${Object.keys(existingMap).length} existing entries from thumbhash-map.json\n`)
    } catch {
      console.warn('Could not parse existing thumbhash-map.json, starting fresh\n')
    }
  }

  // Collect all image entries from all 4 tables
  const [identityEntries, egoEntries, giftEntries, themeEntries] = await Promise.all([
    collectIdentities(),
    collectEgo(),
    collectEgoGifts(),
    collectEgoGiftThemes(),
  ])

  const allEntries = [...identityEntries, ...egoEntries, ...giftEntries, ...themeEntries]

  // Deduplicate by path
  const seen = new Set()
  const uniqueEntries = []
  for (const entry of allEntries) {
    if (!seen.has(entry.path)) {
      seen.add(entry.path)
      uniqueEntries.push(entry)
    }
  }

  // Skip entries already in the map
  const toProcess = uniqueEntries.filter(e => !(e.path in existingMap))
  const total = toProcess.length

  console.log(`\nTotal unique images: ${uniqueEntries.length}`)
  console.log(`Already processed:   ${uniqueEntries.length - total}`)
  console.log(`To process:          ${total}\n`)

  if (total === 0) {
    console.log('Nothing new to process. Saving sorted map...')
  } else {
    // Process in labelled groups for clean progress output
    const groups = [
      { label: 'Processing identities', entries: identityEntries.filter(e => !(e.path in existingMap)) },
      { label: 'Processing ego',        entries: egoEntries.filter(e => !(e.path in existingMap)) },
      { label: 'Processing ego_gifts',  entries: giftEntries.filter(e => !(e.path in existingMap)) },
      { label: 'Processing themes',     entries: themeEntries.filter(e => !(e.path in existingMap)) },
    ]

    let processed = 0
    for (const group of groups) {
      if (group.entries.length === 0) continue
      const partial = await processBatch(group.entries, group.label, processed, total)
      Object.assign(existingMap, partial)
      processed += group.entries.length

      // Save incrementally after each group so progress isn't lost on failure
      const sorted = Object.fromEntries(
        Object.keys(existingMap).sort().map(k => [k, existingMap[k]])
      )
      writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf-8')
      console.log(`  Saved intermediate map (${Object.keys(existingMap).length} entries)\n`)
    }
  }

  // Final sorted write
  const sortedFinal = Object.fromEntries(
    Object.keys(existingMap).sort().map(k => [k, existingMap[k]])
  )
  writeFileSync(OUTPUT_PATH, JSON.stringify(sortedFinal, null, 2) + '\n', 'utf-8')

  const finalCount = Object.keys(sortedFinal).length
  console.log(`Done. ${finalCount} entries written to lib/data/thumbhash-map.json`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
