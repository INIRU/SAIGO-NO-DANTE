#!/usr/bin/env tsx
/**
 * One unattended pass from the Windows extraction ZIP to the site DB.
 * Default: verify the ZIP and dry-run every sync. --fix: back up, then apply step by step and stop at the first failure.
 *
 *   node --import tsx scripts/sync/apply-extraction.ts (--zip <LimbusAssets_*.zip> | --source <unpacked LimbusAssets>) --work <dir> [--fix]
 * Theme pack cards the extraction tool composed into the ZIP are uploaded (as WebP) only when Storage lacks them; existing
 * images are never replaced. Keyword icons Storage lacks (icons/keywords/<slug>.webp) are uploaded as lossless WebP from the ZIP's
 * keyword sprites right after the keyword catalogue step, and skill icons Storage lacks (icons/skills/<sinner>/<sprite>.webp) for the
 * identities the DB already has are uploaded after the identity images. A read-only image audit closes every --fix.
 *
 *   ... --keyword-icons-only [--fix]   verify the ZIP, then only plan (--fix: upload) the missing keyword icons for the keyword
 *                                      rows the DB already has (catch-up for keywords an earlier apply added without icons)
 *   ... --skill-icons-only [--fix]     the same for the skill icons of the identities the DB already has
 *   ... --icons-only [--fix]           both, then the image audit
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, closeSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { prepareExtractedAssets } from './prepare-extracted-assets'
import sharp from 'sharp'
import { missingThemeImages, themeImageSource } from './theme-images'
import { RESTORE_TABLES } from './extraction-restore'
import { egoDrift } from './ego-drift'
import { extractionGaps as findGaps, leftoverChanges, parseSyncSummary, storageKeyOf } from './sync-result'
import { eventImageIdFromFilename } from '../assets/event-image-source'
import { PLACEHOLDER_CHECK_COLUMNS, rowsWithRawPlaceholders } from './placeholder-rules'
import { STEPS, catalogSummaryOf, stepCommand, verifySteps } from './extraction-steps'
import { KEYWORD_AUDIT_FILE, KEYWORD_ICON_DIR, readBuffIconIds, readKeywordAudit, uploadMissingKeywordIcons, type ManifestEntry } from './keyword-icons'
import { uploadMissingSkillIcons } from './skill-icons'
import { EGO_ARTWORK_QUALITY, egoArtworkPublicUrl, egoFolderKey, uploadEgoArtworkCopy, type EgoArtworkUpload } from './ego-artwork'
import { auditImagesSafely, formatMissingImages, IMAGE_AUDIT_KINDS, supabaseAuditSource } from './image-audit'

config({ path: '.env.local', quiet: true })
const args = process.argv.slice(2)
const option = (name: string) => { const at = args.indexOf(name); return at === -1 ? undefined : args[at + 1] }
const FIX = args.includes('--fix')
const KEYWORD_ICONS_ONLY = args.includes('--keyword-icons-only') || args.includes('--icons-only')
const SKILL_ICONS_ONLY = args.includes('--skill-icons-only') || args.includes('--icons-only')
const ICONS_ONLY = KEYWORD_ICONS_ONLY || SKILL_ICONS_ONLY
// Bundled next to the other sync bundles (no tsx or repository on the Windows PC).
const BUNDLE_DIR = import.meta.url.endsWith('.mjs') ? dirname(fileURLToPath(import.meta.url)) : null
const command = (script: string, rest: string[]) => stepCommand(script, rest, BUNDLE_DIR)
// Every table any step writes, saved before the first write; extraction-restore.ts puts them back.
const BACKUP_TABLES = RESTORE_TABLES.map(item => item.table)

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

const logOf = (work: string, label: string) => readFileSync(join(work, 'logs', `${label}.log`), 'utf8')

/**
 * Gift, theme, recipe, keyword catalogue and (refs) reference table sections of one pass, or null if a step lacks a summary.
 * The completeness check leaves refs out: reference rows the source lacks stay in the DB.
 */
function catalogSummary(work: string, pass: 'dry-run' | 'verify', refs = pass === 'verify') {
  const label = (step: string) => pass === 'verify' ? `verify-${step}` : `${step}-dry-run`
  return catalogSummaryOf(step => parseSyncSummary(logOf(work, label(step))), refs)
}

type EgoPlan = { egos: Record<string, unknown>[]; skills: Record<string, unknown>[]; passives: Record<string, unknown>[] }
/** EGO whose DB rows differ from what bootstrap-data.ts builds from this ZIP (every produced field), or are missing. */
async function egoDiffs(work: string, env: NodeJS.ProcessEnv, label: string, ids: string[]) {
  const dir = join(work, label)
  run(work, label, command('scripts/sync/bootstrap-data.ts', ['--ego-ids', ids.join(','), '--output', dir]), env)
  const plan = JSON.parse(readFileSync(join(dir, 'bootstrap-plan.json'), 'utf8')) as EgoPlan
  const [egoRows, skillRows, passiveRows] = await Promise.all([all('ego'), all('ego_skills'), all('ego_passives')])
  return plan.egos.flatMap(ego => {
    const current = egoRows.find(row => row.id === ego.id)
    if (!current) return [{ gameId: String(ego.game_id), name: String(ego.name_kr), fields: ['missing'] }]
    const of = (rows: Record<string, unknown>[]) => rows.filter(row => row.ego_id === ego.id)
    const fields = egoDrift({ ego, skills: of(plan.skills), passives: of(plan.passives) }, { ego: current, skills: of(skillRows), passives: of(passiveRows) })
    return fields.length ? [{ gameId: String(ego.game_id), name: String(ego.name_kr), fields }] : []
  })
}

/** After --fix: each step's dry-run and the EGO check again; whatever they would still change is a mismatch. */
async function leftoverDiffs(work: string, env: NodeJS.ProcessEnv, egoIds: string[]) {
  for (const step of verifySteps()) run(work, `verify-${step.name}`, command(step.script, step.args), env)
  const left = leftoverChanges(parseSyncSummary(logOf(work, 'verify-identity')), catalogSummary(work, 'verify'))
  // Events: rebuild-mirror-events.ts reads its rows back and fails on any difference during --fix.
  for (const ego of await egoDiffs(work, env, 'verify-ego', egoIds)) left.push(`EGO ${ego.gameId} ${ego.fields.join(',')}`)
  return left
}

/**
 * Columns whose sync tokenizes the game slots ({0}, {1:F1}, {amount}) that still hold a bare one after the apply, so any row
 * here is a rule placeholder-rules.ts is missing. Skill, passive and EGO descriptions are stored raw and keep their {0}. Warns only.
 */
async function leftoverPlaceholders() {
  const found: string[] = []
  for (const [table, columns] of Object.entries(PLACEHOLDER_CHECK_COLUMNS)) {
    const key = RESTORE_TABLES.find(item => item.table === table)?.key ?? ['id']
    const rows = await all(table, [...new Set([...key, ...columns])].join(','))
    for (const { row, columns: bad } of rowsWithRawPlaceholders(rows, columns)) found.push(`${table} ${key.map(column => row[column]).join('/')} ${bad.join(',')}`)
  }
  return found
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
    const key = storageKeyOf(gift.image_url as string | null)
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

/**
 * Keyword icons Storage lacks, from the keyword sprites of the ZIP (see keyword-icons.ts). Run after the keywords sync and refs-link,
 * so the new keyword rows and their reference ids exist. Without --fix it only reports what it would upload.
 */
async function uploadKeywordIcons(source: string, work: string, data: string, uploads: Upload[], report: Record<string, unknown>) {
  const [keywords, refs, stored] = await Promise.all([all('keyword_meta', 'name,icon_slug'), all('game_text_refs', 'id,keyword_name'), storedNames(KEYWORD_ICON_DIR)])
  const result = await uploadMissingKeywordIcons({
    source, manifest: readManifest(source), uploads, fix: FIX, stored, bucket: client().storage.from('limbus-assets'),
    keywords: keywords as { name: string; icon_slug: string | null }[], refs: refs as { id: string; keyword_name: string | null }[],
    primaryTags: readKeywordAudit(join(work, KEYWORD_AUDIT_FILE)), iconIds: readBuffIconIds(data),
  })
  report.newKeywordIcons = result.newKeywordIcons
  report.keywordsWithoutIcon = result.keywordsWithoutIcon
  console.log(`ok   keyword-icons (${result.newKeywordIcons.length} ${FIX ? 'uploaded' : 'to upload'}, ${result.keywordsWithoutIcon.length} without a sprite)`)
  for (const row of result.keywordsWithoutIcon) console.warn(`WARN keyword icon: ${row.name} (${row.slug}) ${row.reason}: tags ${row.tags.join(',') || '-'}`)
}

/**
 * Skill icons Storage lacks for the identities the DB has (the new-identity upload covers only new ones, so a skill an existing identity
 * gained later has none), from the ZIP's skill sprites (see skill-icons.ts). Without --fix it only reports what it would upload.
 */
async function uploadSkillIcons(source: string, uploads: Upload[], report: Record<string, unknown>) {
  const [identities, skills] = await Promise.all([all('identities', 'id,game_id,sinner_id'), all('skills', 'id,identity_id,image_id,skill_order,uptie_level')])
  const result = await uploadMissingSkillIcons({
    source, manifest: readManifest(source), uploads, fix: FIX, listDir: storedNames, bucket: client().storage.from('limbus-assets'),
    identities: identities as never, skills: skills as never,
  })
  report.newSkillIcons = result.newSkillIcons
  report.skillsWithoutIcon = result.skillsWithoutIcon
  console.log(`ok   skill-icons (${result.newSkillIcons.length} ${FIX ? 'uploaded' : 'to upload'}, ${result.skillsWithoutIcon.length} without a sprite)`)
  for (const row of result.skillsWithoutIcon) console.warn(`WARN skill icon: ${row.key} (identity ${row.identity}) ${row.reason}`)
}

/** Read-only: every image the DB references against Storage. Missing ones are reported (report.missingImages) and warned about, never fatal. */
async function auditStoredImages(report: Record<string, unknown>) {
  let result: Awaited<ReturnType<typeof auditImagesSafely>>
  try { result = await auditImagesSafely(supabaseAuditSource(client())) } catch (error) { result = { error: error instanceof Error ? error.message : String(error) } }
  report.missingImages = result
  if ('error' in result) return console.warn(`WARN image audit could not run: ${result.error}`)
  const missing = IMAGE_AUDIT_KINDS.reduce((sum, kind) => sum + result[kind].missing, 0)
  console.log(`${missing ? 'WARN' : 'ok  '} images (${missing} referenced image(s) missing in Storage)`)
  if (missing) for (const line of formatMissingImages(result)) console.warn(`     ${line}`)
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

/**
 * New EGO images from the verified ZIP at the paths their rows point to; existing objects are never replaced. The `cg` of each EGO is
 * also encoded at quality 95 and uploaded as `{id}_cg-{hash12}.webp` (ego-artwork.ts), and its public URL is stored in
 * `ego.artwork_url`, which the detail hero shows instead of the 256px profile. An EGO whose ZIP has no `cg` keeps a null artwork_url.
 */
async function uploadEgoImages(source: string, gameIds: string[], uploads: Upload[]) {
  const manifest = readManifest(source)
  const { data: egos, error } = await db().from('ego').select('game_id, sinner_id, folder_name').in('game_id', gameIds)
  if (error) throw Error(`ego: ${error.message}`)
  if (egos.length !== gameIds.length) throw Error('some new EGO rows are missing after bootstrap')
  const bucket = client().storage.from('limbus-assets')
  let uploaded = 0
  const artwork: EgoArtworkUpload[] = [], withoutArtwork: string[] = []
  for (const ego of egos) {
    for (const suffix of EGO_IMAGES) {
      const entry = manifest.find(item => item.kind === 'EGO' && item.name === `${ego.game_id}_${suffix}`)
      if (!entry) { if (suffix === 'awaken_profile') throw Error(`the ZIP has no ${ego.game_id}_awaken_profile`); continue }
      const key = `${egoFolderKey(ego.sinner_id, ego.folder_name)}/${entry.name}.webp`
      const { error: uploadError } = await bucket.upload(key, await zipImage(source, entry), { contentType: 'image/webp', cacheControl: '3600', upsert: false })
      if (uploadError) throw Error(`upload ${key}: ${uploadError.message}`)
      uploads.push({ key, before: null })
      uploaded++
      // The corrosion art is the hero's corrosion tab (migration ego_corrosion_artwork_url); the ego table backup carries the column.
      if (suffix === 'e_cg') {
        const { error: corrosionError } = await db().from('ego').update({ corrosion_artwork_url: egoArtworkPublicUrl(key) }).eq('game_id', ego.game_id)
        if (corrosionError) throw Error(`ego ${ego.game_id} corrosion_artwork_url: ${corrosionError.message} (is the ego_corrosion_artwork_url migration applied?)`)
      }
    }
    const cg = manifest.find(item => item.kind === 'EGO' && item.name === `${ego.game_id}_cg`)
    if (!cg) { withoutArtwork.push(String(ego.game_id)); continue }
    const copy = await uploadEgoArtworkCopy({
      ego, webp: await zipImage(source, cg, EGO_ARTWORK_QUALITY), stored: await storedNames(egoFolderKey(ego.sinner_id, ego.folder_name)), bucket, uploads, fix: true,
    })
    // artwork_url is a column of the ego table (migration ego_artwork_url): the backup and restore of the table carry it.
    const { error: updateError } = await db().from('ego').update({ artwork_url: copy.url }).eq('game_id', ego.game_id)
    if (updateError) throw Error(`ego ${ego.game_id} artwork_url: ${updateError.message} (is the ego_artwork_url migration applied?)`)
    artwork.push(copy)
  }
  return { uploaded, artwork, withoutArtwork }
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
  if (!input || !existsSync(input) || !option('--work')) throw Error('usage: (--zip <LimbusAssets_*.zip> | --source <LimbusAssets>) --work <dir> [--fix] [--keyword-icons-only | --skill-icons-only | --icons-only]')
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
    // The keywords sync writes its keyword rows (with their primary tags) to a file the keyword icon step reads.
    const stepEnv = (name: string) => name === 'keywords' ? { ...env, LIMBUS_KEYWORD_AUDIT: join(work, KEYWORD_AUDIT_FILE) } : env
    // Never leave a partial or mismatched apply: put every table and image back as it was before this run.
    const restoreAndFail = (error: unknown): never => {
      console.log('FAIL apply: restoring the backup')
      save() // extraction-restore reads this run's uploads from report.json
      const restore = spawnSync(process.execPath, command('scripts/sync/extraction-restore.ts', ['--work', work, '--fix']), { cwd: process.cwd(), env, encoding: 'utf8' })
      writeFileSync(join(work, 'logs', 'auto-restore.log'), (restore.stdout ?? '') + (restore.stderr ?? ''))
      report.autoRestored = restore.status === 0
      const message = error instanceof Error ? error.message : String(error)
      throw Error(restore.status === 0 ? `${message} — restored the backup automatically` : `${message} — AUTOMATIC RESTORE FAILED, restore this run from the tool (logs/auto-restore.log)`)
    }

    if (ICONS_ONLY) {
      // Only icons: the rows are the DB's as they are, nothing but Storage objects is written (and recorded for a restore).
      report.iconsOnly = [...KEYWORD_ICONS_ONLY ? ['keywords'] : [], ...SKILL_ICONS_ONLY ? ['skills'] : []]
      // The keywords dry-run writes the audit file with each keyword's primary tag.
      if (KEYWORD_ICONS_ONLY) run(work, 'keywords-dry-run', command('scripts/sync/identity-data.ts', ['--rebuild-keyword-meta']), stepEnv('keywords'))
      if (FIX) mkdirSync(join(work, 'backup')) // extraction-restore needs it to remove this run's uploads
      try {
        if (KEYWORD_ICONS_ONLY) await uploadKeywordIcons(source, work, data, uploads, report)
        if (SKILL_ICONS_ONLY) await uploadSkillIcons(source, uploads, report)
      } catch (error) { if (FIX) restoreAndFail(error); throw error }
      if (FIX) await revalidateGameData()
      await auditStoredImages(report)
      report.ok = true
      return
    }

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

    // 2. Dry-run every step, then refuse an incomplete extraction before anything is written: the game never removes
    // identities, EGO, gifts, theme packs or recipes, so one the DB has and the ZIP lacks means files are missing.
    for (const step of STEPS) run(work, `${step.name}-dry-run`, command(step.script, step.args), stepEnv(step.name))
    const gaps = findGaps(parseSyncSummary(logOf(work, 'identity-dry-run')), catalogSummary(work, 'dry-run'), [...knownEgo].filter(id => !egoIds.has(id)))
    if (gaps.length) throw Error(`the extraction is incomplete, nothing was written: ${gaps.join('; ')}`)
    console.log('ok   completeness')
    const existingEgos = [...egoIds].filter(id => knownEgo.has(id)).sort()
    const changedEgos = existingEgos.length ? await egoDiffs(work, env, 'existing-ego', existingEgos) : []
    report.changedEgos = changedEgos
    console.log(`ok   existing-ego (${changedEgos.length} differ)`)

    // New theme packs: the extraction tool composes every pack card into the ZIP (kind '합성 테마팩'); upload the ones Storage lacks.
    const themeFiles = missingThemeImages(data, { packs: await storedNames(THEME_IMAGE_DIR), bosses: await storedNames(`${THEME_IMAGE_DIR}/boss`) })
    report.newThemeImages = themeFiles
    const themeImages = themeFiles.length ? JSON.parse(readFileSync(join(source, 'Reports', 'manifest.json'), 'utf8').replace(/^\uFEFF/, '')) : null
    const themeSources = themeFiles.map(file => ({ file, path: themeImageSource(file, themeImages) }))
    const unsourced = themeSources.filter(item => !item.path).map(item => item.file)
    if (unsourced.length) throw Error(`the ZIP has no composed image for ${unsourced.join(', ')}; update the extraction tool and extract again`)

    if (FIX) {
      mkdirSync(join(work, 'backup'))
      for (const table of BACKUP_TABLES) writeFileSync(join(work, 'backup', `${table}.json`), JSON.stringify(await all(table)), { flag: 'wx' })
      console.log('ok   backup')
      try {
        // 3. Apply step by step.
        for (const step of STEPS) {
          if (step.name === 'events') {
            await uploadMissingEventImages(source, uploads)
            console.log('ok   event-images')
          }
          run(work, `${step.name}-fix`, command(step.script, [...step.args, '--fix']), stepEnv(step.name))
          ;(report.steps as string[]).push(step.name)
          // The catalogue step may add keywords and refs-link ties their reference ids to them: now their icons can be paired.
          if (step.name === 'refs-link') await uploadKeywordIcons(source, work, data, uploads, report)
          if (step.name === 'mirror') {
            report.giftsWithoutIcon = await uploadMissingGiftIcons(source, uploads)
            console.log('ok   gift-icons')
          }
        }

        // New identities: illustrations, portraits, avatar profiles and skill icons from the same verified ZIP.
        const newIdentities = (await all('identities', 'id,game_id')).map(row => String(row.game_id)).filter(id => !identitiesBefore.has(id))
        report.newIdentities = newIdentities
        if (newIdentities.length) {
          run(work, 'identity-images', command('scripts/assets/sync-extracted-identities.cjs', ['--ids', newIdentities.join(','), '--source', source, '--output', join(work, 'identity-images'), '--fix']), env)
          ;(report.steps as string[]).push('identity-images')
        }
        // Skill icons of identities the DB already had: the upload above covers only the new ones.
        await uploadSkillIcons(source, uploads, report)

        // New EGO: bootstrap-data.ts writes their rows, stage skills and passives (with SkillTag section names) from this ZIP.
        if (newEgos.length) {
          run(work, 'new-ego-fix', command('scripts/sync/bootstrap-data.ts', ['--ego-ids', newEgos.join(','), '--output', join(work, 'new-ego'), '--fix']), env)
          const egoImages = await uploadEgoImages(source, newEgos, uploads)
          report.egoArtwork = egoImages.artwork
          report.egoWithoutArtwork = egoImages.withoutArtwork
          console.log(`ok   new-ego-images (${egoImages.uploaded} uploaded, ${egoImages.artwork.length} artwork_url set)`)
          for (const gameId of egoImages.withoutArtwork) console.warn(`WARN ego artwork: ${gameId} has no cg in the ZIP, the detail page shows its profile`)
          ;(report.steps as string[]).push('new-ego')
        }

        // Existing EGO that differ from this ZIP in any field it produces (rows copied from another EGO, missing stage
        // passives, balance patches) are rebuilt from it; their image URLs and folders stay.
        if (changedEgos.length) {
          run(work, 'existing-ego-fix', command('scripts/sync/bootstrap-data.ts', ['--ego-ids', changedEgos.map(item => item.gameId).join(','), '--output', join(work, 'existing-ego-fix'), '--replace', '--fix']), env)
          ;(report.steps as string[]).push('existing-ego')
        }

        if (themeSources.length) {
          const bucket = client().storage.from('limbus-assets')
          for (const { file, path } of themeSources) {
            const webp = await sharp(readFileSync(join(source, 'Images', path!))).webp({ quality: 95, effort: 6 }).toBuffer()
            const { error } = await bucket.upload(`${THEME_IMAGE_DIR}/${file}`, webp, { contentType: 'image/webp', cacheControl: '3600', upsert: false })
            if (error) throw Error(`upload ${THEME_IMAGE_DIR}/${file}: ${error.message}`)
            uploads.push({ key: `${THEME_IMAGE_DIR}/${file}`, before: null })
          }
          console.log(`ok   theme-images (${themeSources.length} uploaded)`)
          ;(report.steps as string[]).push('theme-images')
        }

        // 4. Read everything back: a second dry-run of each step and the EGO check must find nothing left to change.
        const left = await leftoverDiffs(work, env, [...egoIds].sort())
        report.verify = { ok: !left.length, left }
        if (left.length) throw Error(`the DB still differs from the extraction after applying: ${left.join('; ')}`)
        console.log('ok   verify (DB equals the extraction)')
        const placeholders = await leftoverPlaceholders()
        report.leftoverPlaceholders = placeholders
        if (placeholders.length) {
          console.warn(`WARN placeholders: ${placeholders.length} rows still show a bare {0}/{name} — add a rule to scripts/sync/placeholder-rules.ts`)
          for (const line of placeholders.slice(0, 20)) console.warn(`     ${line}`)
        } else console.log('ok   placeholders (no bare {0} in display columns)')
        await revalidateGameData()
        await auditStoredImages(report)
      } catch (error) {
        restoreAndFail(error)
      }
    } else {
      report.newIdentities = []
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
