#!/usr/bin/env node
/**
 * Dry-run-first EGO release_date backfill from local game JSON.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-ego-release-dates.mjs --dry-run
 *   node --env-file=.env.local scripts/backfill-ego-release-dates.mjs --fix
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DEFAULT_DATA_DIR = '/Users/iniru/Documents/Limbus/assets/data/Json (Text)'
const TRUE_EGO_FILE_RE = /^ego-(?:\d+|a\d+c\d+p\d+)\.txt$/i

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return

  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue

    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue

    let value = rawValue.trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

function usage() {
  console.log(`Usage:
  node --env-file=.env.local scripts/backfill-ego-release-dates.mjs [--dry-run]
  node --env-file=.env.local scripts/backfill-ego-release-dates.mjs --fix

Options:
  --dry-run          Compare only. This is the default.
  --fix              Write changed release_date values to Supabase.
  --data-dir <path>  Override local game JSON directory.
  --help             Show this help.`)
}

function parseArgs(argv) {
  const result = {
    fix: false,
    dryRun: false,
    dataDir: DEFAULT_DATA_DIR,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--fix') {
      result.fix = true
    } else if (arg === '--dry-run') {
      result.dryRun = true
    } else if (arg === '--data-dir') {
      const next = argv[i + 1]
      if (!next) throw new Error('--data-dir requires a path')
      result.dataDir = next
      i += 1
    } else if (arg === '--help' || arg === '-h') {
      usage()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (result.fix && result.dryRun) {
    throw new Error('Use either --dry-run or --fix, not both.')
  }

  result.dryRun = !result.fix
  return result
}

function formatUpdatedDate(value) {
  const raw = String(value ?? '').trim()
  if (!/^\d{8}$/.test(raw)) return null

  const year = raw.slice(0, 4)
  const month = raw.slice(4, 6)
  const day = raw.slice(6, 8)
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`)
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return null
  }

  return `${year}-${month}-${day}`
}

function normalizeReleaseDate(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function unwrapEntries(json) {
  if (Array.isArray(json)) return json

  for (const value of Object.values(json ?? {})) {
    if (Array.isArray(value)) return value
  }

  return []
}

async function loadSourceMap(dataDir) {
  const dirents = await readdir(dataDir, { withFileTypes: true })
  const sourceFiles = dirents
    .filter((dirent) => dirent.isFile() && TRUE_EGO_FILE_RE.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

  const sourceByGameId = new Map()
  const ambiguousSource = new Map()
  let sourceEntries = 0
  let skippedEntries = 0

  for (const sourceFile of sourceFiles) {
    const filePath = path.join(dataDir, sourceFile)
    const text = (await readFile(filePath, 'utf8')).replace(/^\uFEFF/, '')
    const entries = unwrapEntries(JSON.parse(text))

    for (const entry of entries) {
      const gameId = String(entry?.id ?? '').trim()
      const releaseDate = formatUpdatedDate(entry?.updatedDate)
      if (!gameId || !releaseDate) {
        skippedEntries += 1
        continue
      }

      sourceEntries += 1
      const next = {
        release_date: releaseDate,
        updatedDate: String(entry.updatedDate),
        sourceFile,
      }

      const current = sourceByGameId.get(gameId)
      if (!current) {
        sourceByGameId.set(gameId, next)
        continue
      }

      if (current.release_date !== next.release_date) {
        const records = ambiguousSource.get(gameId) ?? [current]
        records.push(next)
        ambiguousSource.set(gameId, records)
      }
    }
  }

  for (const gameId of ambiguousSource.keys()) {
    sourceByGameId.delete(gameId)
  }

  return {
    sourceFiles,
    sourceByGameId,
    ambiguousSource,
    sourceEntries,
    skippedEntries,
  }
}

function isMissingReleaseDateColumn(error) {
  return error?.code === '42703' && String(error?.message ?? '').includes('release_date')
}

async function loadDbRows(limbus) {
  const withReleaseDate = await limbus
    .from('ego')
    .select('id, game_id, name, name_kr, release_date')

  if (!withReleaseDate.error) {
    return {
      rows: withReleaseDate.data ?? [],
      columnMissing: false,
    }
  }

  if (!isMissingReleaseDateColumn(withReleaseDate.error)) {
    throw withReleaseDate.error
  }

  const withoutReleaseDate = await limbus
    .from('ego')
    .select('id, game_id, name, name_kr')

  if (withoutReleaseDate.error) throw withoutReleaseDate.error

  return {
    rows: (withoutReleaseDate.data ?? []).map((row) => ({ ...row, release_date: null })),
    columnMissing: true,
  }
}

function buildPlan(rows, sourceByGameId, ambiguousSource, columnMissing) {
  const changes = []
  let matched = 0
  let unchanged = 0
  let missingSource = 0
  let missingGameId = 0

  for (const row of rows) {
    const gameId = String(row.game_id ?? '').trim()
    if (!gameId) {
      missingGameId += 1
      continue
    }

    if (ambiguousSource.has(gameId)) {
      missingSource += 1
      continue
    }

    const source = sourceByGameId.get(gameId)
    if (!source) {
      missingSource += 1
      continue
    }

    matched += 1
    const before = columnMissing ? null : normalizeReleaseDate(row.release_date)
    const after = source.release_date

    if (before === after) {
      unchanged += 1
      continue
    }

    changes.push({
      id: row.id,
      game_id: gameId,
      name: row.name_kr || row.name || null,
      before,
      after,
      updatedDate: source.updatedDate,
      sourceFile: source.sourceFile,
    })
  }

  return {
    changes,
    summary: {
      dbRows: rows.length,
      matched,
      changed: changes.length,
      unchanged,
      missingSource,
      missingGameId,
      ambiguousSource: ambiguousSource.size,
      columnMissing,
    },
  }
}

function printReport({ mode, dataDir, sourceFiles, sourceEntries, skippedEntries, summary, changes }) {
  console.log('EGO release_date backfill')
  console.log(`Mode: ${mode}`)
  console.log(`Data dir: ${dataDir}`)
  console.log(`Source files: ${sourceFiles.length}`)
  console.log('')
  console.log('Summary:')
  console.log(`  sourceEntries: ${sourceEntries}`)
  console.log(`  skippedEntries: ${skippedEntries}`)
  console.log(`  dbRows: ${summary.dbRows}`)
  console.log(`  matched: ${summary.matched}`)
  console.log(`  changed: ${summary.changed}`)
  console.log(`  unchanged: ${summary.unchanged}`)
  console.log(`  missingSource: ${summary.missingSource}`)
  console.log(`  missingGameId: ${summary.missingGameId}`)
  console.log(`  ambiguousSource: ${summary.ambiguousSource}`)
  console.log(`  columnMissing: ${summary.columnMissing}`)

  if (changes.length > 0) {
    console.log('')
    console.log('Sample changes:')
    for (const change of changes.slice(0, 10)) {
      console.log(
        `  ${change.game_id} ${change.name ?? '(unnamed)'}: ` +
        `${change.before ?? '(null)'} -> ${change.after} (${change.sourceFile})`
      )
    }
  }
}

async function applyChanges(limbus, changes) {
  let updated = 0

  for (const change of changes) {
    const { error } = await limbus
      .from('ego')
      .update({ release_date: change.after })
      .eq('id', change.id)

    if (error) throw error
    updated += 1
  }

  return updated
}

async function main() {
  loadEnvFile(path.join(ROOT, '.env.local'))

  const args = parseArgs(process.argv.slice(2))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SECRET_KEY.')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'limbus' } })
  const { sourceFiles, sourceByGameId, ambiguousSource, sourceEntries, skippedEntries } =
    await loadSourceMap(args.dataDir)
  const { rows, columnMissing } = await loadDbRows(supabase)
  const { changes, summary } = buildPlan(rows, sourceByGameId, ambiguousSource, columnMissing)

  printReport({
    mode: args.fix ? '--fix (DB write)' : '--dry-run (no DB writes)',
    dataDir: args.dataDir,
    sourceFiles,
    sourceEntries,
    skippedEntries,
    summary,
    changes,
  })

  if (!args.fix) {
    console.log('')
    console.log('Dry-run complete. Re-run with --fix only after reviewing this report.')
    return
  }

  if (columnMissing) {
    throw new Error('Abort: limbus.ego.release_date column is missing. Apply the migration before --fix.')
  }

  const updated = await applyChanges(supabase, changes)
  console.log('')
  console.log(`Updated rows: ${updated}`)
}

main().catch((error) => {
  console.error(`ERROR: ${error?.message ?? error}`)
  process.exit(1)
})
