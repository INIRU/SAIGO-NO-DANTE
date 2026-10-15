import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/** The assist recognition models: every .onnx and .json under public/models (the runtimes and worker bundles are not). */
export const MODELS_DIR = resolve(__dirname, '../../public/models')

export function assistModelFiles(): string[] {
  return readdirSync(MODELS_DIR, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(onnx|json)$/.test(entry.name))
    .map(entry => relative(MODELS_DIR, join(entry.parentPath, entry.name)).split('\\').join('/'))
    .sort()
}

/** First 12 hex of the sha256 over each model file's path and content: the Storage folder they are uploaded to. */
export function assistModelVersion(): string {
  const hash = createHash('sha256')
  for (const file of assistModelFiles()) hash.update(`${file}\0`).update(readFileSync(join(MODELS_DIR, file))).update('\0')
  return hash.digest('hex').slice(0, 12)
}
