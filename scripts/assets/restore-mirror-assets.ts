#!/usr/bin/env tsx
/** Upload only Drive-derived Mirror Dungeon assets. Defaults to an inspectable dry run. */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { eventImageIdFromFilename } from './event-image-source'

async function main() {
config({ path: '.env.local', quiet: true })
const apply = process.argv.includes('--fix')
const recovery = resolve(process.env.LIMBUS_RECOVERY_DIR || '../assets/recovery-2026-09-10')
const run = promisify(execFile)
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!)
const bucket = client.storage.from('limbus-assets')
interface Source { id: string; name: string; path: string; mimeType: string; size?: string; modifiedTime?: string }
interface Asset { target: string; source?: Source; local?: string; gameId?: number }
const inventory = (domain: string): Source[] => JSON.parse(readFileSync(join(recovery, `drive-complete-${domain}.json`), 'utf8')).files
const normalize = (name: string) => name.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '')
// Drive's labels predate current EN localization or contain spelling mistakes.
const aliases: Record<number, string> = { 9019: 'Sticky Resin', 9024: 'Melty Eyeball', 9047: 'Barbed Snare', 9738: 'Prosthetic Join Servos', 9802: 'Lightening Axe' }
const seasonPriority = (path: string) => ['Names and Spiders', 'Immortality', 'Dreaming', 'Wuthering', 'Mirrors', 'Beginning'].findIndex(season => path.includes(season))
const latestFirst = (a: Source, b: Source) => {
  const aSeason = seasonPriority(a.path), bSeason = seasonPriority(b.path)
  return (aSeason < 0 ? 99 : aSeason) - (bSeason < 0 ? 99 : bSeason) || (b.modifiedTime || '').localeCompare(a.modifiedTime || '') || a.path.localeCompare(b.path)
}
const giftSources = inventory('icons').filter(file => file.mimeType === 'image/png' && file.path.startsWith('icons/EGO Gifts/')).sort(latestFirst)
const giftsByName = new Map<string, Source>()
for (const file of giftSources) {
  const name = normalize(basename(file.name, '.png'))
  if (!giftsByName.has(name)) giftsByName.set(name, file)
}
const { data: gifts, error } = await client.schema('limbus').from('ego_gifts').select('game_id,name,name_en,image_url').order('game_id')
if (error) throw error
const assets: Asset[] = [], missing: unknown[] = []
for (const gift of gifts || []) {
  const source = giftsByName.get(normalize(aliases[gift.game_id] || gift.name_en || ''))
  if (!source) { missing.push({ gameId: gift.game_id, name: gift.name_en }); continue }
  const hash = createHash('md5').update(gift.name).digest('hex').slice(0, 8)
  assets.push({ target: `ego-gifts/ego-gift-${hash}.webp`, source, gameId: gift.game_id })
}
const eventSources = inventory('events').filter(file => file.mimeType === 'image/png').sort(latestFirst)
const eventsById = new Map<string, Source>()
for (const file of eventSources) {
  const id = eventImageIdFromFilename(file.name)?.toString()
  if (id && !eventsById.has(id)) eventsById.set(id, file)
}
for (const [id, source] of eventsById) assets.push({ target: `icons/events/${id}.webp`, source })
const themeRoot = join(recovery, 'theme-complete/output')
function addThemeFiles(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name)
    if (entry.isDirectory()) addThemeFiles(file)
    else if (entry.name.endsWith('.webp')) assets.push({ target: `icons/theme-packs/${relative(themeRoot, file)}`, local: file })
  }
}
addThemeFiles(themeRoot)
const planPath = join(recovery, 'mirror-assets-plan.json')
writeFileSync(planPath, JSON.stringify({ assets, missing }, null, 2))
console.log(JSON.stringify({ gifts: gifts?.length, planned: assets.length, missing: missing.length, apply }))
if (missing.length) throw Error(`Unresolved gift sources; inspect ${planPath}`)
if (!apply) process.exit(0)

const output = join(recovery, 'mirror-webp'), originals = join(recovery, 'image-originals')
mkdirSync(output, { recursive: true }); mkdirSync(originals, { recursive: true })
const receiptPath = join(recovery, 'mirror-assets-upload.json')
type Receipt = { target: string; sha256: string; sourceId?: string; sourceSha256?: string; bytes: number }
const receipts: Receipt[] = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : []
const completed = new Map(receipts.map(receipt => [receipt.target, receipt]))
function save() { const tmp = receiptPath + '.tmp'; writeFileSync(tmp, JSON.stringify(receipts, null, 2)); renameSync(tmp, receiptPath) }
let next = 0
async function worker() {
  while (next < assets.length) {
    const asset = assets[next++]
    let local = asset.local, sourceSha256: string | undefined
    if (asset.source) {
      const source = asset.source, raw = join(originals, source.id + '.png')
      if (!existsSync(raw)) {
        // Own temporary file avoids racing another source download worker.
        const temporary = raw + '.mirror.part'
        await run('curl', ['--fail', '--silent', '--show-error', '--location', '--retry', '3', '--max-time', '45', `https://drive.usercontent.google.com/download?id=${source.id}&export=download`, '-o', temporary])
        const bytes = readFileSync(temporary)
        if (source.size && bytes.length !== Number(source.size)) throw Error(`Size mismatch: ${source.path}`)
        if ((await sharp(bytes).metadata()).format !== 'png') throw Error(`Not a PNG: ${source.path}`)
        renameSync(temporary, raw)
      }
      const rawBytes = readFileSync(raw)
      if (source.size && rawBytes.length !== Number(source.size)) throw Error(`Size mismatch: ${source.path}`)
      sourceSha256 = createHash('sha256').update(rawBytes).digest('hex')
      local = join(output, source.id + '.webp')
      if (!existsSync(local)) await sharp(rawBytes).webp({ quality: 95, alphaQuality: 100, effort: 4 }).toFile(local)
    }
    if (!local) throw Error(`No file: ${asset.target}`)
    const bytes = readFileSync(local), sha256 = createHash('sha256').update(bytes).digest('hex')
    if (completed.get(asset.target)?.sha256 === sha256) continue
    const { error: uploadError } = await bucket.upload(asset.target, bytes, { contentType: 'image/webp', cacheControl: '3600', upsert: true })
    if (uploadError) throw Error(`${asset.target}: ${uploadError.message}`)
    const receipt: Receipt = { target: asset.target, sha256, bytes: bytes.length, sourceId: asset.source?.id, sourceSha256 }
    const oldIndex = receipts.findIndex(item => item.target === asset.target)
    if (oldIndex >= 0) receipts[oldIndex] = receipt; else receipts.push(receipt)
    completed.set(asset.target, receipt); save()
    if (receipts.length % 50 === 0) console.log(`Uploaded ${receipts.length}/${assets.length}`)
  }
}
await Promise.all(Array.from({ length: 6 }, worker))
save()
console.log(`Verified upload receipts: ${receipts.length}/${assets.length}`)

}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
