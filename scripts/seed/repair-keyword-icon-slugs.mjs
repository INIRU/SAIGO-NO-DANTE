#!/usr/bin/env node
/**
 * Conservative keyword_meta.icon_slug repair.
 *
 * Dry-run:
 *   node --env-file=.env.local scripts/seed/repair-keyword-icon-slugs.mjs --dry-run
 *
 * Apply deterministic matches only:
 *   node --env-file=.env.local scripts/seed/repair-keyword-icon-slugs.mjs --fix
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const args = process.argv.slice(2)
const FIX = args.includes('--fix')
const DRY_RUN = args.includes('--dry-run') || !FIX
const reportIdx = args.indexOf('--report')
const reportPath = reportIdx === -1 ? null : args[reportIdx + 1]

if (FIX && args.includes('--dry-run')) {
  console.error('Use either --dry-run or --fix, not both.')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'limbus' } })

const CURATED_OBJECTS = [
  ['scripts/seed/keyword-icons.mjs', 'KEYWORD_ICON_MAP'],
  ['scripts/upload/keyword-icons.mjs', 'KEYWORD_EN_MAP'],
  ['scripts/scrape-keyword-icons.mjs', 'KNOWN_SLUGS'],
]

const VARIANT_OBJECTS = [
  ['scripts/scrape-keyword-icons.mjs', 'VARIANT_MAP'],
]

const VERIFIED_SLUGS = {
  '강렬한 색채': {
    slug: 'IntenseColorsRodion',
    source: 'game_id:IntenseColorsRodion + storage',
  },
  '고전압 외피': {
    slug: 'high-voltage-exoskeleton',
    source: 'name_en:High-voltage Exoskeleton + storage canonical lowercase',
  },
  '공격 레벨+': {
    slug: 'offense-level-up',
    source: 'game_id:AttackLevelAdder + name_en:Offense level+ + storage',
  },
  '과감한 터치': {
    slug: 'BoldBrushstrokesRodion',
    source: 'game_id:BoldBrushstrokesRodion + storage',
  },
  '구속 해제 - 창작 몰입': {
    slug: 'the-self-unbound-flow-state',
    source: 'name_en:The Self Unbound - Flow State + storage canonical hyphen',
  },
  '전하침': {
    slug: 'charged-sting',
    source: 'name_en:Charged Sting + storage canonical lowercase',
  },
  '정신력 회복': {
    slug: 'sp-heal-up',
    source: 'generic SP recovery + storage',
  },
  '진동 - 중첩': {
    slug: 'tremor-superposition',
    source: 'name_en:Tremor - Superposition + storage canonical hyphen',
  },
  '집중【저격】': {
    slug: 'concentration-sniper',
    source: 'name_en:Concentration【Sniper】 + storage canonical hyphen',
  },
  '천퇴성[天退星]': {
    slug: 'heavenly-retreat',
    source: 'known alias:천퇴성 [天退星] + storage',
  },
  '체력 회복': {
    slug: 'hp-heal-up',
    source: 'generic HP recovery + storage',
  },
}

function findObjectBody(source, constName) {
  const marker = `const ${constName} = {`
  const start = source.indexOf(marker)
  if (start === -1) return null

  const braceStart = source.indexOf('{', start)
  let depth = 0
  let quote = null
  let escaped = false

  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === quote) {
        quote = null
      }
      continue
    }

    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') depth++
    if (ch === '}') depth--
    if (depth === 0) return source.slice(braceStart + 1, i)
  }

  throw new Error(`Could not parse ${constName}`)
}

function unescapeLiteral(value) {
  return value
    .replace(/\\'/g, '\'')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function extractStringMap(filePath, constName) {
  const absPath = resolve(filePath)
  if (!existsSync(absPath)) return new Map()

  const source = readFileSync(absPath, 'utf8')
  const body = findObjectBody(source, constName)
  if (!body) return new Map()

  const map = new Map()
  const entryPattern = /(['"])((?:\\.|(?!\1).)+)\1\s*:\s*(['"])((?:\\.|(?!\3).)+)\3/g
  for (const match of body.matchAll(entryPattern)) {
    map.set(unescapeLiteral(match[2]), unescapeLiteral(match[4]))
  }
  return map
}

function normalizeText(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function toSlugCandidate(value, separator) {
  return normalizeText(value)
    .replace(/[''`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`${separator}+`, 'g'), separator)
    .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '')
}

function nameEnCandidates(nameEn) {
  const hyphen = toSlugCandidate(nameEn, '-')
  const underscore = toSlugCandidate(nameEn, '_')
  const compact = normalizeText(nameEn).replace(/[^a-z0-9]+/g, '')
  return [...new Set([hyphen, underscore, compact].filter(Boolean))]
}

function storageKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '')
}

function isMissingSlug(value) {
  return !value || String(value).trim() === ''
}

function isStatSlug(value) {
  return value.startsWith('stat:')
}

function buildCuratedSlugMap(existingRows) {
  const curated = new Map()
  for (const [name, { slug, source }] of Object.entries(VERIFIED_SLUGS)) {
    curated.set(name, { slug, source: `verified:${source}` })
  }

  for (const [filePath, constName] of CURATED_OBJECTS) {
    for (const [name, slug] of extractStringMap(filePath, constName)) {
      if (!curated.has(name)) curated.set(name, { slug, source: `${filePath}:${constName}` })
    }
  }

  const existingSlugByName = new Map(
    existingRows
      .filter(row => !isMissingSlug(row.icon_slug))
      .map(row => [row.name, String(row.icon_slug).trim()]),
  )

  for (const [filePath, constName] of VARIANT_OBJECTS) {
    for (const [variant, canonical] of extractStringMap(filePath, constName)) {
      const canonicalCurated = curated.get(canonical)?.slug
      const canonicalExisting = existingSlugByName.get(canonical)
      const slug = canonicalExisting ?? canonicalCurated
      if (slug && !curated.has(variant)) {
        curated.set(variant, { slug, source: `${filePath}:${constName} -> ${canonical}` })
      }
    }
  }

  return curated
}

async function listKeywordStorageSlugs() {
  const slugs = new Set()
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase.storage
      .from('limbus-assets')
      .list('icons/keywords', {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })

    if (error) throw new Error(`Storage list failed: ${error.message}`)
    for (const file of data ?? []) {
      if (file.name?.endsWith('.webp')) {
        slugs.add(file.name.replace(/\.webp$/i, ''))
      }
    }

    if (!data || data.length < limit) break
    offset += limit
  }

  return slugs
}

function buildStorageIndexes(storageSlugs) {
  const exact = new Map()
  const normalized = new Map()

  for (const slug of storageSlugs) {
    exact.set(slug, slug)
    const key = storageKey(slug)
    if (!normalized.has(key)) normalized.set(key, new Set())
    normalized.get(key).add(slug)
  }

  return { exact, normalized }
}

function resolveMatch(row, curatedSlugMap, storageSlugs, storageIndexes) {
  const curated = curatedSlugMap.get(row.name)
  if (curated) {
    if (isStatSlug(curated.slug) || storageSlugs.has(curated.slug)) {
      return { name: row.name, name_en: row.name_en, slug: curated.slug, reason: `curated:${curated.source}` }
    }
    return { name: row.name, name_en: row.name_en, reason: 'curated_slug_missing_storage', candidate: curated.slug }
  }

  if (!row.name_en || String(row.name_en).trim() === '') {
    return { name: row.name, name_en: row.name_en, reason: 'missing_name_en' }
  }

  const candidateHits = new Set()
  for (const candidate of nameEnCandidates(String(row.name_en))) {
    if (storageIndexes.exact.has(candidate)) candidateHits.add(storageIndexes.exact.get(candidate))

    const normalizedHits = storageIndexes.normalized.get(storageKey(candidate))
    if (normalizedHits) {
      for (const slug of normalizedHits) candidateHits.add(slug)
    }
  }

  if (candidateHits.size === 1) {
    const [slug] = [...candidateHits]
    return { name: row.name, name_en: row.name_en, slug, reason: 'name_en_storage_exact_or_punctuation_variant' }
  }

  if (candidateHits.size > 1) {
    return {
      name: row.name,
      name_en: row.name_en,
      reason: 'ambiguous_name_en_storage_match',
      candidates: [...candidateHits].sort(),
    }
  }

  return {
    name: row.name,
    name_en: row.name_en,
    reason: 'no_deterministic_storage_match',
    candidates: nameEnCandidates(String(row.name_en)),
  }
}

async function fetchKeywordMetaRows() {
  const { data, error } = await supabase
    .from('keyword_meta')
    .select('name, name_en, icon_slug')
    .order('name', { ascending: true })
    .limit(5000)

  if (error) throw new Error(`keyword_meta read failed: ${error.message}`)
  return data ?? []
}

async function applyMatches(matches, rowsByName) {
  const updated = []
  const skipped = []

  for (const match of matches) {
    const before = rowsByName.get(match.name)
    if (!before || !isMissingSlug(before.icon_slug)) {
      skipped.push({ ...match, skipped: 'row_no_longer_missing' })
      continue
    }

    let query = supabase
      .from('keyword_meta')
      .update({ icon_slug: match.slug })
      .eq('name', match.name)
      .select('name, name_en, icon_slug')

    if (before.icon_slug === null) {
      query = query.is('icon_slug', null)
    } else {
      query = query.eq('icon_slug', before.icon_slug)
    }

    const { data, error } = await query
    if (error) throw new Error(`keyword_meta update failed for ${match.name}: ${error.message}`)

    if (data?.length) {
      updated.push({ ...match, after: data[0] })
    } else {
      skipped.push({ ...match, skipped: 'concurrent_change_or_no_row' })
    }
  }

  return { updated, skipped }
}

function tableRows(rows, columns) {
  if (rows.length === 0) return '_None._'

  const header = `| ${columns.join(' |')} |`
  const sep = `| ${columns.map(() => '---').join(' |')} |`
  const body = rows.map(row => `| ${columns.map(col => String(row[col] ?? '').replace(/\n/g, '<br>')).join(' |')} |`)
  return [header, sep, ...body].join('\n')
}

function writeReport(path, summary) {
  if (!path) return

  const content = [
    '# Keyword Icon Slug Repair Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${summary.mode}`,
    '',
    '## Summary',
    '',
    `- Total keyword_meta rows: ${summary.totalRows}`,
    `- Storage keyword .webp assets: ${summary.storageCount}`,
    `- Missing before: ${summary.missingBefore}`,
    `- Deterministic matches: ${summary.matches.length}`,
    `- Updated: ${summary.updated.length}`,
    `- Skipped during update: ${summary.skipped.length}`,
    `- Missing after: ${summary.missingAfter ?? 'not-run'}`,
    `- Unresolved: ${summary.unresolved.length}`,
    '',
    '## Deterministic Matches',
    '',
    tableRows(summary.matches, ['name', 'name_en', 'slug', 'reason']),
    '',
    '## Unresolved',
    '',
    tableRows(summary.unresolved, ['name', 'name_en', 'reason', 'candidate', 'candidates']),
    '',
  ].join('\n')

  writeFileSync(resolve(path), content)
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'dry-run' : 'fix'}`)

  const rowsBefore = await fetchKeywordMetaRows()
  const missingRows = rowsBefore.filter(row => isMissingSlug(row.icon_slug))
  const storageSlugs = await listKeywordStorageSlugs()
  const storageIndexes = buildStorageIndexes(storageSlugs)
  const curatedSlugMap = buildCuratedSlugMap(rowsBefore)

  const resolved = missingRows.map(row => resolveMatch(row, curatedSlugMap, storageSlugs, storageIndexes))
  const matches = resolved.filter(row => row.slug)
  const unresolved = resolved
    .filter(row => !row.slug)
    .map(row => ({
      ...row,
      candidates: Array.isArray(row.candidates) ? row.candidates.join(', ') : row.candidates,
    }))

  console.log(`Total keyword_meta rows: ${rowsBefore.length}`)
  console.log(`Storage keyword .webp assets: ${storageSlugs.size}`)
  console.log(`Missing icon_slug before: ${missingRows.length}`)
  console.log(`Deterministic matches: ${matches.length}`)
  console.log(`Unresolved: ${unresolved.length}`)

  if (matches.length > 0) {
    console.log('\nMatch sample:')
    for (const match of matches.slice(0, 20)) {
      console.log(`  ${match.name} (${match.name_en ?? '-'}) -> ${match.slug} [${match.reason}]`)
    }
    if (matches.length > 20) console.log(`  ... ${matches.length - 20} more`)
  }

  if (unresolved.length > 0) {
    console.log('\nUnresolved sample:')
    for (const row of unresolved.slice(0, 30)) {
      console.log(`  ${row.name} (${row.name_en ?? '-'}) [${row.reason}]`)
    }
    if (unresolved.length > 30) console.log(`  ... ${unresolved.length - 30} more`)
  }

  let updated = []
  let skipped = []
  let missingAfter = null

  if (FIX) {
    const rowsByName = new Map(rowsBefore.map(row => [row.name, row]))
    const result = await applyMatches(matches, rowsByName)
    updated = result.updated
    skipped = result.skipped

    const rowsAfter = await fetchKeywordMetaRows()
    missingAfter = rowsAfter.filter(row => isMissingSlug(row.icon_slug)).length

    console.log(`\nRows updated: ${updated.length}`)
    console.log(`Rows skipped: ${skipped.length}`)
    console.log(`Missing icon_slug after: ${missingAfter}`)
    if (updated.length > 0) {
      console.log('\nUpdated sample:')
      for (const row of updated.slice(0, 20)) {
        console.log(`  ${row.name}: ${row.after.icon_slug}`)
      }
      if (updated.length > 20) console.log(`  ... ${updated.length - 20} more`)
    }
  } else {
    console.log('\nDry-run only. Re-run with --fix to apply deterministic matches.')
  }

  writeReport(reportPath, {
    mode: DRY_RUN ? 'dry-run' : 'fix',
    totalRows: rowsBefore.length,
    storageCount: storageSlugs.size,
    missingBefore: missingRows.length,
    matches,
    unresolved,
    updated,
    skipped,
    missingAfter,
  })

  if (reportPath) console.log(`Report written: ${reportPath}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
