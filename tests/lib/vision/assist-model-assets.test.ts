import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STORAGE_BASE } from '@/lib/constants/game'
import { ASSIST_MODEL_VERSION, ASSIST_RUNTIME_ROOT, ASSIST_RUNTIME_VERSION, assistModelRoot, assistRuntimeDataRoot, ortWasmPaths } from '@/lib/vision/model-assets'
import { assistModelFiles, assistModelVersion, assistRuntimeFiles } from '@/scripts/vision/assist-model-files'

const root = resolve(__dirname, '../../..')
const text = (file: string) => readFileSync(resolve(root, file), 'utf8')

describe('REQ-ASSIST-073 where the recognition models are read', () => {
  it('REQ-ASSIST-073 a deployed site reads the Storage copy of exactly these model files', () => {
    // A model changed without `npm run upload:assist-models` keeps the old version here and fails.
    expect(ASSIST_MODEL_VERSION).toBe(assistModelVersion())
    expect(assistModelRoot('saigo-no-dante.com')).toBe(`${STORAGE_BASE}/models/${ASSIST_MODEL_VERSION}`)
    expect(assistModelFiles()).toEqual(expect.arrayContaining(['assist-scene/scene.onnx', 'assist-ocr/paddle/det.onnx', 'assist-ocr/paddle/ja/dict.json']))
  })

  it('REQ-ASSIST-073 a local dev server reads public/models', () => {
    expect(assistModelRoot('localhost')).toBe('/models')
    expect(assistModelRoot('127.0.0.1')).toBe('/models')
  })
})

describe('REQ-ASSIST-074 runtimes are served by the site itself', () => {
  it('REQ-ASSIST-074 the workers read ONNX Runtime and Tesseract from this origin, never from a CDN', () => {
    // A cross-origin script was blocked by CSP in some browsers (2026-10-16, OCR never started); 'self' always loads.
    expect(ASSIST_RUNTIME_ROOT).toBe('/models')
    for (const worker of ['lib/vision/ocr-worker.ts', 'lib/vision/scene-worker.ts', 'lib/vision/model-assets.ts']) expect(text(worker)).not.toMatch(/jsdelivr|unpkg/)
    const ocr = text('lib/vision/ocr-worker.ts')
    expect(ocr).toMatch(/corePath: `\$\{ROOT\}\/core`/)
    expect(ocr).toMatch(/langPath: `\$\{DATA_ROOT\}\/assist-ocr\/lang`/)
  })

  it('REQ-ASSIST-074 the build copies the runtimes and the deployment leaves out only the models', () => {
    const scripts: Record<string, string> = JSON.parse(text('package.json')).scripts
    expect(scripts['build:assist-worker']).toMatch(/ort-wasm-simd-threaded\.asyncify\.mjs .*ort-wasm-simd-threaded\.asyncify\.wasm public\/models\/assist-scene\//)
    expect(scripts['build:assist-ocr']).toMatch(/tesseract\.js-core\/\*-lstm\.wasm\.js public\/models\/assist-ocr\/core\//)
    expect(scripts['build:assist-ocr']).toMatch(/kor\.traineddata\.gz .*public\/models\/assist-ocr\/lang\//)
    const ignored = text('.vercelignore')
    expect(ignored).toContain('public/models/**/*.onnx')
    expect(ignored).toContain('public/models/**/*.json')
    expect(ignored).toContain('public/models/**/*.wasm')
    expect(ignored).toContain('public/models/**/*.traineddata.gz')
    expect(ignored.split('\n').filter(row => !row.startsWith('#')).join('\n')).not.toMatch(/\.mjs|\.js\b/)
  })

  it('REQ-ASSIST-074 the CSP adds no CDN for scripts', () => {
    expect(text('next.config.ts')).not.toMatch(/jsdelivr/)
  })
})

describe('REQ-ASSIST-075 runtime data files come from Storage, runtime scripts stay on this origin', () => {
  it('REQ-ASSIST-075 a deployed site reads .wasm and language data from Storage, a local dev server from public/models', () => {
    expect(ASSIST_RUNTIME_VERSION).toMatch(/^[0-9a-f]{12}$/)
    expect(assistRuntimeDataRoot('saigo-no-dante.com')).toBe(`${STORAGE_BASE}/runtime/${ASSIST_RUNTIME_VERSION}`)
    expect(assistRuntimeDataRoot('localhost')).toBe('/models')
  })

  it('REQ-ASSIST-075 ONNX Runtime keeps its .mjs script same-origin and loads only the .wasm from Storage', () => {
    const prod = ortWasmPaths('saigo-no-dante.com')
    expect(prod.mjs).toBe(`${ASSIST_RUNTIME_ROOT}/assist-scene/ort-wasm-simd-threaded.asyncify.mjs`)
    expect(prod.wasm).toBe(`${STORAGE_BASE}/runtime/${ASSIST_RUNTIME_VERSION}/assist-scene/ort-wasm-simd-threaded.asyncify.wasm`)
    expect(ortWasmPaths('localhost').wasm).toBe('/models/assist-scene/ort-wasm-simd-threaded.asyncify.wasm')
  })

  it('REQ-ASSIST-075 the workers use the helpers and the unused tesseract .wasm is not copied', () => {
    expect(text('lib/vision/scene-worker.ts')).toMatch(/wasmPaths = ortWasmPaths\(/)
    expect(text('lib/vision/ocr-worker.ts')).toMatch(/wasmPaths = ortWasmPaths\(/)
    expect(JSON.parse(text('package.json')).scripts['build:assist-ocr']).not.toMatch(/-lstm\.wasm\*/)
  })

  it('REQ-ASSIST-075 the upload sends only non-script runtime files', () => {
    const runtime = assistRuntimeFiles()
    // public/models/**/*.wasm is a build copy (empty before the build), so only the filter is checked.
    for (const file of runtime) expect(file).toMatch(/\.(wasm|traineddata\.gz)$/)
  })

  it('REQ-ASSIST-075 script-src gains no external host besides the visitor analytics beacons', () => {
    const line = text('next.config.ts').split('\n').find(row => row.includes('script-src'))!
    const hosts = line.match(/https?:\/\/[^\s`"']+/g)
    expect(hosts).toEqual(['https://va.vercel-scripts.com', 'https://static.cloudflareinsights.com'])
  })
})
