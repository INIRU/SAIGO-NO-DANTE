#!/usr/bin/env tsx
/**
 * One-off: fill `limbus.ego.artwork_url` (the full-size art the EGO detail hero shows) for EGO that predate the column.
 *
 *   node --import tsx scripts/sync/backfill-ego-artwork-url.ts [--fix] [--out <receipt.json>]
 *
 * Dry-run by default: prints every planned action and writes nothing. Per EGO row whose artwork_url is null and whose image_url is an
 * `_awaken_profile` (see planEgoArtworkBackfill):
 *  (a) the id is in lib/generated/ego-artwork.json (the 113 hand-verified q95 copies): artwork_url = that hashed URL, after a HEAD
 *      confirms the object exists (a missing one is reported, not linked);
 *  (b) otherwise, when `{id}_cg.webp` exists in Storage (EGO added by apply-extraction before it stored a hashed copy, e.g. 20211, 20510):
 *      the existing object's bytes are downloaded, hashed (SHA-256, first 12 hex) and uploaded unchanged as `{id}_cg-{hash12}.webp`
 *      (upsert: false, never replaced), then artwork_url points there. Re-encoding at quality 95 is not done: the stored `_cg.webp` is
 *      already a lossy WebP (quality 90), and encoding it again would only lose more, so the copy is byte-identical to it.
 * EGO whose profile is not an `_awaken_profile`, with no `_cg.webp`, or with artwork_url already set are left alone, so a rerun is safe.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local. --fix writes ego.artwork_url and uploads the copies; --out saves a
 * receipt (uploaded keys, updated rows) to undo it: `update limbus.ego set artwork_url = null where id in (...)` and remove the keys.
 * Afterwards it asks the site to revalidate (SITE_URL + REVALIDATION_SECRET) so cached detail pages show the new art.
 */
import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import egoArtwork from '../../lib/generated/ego-artwork.json'
import { egoArtworkPublicUrl, egoFolderKey, planEgoArtworkBackfill, uploadEgoArtworkCopy, type EgoArtworkAction, type EgoArtworkRow, type Upload } from './ego-artwork'

config({ path: '.env.local', quiet: true })
const args = process.argv.slice(2)
const option = (name: string) => { const at = args.indexOf(name); return at === -1 ? undefined : args[at + 1] }
const FIX = args.includes('--fix')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required (.env.local)')
const supabase = createClient(url, key)
const db = () => supabase.schema('limbus')
const bucket = supabase.storage.from('limbus-assets')

async function egoRows() {
  const rows: EgoArtworkRow[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db().from('ego').select('id, game_id, sinner_id, folder_name, image_url, artwork_url').order('game_id').range(offset, offset + 999)
    if (error) throw Error(`ego: ${error.message}${/artwork_url/.test(error.message) ? ' (apply the ego_artwork_url migration first)' : ''}`)
    rows.push(...(data as EgoArtworkRow[]))
    if (data.length < 1000) return rows
  }
}

const exists = async (publicUrl: string) => (await fetch(publicUrl, { method: 'HEAD' })).ok

async function inBatches<T, R>(items: readonly T[], size: number, task: (item: T) => Promise<R>) {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(task)))
  return out
}

async function revalidate() {
  const site = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL, secret = process.env.REVALIDATION_SECRET
  if (!site || !secret) return console.warn('SITE_URL or REVALIDATION_SECRET not set: detail pages show the new art after their cache expires')
  const response = await fetch(`${site}/api/revalidate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-revalidation-secret': secret }, body: JSON.stringify({ scope: 'all-game-data' }) })
  console.log(response.ok ? 'ok   revalidate' : `WARN revalidate failed: ${response.status}`)
}

async function main() {
  const rows = await egoRows()
  const map = egoArtwork as Record<string, string>
  // (b) candidates: rows the map does not cover and that still lack artwork_url; ask Storage which have a plain _cg.webp.
  const candidates = rows.filter(row => !row.artwork_url && !Object.hasOwn(map, row.game_id) && row.image_url?.includes('_awaken_profile'))
  const found = await inBatches(candidates, 8, async row => (await exists(egoArtworkPublicUrl(`${egoFolderKey(row.sinner_id, row.folder_name)}/${row.game_id}_cg.webp`))) ? row.game_id : null)
  const plan = planEgoArtworkBackfill({ rows, map, cgStored: new Set(found.filter((id): id is string => !!id)) })
  // (a) the hashed object a map entry points at must exist before a row links to it.
  const mapped = plan.filter((action): action is Extract<EgoArtworkAction, { kind: 'map' }> => action.kind === 'map')
  const missing = new Set((await inBatches(mapped, 8, async action => (await exists(action.url)) ? null : action.gameId)).filter((id): id is string => !!id))
  const todo = plan.filter(action => action.kind !== 'skip' && !(action.kind === 'map' && missing.has(action.gameId)))

  for (const action of plan) {
    if (action.kind === 'map') console.log(missing.has(action.gameId) ? `MISS map  ${action.gameId} hashed object not in Storage: ${action.url}` : `plan map  ${action.gameId} -> ${action.url}`)
    else if (action.kind === 'copy') console.log(`plan copy ${action.gameId} ${action.from} -> ${action.from.replace(/_cg\.webp$/, '_cg-<sha256[:12] of its bytes>.webp')}`)
    else console.log(`skip      ${action.gameId} (${action.reason})`)
  }
  const count = (kind: string) => plan.filter(action => action.kind === kind).length
  console.log(`\n${rows.length} EGO rows: ${count('map') - missing.size} from the map, ${count('copy')} copies of {id}_cg.webp, ${count('skip')} skipped, ${missing.size} map entries without a Storage object`)
  if (!FIX) return console.log('dry-run: nothing written (--fix applies)')

  const uploads: Upload[] = [], updated: { id: string; gameId: string; artwork_url: string }[] = []
  for (const action of todo) {
    let artworkUrl: string
    if (action.kind === 'map') artworkUrl = action.url
    else if (action.kind === 'copy') {
      const response = await fetch(egoArtworkPublicUrl(action.from))
      if (!response.ok) throw Error(`download ${action.from}: ${response.status}`)
      const stored = new Set<string>()
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await bucket.list(egoFolderKey(action.sinnerId, action.folder), { limit: 1000, offset })
        if (error) throw Error(`Storage ${action.folder}: ${error.message}`)
        for (const item of data) stored.add(item.name)
        if (data.length < 1000) break
      }
      const copy = await uploadEgoArtworkCopy({
        ego: { game_id: action.gameId, sinner_id: action.sinnerId, folder_name: action.folder }, webp: Buffer.from(await response.arrayBuffer()), stored, bucket, uploads, fix: true,
      })
      console.log(`${copy.uploaded ? 'upload' : 'exists'} ${copy.key}`)
      artworkUrl = copy.url
    } else continue
    // Only a row that still has no artwork_url is written: the filter keeps a concurrent apply's value.
    const { error } = await db().from('ego').update({ artwork_url: artworkUrl }).eq('id', action.id).is('artwork_url', null)
    if (error) throw Error(`ego ${action.gameId} artwork_url: ${error.message}`)
    updated.push({ id: action.id, gameId: action.gameId, artwork_url: artworkUrl })
    console.log(`set    ${action.gameId}`)
  }
  const out = option('--out')
  if (out) writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), uploads, updated, missingMapObjects: [...missing] }, null, 2) + '\n')
  console.log(`done: ${updated.length} rows set, ${uploads.length} objects uploaded${out ? `, receipt ${out}` : ''}`)
  await revalidate()
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
