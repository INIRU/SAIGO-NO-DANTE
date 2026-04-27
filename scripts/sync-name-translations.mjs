#!/usr/bin/env node
/**
 * sync-name-translations.mjs
 * JP 인격/EGO/수감자 이름을 DB identities.name_jp, ego.name_jp, sinners.name_jp에 채움
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-name-translations.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// ── Assets dir ──
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

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY
if (!dryRun && (!supabaseUrl || !supabaseKey)) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY'); process.exit(1)
}
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

function readDataList(langDir, filename) {
  const path = join(ASSETS_ROOT, langDir, filename)
  if (!existsSync(path)) { console.warn(`  ⚠ Not found: ${langDir}/${filename}`); return [] }
  const raw = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '')
  const json = JSON.parse(raw)
  return json.dataList ?? json.list ?? (Array.isArray(json) ? json : [])
}

async function main() {
  console.log(`\n🌐 sync-name-translations ${dryRun ? '(DRY RUN)' : ''}\n`)

  // ── 1. EN/JP Personality names → identities.name_en, name_jp ──
  console.log('── EN Personality names ──')
  const enPersonalities = readDataList('EN', 'EN_Personalities.txt')
  console.log(`  EN_Personalities.txt: ${enPersonalities.length} entries`)

  const enNameMap = new Map()
  for (const p of enPersonalities) {
    const title = (p.title ?? '').replace(/\n/g, ' ').trim()
    enNameMap.set(String(p.id), title)
  }

  console.log('── JP Personality names ──')
  const jpPersonalities = readDataList('JP', 'JP_Personalities.txt')
  console.log(`  JP_Personalities.txt: ${jpPersonalities.length} entries`)

  const jpNameMap = new Map()
  for (const p of jpPersonalities) {
    const title = (p.title ?? '').replace(/\n/g, ' ').trim()
    jpNameMap.set(String(p.id), title)
  }

  // Get all identities from DB and update both name_en and name_jp
  if (!dryRun) {
    const { data: identities, error } = await supabase
      .schema('limbus')
      .from('identities')
      .select('id, game_id, name_en, name_jp')

    if (error) { console.error('  ✗ identities fetch failed:', error.message); return }

    let enUpdated = 0, jpUpdated = 0
    for (const ident of identities ?? []) {
      if (!ident.game_id) continue
      const updates = {}
      const enTitle = enNameMap.get(ident.game_id)
      const jpTitle = jpNameMap.get(ident.game_id)
      if (enTitle && ident.name_en !== enTitle) updates.name_en = enTitle
      if (jpTitle && ident.name_jp !== jpTitle) updates.name_jp = jpTitle
      if (Object.keys(updates).length === 0) continue

      const { error: upErr } = await supabase
        .schema('limbus')
        .from('identities')
        .update(updates)
        .eq('id', ident.id)

      if (upErr) console.error(`  ✗ ${ident.game_id}: ${upErr.message}`)
      else { if (updates.name_en) enUpdated++; if (updates.name_jp) jpUpdated++ }
    }
    console.log(`  ✓ ${enUpdated} identities updated with name_en`)
    console.log(`  ✓ ${jpUpdated} identities updated with name_jp`)
  } else {
    let i = 0
    for (const [id, title] of enNameMap) {
      if (i++ >= 5) break
      console.log(`  EN ${id} → ${title}`)
    }
    for (const [id, title] of jpNameMap) {
      if (i++ >= 10) break
      console.log(`  JP ${id} → ${title}`)
    }
    console.log(`  ... EN ${enNameMap.size}, JP ${jpNameMap.size} personality names`)
  }

  // ── 2. JP Sinner names ──
  console.log('\n── JP Sinner names ──')
  const SINNER_JP = {
    'yi-sang': 'イサン',
    'faust': 'ファウスト',
    'don-quixote': 'ドンキホーテ',
    'ryoshu': 'リョウシュウ',
    'meursault': 'ムルソー',
    'hong-lu': 'ホンルー',
    'heathcliff': 'ヒースクリフ',
    'ishmael': 'イシュマエル',
    'rodion': 'ロージャ',
    'sinclair': 'シンクレア',
    'outis': 'オーティス',
    'gregor': 'グレゴール',
  }

  if (!dryRun) {
    let updated = 0
    for (const [id, jpName] of Object.entries(SINNER_JP)) {
      const { error } = await supabase
        .schema('limbus')
        .from('sinners')
        .update({ name_jp: jpName })
        .eq('id', id)

      if (error) console.error(`  ✗ ${id}: ${error.message}`)
      else updated++
    }
    console.log(`  ✓ ${updated} sinners updated with name_jp`)
  } else {
    for (const [id, name] of Object.entries(SINNER_JP)) {
      console.log(`  ${id} → ${name}`)
    }
  }

  // ── 3. EN/JP EGO names → ego.name_en, ego.name_jp ──
  console.log('\n── EN/JP EGO names ──')
  const enEgos = readDataList('EN', 'EN_Egos.txt')
  const jpEgos = readDataList('JP', 'JP_Egos.txt')
  console.log(`  EN_Egos.txt: ${enEgos.length} entries`)
  console.log(`  JP_Egos.txt: ${jpEgos.length} entries`)

  const enEgoMap = new Map(enEgos.map(e => [String(e.id), e.name]))
  const jpEgoMap = new Map(jpEgos.map(e => [String(e.id), e.name]))

  if (!dryRun) {
    const { data: egos, error } = await supabase
      .schema('limbus')
      .from('ego')
      .select('id, game_id, name_en, name_jp')

    if (error) { console.error('  ✗ ego fetch failed:', error.message) }
    else {
      let enUpdated = 0, jpUpdated = 0
      for (const ego of egos ?? []) {
        if (!ego.game_id) continue
        const updates = {}
        const en = enEgoMap.get(ego.game_id)
        const jp = jpEgoMap.get(ego.game_id)
        if (en && ego.name_en !== en) updates.name_en = en
        if (jp && ego.name_jp !== jp) updates.name_jp = jp
        if (Object.keys(updates).length === 0) continue

        const { error: upErr } = await supabase
          .schema('limbus')
          .from('ego')
          .update(updates)
          .eq('id', ego.id)

        if (upErr) console.error(`  ✗ ${ego.game_id}: ${upErr.message}`)
        else { if (updates.name_en) enUpdated++; if (updates.name_jp) jpUpdated++ }
      }
      console.log(`  ✓ ${enUpdated} egos updated with name_en`)
      console.log(`  ✓ ${jpUpdated} egos updated with name_jp`)
    }
  } else {
    for (const [id, name] of [...jpEgoMap].slice(0, 5)) {
      console.log(`  JP ${id} → ${name}`)
    }
    console.log(`  ... EN ${enEgoMap.size}, JP ${jpEgoMap.size} EGO names`)
  }

  console.log('\n✅ Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
