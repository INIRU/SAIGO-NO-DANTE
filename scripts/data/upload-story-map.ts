// Uploads the story map export (Limbus Assets pipeline/story_map.py → out/_story_map) to Storage under story-map/:
// index.json and sub/<id>.json (the stages and their enemies), map/<id>/<r>_<c>.webp (map tiles), cg/<nodeId>.webp
// (stage card pictures) and ui/*.webp (node, card frame, icons). The story page reads them from STORY_MAP_BASE.
// npx tsx scripts/data/upload-story-map.ts [export dir, default E:/Limbus Assets/out/_story_map]
// `-- --dry-run` lists what would be sent. Pictures already there are kept; the JSON files are replaced. Nothing is deleted.
// `--replace <file>`: pictures whose paths (one per line, relative to the export, e.g. cg/911207.webp) are replaced too.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { storageName } from '../../lib/storage-name'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

const dryRun = process.argv.includes('--dry-run')
const replaceAt = process.argv.indexOf('--replace')
const replace = new Set(replaceAt > 0 ? readFileSync(process.argv[replaceAt + 1], 'utf8').split(/\r?\n/).filter(Boolean) : [])
// `--prefix story-map-test`: a test copy, so work in progress never replaces what the live site reads (story-map/)
const prefixAt = process.argv.indexOf('--prefix')
const prefix = prefixAt > 0 ? process.argv[prefixAt + 1].replace(/\/+$/, '') : 'story-map'
const root = process.argv.slice(2).find((a, i, args) => !a.startsWith('--') && args[i - 1] !== '--replace' && args[i - 1] !== '--prefix') ?? 'E:/Limbus Assets/out/_story_map'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

function storageClient() {
  loadEnvConfig(process.cwd())
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are needed (.env.local)')
  return createClient(url, key, { auth: { persistSession: false } }).storage.from('limbus-assets')
}

async function main() {
  const storage = dryRun ? null : storageClient()
  const all = files(root).filter(f => /\.(json|webp|png|ttf)$/.test(f))
  let uploaded = 0, kept = 0, bytes = 0, total = 0
  for (const file of all) {
    // Storage keys are ASCII: a file named in other letters goes up as storageName(name)
    const rel = relative(root, file).replaceAll('\\', '/').split('/')
    rel[rel.length - 1] = rel[rel.length - 1].replace(/^(.*?)(\.[a-z0-9]+)$/i, (_m: string, n: string, ext: string) => storageName(n) + ext)
    const path = `${prefix}/${rel.join('/')}`
    const body = readFileSync(file)
    const json = file.endsWith('.json')
    const overwrite = json || replace.has(relative(root, file).replaceAll('\\', '/'))
    total += body.length
    if (!storage) continue
    const { error } = await storage.upload(path, body, {
      contentType: json ? 'application/json' : file.endsWith('.png') ? 'image/png' : file.endsWith('.ttf') ? 'font/ttf' : 'image/webp', // png: the map effects' textures (fx/*/tex)
      // Pictures keep their content per path; the data changes with game updates, so it is replaced and cached briefly.
      cacheControl: json ? '600' : '31536000',
      upsert: overwrite,
    })
    if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`${path}: ${error.message}`)
    if (error) kept++
    else { uploaded++; bytes += body.length }
  }
  console.log(storage
    ? `${uploaded} uploaded (${(bytes / 1048576).toFixed(1)}MB), ${kept} already there`
    : `${all.length} files, ${(total / 1048576).toFixed(1)}MB would go to ${prefix}/ (dry run);${all.filter(f => replace.has(relative(root, f).replaceAll('\\', '/'))).length} pictures to replace`)
}

main().catch(error => { console.error(error); process.exit(1) })
