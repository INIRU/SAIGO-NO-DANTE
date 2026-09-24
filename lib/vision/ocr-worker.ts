import { createWorker, PSM } from 'tesseract.js'
import * as ort from 'onnxruntime-web/webgpu'
import { popupEffectBox, popupHeaderBox, popupPlateUnit } from './popup-detect'
import { popupHeaderEvidence } from './popup-evidence'
import { explorationFloor } from './exploration-match'
import { ctcDecode, detSize, detTensor, fillRecLine, recAlphabet, recBatchWidth, recLineWidth, REC_HEIGHT, textRects,
  type TextRect } from './paddle-text'

type Language = 'ko' | 'en' | 'ja'
type Request =
  | { type: 'init'; language: Language }
  | { type: 'recognize'; requestId: number; frame: ImageBitmap; mode?: 'full' | 'line' | 'word'; detSide?: number }
  | { type: 'popup'; requestId: number; frame: ImageBitmap; box: { x: number; y: number; width: number; height: number } }
  | { type: 'explore'; requestId: number; frame: ImageBitmap }
  | { type: 'dispose' }

interface OcrWord {
  text: string
  confidence: number
  left: number
  top: number
  width: number
  height: number
}

type Response =
  | { type: 'ready' }
  | { type: 'result'; requestId: number; text: string; words: OcrWord[] }
  | { type: 'popupResult'; requestId: number; header: string; label: string; labelWords: OcrWord[];
    labels: { text: string; words: OcrWord[] }[]; body: string }
  | { type: 'popupError'; requestId: number }
  | { type: 'exploreResult'; requestId: number; floorText: string; themeReads: OcrWord[][] }
  | { type: 'error'; requestId?: number; message: string }
  | { type: 'disposed' }
  | { type: 'backend'; engine: 'paddle' | 'tesseract'; adapter: string; loading: boolean; reason?: string }

const ROOT = '/models/assist-ocr'
const LANGUAGES: Record<Language, string> = { ko: 'kor+eng', en: 'eng', ja: 'jpn+eng' }
let reader: Awaited<ReturnType<typeof createWorker>> | null = null
let busy = false
let disposed = false

// Korean PP-OCRv5 mobile det+rec on a real WebGPU adapter. Any load or run failure releases it for this worker's life
// and the same request is read by Tesseract, which stays loaded as the fallback.
const PADDLE_ROOT = `${ROOT}/paddle`
// ONNX Runtime's WebGPU build ships its runtime with the scene worker assets.
const ORT_ROOT = '/models/assist-scene/'
const PADDLE_TIMEOUT_MS = 8000
const FULL_FRAME_LINES = 80
const REC_BATCH = 6
/** A popup box or crop outside the frame: that frame is unreadable by any engine, the GPU is not at fault. */
class RegionError extends Error {}
let paddle: { det: ort.InferenceSession; rec: ort.InferenceSession; alphabet: string[]; adapter: string } | null = null
let paddleFailed = false

function respond(message: Response) {
  self.postMessage(message)
}

function parseWords(tsv: string): OcrWord[] {
  return tsv.split('\n').slice(1).flatMap(row => {
    const columns = row.split('\t')
    if (columns.length < 12 || columns[0] !== '5') return []
    const [left, top, width, height, confidence] = columns.slice(6, 11).map(Number)
    const text = columns.slice(11).join('\t').trim()
    if (!text || ![left, top, width, height, confidence].every(Number.isFinite)) return []
    return [{ text, confidence, left, top, width, height }]
  }).slice(0, 1000)
}

/** Name plates are saturated colors behind near-white text; the darkest channel separates them for any hue. */
function inkFromChannel(canvas: OffscreenCanvas, channel: 'min' | 'max') {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('OCR canvas unavailable')
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = image
  for (let at = 0; at < data.length; at += 4) {
    const value = channel === 'min' ? Math.min(data[at], data[at + 1], data[at + 2]) : Math.max(data[at], data[at + 1], data[at + 2])
    data[at] = data[at + 1] = data[at + 2] = 255 - value
  }
  context.putImageData(image, 0, 0)
  // Tesseract segments edge-touching glyphs poorly, so the dark text gets a white margin.
  const padded = new OffscreenCanvas(canvas.width + 32, canvas.height + 32)
  const output = padded.getContext('2d')
  if (!output) throw new Error('OCR canvas unavailable')
  output.fillStyle = '#fff'
  output.fillRect(0, 0, padded.width, padded.height)
  output.drawImage(canvas, 16, 16)
  return padded
}

// Last banner position that re-read as "N층 탐사", as frame fractions; the game UI does not move within a session.
let bannerHint: { left: number; right: number; top: number; unit: number } | null = null

/** Exploration banner ("N층 탐사 중") and the theme line below it, located by text rather than fixed pixels. */
async function readExploration(frame: ImageBitmap) {
  if (!reader) throw new Error('OCR not ready')
  const region = { x: 0, y: frame.height * 0.05, width: frame.width * 0.45, height: frame.height * 0.37 }
  // Banner glyphs are large; reading at 0.6x of a 1080p frame keeps them near Tesseract's preferred size.
  const scale = 0.6 * 1080 / frame.height
  const draw = (x: number, y: number, width: number, height: number, factor: number, channel: 'min' | 'raw' = 'min') => {
    const left = Math.max(0, Math.floor(x)), top = Math.max(0, Math.floor(y))
    const right = Math.min(frame.width, Math.ceil(x + width)), bottom = Math.min(frame.height, Math.ceil(y + height))
    if (right <= left || bottom <= top) throw new Error('Invalid exploration crop')
    const canvas = new OffscreenCanvas(Math.max(1, Math.round((right - left) * factor)), Math.max(1, Math.round((bottom - top) * factor)))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('OCR canvas unavailable')
    context.drawImage(frame, left, top, right - left, bottom - top, 0, 0, canvas.width, canvas.height)
    if (channel === 'min') return { canvas: inkFromChannel(canvas, 'min'), left, top }
    const padded = new OffscreenCanvas(canvas.width + 32, canvas.height + 32)
    const output = padded.getContext('2d')
    if (!output) throw new Error('OCR canvas unavailable')
    output.drawImage(canvas, 16, 16)
    return { canvas: padded, left, top }
  }
  const readBanner = async (left: number, right: number, top: number, unit: number) => {
    const banner = draw(left - unit * 0.3, top - unit * 0.25, right - left + unit * 0.6, unit * 1.5, 40 / unit)
    return (await reader!.recognize(banner.canvas, {}, { text: true })).data.text.slice(0, 100)
  }
  // The dim pack name over a moving map is read in several ways; callers accept only an exact, agreeing catalog name.
  const readTheme = async (left: number, top: number, unit: number) => {
    const reads: OcrWord[][] = []
    for (const [size, channel] of [[60, 'min'], [80, 'min'], [60, 'raw']] as const) {
      const line = draw(left - unit * 0.2, top + unit * 1.1, unit * 7, unit * 0.8, size / unit, channel)
      reads.push(parseWords((await reader!.recognize(line.canvas, {}, { tsv: true })).data.tsv ?? '').slice(0, 40))
    }
    return reads
  }
  if (bannerHint) {
    const hint = { left: bannerHint.left * frame.width, right: bannerHint.right * frame.width,
      top: bannerHint.top * frame.height, unit: bannerHint.unit * frame.height }
    await reader.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE })
    const floorText = await readBanner(hint.left, hint.right, hint.top, hint.unit)
    if (/[1-9][층증충]/u.test(floorText.replace(/\s+/g, ''))) {
      return { floorText, themeReads: await readTheme(hint.left, hint.top, hint.unit) }
    }
  }
  await reader.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
  const overview = draw(region.x, region.y, region.width, region.height, scale)
  const words = parseWords((await reader.recognize(overview.canvas, {}, { tsv: true })).data.tsv ?? '')
    .filter(word => word.height >= 6)
  const sameRow = (word: OcrWord, other: OcrWord) =>
    Math.abs(other.top + other.height / 2 - word.top - word.height / 2) < word.height / 2
  // Hangul is split into glyph boxes; prefer the row holding 탐(or 람), otherwise try the tallest rows because the
  // banner is sometimes read as Latin letters. Every candidate must still re-read as "N층 탐사" below.
  const hangul = words.filter(word => /[탐람]/u.test(word.text))
  const tallest = [...words].sort((left, right) => right.height - left.height)
  const seeds = [...hangul, ...tallest].filter((word, index, all) =>
    all.findIndex(other => sameRow(other, word)) === index).slice(0, 3)
  await reader.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE })
  for (const seed of seeds) {
    const row = words.filter(word => sameRow(seed, word) && Math.abs(word.left - seed.left) < seed.height * 4)
    const unit = seed.height / scale
    const toFrameX = (value: number) => overview.left + (value - 16) / scale
    const left = toFrameX(Math.min(...row.map(word => word.left)))
    const right = toFrameX(Math.max(...row.map(word => word.left + word.width)))
    const top = overview.top + (seed.top - 16) / scale
    const floorText = await readBanner(left, right, top, unit)
    if (!/[1-9]/.test(floorText)) continue
    if (/[1-9][층증충]/u.test(floorText.replace(/\s+/g, ''))) {
      bannerHint = { left: left / frame.width, right: right / frame.width, top: top / frame.height, unit: unit / frame.height }
    }
    const themeLine = await readTheme(left, top, unit)
    // The overview already read the line under the banner once; it is kept as a second, independent read.
    const below = words.filter(word => word.top > seed.top + seed.height * 0.9 && word.top < seed.top + seed.height * 2 &&
      word.left >= Math.min(...row.map(item => item.left)) - seed.height && word.left < seed.left + seed.height * 7).slice(0, 40)
    return { floorText, themeReads: [...themeLine, below] }
  }
  return { floorText: '', themeReads: [] }
}

async function webgpuAdapter(): Promise<string | null> {
  const gpu = (self.navigator as unknown as { gpu?: { requestAdapter(options?: object): Promise<{
    isFallbackAdapter?: boolean; info?: { vendor?: string; architecture?: string; isFallbackAdapter?: boolean } } | null> } }).gpu
  if (!gpu) return null
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' })
    if (!adapter || adapter.isFallbackAdapter || adapter.info?.isFallbackAdapter) return null
    return [adapter.info?.vendor, adapter.info?.architecture].filter(Boolean).join(' ') || 'GPU'
  } catch {
    return null
  }
}

function withTimeout<T>(promise: Promise<T>, ms = PADDLE_TIMEOUT_MS): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  return Promise.race([promise, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('GPU OCR timed out')), ms) })])
    .finally(() => clearTimeout(timeout))
}

async function releasePaddle(reason: string) {
  const current = paddle
  paddle = null
  paddleFailed = true
  if (current) await withTimeout(Promise.allSettled([current.det.release(), current.rec.release()]), 2000).catch(() => {})
  if (!disposed) respond({ type: 'backend', engine: 'tesseract', adapter: '', loading: false, reason })
}

/** Loads the GPU models after Tesseract is ready, so capture never waits for them. */
async function loadPaddle() {
  const adapter = await webgpuAdapter()
  if (disposed) return
  if (!adapter) {
    paddleFailed = true
    respond({ type: 'backend', engine: 'tesseract', adapter: '', loading: false, reason: 'webgpu-unavailable' })
    return
  }
  respond({ type: 'backend', engine: 'tesseract', adapter: '', loading: true })
  let det: ort.InferenceSession | null = null
  let rec: ort.InferenceSession | null = null
  try {
    ort.env.wasm.numThreads = 1
    ort.env.wasm.wasmPaths = ORT_ROOT
    const response = await fetch(`${PADDLE_ROOT}/dict.json`)
    if (!response.ok) throw new Error('OCR dictionary unavailable')
    const alphabet = recAlphabet(await response.json())
    const options: ort.InferenceSession.SessionOptions = { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' }
    det = await withTimeout(ort.InferenceSession.create(`${PADDLE_ROOT}/det.onnx`, options), 30000)
    rec = await withTimeout(ort.InferenceSession.create(`${PADDLE_ROOT}/rec.onnx`, options), 30000)
    // The first run compiles shaders; it is paid here rather than on the first popup.
    await runModel(det, new Float32Array(3 * 544 * 960), [1, 3, 544, 960])
    if (alphabet.length !== (await runModel(rec, new Float32Array(3 * REC_HEIGHT * 320), [1, 3, REC_HEIGHT, 320])).dims[2]) {
      throw new Error('OCR dictionary does not match the model')
    }
    if (disposed) throw new Error('Disposed')
    paddle = { det, rec, alphabet, adapter }
    respond({ type: 'backend', engine: 'paddle', adapter, loading: false })
  } catch (error) {
    if (!disposed) console.warn('GPU OCR unavailable; using Tesseract', error)
    await Promise.allSettled([det?.release(), rec?.release()])
    paddleFailed = true
    if (!disposed) respond({ type: 'backend', engine: 'tesseract', adapter: '', loading: false, reason: 'gpu-ocr-init-failed' })
  }
}

async function runModel(session: ort.InferenceSession, input: Float32Array, dims: number[]) {
  const outputs = await withTimeout(session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, dims) }))
  const output = outputs[session.outputNames[0]]
  const data = await withTimeout(output.getData()) as Float32Array
  const result = { data, dims: [...output.dims] }
  for (const value of Object.values(outputs)) value.dispose()
  return result
}

function pixels(source: CanvasImageSource, x: number, y: number, width: number, height: number, outWidth: number, outHeight: number) {
  const canvas = new OffscreenCanvas(outWidth, outHeight)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('OCR canvas unavailable')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'low'
  context.drawImage(source, x, y, width, height, 0, 0, outWidth, outHeight)
  return context.getImageData(0, 0, outWidth, outHeight).data
}

/** Detection then recognition of every text line in a region of `source` (source pixels), capped at `maxLines`. */
async function paddleLines(source: CanvasImageSource, region: { x: number; y: number; width: number; height: number },
  detLimit: { side: number; type: 'max' | 'min' }, maxLines: number) {
  const engine = paddle
  if (!engine) throw new Error('GPU OCR unavailable')
  const size = detSize(region.width, region.height, detLimit.side, detLimit.type)
  const map = await runModel(engine.det, detTensor(pixels(source, region.x, region.y, region.width, region.height, size.width,
    size.height), size.width, size.height), [1, 3, size.height, size.width])
  const rects = textRects(map.data, map.dims[3], map.dims[2], region.width, region.height, maxLines)
  const lines: { text: string; score: number; rect: TextRect }[] = new Array(rects.length)
  // Similar aspect ratios share a batch, as in the official batching, so padding stays small.
  const order = rects.map((_, index) => index).sort((first, second) =>
    rects[first].width / rects[first].height - rects[second].width / rects[second].height)
  for (let start = 0; start < order.length; start += REC_BATCH) {
    const batch = order.slice(start, start + REC_BATCH)
    const width = recBatchWidth(batch.map(index => rects[index]))
    const input = new Float32Array(batch.length * 3 * REC_HEIGHT * width)
    batch.forEach((index, slot) => {
      const rect = rects[index]
      const lineWidth = recLineWidth(rect, width)
      fillRecLine(input, slot, width, pixels(source, region.x + rect.x, region.y + rect.y, rect.width, rect.height, lineWidth, REC_HEIGHT), lineWidth)
    })
    const logits = await runModel(engine.rec, input, [batch.length, 3, REC_HEIGHT, width])
    const [, steps, classes] = logits.dims
    batch.forEach((index, slot) => {
      const decoded = ctcDecode(logits.data, slot, steps, classes, engine.alphabet)
      lines[index] = { ...decoded, rect: { ...rects[index], x: rects[index].x + region.x, y: rects[index].y + region.y } }
    })
  }
  return lines
}

const lineWords = (lines: { text: string; score: number; rect: TextRect }[]): OcrWord[] => lines.flatMap(line =>
  line.text.trim() ? [{ text: line.text.trim(), confidence: line.score * 100, left: line.rect.x, top: line.rect.y,
    width: line.rect.width, height: line.rect.height }] : [])

function clampRegion(frame: { width: number; height: number }, x: number, y: number, width: number, height: number) {
  const left = Math.max(0, Math.floor(x)), top = Math.max(0, Math.floor(y))
  const right = Math.min(frame.width, Math.ceil(x + width)), bottom = Math.min(frame.height, Math.ceil(y + height))
  if (right - left < 8 || bottom - top < 8) throw new RegionError('Invalid popup crop')
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * Popup header, plate name and effect panel read by PP-OCR at their native size. The plate yields one read per frame;
 * repeated or near-miss evidence therefore has to come from other frames of the same popup, never from copies.
 */
async function readPopupPaddle(frame: ImageBitmap, box: Extract<Request, { type: 'popup' }>['box']) {
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width < 20 || box.height < 12 || box.x < 0 ||
    box.y < 0 || box.x + box.width > frame.width || box.y + box.height > frame.height) throw new RegionError('Invalid popup region')
  const small = { side: 64, type: 'min' as const }
  const headerBox = popupHeaderBox(box)
  const header = (await paddleLines(frame, clampRegion(frame, headerBox.x, headerBox.y, headerBox.width, headerBox.height), small, 6))
    .map(line => line.text).join('\n').slice(0, 300)
  if (!popupHeaderEvidence(header)) return { header, label: '', labelWords: [], labels: [], body: '' }
  const plate = await paddleLines(frame, clampRegion(frame, box.x - 10, box.y - 10, box.width + 20, box.height + 20), small, 3)
  const label = { text: plate.map(line => line.text).join(' ').slice(0, 300), words: lineWords(plate) }
  let body = ''
  try {
    const effect = popupEffectBox(box)
    body = (await paddleLines(frame, clampRegion(frame, effect.x, effect.y, effect.width, effect.height), small, 12))
      .map(line => line.text).join('\n').slice(0, 3000)
  } catch (error) {
    // A GPU failure must reach the fallback; an effect panel cut off by the frame edge only loses that evidence.
    if (!(error instanceof RegionError)) throw error
  }
  return { header, label: label.text, labelWords: label.words, labels: [label], body }
}

/**
 * Exploration banner ("N층 탐사 중") and the pack name line under it, from the same map region Tesseract searches. The
 * region is detected at its 1080p size (smaller captures are enlarged) so the dim pack line stays detectable. One read
 * per capture: agreement between separate captures is decided by the caller.
 */
async function readExplorationPaddle(frame: ImageBitmap) {
  const region = clampRegion(frame, 0, frame.height * 0.05, frame.width * 0.45, frame.height * 0.37)
  const lines = await paddleLines(frame, region, { side: Math.round(1080 * 0.37), type: 'min' }, 16)
  const banner = lines.find(line => explorationFloor(line.text) !== null)
  if (!banner) return { floorText: '', themeReads: [] }
  const below = lines.filter(line => line !== banner && line.text.trim() &&
    line.rect.y >= banner.rect.y + banner.rect.height * 0.5 && line.rect.y <= banner.rect.y + banner.rect.height * 2.2 &&
    Math.abs(line.rect.x - banner.rect.x) <= banner.rect.height * 1.5)
    .sort((first, second) => first.rect.y - second.rect.y)
  return { floorText: banner.text.slice(0, 100), themeReads: below.length ? [lineWords(below.slice(0, 1))] : [] }
}

/** Full-frame reading for event and pack screens: detection at `detSide` (default 960) px on the long side, at most 80 lines. */
async function recognizePaddle(canvas: OffscreenCanvas, detSide = 960) {
  const side = Number.isFinite(detSide) ? Math.min(1600, Math.max(640, Math.round(detSide))) : 960
  const lines = await paddleLines(canvas, { x: 0, y: 0, width: canvas.width, height: canvas.height }, { side, type: 'max' },
    FULL_FRAME_LINES)
  return { text: lines.map(line => line.text).join('\n').slice(0, 20000), words: lineWords(lines) }
}

async function readPopup(frame: ImageBitmap, box: Extract<Request, { type: 'popup' }>['box']) {
  if (!reader || ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
    box.width < 20 || box.height < 12 || box.x < 0 || box.y < 0 ||
    box.x + box.width > frame.width || box.y + box.height > frame.height) throw new Error('Invalid popup region')
  const crop = (x: number, y: number, width: number, height: number, scale = 2) => {
    const left = Math.max(0, Math.floor(x)), top = Math.max(0, Math.floor(y))
    const right = Math.min(frame.width, Math.ceil(x + width)), bottom = Math.min(frame.height, Math.ceil(y + height))
    if (right <= left || bottom <= top) throw new Error('Invalid popup crop')
    const canvas = new OffscreenCanvas(Math.max(1, Math.round((right - left) * scale)), Math.max(1, Math.round((bottom - top) * scale)))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('OCR canvas unavailable')
    context.drawImage(frame, left, top, right - left, bottom - top, 0, 0, canvas.width, canvas.height)
    return canvas
  }
  // Plates measured about 120px tall at 1080p; reading at that size keeps smaller captures legible.
  const plateScale = Math.min(4, 120 / popupPlateUnit(box))
  const read = async (canvas: OffscreenCanvas) => {
    const result = await reader!.recognize(canvas, {}, { text: true, tsv: true })
    return { text: result.data.text.slice(0, 300), words: parseWords(result.data.tsv ?? '') }
  }
  await reader.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE })
  const headerBox = popupHeaderBox(box)
  // Header glyphs shrink with the capture like the plate, so smaller captures are enlarged to the 1080p read size.
  const header = (await reader.recognize(crop(headerBox.x, headerBox.y, headerBox.width, headerBox.height, Math.max(2, 2 * plateScale)),
    {}, { text: true })).data.text.slice(0, 300)
  // Acquisition needs the header, so frames without it (most detections are other UI) skip the slower reads.
  if (!popupHeaderEvidence(header)) return { header, label: '', labelWords: [], labels: [], body: '' }
  const label = await read(crop(box.x - 10, box.y - 10, box.width + 20, box.height + 20))
  // Each size misreads different plates (measured: no size produced a wrong exact name), so several are kept.
  const labels = [label]
  for (const size of [1, 1.5, 0.7]) {
    labels.push(await read(inkFromChannel(crop(box.x + box.width * 0.04, box.y + box.height * 0.1,
      box.width * 0.92, box.height * 0.8, plateScale * size), 'min')))
  }
  let body = ''
  const effect = popupEffectBox(box)
  try {
    await reader.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
    body = (await reader.recognize(inkFromChannel(crop(effect.x, effect.y, effect.width, effect.height, plateScale * 1.5), 'max'),
      {}, { text: true })).data.text.slice(0, 3000)
  } catch { /* Name and artwork evidence still apply without the effect panel. */ }
  return { header, label: label.text, labelWords: label.words, labels, body }
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data
  if (request.type === 'dispose') {
    disposed = true
    const engine = paddle
    paddle = null
    await Promise.allSettled([reader?.terminate(), engine?.det.release(), engine?.rec.release()])
    reader = null
    respond({ type: 'disposed' })
    self.close()
    return
  }

  if (request.type === 'init') {
    if (reader || disposed || !Object.hasOwn(LANGUAGES, request.language)) {
      respond({ type: 'error', message: 'Invalid OCR initialization' })
      return
    }
    try {
      const created = await createWorker(LANGUAGES[request.language], 1, {
        workerPath: `${ROOT}/tesseract-worker.min.js`,
        corePath: `${ROOT}/core`,
        langPath: `${ROOT}/lang`,
        workerBlobURL: false,
        cacheMethod: 'none',
      })
      if (disposed) {
        await created.terminate()
        return
      }
      reader = created
      respond({ type: 'ready' })
      // The Korean model only serves Korean screens; other languages keep their Tesseract data.
      if (request.language === 'ko') void loadPaddle()
      else respond({ type: 'backend', engine: 'tesseract', adapter: '', loading: false, reason: 'language' })
    } catch (error) {
      respond({ type: 'error', message: error instanceof Error ? error.message : 'OCR unavailable' })
    }
    return
  }

  const { frame, requestId } = request
  try {
    if (!reader || disposed || busy || !Number.isSafeInteger(requestId) || !frame.width || !frame.height) {
      throw new Error('OCR not ready')
    }
    busy = true
    const scale = Math.min(1, 1920 / frame.width)
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(frame.width * scale)), Math.max(1, Math.round(frame.height * scale)))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('OCR canvas unavailable')
    context.drawImage(frame, 0, 0, canvas.width, canvas.height)
    // GPU OCR first; a failure disables it and the same frame is read by Tesseract before any response.
    const viaPaddle = async <T>(read: () => Promise<T>): Promise<T | null> => {
      if (!paddle || paddleFailed) return null
      try {
        return await read()
      } catch (error) {
        if (error instanceof RegionError) throw error
        console.warn('GPU OCR disabled; using Tesseract', error)
        await releasePaddle('gpu-ocr-runtime-failed')
        return null
      }
    }
    if (request.type === 'popup') {
      const result = await viaPaddle(() => readPopupPaddle(frame, request.box)) ?? await readPopup(frame, request.box)
      if (!disposed) respond({ type: 'popupResult', requestId, ...result })
    } else if (request.type === 'explore') {
      const result = await viaPaddle(() => readExplorationPaddle(frame)) ?? await readExploration(frame)
      if (!disposed) respond({ type: 'exploreResult', requestId, ...result })
    } else if (!request.mode || request.mode === 'full') {
      const result = await viaPaddle(() => recognizePaddle(canvas, request.detSide))
      if (result) {
        if (!disposed) respond({ type: 'result', requestId, ...result })
      } else {
        await reader.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
        const read = await reader.recognize(canvas, {}, { text: true, tsv: true })
        if (!disposed) respond({ type: 'result', requestId, text: read.data.text.slice(0, 20000), words: parseWords(read.data.tsv ?? '') })
      }
    } else {
      await reader.setParameters({ tessedit_pageseg_mode: request.mode === 'line' ? PSM.SINGLE_LINE : request.mode === 'word' ? PSM.SINGLE_WORD : PSM.AUTO })
      const result = await reader.recognize(canvas, {}, { text: true, tsv: true })
      if (!disposed) respond({ type: 'result', requestId, text: result.data.text.slice(0, 20000), words: parseWords(result.data.tsv ?? '') })
    }
  } catch (error) {
    if (!disposed) respond(request.type === 'popup' ? { type: 'popupError', requestId }
      : request.type === 'explore' ? { type: 'exploreResult', requestId, floorText: '', themeReads: [] }
        : { type: 'error', requestId, message: error instanceof Error ? error.message : 'OCR failed' })
  } finally {
    busy = false
    frame.close()
  }
}
