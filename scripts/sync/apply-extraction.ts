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
import { egoDrift } from './ego-drift'
import { eventImageIdFromFilename } from '../assets/event-image-source'

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
  // --keywords: identity keywords follow the extraction like every other field.
  { name: 'identity', script: 'scripts/sync/identity-data.ts', args: ['--keywords'] },
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
  const names = new Set<string>()
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client().storage.from('limbus-assets').list(dir, { limit: 1000, offset })
    if (error) throw Error(`Storage ${dir}: ${error.message}`)
    for (const item of data) names.add(item.name)
    if (data.length < 1000) return names
  }
}

type ManifestEntry = { kind: string; name: string; path: string; sha256: string }
const readManifest = (source: string) => JSON.parse(readFileSync(join(source, 'Reports', 'manifest.json'), 'utf8').replace(/^\uFEFF/, '')) as ManifestEntry[]

/** A ZIP image as WebP after its hash is checked against the manifest. */
async function zipImage(source: string, entry: ManifestEntry, quality = 90) {
  const bytes = readFileSync(join(source, 'Images', entry.path))
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256.toLowerCase()) throw Error(`image hash mismatch: ${entry.path}`)
  return sharp(bytes).webp({ quality }).toBuffer()
}

/**
 * Icons of gifts whose image_url has no object yet (gifts the mirror step just added), from the ZIP's
 * EgoGiftIcon/<game id>.png. Gifts without an icon in the ZIP are listed, not guessed.
 */
async function uploadMissingGiftIcons(source: string, uploads: Upload[]) {
  const manifest = readManifest(source), stored = await storedNames('ego-gifts'), missing: string[] = []
  const bucket = client().storage.from('limbus-assets')
  for (const gift of await all('ego_gifts', 'id,game_id,image_url')) {
    const key = String(gift.image_url ?? '').split('/limbus-assets/')[1]
    if (!key?.startsWith('ego-gifts/') || stored.has(key.slice('ego-gifts/'.length))) continue
    const entry = manifest.find(item => item.kind === '기프트' && item.name === String(gift.game_id))
    if (!entry) { missing.push(String(gift.game_id)); continue }
    const { error } = await bucket.upload(key, await zipImage(source, entry, 95), { contentType: 'image/webp', cacheControl: '3600', upsert: false })
    if (error) throw Error(`upload ${key}: ${error.message}`)
    uploads.push({ key, before: null })
    stored.add(key.slice('ego-gifts/'.length))
  }
  return missing
}

/** Event illustrations Storage lacks (icons/events/<event id>.webp), before the event step links images it finds there. */
async function uploadMissingEventImages(source: string, uploads: Upload[]) {
  const stored = await storedNames('icons/events'), bucket = client().storage.from('limbus-assets')
  for (const entry of readManifest(source).filter(item => item.kind === '이벤트선택지')) {
    const id = eventImageIdFromFilename(entry.name), file = `${id}.webp`
    if (!id || stored.has(file)) continue
    const { error } = await bucket.upload(`icons/events/${file}`, await zipImage(source, entry), { contentType: 'image/webp', cacheControl: '3600', upsert: false })
    if (error) throw Error(`upload icons/events/${file}: ${error.message}`)
    uploads.push({ key: `icons/events/${file}`, before: null })
    stored.add(file)
  }
}

/** Images of an EGO in the ZIP, stored as <game id>_<suffix>.webp in its folder; the awakening profile is required. */
const EGO_IMAGES = ['awaken_profile', 'erosion_profile', 'cg', 'e_cg', 'profile_summary'] as const

/** Objects this apply uploaded; none replaced an existing one (before: null), so a restore removes them. */
type Upload = { key: string; before: null }

/** New EGO images from the verified ZIP at the paths their rows point to; existing objects are never replaced. */
async function uploadEgoImages(source: string, gameIds: string[], uploads: Upload[]) {
  const manifest = readManifest(source)
  const { data: egos, error } = await db().from('ego').select('game_id, sinner_id, folder_name').in('game_id', gameIds)
  if (error) throw Error(`ego: ${error.message}`)
  if (egos.length !== gameIds.length) throw Error('some new EGO rows are missing after bootstrap')
  const bucket = client().storage.from('limbus-assets')
  let uploaded = 0
  for (const ego of egos) for (const suffix of EGO_IMAGES) {
    const entry = manifest.find(item => item.kind === 'EGO' && item.name === `${ego.game_id}_${suffix}`)
    if (!entry) { if (suffix === 'awaken_profile') throw Error(`the ZIP has no ${ego.game_id}_awaken_profile`); continue }
    const key = `sinners/${ego.sinner_id}/ego/${ego.folder_name}/${entry.name}.webp`
    const { error: uploadError } = await bucket.upload(key, await zipImage(source, entry), { contentType: 'image/webp', cacheControl: '3600', upsert: false })
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
      if (FIX && step.name === 'events') {
        await uploadMissingEventImages(source, uploads)
        console.log('ok   event-images')
      }
      run(work, `${step.name}-dry-run`, command(step.script, step.args), env)
      if (!FIX) continue
      if (!existsSync(join(work, 'backup'))) {
        mkdirSync(join(work, 'backup'))
        for (const table of BACKUP_TABLES) writeFileSync(join(work, 'backup', `${table}.json`), JSON.stringify(await all(table)), { flag: 'wx' })
        console.log('ok   backup')
      }
      run(work, `${step.name}-fix`, command(step.script, [...step.args, '--fix']), env)
      ;(report.steps as string[]).push(step.name)
      if (step.name === 'mirror') {
        report.giftsWithoutIcon = await uploadMissingGiftIcons(source, uploads)
        console.log('ok   gift-icons')
      }
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

    // Existing EGO whose grade, sin, cost, resistance, passives or stage skill stats differ from this ZIP are rebuilt from it
    // (rows copied from another EGO, missing stage passives, balance patches). Text-only differences stay with the identity step.
    const existingEgos = [...egoIds].filter(id => knownEgo.has(id)).sort()
    if (existingEgos.length) {
      const checkDir = join(work, 'existing-ego')
      run(work, 'existing-ego-check', command('scripts/sync/bootstrap-data.ts', ['--ego-ids', existingEgos.join(','), '--output', checkDir]), env)
      const plan = JSON.parse(readFileSync(join(checkDir, 'bootstrap-plan.json'), 'utf8')) as { egos: Record<string, unknown>[]; skills: Record<string, unknown>[]; passives: Record<string, unknown>[] }
      const [egoRows, skillRows, passiveRows] = await Promise.all([all('ego'), all('ego_skills'), all('ego_passives')])
      const changed = plan.egos.flatMap(ego => {
        const current = egoRows.find(row => row.id === ego.id)
        if (!current) return []
        const of = (rows: Record<string, unknown>[]) => rows.filter(row => row.ego_id === ego.id)
        const fields = egoDrift({ ego, skills: of(plan.skills), passives: of(plan.passives) }, { ego: current, skills: of(skillRows), passives: of(passiveRows) })
        return fields.length ? [{ gameId: String(ego.game_id), name: String(ego.name_kr), fields }] : []
      })
      report.changedEgos = changed
      if (FIX && changed.length) {
        run(work, 'existing-ego-fix', command('scripts/sync/bootstrap-data.ts', ['--ego-ids', changed.map(item => item.gameId).join(','), '--output', join(work, 'existing-ego-fix'), '--replace', '--fix']), env)
        await revalidateGameData()
        ;(report.steps as string[]).push('existing-ego')
      }
      console.log(`ok   existing-ego (${changed.length} ${FIX ? 'rebuilt' : 'differ'})`)
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
