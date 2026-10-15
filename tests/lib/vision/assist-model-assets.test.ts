import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STORAGE_BASE } from '@/lib/constants/game'
import { ASSIST_MODEL_VERSION, assistModelRoot, ortRuntimeRoot } from '@/lib/vision/model-assets'
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

describe('REQ-ASSIST-074 runtimes come from jsDelivr and stay out of the deployment', () => {
  it('REQ-ASSIST-074 ONNX Runtime wasm comes from the bundled version on jsDelivr', () => {
    expect(ortRuntimeRoot('1.30.0')).toBe('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/')
  })

  it('REQ-ASSIST-074 the build copies no runtime files and the deployment leaves out the models', () => {
    const scripts: Record<string, string> = JSON.parse(text('package.json')).scripts
    expect(`${scripts['build:assist-worker']} ${scripts['build:assist-ocr']}`).not.toMatch(/ort-wasm|tesseract\.js-core|traineddata/)
    const ignored = text('.vercelignore')
    expect(ignored).toContain('public/models/**/*.onnx')
    expect(ignored).toContain('public/models/**/*.json')
  })

  it('REQ-ASSIST-074 the CSP lets the workers load scripts and files from jsDelivr', () => {
    const config = text('next.config.ts')
    expect(config).toMatch(/script-src.*https:\/\/cdn\.jsdelivr\.net\/npm\//)
    expect(config).toMatch(/connect-src.*https:\/\/cdn\.jsdelivr\.net\/npm\//)
  })
})
