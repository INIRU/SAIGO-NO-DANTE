// @ts-nocheck -- developer tool run with tsx.
/**
 * Copies the Assist recognition samples (frames and rows) and the recognition reports from Supabase to the sample archive,
 * which is where the replay and training tools read them.
 * Usage: npx tsx scripts/vision/pull_samples.ts [out dir] [--delete-uploaded]
 * Default out dir: ~/Library/Mobile Documents/com~apple~CloudDocs/Limbus/assist/samples (iCloud Drive).
 * Layout: <out>/<path>/<n>.jpg as in the bucket, <out>/rows.json (assist_samples rows), <out>/reports.json.
 * A frame already on disk with a size is kept; a group counts as complete when every frame is there and the sizes add
 * up to the row's bytes. Rows already in the archive are kept, so a sample deleted on the server stays here.
 * Samples sent before the training consent (no consent version) are deleted from the archive 180 days after they were
 * received, as their senders were told (sampleExpiresAt).
 * --delete-uploaded: after the copy, deletes from the server every sample that is complete in the archive. Without it
 * nothing is deleted on the server.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { sampleExpiresAt } from '../../lib/vision/assist-samples'

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'))
const deleteUploaded = process.argv.includes('--delete-uploaded')
const out = path.resolve(args[0] ?? path.join(homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/Limbus/assist/samples'))
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(line => /^[A-Z_]+=/.test(line))
  .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).replace(/^["']|["']$/g, '')]))
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)
const bucket = admin.storage.from('assist-samples')

/** Every row of a table, oldest first (one request returns at most 1000). */
async function all(table: string) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.schema('limbus').from(table).select('*').order('created_at').order('id').range(from, from + 999)
    if (error) throw Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

/** The archive's rows with the server's: the server's copy wins, rows only in the archive (deleted on the server) stay. */
function merged(file: string, server: { id: string; created_at: string }[]) {
  const kept = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
  return [...new Map([...kept, ...server].map(row => [row.id, row])).values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

async function main() {
  mkdirSync(out, { recursive: true })
  const server = await all('assist_samples')
  const frames = server.flatMap(row => Array.from({ length: row.frame_count }, (_, index) => `${row.path}/${index}.jpg`))
  const missing = frames.filter(file => !(existsSync(path.join(out, file)) && statSync(path.join(out, file)).size > 0))
  console.log(`${server.length} groups, ${frames.length} frames on the server; ${missing.length} to download into ${out}`)
  let done = 0, failed = 0
  const queue = [...missing]
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const { data, error } = await bucket.download(file)
      if (error) { failed++; console.warn(`FAIL ${file}: ${error.message}`); continue }
      mkdirSync(path.dirname(path.join(out, file)), { recursive: true })
      writeFileSync(path.join(out, file), Buffer.from(await data.arrayBuffer()))
      if (++done % 500 === 0) console.log(`  ${done}/${missing.length}`)
    }
  }))
  // Samples from before the training consent leave the archive when their 180 days are over.
  const now = Date.now()
  const everything = merged(path.join(out, 'rows.json'), server)
  const expired = everything.filter(row => (sampleExpiresAt(row) ?? Infinity) < now)
  for (const row of expired) rmSync(path.join(out, row.path), { recursive: true, force: true })
  const rows = everything.filter(row => !expired.includes(row))
  // A group is complete when every frame is on disk and the sizes add up to what the row recorded at upload.
  const incomplete = rows.filter(row => {
    const sizes = Array.from({ length: row.frame_count }, (_, index) => path.join(out, row.path, `${index}.jpg`)).map(file => existsSync(file) ? statSync(file).size : 0)
    return sizes.some(size => !size) || sizes.reduce((sum, size) => sum + size, 0) !== row.bytes
  })
  writeFileSync(path.join(out, 'rows.json'), JSON.stringify(rows, null, 1))
  writeFileSync(path.join(out, 'reports.json'), JSON.stringify(merged(path.join(out, 'reports.json'), await all('assist_reports')), null, 1))
  console.log(`downloaded ${done}, failed ${failed}; archive ${rows.length} groups (${rows.length - server.filter(row => rows.includes(row)).length} only here), complete ${rows.length - incomplete.length}/${rows.length}, expired and removed ${expired.length}`)
  for (const row of incomplete.slice(0, 20)) console.warn(`INCOMPLETE ${row.path}`)
  if (failed || incomplete.length) process.exitCode = 1

  if (!deleteUploaded) return
  // Only what is whole in the archive leaves the server: frames first, then the row (as the server's own retention does).
  const safe = server.filter(row => rows.includes(row) && !incomplete.includes(row))
  let removedGroups = 0
  for (let from = 0; from < safe.length; from += 20) {
    const batch = safe.slice(from, from + 20)
    const removed = await bucket.remove(batch.flatMap(row => Array.from({ length: row.frame_count }, (_, index) => `${row.path}/${index}.jpg`)))
    if (removed.error) { console.warn(`server delete failed: ${removed.error.message}`); process.exitCode = 1; break }
    const { error } = await admin.schema('limbus').from('assist_samples').delete().in('id', batch.map(row => row.id))
    if (error) { console.warn(`server row delete failed: ${error.message}`); process.exitCode = 1; break }
    removedGroups += batch.length
  }
  console.log(`deleted on the server: ${removedGroups}/${server.length} groups (kept there: ${server.length - safe.length} not complete in the archive)`)
}
main().catch(error => { console.error(error); process.exit(1) })
