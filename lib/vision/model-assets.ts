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

/** ONNX Runtime's wasm files on jsDelivr, at the version bundled into the worker (the two must match). */
export function ortRuntimeRoot(version: string) {
  return `https://cdn.jsdelivr.net/npm/onnxruntime-web@${version}/dist/`
}
