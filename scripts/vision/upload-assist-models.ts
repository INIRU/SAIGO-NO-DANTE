// Uploads the assist recognition models (public/models/**/*.onnx|json) to Storage under models/<version>/ and the runtime
// data the workers fetch (ONNX .wasm, Tesseract language data) under runtime/<version>/, then writes both versions into
// features/assist/lib/model-assets.ts. The runtime files are build copies: run `npm run build:assist-worker` and
// `npm run build:assist-ocr` first. Run after replacing a model or upgrading onnxruntime-web / tesseract:
// npm run upload:assist-models
// `-- --dry-run` lists what would be sent and touches neither Storage nor model-assets.ts.
// Files already in a version folder are kept (same version = same content); nothing is deleted.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { MODELS_DIR, assistModelFiles, assistModelVersion, assistRuntimeFiles, assistRuntimeVersion } from './assist-model-files'

const dryRun = process.argv.includes('--dry-run')

function contentType(file: string) {
  if (file.endsWith('.json')) return 'application/json'
  if (file.endsWith('.wasm')) return 'application/wasm'
  if (file.endsWith('.gz')) return 'application/gzip'
  return 'application/octet-stream'
}

function storageClient() {
  loadEnvConfig(process.cwd())
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are needed (.env.local)')
  return createClient(url, key, { auth: { persistSession: false } }).storage.from('limbus-assets')
}

async function main() {
  const storage = dryRun ? null : storageClient()
  const groups = [
    { folder: 'models', version: assistModelVersion(), files: assistModelFiles(), constant: 'ASSIST_MODEL_VERSION' },
    { folder: 'runtime', version: assistRuntimeVersion(), files: assistRuntimeFiles(), constant: 'ASSIST_RUNTIME_VERSION' },
  ]
  const assets = resolve(MODELS_DIR, '../../features/assist/lib/model-assets.ts')
  let source = readFileSync(assets, 'utf8')
  for (const { folder, version, files, constant } of groups) {
    if (!files.length) throw new Error(`no ${folder} files under public/models (run the build:assist-* scripts first)`)
    let uploaded = 0, kept = 0, bytes = 0, total = 0
    for (const file of files) {
      const body = readFileSync(join(MODELS_DIR, file))
      const path = `${folder}/${version}/${file}`
      total += body.length
      const size = `(${(body.length / 1048576).toFixed(1)}MB, ${contentType(file)})`
      if (!storage) { console.log(`would upload ${path} ${size}`); continue }
      const { error } = await storage.upload(path, body, {
        contentType: contentType(file),
        // The path changes with the content, so a year is safe.
        cacheControl: '31536000',
        upsert: false,
      })
      if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`${file}: ${error.message}`)
      if (error) kept++
      else { uploaded++; bytes += body.length }
      console.log(`${error ? 'kept' : 'uploaded'} ${path} ${size}`)
    }
    console.log(storage
      ? `${folder} ${version}: ${uploaded} uploaded (${(bytes / 1048576).toFixed(1)}MB), ${kept} already there`
      : `${folder} ${version}: ${files.length} files, ${(total / 1048576).toFixed(1)}MB (dry run)`)
    source = source.replace(new RegExp(`export const ${constant} = '[0-9a-f]+'`), `export const ${constant} = '${version}'`)
  }
  if (storage) writeFileSync(assets, source)
}

main().catch(error => { console.error(error); process.exit(1) })
