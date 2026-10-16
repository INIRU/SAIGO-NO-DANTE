import { STORAGE_BASE } from '../constants/game'

/** Content hash of the models in public/models (scripts/vision/assist-model-files.ts); `npm run upload:assist-models` uploads them under it and writes it here. */
export const ASSIST_MODEL_VERSION = '860d7ecad6cd'

/**
 * Where the assist workers read their recognition models. A deployed site reads the Storage copy (the files are kept
 * out of the deployment by .vercelignore); a local dev server reads public/models, so a retrained model can be tried
 * before it is uploaded.
 */
export function assistModelRoot(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' ? '/models' : `${STORAGE_BASE}/models/${ASSIST_MODEL_VERSION}`
}

/**
 * Where the workers read ONNX Runtime (assist-scene/) and Tesseract (assist-ocr/core, lang): copies the build makes from
 * node_modules, served by the site itself. A CDN was tried on 2026-10-16 and some browsers blocked its scripts by CSP,
 * so OCR never started; a same-origin script always loads.
 */
export const ASSIST_RUNTIME_ROOT = '/models'
