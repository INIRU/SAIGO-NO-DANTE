import { STORAGE_BASE } from '../constants/game'

/** Content hash of the models in public/models (scripts/vision/assist-model-files.ts); `npm run upload:assist-models` uploads them under it and writes it here. */
export const ASSIST_MODEL_VERSION = '34f50e1c3c0f'

/**
 * Where the assist workers read their recognition models. A deployed site reads the Storage copy (the files are kept
 * out of the deployment by .vercelignore); a local dev server reads public/models, so a retrained model can be tried
 * before it is uploaded.
 */
export function assistModelRoot(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' ? '/models' : `${STORAGE_BASE}/models/${ASSIST_MODEL_VERSION}`
}

/** Content hash of the runtime data files (.wasm, language data) the build copies; `npm run upload:assist-models` uploads them under it and writes it here. */
export const ASSIST_RUNTIME_VERSION = '7c4d8726e22b'

/**
 * Where the workers read ONNX Runtime (assist-scene/) and Tesseract (assist-ocr/core, lang): copies the build makes from
 * node_modules, served by the site itself. A CDN was tried on 2026-10-16 and some browsers blocked its scripts by CSP,
 * so OCR never started; a same-origin script always loads. Only files that are fetched, never run as scripts, may leave
 * this origin: see assistRuntimeDataRoot.
 */
export const ASSIST_RUNTIME_ROOT = '/models'

/**
 * Where the workers fetch runtime data that is not a script (ONNX .wasm, Tesseract language data): the Storage copy on a
 * deployed site (kept out of the deployment by .vercelignore), public/models on a local dev server. fetch is governed by
 * CSP connect-src, which allows Storage; script-src must not be widened, so every .js/.mjs stays on ASSIST_RUNTIME_ROOT.
 */
export function assistRuntimeDataRoot(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' ? '/models' : `${STORAGE_BASE}/runtime/${ASSIST_RUNTIME_VERSION}`
}

/** ONNX Runtime files: the .mjs is imported as a script (same origin), the .wasm is fetched (Storage). */
export function ortWasmPaths(hostname: string) {
  return {
    mjs: `${ASSIST_RUNTIME_ROOT}/assist-scene/ort-wasm-simd-threaded.asyncify.mjs`,
    wasm: `${assistRuntimeDataRoot(hostname)}/assist-scene/ort-wasm-simd-threaded.asyncify.wasm`,
  }
}
