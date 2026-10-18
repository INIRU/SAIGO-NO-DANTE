import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/** The assist recognition models: every .onnx and .json under public/models (the runtimes and worker bundles are not). */
export const MODELS_DIR = resolve(__dirname, '../../public/models')

function filesMatching(pattern: RegExp): string[] {
  return readdirSync(MODELS_DIR, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && pattern.test(entry.name))
    .map(entry => relative(MODELS_DIR, join(entry.parentPath, entry.name)).split('\\').join('/'))
    .sort()
}

export const assistModelFiles = () => filesMatching(/\.(onnx|json)$/)

/** Runtime data the workers fetch: ONNX Runtime .wasm and Tesseract language data. Scripts (.js, .mjs) are never in this list. */
export const assistRuntimeFiles = () => filesMatching(/\.(wasm|traineddata\.gz)$/)

/** First 12 hex of the sha256 over each model file's path and content: the Storage folder they are uploaded to. */
export const assistModelVersion = () => versionOf(assistModelFiles())

/** Same hash over the runtime data files (needs the build first: they are copies from node_modules). */
export const assistRuntimeVersion = () => versionOf(assistRuntimeFiles())

function versionOf(files: string[]): string {
  const hash = createHash('sha256')
  for (const file of files) hash.update(`${file}\0`).update(readFileSync(join(MODELS_DIR, file))).update('\0')
  return hash.digest('hex').slice(0, 12)
}
