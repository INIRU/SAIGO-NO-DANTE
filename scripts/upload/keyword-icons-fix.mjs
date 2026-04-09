/**
 * keyword-icons-fix.mjs
 *
 * Correctly maps keyword icons using the chain:
 *   keyword_meta.name (KR) → game_id (KR data) → EN name (EN data) → General/ file → upload as icon_slug.webp
 *
 * Usage:
 *   node --env-file=.env.local scripts/upload/keyword-icons-fix.mjs --dry-run
 *   node --env-file=.env.local scripts/upload/keyword-icons-fix.mjs
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, basename } from 'path'

// ── Config ──────────────────────────────────────────────────────────────────
const ASSETS = '/Users/iniru/Documents/Limbus/assets/data'
const GENERAL = '/Users/iniru/Downloads/General'
const BUCKET = 'limbus-assets'
const ICON_PREFIX = 'icons/keywords'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Helpers ─────────────────────────────────────────────────────────────────

const CHAR_MAP = {
  'α': 'alpha', 'β': 'beta', 'γ': 'gamma',
  'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u',
  'æ': 'ae', 'œ': 'oe', 'ñ': 'n',
}

function slugify(name) {
  let s = name.toLowerCase()
  for (const [from, to] of Object.entries(CHAR_MAP)) {
    s = s.replaceAll(from, to)
  }
  return s
    .replace(/[\[\]【】()（）!?'",.:;\/\\]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

/** Read a JSON file, stripping BOM if present */
function readJson(filepath) {
  try {
    const raw = readFileSync(filepath, 'utf-8').replace(/^\uFEFF/, '')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Extract dataList from a game data file */
function extractDataList(filepath) {
  const data = readJson(filepath)
  if (!data) return []
  if (data.dataList) return data.dataList
  if (Array.isArray(data)) return data
  return []
}

/** Recursively find all PNGs under a directory */
function findPngs(dir) {
  const results = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findPngs(fullPath))
    } else if (entry.name.toLowerCase().endsWith('.png')) {
      results.push({ fullPath, filename: entry.name })
    }
  }
  return results
}

/** List files matching a pattern in a directory */
function listFiles(dir, prefix, suffix) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.startsWith(prefix) && f.endsWith(suffix))
    .sort()
}

// ── Step 1: Build game_id → KR name maps ────────────────────────────────────

console.log('=== Step 1: Loading KR game data ===')

const gameIdToKr = new Map()   // game_id → KR name (first wins = latest)
const krToGameIds = new Map()  // NFC(KR name) → Set<game_id>

function addKrEntry(id, name) {
  const nfcName = name.normalize('NFC')
  if (!gameIdToKr.has(id)) {
    gameIdToKr.set(id, nfcName)
  }
  if (!krToGameIds.has(nfcName)) {
    krToGameIds.set(nfcName, new Set())
  }
  krToGameIds.get(nfcName).add(id)
}

// Read kr/ JSON files first (latest data)
const krJsonDir = join(ASSETS, 'kr')
for (const prefix of ['KR_BattleKeywords', 'KR_Bufs']) {
  const files = listFiles(krJsonDir, prefix, '.json').reverse() // newest first by name sort reversed
  for (const f of files) {
    const items = extractDataList(join(krJsonDir, f))
    for (const item of items) {
      if (item.id && item.name) addKrEntry(item.id, item.name)
    }
  }
}

// Then read Json (Text)/KR/ txt files as fallback
const krTxtDir = join(ASSETS, 'Json (Text)', 'KR')
for (const prefix of ['KR_BattleKeywords', 'KR_Bufs']) {
  const files = listFiles(krTxtDir, prefix, '.txt').reverse()
  for (const f of files) {
    const items = extractDataList(join(krTxtDir, f))
    for (const item of items) {
      if (item.id && item.name) addKrEntry(item.id, item.name)
    }
  }
}

console.log(`  KR: ${gameIdToKr.size} game_ids, ${krToGameIds.size} unique KR names`)

// ── Step 2: Build game_id → EN name map ─────────────────────────────────────

console.log('=== Step 2: Loading EN game data ===')

const gameIdToEn = new Map()  // game_id → EN name (first wins)

function addEnEntry(id, name) {
  if (!gameIdToEn.has(id)) {
    gameIdToEn.set(id, name)
  }
}

// Read en/ JSON files first (latest data)
const enJsonDir = join(ASSETS, 'en')
for (const prefix of ['EN_BattleKeywords', 'EN_Bufs']) {
  const files = listFiles(enJsonDir, prefix, '.json').reverse()
  for (const f of files) {
    const items = extractDataList(join(enJsonDir, f))
    for (const item of items) {
      if (item.id && item.name) addEnEntry(item.id, item.name)
    }
  }
}

// Then read Json (Text)/EN/ txt files as fallback
const enTxtDir = join(ASSETS, 'Json (Text)', 'EN')
for (const prefix of ['EN_BattleKeywords', 'EN_Bufs']) {
  const files = listFiles(enTxtDir, prefix, '.txt').reverse()
  for (const f of files) {
    const items = extractDataList(join(enTxtDir, f))
    for (const item of items) {
      if (item.id && item.name) addEnEntry(item.id, item.name)
    }
  }
}

console.log(`  EN: ${gameIdToEn.size} game_ids loaded`)

// ── Step 3: Build General/ file index ────────────────────────────────────────

console.log('=== Step 3: Indexing General/ folder ===')

const enNameToFile = new Map()  // lowercase EN display name → filepath
const gameIdToFile = new Map()  // game_id → filepath (some files use game_id as filename)

const pngs = findPngs(GENERAL)
for (const { fullPath, filename } of pngs) {
  const nameNoExt = filename.replace(/\.png$/i, '')
  // Index by display name (case-insensitive)
  const lower = nameNoExt.toLowerCase()
  if (!enNameToFile.has(lower)) {
    enNameToFile.set(lower, { fullPath, displayName: nameNoExt })
  }
  // Also index by potential game_id (no spaces/special chars in game_id)
  if (!gameIdToFile.has(nameNoExt)) {
    gameIdToFile.set(nameNoExt, { fullPath, displayName: nameNoExt })
  }
}

console.log(`  General/: ${pngs.length} PNG files indexed`)

// ── Step 4: Fetch keyword_meta from DB (paginated) ───────────────────────────

console.log('=== Step 4: Fetching keyword_meta from DB ===')

async function fetchAllKeywordMeta() {
  const all = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .schema('limbus')
      .from('keyword_meta')
      .select('name, icon_slug, name_en')
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`DB error: ${error.message}`)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

// ── Step 5: Map keywords to files & upload ──────────────────────────────────

async function main() {
  const keywords = await fetchAllKeywordMeta()
  console.log(`  Fetched ${keywords.length} keyword_meta rows`)

  const matched = []
  const unmatched = []

  for (const kw of keywords) {
    const krName = kw.name.normalize('NFC')
    const candidateGameIds = krToGameIds.get(krName)

    if (!candidateGameIds || candidateGameIds.size === 0) {
      unmatched.push({ name: krName, reason: 'no game_id for KR name' })
      continue
    }

    let found = null

    for (const gameId of candidateGameIds) {
      const enName = gameIdToEn.get(gameId)
      if (!enName) continue

      // Try matching EN name to General/ file (case-insensitive)
      const fileEntry = enNameToFile.get(enName.toLowerCase())
      if (fileEntry) {
        found = { gameId, enName, filePath: fileEntry.fullPath, displayName: fileEntry.displayName }
        break
      }

      // Try matching game_id directly to General/ file
      const gameIdEntry = gameIdToFile.get(gameId)
      if (gameIdEntry) {
        found = { gameId, enName, filePath: gameIdEntry.fullPath, displayName: gameIdEntry.displayName }
        break
      }
    }

    if (!found) {
      // Collect all EN names tried for debugging
      const tried = [...candidateGameIds].map(gid => `${gid}→${gameIdToEn.get(gid) || '?'}`).join(', ')
      unmatched.push({ name: krName, reason: `no General/ file (tried: ${tried})` })
      continue
    }

    const newIconSlug = slugify(found.enName)
    matched.push({
      krName,
      gameId: found.gameId,
      enName: found.enName,
      filePath: found.filePath,
      oldSlug: kw.icon_slug,
      newSlug: newIconSlug,
      changed: kw.icon_slug !== newIconSlug,
    })
  }

  // ── Stats ──
  console.log('\n=== Mapping Results ===')
  console.log(`  Matched: ${matched.length}`)
  console.log(`  Unmatched: ${unmatched.length}`)
  console.log(`  Slug changed: ${matched.filter(m => m.changed).length}`)
  console.log(`  Slug unchanged: ${matched.filter(m => !m.changed).length}`)

  if (DRY_RUN) {
    console.log('\n=== Dry Run — Changed mappings (sample) ===')
    const changed = matched.filter(m => m.changed)
    for (const m of changed.slice(0, 30)) {
      console.log(`  ${m.krName} → ${m.enName} (${m.gameId}) | ${m.oldSlug} → ${m.newSlug}`)
    }
    if (changed.length > 30) console.log(`  ... and ${changed.length - 30} more`)

    console.log('\n=== Dry Run — Unchanged (sample) ===')
    const unchanged = matched.filter(m => !m.changed)
    for (const m of unchanged.slice(0, 10)) {
      console.log(`  ${m.krName} → ${m.enName} | slug: ${m.newSlug}`)
    }
    if (unchanged.length > 10) console.log(`  ... and ${unchanged.length - 10} more`)

    console.log('\n=== Dry Run — Unmatched (sample) ===')
    for (const u of unmatched.slice(0, 20)) {
      console.log(`  ${u.name}: ${u.reason}`)
    }
    if (unmatched.length > 20) console.log(`  ... and ${unmatched.length - 20} more`)

    console.log('\n=== Summary ===')
    console.log(`  Total keywords: ${keywords.length}`)
    console.log(`  Would upload: ${matched.length} icons`)
    console.log(`  Would update slug: ${matched.filter(m => m.changed).length} rows`)
    console.log(`  Unmatched: ${unmatched.length}`)
    return
  }

  // ── Upload + update DB ──
  console.log('\n=== Uploading icons ===')

  let uploaded = 0
  let dbUpdated = 0
  let errors = 0
  const BATCH_SIZE = 10

  for (let i = 0; i < matched.length; i += BATCH_SIZE) {
    const batch = matched.slice(i, i + BATCH_SIZE)
    const promises = batch.map(async (m) => {
      try {
        // Convert PNG to webp
        const pngBuffer = readFileSync(m.filePath)
        const webpBuffer = await sharp(pngBuffer)
          .webp({ quality: 85 })
          .toBuffer()

        // Upload to Storage
        const storagePath = `${ICON_PREFIX}/${m.newSlug}.webp`
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, webpBuffer, {
            contentType: 'image/webp',
            upsert: true,
          })

        if (uploadError) {
          console.error(`  Upload failed: ${m.newSlug} — ${uploadError.message}`)
          errors++
          return
        }
        uploaded++

        // Update icon_slug in DB if changed
        if (m.changed) {
          const { error: dbError } = await supabase
            .schema('limbus')
            .from('keyword_meta')
            .update({ icon_slug: m.newSlug })
            .eq('name', m.krName)

          if (dbError) {
            console.error(`  DB update failed: ${m.krName} — ${dbError.message}`)
            errors++
            return
          }
          dbUpdated++
        }
      } catch (err) {
        console.error(`  Error processing ${m.krName}: ${err.message}`)
        errors++
      }
    })
    await Promise.all(promises)

    // Progress
    const progress = Math.min(i + BATCH_SIZE, matched.length)
    if (progress % 50 === 0 || progress === matched.length) {
      console.log(`  Progress: ${progress}/${matched.length} (uploaded: ${uploaded}, db: ${dbUpdated}, errors: ${errors})`)
    }
  }

  console.log('\n=== Done ===')
  console.log(`  Uploaded: ${uploaded}`)
  console.log(`  DB slug updated: ${dbUpdated}`)
  console.log(`  Errors: ${errors}`)
  console.log(`  Unmatched: ${unmatched.length}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
