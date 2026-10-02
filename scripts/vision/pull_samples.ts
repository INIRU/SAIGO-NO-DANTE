// @ts-nocheck -- developer tool run with tsx.
/**
 * Copies the Assist recognition samples (frames and rows) and the recognition reports from Supabase to a local folder,
 * which is where the replay and training tools read them. Nothing is deleted on the server.
 * Usage: npx tsx scripts/vision/pull_samples.ts [out dir]
 * Default out dir: ~/Library/Mobile Documents/com~apple~CloudDocs/Limbus/assist/samples (iCloud Drive).
 * Layout: <out>/<path>/<n>.jpg as in the bucket, <out>/rows.json (assist_samples rows), <out>/reports.json.
 * A frame already on disk with a size is kept; a group counts as complete when every frame is there and the sizes add
 * up to the row's bytes.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const out = path.resolve(process.argv[2] ?? path.join(homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/Limbus/assist/samples'))
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

async function main() {
  mkdirSync(out, { recursive: true })
  const rows = await all('assist_samples')
  const frames = rows.flatMap(row => Array.from({ length: row.frame_count }, (_, index) => `${row.path}/${index}.jpg`))
  const missing = frames.filter(file => !(existsSync(path.join(out, file)) && statSync(path.join(out, file)).size > 0))
  console.log(`${rows.length} groups, ${frames.length} frames on the server; ${missing.length} to download into ${out}`)
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
  // A group is complete when every frame is on disk and the sizes add up to what the row recorded at upload.
  const incomplete = rows.filter(row => {
    const sizes = Array.from({ length: row.frame_count }, (_, index) => path.join(out, row.path, `${index}.jpg`)).map(file => existsSync(file) ? statSync(file).size : 0)
    return sizes.some(size => !size) || sizes.reduce((sum, size) => sum + size, 0) !== row.bytes
  })
  writeFileSync(path.join(out, 'rows.json'), JSON.stringify(rows, null, 1))
  writeFileSync(path.join(out, 'reports.json'), JSON.stringify(await all('assist_reports'), null, 1))
  console.log(`downloaded ${done}, failed ${failed}; complete groups ${rows.length - incomplete.length}/${rows.length}`)
  for (const row of incomplete.slice(0, 20)) console.warn(`INCOMPLETE ${row.path}`)
  if (failed || incomplete.length) process.exitCode = 1
}
main().catch(error => { console.error(error); process.exit(1) })
