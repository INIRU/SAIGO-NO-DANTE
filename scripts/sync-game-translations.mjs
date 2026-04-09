#!/usr/bin/env node
/**
 * sync-game-translations.mjs
 * EN/JP 게임 데이터 로케일 파일을 읽어 limbus.game_translations 테이블에 upsert
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-game-translations.mjs [--dry-run] [--lang en|ja] [--type skill|passive|keyword|buf|ego_gift]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

// ── Config ──────────────────────────────────────────
// Assets live in {repo}/../../../assets/data/Json (Text)/{EN,JP,KR}/
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
const FALLBACK_ROOT = join(ASSETS_ROOT, '..')
const BATCH_SIZE = 500

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const langFilter = args.find((_, i, a) => a[i - 1] === '--lang') ?? null
const typeFilter = args.find((_, i, a) => a[i - 1] === '--type') ?? null

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!dryRun && (!supabaseUrl || !supabaseKey)) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

// ── Helpers ─────────────────────────────────────────

/** Get locale subdir: en→EN/, ja→JP/ (files live inside these subdirs) */
function langDir(lang) {
  return lang === 'en' ? 'EN' : 'JP'
}

/** Get fallback locale dir name: en→en, ja→jp (lowercase dirs at FALLBACK_ROOT) */
function fallbackDirName(lang) {
  return lang === 'en' ? 'en' : 'jp'
}

/** Also check root (some files exist at root level, not in subdir) */
function readJson(lang, filename) {
  // 1. Try subdir first (EN/, JP/)
  const subPath = join(ASSETS_ROOT, langDir(lang), filename)
  // 2. Try Json (Text) root
  const rootPath = join(ASSETS_ROOT, filename)
  // 3. Try fallback dir: en/, jp/ (lowercase, .json extension)
  const fallbackFilename = filename.replace(/\.txt$/, '.json')
  const fallbackPath = join(FALLBACK_ROOT, fallbackDirName(lang), fallbackFilename)
  const path = existsSync(subPath) ? subPath
    : existsSync(rootPath) ? rootPath
    : existsSync(fallbackPath) ? fallbackPath
    : null
  if (!path) return null
  const raw = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '')
  try {
    return JSON.parse(raw)
  } catch (e) {
    console.warn(`  ⚠ Parse error: ${filename}`, e.message)
    return null
  }
}

function readDataList(lang, filename) {
  const json = readJson(lang, filename)
  if (!json) return []
  return json.dataList ?? json.list ?? (Array.isArray(json) ? json : [])
}

/** Glob files matching a prefix pattern in the locale subdir + fallback */
function findFiles(lang, prefix) {
  const results = []
  // Primary: Json (Text)/EN/ or JP/ (.txt files)
  const dir = join(ASSETS_ROOT, langDir(lang))
  if (existsSync(dir)) {
    results.push(...readdirSync(dir).filter(f => f.startsWith(prefix)))
  }
  // Fallback: en/ or jp/ (.json files, same prefix convention)
  const fbDir = join(FALLBACK_ROOT, fallbackDirName(lang))
  if (existsSync(fbDir)) {
    const fbFiles = readdirSync(fbDir)
      .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
      // Skip files already found in primary (same base name, different extension)
      .filter(f => {
        const txtName = f.replace(/\.json$/, '.txt')
        return !results.includes(txtName)
      })
    results.push(...fbFiles)
  }
  return [...new Set(results)].sort()
}

// ── Parsers ─────────────────────────────────────────

/** Skills: use highest uptie level (prefer level=4). Only sinner 01-12. */
function parseSkills(lang) {
  const prefix = langDir(lang)
  const valid = new Set(['01','02','03','04','05','06','07','08','09','10','11','12'])
  const files = findFiles(lang, `${prefix}_Skills_personality-`)
    .filter(f => { const m = f.match(/personality-(\d{2})\.(txt|json)$/); return m && valid.has(m[1]) })
  const rows = []
  for (const filename of files) {
    const dataList = readDataList(lang, filename)
    for (const skill of dataList) {
      if (!skill.levelList?.length) continue
      const entry = skill.levelList.find(l => l.level === 4)
        ?? skill.levelList.reduce((a, b) => a.level > b.level ? a : b)
      if (!entry.name) continue
      rows.push({
        entity_type: 'skill',
        entity_id: String(skill.id),
        lang,
        name: entry.name,
        description: entry.desc ?? null,
      })
    }
    if (dataList.length) console.log(`  ${filename}: ${dataList.length} skills`)
  }

  // Fallback: read combined Skills.json from fallback dir (en/, jp/)
  const existingIds = new Set(rows.map(r => r.entity_id))
  const fbPath = join(FALLBACK_ROOT, fallbackDirName(lang), `${langDir(lang)}_Skills.json`)
  if (existsSync(fbPath)) {
    const raw = readFileSync(fbPath, 'utf-8').replace(/^\uFEFF/, '')
    try {
      const dataList = JSON.parse(raw).dataList ?? []
      let added = 0
      for (const skill of dataList) {
        if (!skill.levelList?.length) continue
        if (existingIds.has(String(skill.id))) continue
        if (!/^1[01]\d{5}$/.test(String(skill.id))) continue
        const entry = skill.levelList.find(l => l.level === 4)
          ?? skill.levelList.reduce((a, b) => a.level > b.level ? a : b)
        if (!entry.name) continue
        rows.push({ entity_type: 'skill', entity_id: String(skill.id), lang, name: entry.name, description: entry.desc ?? null })
        added++
      }
      if (added) console.log(`  ${fbPath.split('/').pop()} (fallback): ${added} additional skills`)
    } catch (e) { console.warn(`  ⚠ Parse error: ${fbPath}`, e.message) }
  }

  return rows
}

/** Passives: auto-discover all passive files */
function parsePassives(lang) {
  const prefix = langDir(lang)
  const files = findFiles(lang, `${prefix}_Passives`)
  // Also check singular Passive files (e.g. EN_Passive_Ego.txt)
  const extraFiles = findFiles(lang, `${prefix}_Passive_`).concat(findFiles(lang, `${prefix}_Passive-`))
  const allFiles = [...new Set([...files, ...extraFiles])]
  const rows = []
  for (const filename of allFiles) {
    const dataList = readDataList(lang, filename)
    for (const p of dataList) {
      if (!p.name) continue
      rows.push({
        entity_type: 'passive',
        entity_id: String(p.id),
        lang,
        name: p.name,
        description: p.desc ?? null,
      })
    }
    if (dataList.length) console.log(`  ${filename}: ${dataList.length} passives`)
  }
  return rows
}

/** Keywords: auto-discover all BattleKeywords files */
function parseKeywords(lang) {
  const prefix = langDir(lang)
  const files = findFiles(lang, `${prefix}_BattleKeywords`)
  const rows = []
  for (const filename of files) {
    const dataList = readDataList(lang, filename)
    for (const kw of dataList) {
      if (!kw.name) continue
      rows.push({
        entity_type: 'keyword',
        entity_id: String(kw.id),
        lang,
        name: kw.name,
        description: kw.desc ?? null,
      })
    }
    if (dataList.length) console.log(`  ${filename}: ${dataList.length} keywords`)
  }
  return rows
}

/** Bufs: auto-discover all Bufs files */
function parseBufs(lang) {
  const prefix = langDir(lang)
  const files = findFiles(lang, `${prefix}_Bufs`)
  const rows = []
  for (const filename of files) {
    const dataList = readDataList(lang, filename)
    for (const buf of dataList) {
      if (!buf.name) continue
      rows.push({
        entity_type: 'buf',
        entity_id: String(buf.id),
        lang,
        name: buf.name,
        description: buf.desc ?? null,
      })
    }
    if (dataList.length) console.log(`  ${filename}: ${dataList.length} bufs`)
  }
  return rows
}

/** EGO Gifts: auto-discover all EGOgift files */
function parseEgoGifts(lang) {
  const prefix = langDir(lang)
  const files = findFiles(lang, `${prefix}_EGOgift`)
  const rows = []
  for (const filename of files) {
    const dataList = readDataList(lang, filename)
    for (const gift of dataList) {
      if (!gift.name) continue
      rows.push({
        entity_type: 'ego_gift',
        entity_id: String(gift.id),
        lang,
        name: gift.name,
        description: gift.desc ?? null,
      })
    }
    if (dataList.length) console.log(`  ${filename}: ${dataList.length} ego_gifts`)
  }
  return rows
}

// ── Main ────────────────────────────────────────────
const PARSERS = {
  skill: parseSkills,
  passive: parsePassives,
  keyword: parseKeywords,
  buf: parseBufs,
  ego_gift: parseEgoGifts,
}

async function main() {
  const langs = langFilter ? [langFilter] : ['en', 'ja']
  const types = typeFilter ? [typeFilter] : Object.keys(PARSERS)

  console.log(`\n🌐 sync-game-translations ${dryRun ? '(DRY RUN)' : ''}`)
  console.log(`   langs: ${langs.join(', ')}  |  types: ${types.join(', ')}\n`)

  let totalRows = 0

  for (const lang of langs) {
    console.log(`── ${lang.toUpperCase()} ──`)
    let allRows = []

    for (const type of types) {
      const parser = PARSERS[type]
      if (!parser) { console.warn(`  Unknown type: ${type}`); continue }
      const rows = parser(lang)
      allRows.push(...rows)
    }

    // Deduplicate by (entity_type, entity_id, lang)
    const seen = new Set()
    allRows = allRows.filter(r => {
      const key = `${r.entity_type}:${r.entity_id}:${r.lang}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(`  → ${allRows.length} rows total\n`)
    totalRows += allRows.length

    if (dryRun) {
      // Print first 10 rows as sample
      for (const row of allRows.slice(0, 10)) {
        console.log(`  [${row.entity_type}] ${row.entity_id} → ${row.name}`)
      }
      if (allRows.length > 10) console.log(`  ... and ${allRows.length - 10} more\n`)
      continue
    }

    // Upsert in batches
    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
      const batch = allRows.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .schema('limbus')
        .from('game_translations')
        .upsert(batch, { onConflict: 'entity_type,entity_id,lang' })

      if (error) {
        console.error(`  ✗ Batch ${i}-${i + batch.length} failed:`, error.message)
      } else {
        console.log(`  ✓ Batch ${i}-${i + batch.length} upserted`)
      }
    }
  }

  console.log(`\n✅ Done. ${totalRows} rows ${dryRun ? 'would be' : ''} synced.`)
}

main().catch(e => { console.error(e); process.exit(1) })
