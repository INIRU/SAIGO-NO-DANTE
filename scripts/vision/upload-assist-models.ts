// Uploads the assist recognition models (public/models/**/*.onnx|json) to Storage under models/<version>/ and writes
// that version into lib/vision/model-assets.ts. Run after replacing a model: npm run upload:assist-models
// Files already in the version folder are kept (same version = same content); nothing is deleted.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { MODELS_DIR, assistModelFiles, assistModelVersion } from './assist-model-files'

loadEnvConfig(process.cwd())
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are needed (.env.local)')
const storage = createClient(url, key, { auth: { persistSession: false } }).storage.from('limbus-assets')

async function main() {
  const version = assistModelVersion()
  let uploaded = 0, kept = 0, bytes = 0
  for (const file of assistModelFiles()) {
    const body = readFileSync(join(MODELS_DIR, file))
    const { error } = await storage.upload(`models/${version}/${file}`, body, {
      contentType: file.endsWith('.json') ? 'application/json' : 'application/octet-stream',
      // The path changes with the content, so a year is safe.
      cacheControl: '31536000',
      upsert: false,
    })
    if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`${file}: ${error.message}`)
    if (error) kept++
    else { uploaded++; bytes += body.length }
    console.log(`${error ? 'kept' : 'uploaded'} models/${version}/${file} (${(body.length / 1048576).toFixed(1)}MB)`)
  }

  const assets = resolve(MODELS_DIR, '../../lib/vision/model-assets.ts')
  writeFileSync(assets, readFileSync(assets, 'utf8').replace(/export const ASSIST_MODEL_VERSION = '[0-9a-f]+'/, `export const ASSIST_MODEL_VERSION = '${version}'`))
  console.log(`version ${version}: ${uploaded} uploaded (${(bytes / 1048576).toFixed(1)}MB), ${kept} already there`)
}

main().catch(error => { console.error(error); process.exit(1) })
