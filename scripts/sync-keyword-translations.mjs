#!/usr/bin/env node
/**
 * sync-keyword-translations.mjs
 * KR BattleKeywords 파일로 game_id를 매핑하고,
 * game_translations 테이블에서 EN/JP 번역을 가져와
 * keyword_meta.name_en, name_jp, description_en, description_jp 컬럼을 채움
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-keyword-translations.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

// ── Config ──────────────────────────────────────────
function findAssetsRoot() {
  if (process.env.GAME_ASSETS_DIR) return process.env.GAME_ASSETS_DIR
  let dir = import.meta.dirname
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, 'assets', 'data', 'Json (Text)')
    if (existsSync(candidate)) return candidate
    dir = join(dir, '..')
  }
  throw new Error('Could not find assets/data/Json (Text) directory')
}

const ASSETS_ROOT = findAssetsRoot()
const BATCH_SIZE = 100

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY
if (!dryRun && (!supabaseUrl || !supabaseKey)) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY')
  process.exit(1)
}
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

// ── Step 1: Read all KR BattleKeywords files → build KR name → game_id map ──

function buildKrNameToGameIdMap() {
  const krDir = join(ASSETS_ROOT, 'KR')
  if (!existsSync(krDir)) {
    throw new Error(`KR directory not found: ${krDir}`)
  }

  // Latest first (kr/) → then old (Json (Text)/KR/)
  const files = []
  const fbDir = join(ASSETS_ROOT, '..', 'kr')
  if (existsSync(fbDir)) {
    const fbFiles = readdirSync(fbDir)
      .filter(f => (f.startsWith('KR_BattleKeywords') || f.startsWith('KR_Bufs')) && f.endsWith('.json'))
      .sort()
    files.push(...fbFiles.map(f => `__fb__${f}`))
  }
  const oldFiles = readdirSync(krDir)
    .filter(f => f.startsWith('KR_BattleKeywords') || f.startsWith('KR_Bufs'))
    .sort()
  files.push(...oldFiles)

  console.log(`\nFound ${files.length} KR keyword/buf files`)

  // Map: KR name → Set of candidate game IDs (same name can have multiple IDs)
  const nameToCandidates = new Map()

  for (const rawFilename of files) {
    const isFallback = rawFilename.startsWith('__fb__')
    const filename = isFallback ? rawFilename.slice(6) : rawFilename
    const filepath = isFallback ? join(ASSETS_ROOT, '..', 'kr', filename) : join(krDir, filename)
    const raw = readFileSync(filepath, 'utf-8').replace(/^\uFEFF/, '')
    let json
    try {
      json = JSON.parse(raw)
    } catch (e) {
      console.warn(`  ⚠ Parse error: ${filename}`, e.message)
      continue
    }

    const dataList = json.dataList ?? json.list ?? (Array.isArray(json) ? json : [])
    let count = 0
    for (const entry of dataList) {
      if (!entry.id || !entry.name) continue
      const normalizedName = entry.name.normalize('NFC')
      if (!nameToCandidates.has(normalizedName)) nameToCandidates.set(normalizedName, new Set())
      nameToCandidates.get(normalizedName).add(String(entry.id))
      count++
    }
    if (count > 0) console.log(`  ${filename}: ${count} keywords`)
  }

  console.log(`  → ${nameToCandidates.size} unique KR names\n`)
  return { nameToCandidates }
}

// ── Step 2-5: Fetch translations and update keyword_meta ──

async function main() {
  console.log(`\n🔑 sync-keyword-translations ${dryRun ? '(DRY RUN)' : ''}`)

  // Step 1: Build KR name → candidate game_ids map
  const { nameToCandidates } = buildKrNameToGameIdMap()

  // Step 2: Fetch all keyword_meta rows (paginated, Supabase max 1000/page)
  console.log('Fetching keyword_meta rows...')
  const keywordRows = []
  let kwFrom = 0
  while (true) {
    const { data, error } = await supabase
      .schema('limbus').from('keyword_meta').select('name')
      .range(kwFrom, kwFrom + 999).order('name')
    if (error) { console.error('Failed to fetch keyword_meta:', error.message); process.exit(1) }
    if (!data || data.length === 0) break
    keywordRows.push(...data)
    if (data.length < 1000) break
    kwFrom += 1000
  }
  console.log(`  → ${keywordRows.length} keyword_meta rows\n`)

  // Step 3: Fetch game_translations for keywords (EN and JP)
  console.log('Fetching game_translations for keywords...')

  // EN translations (keyword + buf)
  async function fetchAll(entityType, lang) {
    const rows = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .schema('limbus').from('game_translations').select('entity_id, name, description')
        .eq('entity_type', entityType).eq('lang', lang).range(from, from + 999)
      if (error) { console.error(`Failed to fetch ${lang}/${entityType}:`, error.message); process.exit(1) }
      if (!data || data.length === 0) break
      rows.push(...data)
      if (data.length < 1000) break
      from += 1000
    }
    return rows
  }

  const enRows = [...await fetchAll('keyword', 'en'), ...await fetchAll('buf', 'en')]
  const jpRows = [...await fetchAll('keyword', 'ja'), ...await fetchAll('buf', 'ja')]

  console.log(`  → EN: ${enRows.length} rows, JP: ${jpRows.length} rows\n`)

  // Step 4: Build game_id → translation maps
  const enMap = new Map() // game_id → { name, description }
  for (const row of enRows) {
    enMap.set(row.entity_id, { name: row.name, description: row.description })
  }

  const jpMap = new Map() // game_id → { name, description }
  for (const row of jpRows) {
    jpMap.set(row.entity_id, { name: row.name, description: row.description })
  }

  // Step 5: Build updates for each keyword_meta row
  const updates = []
  let noMapping = 0
  let noTranslation = 0

  for (const kw of keywordRows) {
    const krName = kw.name
    const candidates = nameToCandidates.get(krName.normalize('NFC'))

    if (!candidates || candidates.size === 0) {
      noMapping++
      continue
    }

    // Pick the candidate game_id that has EN or JP translation (prefer EN+JP both)
    let bestEn = null, bestJp = null
    for (const gid of candidates) {
      const en = enMap.get(gid)
      const jp = jpMap.get(gid)
      if (en && jp) { bestEn = en; bestJp = jp; break }
      if (en && !bestEn) bestEn = en
      if (jp && !bestJp) bestJp = jp
    }

    const en = bestEn
    const jp = bestJp

    if (!en && !jp) {
      noTranslation++
      continue
    }

    const update = { name: krName }
    if (en?.name) update.name_en = en.name
    if (en?.description) update.description_en = en.description
    if (jp?.name) update.name_jp = jp.name
    if (jp?.description) update.description_jp = jp.description

    // Only include if there's at least one translation field
    if (update.name_en || update.description_en || update.name_jp || update.description_jp) {
      updates.push(update)
    }
  }

  console.log(`Updates prepared: ${updates.length}`)
  console.log(`  No KR→game_id mapping: ${noMapping}`)
  console.log(`  No EN/JP translation found: ${noTranslation}\n`)

  if (dryRun) {
    // Print first 15 as sample
    console.log('── Sample updates ──')
    for (const u of updates.slice(0, 15)) {
      console.log(`  [${u.name}] → EN: ${u.name_en ?? '(none)'} | JP: ${u.name_jp ?? '(none)'}`)
    }
    if (updates.length > 15) console.log(`  ... and ${updates.length - 15} more\n`)
    console.log(`✅ Dry run complete. ${updates.length} rows would be updated.`)
    return
  }

  // Step 6: Batch update keyword_meta
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)

    const { error } = await supabase
      .schema('limbus')
      .from('keyword_meta')
      .upsert(batch, { onConflict: 'name' })

    if (error) {
      console.error(`  ✗ Batch ${i + 1}-${i + batch.length} failed:`, error.message)
      errorCount += batch.length
    } else {
      console.log(`  ✓ Batch ${i + 1}-${i + batch.length} updated`)
      successCount += batch.length
    }
  }

  console.log(`\n✅ Done. ${successCount} rows updated, ${errorCount} errors.`)
}

main().catch(e => { console.error(e); process.exit(1) })
