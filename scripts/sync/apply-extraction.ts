#!/usr/bin/env tsx
/**
 * One unattended pass from the Windows extraction ZIP to the site DB.
 * Default: verify the ZIP and dry-run every sync. --fix: back up, then apply step by step and stop at the first failure.
 *
 *   node --import tsx scripts/sync/apply-extraction.ts (--zip <LimbusAssets_*.zip> | --source <unpacked LimbusAssets>) --work <dir> [--fix]
 * Theme pack cards the extraction tool composed into the ZIP are uploaded (as WebP) only when Storage lacks them; existing
 * images are never replaced.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, closeSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { prepareExtractedAssets } from './prepare-extracted-assets'
import sharp from 'sharp'
import { missingThemeImages, themeImageSource } from './theme-images'
import { RESTORE_TABLES } from './extraction-restore'

config({ path: '.env.local', quiet: true })
const args = process.argv.slice(2)
const option = (name: string) => { const at = args.indexOf(name); return at === -1 ? undefined : args[at + 1] }
const FIX = args.includes('--fix')
// Bundled next to the other sync bundles (no tsx or repository on the Windows PC).
const BUNDLE_DIR = import.meta.url.endsWith('.mjs') ? dirname(fileURLToPath(import.meta.url)) : null
const command = (script: string, rest: string[]) => BUNDLE_DIR
  ? [join(BUNDLE_DIR, basename(script).replace(/\.ts$/, '.mjs')), ...rest]
  : [...(script.endsWith('.ts') ? ['--import', 'tsx'] : []), script, ...rest]
// Every table any step writes, saved before the first write; extraction-restore.ts puts them back.
const BACKUP_TABLES = RESTORE_TABLES.map(item => item.table)

type Step = { name: string; script: string; args: string[] }
const STEPS: Step[] = [
  { name: 'identity', script: 'scripts/sync/identity-data.ts', args: [] },
  // Events come from rebuild-mirror-events; the legacy event section of this script is skipped.
  { name: 'mirror', script: 'scripts/sync/mirror-dungeon-data.ts', args: ['--gifts-only', '--themes-only', '--recipes-only'] },
  { name: 'events', script: 'scripts/sync/rebuild-mirror-events.ts', args: [] },
]

const client = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!)
const db = () => client().schema('limbus')
const THEME_IMAGE_DIR = 'icons/theme-packs'

async function all(table: string, columns = '*') {
  const rows: Record<string, unknown>[] = []
  const order = RESTORE_TABLES.find(item => item.table === table)?.key ?? ['id']
  for (let offset = 0; ; offset += 1000) {
    let query = db().from(table).select(columns)
    for (const column of order) query = query.order(column)
    const { data, error } = await query.range(offset, offset + 999)
    if (error) throw Error(`${table}: ${error.message}`)
    rows.push(...(data as unknown as Record<string, unknown>[]))
    if (data.length < 1000) return rows
  }
}

function run(work: string, label: string, command: string[], env: NodeJS.ProcessEnv) {
  const log = join(work, 'logs', `${label}.log`)
  const fd = openSync(log, 'w')
  const result = spawnSync(process.execPath, command, { cwd: process.cwd(), env, stdio: ['ignore', fd, fd] })
  closeSync(fd)
  const ok = result.status === 0
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) throw Error(`${label} failed (see ${log}):\n${readFileSync(log, 'utf8').slice(-2000)}`)
}

async function storedNames(dir: string) {
  const { data, error } = await client().storage.from('limbus-assets').list(dir, { limit: 1000 })
  if (error) throw Error(`Storage ${dir}: ${error.message}`)
  if (data.length === 1000) throw Error(`Storage ${dir} has 1000+ entries; list with paging before trusting it`)
  return new Set(data.map(item => item.name))
}

/** Images of an EGO in the ZIP, stored as <game id>_<suffix>.webp in its folder; the awakening profile is required. */
const EGO_IMAGES = ['awaken_profile', 'erosion_profile', 'cg', 'e_cg', 'profile_summary'] as const

/** Objects this apply uploaded; none replaced an existing one (before: null), so a restore removes them. */
type Upload = { key: string; before: null }

/** New EGO images from the verified ZIP at the paths their rows point to; existing objects are never replaced. */
async function uploadEgoImages(source: string, gameIds: string[], uploads: Upload[]) {
  const manifest = JSON.parse(readFileSync(join(source, 'Reports', 'manifest.json'), 'utf8').replace(/^\uFEFF/, '')) as { kind: string; name: string; path: string; sha256: string }[]
  const { data: egos, error } = await db().from('ego').select('game_id, sinner_id, folder_name').in('game_id', gameIds)
  if (error) throw Error(`ego: ${error.message}`)
  if (egos.length !== gameIds.length) throw Error('some new EGO rows are missing after bootstrap')
  const bucket = client().storage.from('limbus-assets')
  let uploaded = 0
  for (const ego of egos) for (const suffix of EGO_IMAGES) {
    const entry = manifest.find(item => item.kind === 'EGO' && item.name === `${ego.game_id}_${suffix}`)
    if (!entry) { if (suffix === 'awaken_profile') throw Error(`the ZIP has no ${ego.game_id}_awaken_profile`); continue }
    const bytes = readFileSync(join(source, 'Images', entry.path))
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256.toLowerCase()) throw Error(`image hash mismatch: ${entry.path}`)
    const key = `sinners/${ego.sinner_id}/ego/${ego.folder_name}/${entry.name}.webp`
    const { error: uploadError } = await bucket.upload(key, await sharp(bytes).webp({ quality: 90 }).toBuffer(), { contentType: 'image/webp', cacheControl: '3600', upsert: false })
    if (uploadError) throw Error(`upload ${key}: ${uploadError.message}`)
    uploads.push({ key, before: null })
    uploaded++
  }
  return uploaded
}

/** The steps revalidate before new EGO are added; invalidate once more so their pages appear. */
async function revalidateGameData() {
  const site = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL, secret = process.env.REVALIDATION_SECRET
  if (!site || !secret) return console.warn('SITE_URL or REVALIDATION_SECRET not set: the site shows new EGO after its cache expires')
  const response = await fetch(`${site}/api/revalidate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-revalidation-secret': secret }, body: JSON.stringify({ scope: 'all-game-data' }) })
  if (!response.ok) console.warn(`revalidate failed: ${response.status}`)
}

async function main() {
  const zip = option('--zip')
  const unpackedSource = option('--source')
  const input = zip ?? unpackedSource
  if (!input || !existsSync(input) || !option('--work')) throw Error('usage: (--zip <LimbusAssets_*.zip> | --source <LimbusAssets>) --work <dir> [--fix]')
  const work = resolve(option('--work')!)
  if (existsSync(work) && readdirSync(work).length) throw Error(`work directory is not empty: ${work}`)
  mkdirSync(join(work, 'logs'), { recursive: true })
  const uploads: Upload[] = []
  const report: Record<string, unknown> = { input: resolve(input), fix: FIX, startedAt: new Date().toISOString(), steps: [] as string[], uploads }
  const save = () => writeFileSync(join(work, 'report.json'), JSON.stringify(report, null, 2))
  try {
    // 1. Unpack and verify every hash, size, parse and locale before anything reads the DB.
    const source = unpackedSource ? resolve(unpackedSource) : join(work, 'unpacked', 'LimbusAssets')
    if (zip) {
      mkdirSync(join(work, 'unpacked'))
      const tar = spawnSync('tar', ['-xf', resolve(zip), '-C', join(work, 'unpacked')], { stdio: 'inherit' })
      if (tar.status !== 0) throw Error('could not unpack the ZIP')
    }
    const prepared = await prepareExtractedAssets({ source, output: join(work, 'prepared'), prepare: true, repoRoot: process.cwd() })
    if (!prepared.ok) throw Error(`extraction check failed: ${prepared.errors.join('; ')}`)
    console.log('ok   verify extraction')
    const data = join(work, 'prepared', 'complete-data')
    const env = { ...process.env, LIMBUS_DATA_DIR: data, LIMBUS_RECOVERY_DIR: work, SITE_URL: process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL }

    // New EGO (story-only ones stay out) are added after the steps below: rows, stage skills and passives, then images.
    const egoIds = new Set<string>()
    for (const file of readdirSync(data).filter(f => /^ego-(?:\d+|a\d+c\d+p\d+)\.txt$/i.test(f))) {
      const value = JSON.parse(readFileSync(join(data, file), 'utf8'))
      for (const row of value.list ?? value.dataList ?? []) if (Number.isInteger(row.id) && !row.hidden && row.awakeningSkillId) egoIds.add(String(row.id))
    }
    const knownEgo = new Set((await all('ego', 'id,game_id')).map(row => String(row.game_id)))
    const newEgos = [...egoIds].filter(id => !knownEgo.has(id)).sort()
    report.newEgos = newEgos
    const identitiesBefore = new Set((await all('identities', 'id,game_id')).map(row => String(row.game_id)))

    for (const step of STEPS) {
      run(work, `${step.name}-dry-run`, command(step.script, step.args), env)
      if (!FIX) continue
      if (!existsSync(join(work, 'backup'))) {
        mkdirSync(join(work, 'backup'))
        for (const table of BACKUP_TABLES) writeFileSync(join(work, 'backup', `${table}.json`), JSON.stringify(await all(table)), { flag: 'wx' })
        console.log('ok   backup')
      }
      run(work, `${step.name}-fix`, command(step.script, [...step.args, '--fix']), env)
      ;(report.steps as string[]).push(step.name)
    }

    // New identities: illustrations, portraits, avatar profiles and skill icons from the same verified ZIP.
    const newIdentities = FIX ? (await all('identities', 'id,game_id')).map(row => String(row.game_id)).filter(id => !identitiesBefore.has(id)) : []
    report.newIdentities = newIdentities
    if (newIdentities.length) {
      run(work, 'identity-images', command('scripts/assets/sync-extracted-identities.cjs', ['--ids', newIdentities.join(','), '--source', source, '--output', join(work, 'identity-images'), '--fix']), env)
      ;(report.steps as string[]).push('identity-images')
    }

    // New EGO: bootstrap-data.ts writes their rows, stage skills and passives (with SkillTag section names) from this ZIP.
    if (newEgos.length) {
      const egoArgs = ['--ego-ids', newEgos.join(','), '--output', join(work, 'new-ego')]
      run(work, 'new-ego-dry-run', command('scripts/sync/bootstrap-data.ts', egoArgs), env)
      if (FIX) {
        run(work, 'new-ego-fix', command('scripts/sync/bootstrap-data.ts', [...egoArgs, '--fix']), env)
        console.log(`ok   new-ego-images (${await uploadEgoImages(source, newEgos, uploads)} uploaded)`)
        await revalidateGameData()
        ;(report.steps as string[]).push('new-ego')
      }
    }

    // New theme packs: the extraction tool composes every pack card into the ZIP (kind '합성 테마팩'); upload the ones Storage lacks.
    const themeFiles = missingThemeImages(data, { packs: await storedNames(THEME_IMAGE_DIR), bosses: await storedNames(`${THEME_IMAGE_DIR}/boss`) })
    report.newThemeImages = themeFiles
    if (themeFiles.length) {
      const images = JSON.parse(readFileSync(join(source, 'Reports', 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''))
      const sources = themeFiles.map(file => ({ file, path: themeImageSource(file, images) }))
      const unsourced = sources.filter(item => !item.path).map(item => item.file)
      if (unsourced.length) throw Error(`the ZIP has no composed image for ${unsourced.join(', ')}; update the extraction tool and extract again`)
      if (FIX) {
        const bucket = client().storage.from('limbus-assets')
        for (const { file, path } of sources) {
          const webp = await sharp(readFileSync(join(source, 'Images', path!))).webp({ quality: 95, effort: 6 }).toBuffer()
          const { error } = await bucket.upload(`${THEME_IMAGE_DIR}/${file}`, webp, { contentType: 'image/webp', cacheControl: '3600', upsert: false })
          if (error) throw Error(`upload ${THEME_IMAGE_DIR}/${file}: ${error.message}`)
          uploads.push({ key: `${THEME_IMAGE_DIR}/${file}`, before: null })
        }
        console.log(`ok   theme-images (${sources.length} uploaded)`)
        ;(report.steps as string[]).push('theme-images')
      }
    }
    report.ok = true
  } catch (error) {
    report.ok = false
    report.error = error instanceof Error ? error.message : String(error)
    throw error
  } finally {
    report.finishedAt = new Date().toISOString()
    save()
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
