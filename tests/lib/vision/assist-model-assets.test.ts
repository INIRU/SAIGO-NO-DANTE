import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STORAGE_BASE } from '@/lib/constants/game'
import { ASSIST_MODEL_VERSION, ASSIST_RUNTIME_ROOT, assistModelRoot } from '@/lib/vision/model-assets'
import { assistModelFiles, assistModelVersion } from '@/scripts/vision/assist-model-files'

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
    expect(ocr).toMatch(/langPath: `\$\{ROOT\}\/lang`/)
  })

  it('REQ-ASSIST-074 the build copies the runtimes and the deployment leaves out only the models', () => {
    const scripts: Record<string, string> = JSON.parse(text('package.json')).scripts
    expect(scripts['build:assist-worker']).toMatch(/ort-wasm-simd-threaded\.asyncify\.mjs .*ort-wasm-simd-threaded\.asyncify\.wasm public\/models\/assist-scene\//)
    expect(scripts['build:assist-ocr']).toMatch(/tesseract\.js-core\/\*-lstm\.wasm\* public\/models\/assist-ocr\/core\//)
    expect(scripts['build:assist-ocr']).toMatch(/kor\.traineddata\.gz .*public\/models\/assist-ocr\/lang\//)
    const ignored = text('.vercelignore')
    expect(ignored).toContain('public/models/**/*.onnx')
    expect(ignored).toContain('public/models/**/*.json')
    expect(ignored).not.toMatch(/\.wasm|\.mjs|traineddata/)
  })

  it('REQ-ASSIST-074 the CSP adds no CDN for scripts', () => {
    expect(text('next.config.ts')).not.toMatch(/jsdelivr/)
  })
})
