import * as ort from 'onnxruntime-web/webgpu'
import { SCENE_SIZE, sceneFrameToTensor } from './preprocess'
import { decodeEmbeddingIndex, matchEventEmbedding, matchGiftEmbedding, type EmbeddingIndex, type VisualMatch, type VisualReference } from './embedding-match'
import { popupIconBox, type PopupLabelBox } from './popup-detect'
import { acceptedIcon, heldSlotRead, iconTemplate, mergeRankedGroups, plateShaped, rankIcons, rankIconsInRegion, type IconTemplate } from './icon-match'
import { fusionSlotRegions, fusionSlotRegionsFromAnchors, fusionWheelRegions, vestigeGroup, type FusionAnchors, type FusionSlotRead, type WheelAnchors } from './fusion-evidence'
import { ASSIST_RUNTIME_ROOT, assistModelRoot } from './model-assets'
import { classifierKnowsHeld, classifierSlotRead, heldLabels, iconTensor, ICON_CROP, ICON_INPUT } from './icon-classifier'

type Request = { type: 'init'; giftReferences?: VisualReference[]; eventReferences?: VisualReference[] } |
  { type: 'infer'; frame: ImageBitmap } | { type: 'popup-icon'; requestId: number; frame: ImageBitmap; box: PopupLabelBox } |
  { type: 'fusion-slots'; requestId: number; frame: ImageBitmap; count: number; capacity: number; anchors?: FusionAnchors; candidates?: string[] } |
  { type: 'fusion-wheel'; requestId: number; frame: ImageBitmap; capacity: number; origin: { x: number; y: number }; scale?: number;
    frameSize: { width: number; height: number }; anchors?: WheelAnchors; candidates?: string[] }
type Response = { type: 'ready'; provider: 'webgpu' | 'wasm'; adapter: string } | { type: 'prediction'; label: string; confidence: number; gifts: VisualMatch[]; events: VisualMatch[] } |
  { type: 'popup-icon'; requestId: number; gifts: VisualMatch[] } |
  { type: 'fusion-slots'; requestId: number; slots: FusionSlotRead[] } | { type: 'icons'; count: number; ms: number } |
  { type: 'error'; message: string }

const ASSET_ROOT = `${assistModelRoot(self.location.hostname)}/assist-scene/`
let session: ort.InferenceSession | null = null
let visualSession: ort.InferenceSession | null = null
// The gift-icon classifier for fusion slots; until it loads (or if it fails) template matching reads them.
let iconSession: ort.InferenceSession | null = null
let iconLabels: string[] = []
let embeddingIndex: EmbeddingIndex | null = null
let labels: string[] = []
let giftReferences: VisualReference[] = []
let eventReferences: VisualReference[] = []
// Execution backend: WebGPU only on a real (non-fallback) adapter; any failure moves every session to WASM.
let provider: 'webgpu' | 'wasm' = 'wasm'
let adapterName = ''
// Catalog icons as templates for the popup artwork; built in the background after the models are ready.
const coarseTemplates: IconTemplate[] = []
// Every icon at 16 px: a one-scale pass that keeps the best 40 for the coarse pass (rankIconsInRegion `tiny`).
const tinyTemplates: IconTemplate[] = []
const fineTemplates = new Map<string, IconTemplate>()

async function gpuAdapter(): Promise<boolean> {
  const gpu = (self.navigator as unknown as { gpu?: { requestAdapter(options?: object): Promise<{
    isFallbackAdapter?: boolean; info?: { vendor?: string; architecture?: string; isFallbackAdapter?: boolean } } | null> } }).gpu
  if (!gpu) return false
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' })
    if (!adapter || adapter.isFallbackAdapter || adapter.info?.isFallbackAdapter) return false
    adapterName = [adapter.info?.vendor, adapter.info?.architecture].filter(Boolean).join(' ')
    return true
  } catch {
    return false
  }
}

async function createSessions(withVisual: boolean) {
  const create = (name: string) => ort.InferenceSession.create(`${ASSET_ROOT}${name}`, { executionProviders: [provider] })
  try {
    session = await create('scene.onnx')
    visualSession = withVisual ? await create('visual-encoder.onnx') : null
  } catch (error) {
    if (provider === 'wasm') throw error
    await releaseSessions()
    provider = 'wasm'
    await createSessions(withVisual)
  }
}

async function releaseSessions() {
  await Promise.allSettled([session?.release(), visualSession?.release(), iconSession?.release()])
  session = null
  visualSession = null
  iconSession = null
}

/**
 * Model calls one at a time: a session created on WebGPU while another ran its first pass once left the scene model
 * without a single answer (replay 2026-09-27), and message handlers interleave at every await.
 */
let modelQueue: Promise<unknown> = Promise.resolve()
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = modelQueue.then(task, task)
  modelQueue = run.catch(() => undefined)
  return run
}

/** The gift-icon classifier session, created after the other sessions (never beside a run); without it templates read slots. */
async function loadIconClassifier() {
  try {
    const response = await fetch(`${ASSET_ROOT}icon-labels.json`)
    if (!response.ok) return
    const decoded: unknown = await response.json()
    if (!Array.isArray(decoded) || !decoded.every(label => typeof label === 'string')) return
    iconSession = await ort.InferenceSession.create(`${ASSET_ROOT}icon-classifier.onnx`, { executionProviders: [provider] })
    iconLabels = decoded
  } catch { iconSession = null }
}

/** Classifier reads for the given slots in one batch, or null to fall back to template matching. */
async function classifySlots(sample: ReturnType<typeof sampler>, regions: { x: number; y: number; size: number }[], held: ReadonlySet<string>) {
  if (!iconSession || !regions.length || !classifierKnowsHeld(iconLabels, held)) return null
  try {
    const input = iconTensor(regions.map(region => sample(region.x, region.y, region.size * ICON_CROP, ICON_INPUT)))
    const icons = iconSession
    const output = await exclusive(() => icons.run({ [icons.inputNames[0]]: new ort.Tensor('float32', input, [regions.length, 3, ICON_INPUT, ICON_INPUT]) }))
    const logits = output[icons.outputNames[0]].data as Float32Array
    if (logits.length !== regions.length * iconLabels.length) return null
    return regions.map((_, index) => classifierSlotRead(logits.subarray(index * iconLabels.length, (index + 1) * iconLabels.length), iconLabels, held))
  } catch {
    // A failing session (device lost) leaves the templates in charge for the rest of the capture.
    iconSession = null
    return null
  }
}

/** Runs a model; a WebGPU device or runtime failure is retried once after moving to WASM. */
async function runModel(kind: 'scene' | 'visual', input: Float32Array) {
  return exclusive(async () => {
    const current = kind === 'scene' ? session : visualSession
    if (!current) throw new Error('Model not ready')
    const feeds = { [current.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SCENE_SIZE, SCENE_SIZE]) }
    try {
      return (await current.run(feeds))[current.outputNames[0]].data
    } catch (error) {
      if (provider === 'wasm') throw error
      const withVisual = visualSession !== null
      await releaseSessions()
      provider = 'wasm'
      await createSessions(withVisual)
      await loadIconClassifier()
      const retry = kind === 'scene' ? session! : visualSession!
      return (await retry.run({ [retry.inputNames[0]]: feeds[current.inputNames[0]] }))[retry.outputNames[0]].data
    }
  })
}

async function loadTemplates(references: VisualReference[]) {
  const tiny = new OffscreenCanvas(16, 16).getContext('2d', { willReadFrequently: true })
  const coarse = new OffscreenCanvas(24, 24).getContext('2d', { willReadFrequently: true })
  const fine = new OffscreenCanvas(48, 48).getContext('2d', { willReadFrequently: true })
  if (!tiny || !coarse || !fine) return
  // Downscaling detailed art without high-quality smoothing aliases it enough to drop the right icon from the shortlist.
  tiny.imageSmoothingQuality = 'high'
  coarse.imageSmoothingQuality = 'high'
  fine.imageSmoothingQuality = 'high'
  const started = performance.now()
  const queue = references.filter(reference => reference.imageUrl && /^https?:/.test(reference.imageUrl))
  // Icons are kept in Cache Storage so later sessions build templates without waiting on the network.
  const cache = typeof caches === 'undefined' ? null : await caches.open('assist-gift-icons-v1').catch(() => null)
  const load = async (url: string) => {
    const cached = await cache?.match(url)
    if (cached) return cached
    const response = await fetch(url)
    if (response.ok) await cache?.put(url, response.clone()).catch(() => {})
    return response
  }
  const worker = async () => {
    for (let reference = queue.shift(); reference; reference = queue.shift()) {
      try {
        const response = await load(reference.imageUrl!)
        if (!response.ok) continue
        const image = await createImageBitmap(await response.blob())
        for (const [target, size] of [[tiny, 16], [coarse, 24], [fine, 48]] as const) {
          target.clearRect(0, 0, size, size)
          target.drawImage(image, 0, 0, size, size)
          const template = iconTemplate(reference.id, target.getImageData(0, 0, size, size).data, size)
          if (size === 16) tinyTemplates.push(template)
          else if (size === 24) coarseTemplates.push(template)
          else fineTemplates.set(reference.id, template)
        }
        image.close()
      } catch { /* A missing icon only removes that gift from template matching. */ }
    }
  }
  await Promise.all(Array.from({ length: 16 }, worker))
  respond({ type: 'icons', count: coarseTemplates.length, ms: Math.round(performance.now() - started) })
}

const sampleCanvases = new Map<number, OffscreenCanvasRenderingContext2D>()
function sampler(frame: ImageBitmap) {
  return (x: number, y: number, span: number, size: number) => {
    let target = sampleCanvases.get(size)
    if (!target) {
      target = new OffscreenCanvas(size, size).getContext('2d', { willReadFrequently: true })!
      target.imageSmoothingQuality = 'high'
      sampleCanvases.set(size, target)
    }
    target.fillStyle = 'rgb(0, 0, 0)'
    target.fillRect(0, 0, size, size)
    target.drawImage(frame, x - span / 2, y - span / 2, span, span, 0, 0, size, size)
    return target.getImageData(0, 0, size, size).data
  }
}
/**
 * Recent slot reads by content: a slot whose pixels (its whole search window) match one read moments ago reuses that
 * read, since the wheel changes one icon or only the cursor at a time. Bounded; the worker lives for one capture.
 */
const SLOT_CACHE_SIZE = 48
const slotCache: { signature: Float32Array; size: number; pool: string; read: FusionSlotRead }[] = []
function slotSignature(sample: ReturnType<typeof sampler>, region: { x: number; y: number; size: number }) {
  const pixels = sample(region.x, region.y, region.size * 1.5, 20)
  const values = new Float32Array(20 * 20 * 3)
  for (let index = 0; index < values.length; index++) values[index] = pixels[Math.floor(index / 3) * 4 + index % 3]
  return values
}
function cachedSlot(signature: Float32Array, size: number, pool: string): FusionSlotRead | undefined {
  for (const entry of slotCache) {
    if (entry.pool !== pool || Math.abs(entry.size / size - 1) > 0.03) continue
    let total = 0
    for (let index = 0; index < signature.length && total < 2 * signature.length; index++) total += Math.abs(entry.signature[index] - signature[index])
    if (total / signature.length < 2) return entry.read
  }
  return undefined
}
function rememberSlot(signature: Float32Array, size: number, pool: string, read: FusionSlotRead) {
  slotCache.unshift({ signature, size, pool, read })
  slotCache.length = Math.min(slotCache.length, SLOT_CACHE_SIZE)
}
// Templates of the gifts a fusion can use (held gifts and vestiges), rebuilt when that list changes.
let heldPool: { key: string; loaded: number; ids: Set<string>; templates: IconTemplate[] } = { key: '', loaded: 0, ids: new Set(), templates: [] }
function heldTemplates(candidates: string[] | undefined) {
  const key = Array.isArray(candidates) ? [...new Set(candidates.filter(id => typeof id === 'string'))].sort().join() : ''
  if (key !== heldPool.key || heldPool.loaded !== coarseTemplates.length) {
    const ids = new Set(key ? key.split(',') : [])
    heldPool = { key, loaded: coarseTemplates.length, ids, templates: coarseTemplates.filter(template => ids.has(template.id)) }
  }
  return heldPool
}

/**
 * An empty slot: the inner part is black (95th-percentile luminance under 12; empty wheel positions and dialog slots
 * measure 0–1, icons that are only starting to fade in 4–6, shown icons 39 and more).
 */
function blankSlot(sample: ReturnType<typeof sampler>, region: { x: number; y: number; size: number }): boolean {
  const pixels = sample(region.x, region.y, region.size * 0.6, 16)
  const luminance: number[] = []
  for (let at = 0; at < pixels.length; at += 4) luminance.push(0.299 * pixels[at] + 0.587 * pixels[at + 1] + 0.114 * pixels[at + 2])
  luminance.sort((first, second) => first - second)
  return luminance[Math.floor(luminance.length * 0.95)] < 12
}
const canvas = new OffscreenCanvas(SCENE_SIZE, SCENE_SIZE)
const context = canvas.getContext('2d', { willReadFrequently: true })

function respond(message: Response) {
  self.postMessage(message)
}

async function embed(frame: ImageBitmap, region: [number, number, number, number]): Promise<Float32Array> {
  if (!context || !visualSession) throw new Error('Visual model not ready')
  const [x, y, width, height] = region
  context.fillStyle = 'rgb(30, 28, 27)'
  context.fillRect(0, 0, SCENE_SIZE, SCENE_SIZE)
  context.drawImage(frame, x * frame.width, y * frame.height, width * frame.width, height * frame.height,
    0, 0, SCENE_SIZE, SCENE_SIZE)
  const vector = await runModel('visual', sceneFrameToTensor(context.getImageData(0, 0, SCENE_SIZE, SCENE_SIZE)))
  if (!(vector instanceof Float32Array) || vector.length !== 576 || !vector.every(Number.isFinite)) throw new Error('Invalid visual embedding')
  return vector
}

const giftRegions: [number, number, number, number][] = [
  [545 / 1920, 328 / 1080, 80 / 1920, 80 / 1080],
  [935 / 1920, 328 / 1080, 80 / 1920, 80 / 1080],
  [1340 / 1920, 328 / 1080, 80 / 1920, 80 / 1080],
]
const shopGiftRegions: [number, number, number, number][] = [
  [595 / 1920, 350 / 1080, 75 / 1920, 75 / 1080],
  [625 / 1920, 365 / 1080, 75 / 1920, 75 / 1080],
]
const eventRegion: [number, number, number, number] = [0.055, 0.17, 0.44, 0.29]

self.onmessage = async (event: MessageEvent<Request>) => {
  if (event.data.type === 'init') {
    try {
      if (!context) throw new Error('Canvas unavailable')
      ort.env.wasm.numThreads = 1
      ort.env.wasm.wasmPaths = `${ASSIST_RUNTIME_ROOT}/assist-scene/`
      const response = await fetch(`${ASSET_ROOT}labels.json`)
      if (!response.ok) throw new Error('Labels unavailable')
      const decoded: unknown = await response.json()
      if (!Array.isArray(decoded) || !decoded.every(label => typeof label === 'string')) throw new Error('Invalid labels')
      labels = decoded
      giftReferences = event.data.giftReferences ?? []
      eventReferences = event.data.eventReferences ?? []
      if (!Array.isArray(giftReferences) || !Array.isArray(eventReferences)) throw new Error('Invalid visual references')
      const withVisual = giftReferences.length > 0 || eventReferences.length > 0
      if (withVisual) {
        const indexResponse = await fetch(`${ASSET_ROOT}embedding-index.json`)
        if (!indexResponse.ok) throw new Error('Visual embedding index unavailable')
        embeddingIndex = decodeEmbeddingIndex(await indexResponse.json())
      }
      provider = await gpuAdapter() ? 'webgpu' : 'wasm'
      await createSessions(withVisual)
      await loadIconClassifier()
      respond({ type: 'ready', provider, adapter: provider === 'webgpu' ? adapterName : '' })
      void loadTemplates(giftReferences)
    } catch (error) {
      respond({ type: 'error', message: error instanceof Error ? error.message : 'Model unavailable' })
    }
    return
  }

  const { frame } = event.data
  try {
    if (!session || !context) throw new Error('Model not ready')
    if ((giftReferences.length || eventReferences.length) && (!visualSession || !embeddingIndex)) throw new Error('Visual model not ready')
    if (event.data.type === 'fusion-slots' || event.data.type === 'fusion-wheel') {
      // Fusion material slots, by catalog icon only: the confirmation dialog's slots, or every position of the selection
      // wheel in a crop of the selection screen (`origin` = the crop's corner in the captured frame).
      const request = event.data
      let regions: { x: number; y: number; size: number }[] | null
      if (request.type === 'fusion-slots') {
        const layout = fusionSlotRegions(frame.width, frame.height, request.count, request.capacity)
        regions = layout && ((request.anchors && fusionSlotRegionsFromAnchors(request.anchors, request.count, request.capacity)) || layout)
      } else {
        // Frame pixels → crop pixels (the crop may be scaled down: `scale` crop pixels per frame pixel).
        const scale = request.scale && request.scale > 0 ? request.scale : 1
        regions = fusionWheelRegions(request.frameSize.width, request.frameSize.height, request.capacity, request.anchors)
          ?.map(region => ({ x: (region.x - request.origin.x) * scale, y: (region.y - request.origin.y) * scale, size: region.size * scale })) ?? null
      }
      if (!Number.isSafeInteger(request.requestId) || !regions) throw new Error('Invalid fusion request')
      const sample = sampler(frame)
      const held = heldTemplates(request.candidates)
      const blanks = regions.map(region => blankSlot(sample, region))
      const filled = regions.filter((_, index) => !blanks[index])
      const classified = await classifySlots(sample, filled, heldLabels(request.candidates))
      const slots = regions.map((region, index): FusionSlotRead => {
        if (blanks[index]) return { blank: true }
        if (classified) return classified[filled.indexOf(region)]
        if (!coarseTemplates.length) return null
        const signature = slotSignature(sample, region)
        const cached = cachedSlot(signature, region.size, held.key)
        if (cached !== undefined) return cached
        const read = heldSlotRead(mergeRankedGroups(rankIconsInRegion(sample, region, coarseTemplates, fineTemplates, tinyTemplates, 40, held.ids), vestigeGroup),
          held.templates.length ? mergeRankedGroups(rankIconsInRegion(sample, region, held.templates, fineTemplates), vestigeGroup) : [])
        rememberSlot(signature, region.size, held.key, read)
        return read
      })
      respond({ type: 'fusion-slots', requestId: request.requestId, slots })
      return
    }
    if (event.data.type === 'popup-icon') {
      const { box, requestId } = event.data
      if (!embeddingIndex || !visualSession || !Number.isSafeInteger(requestId) ||
        ![box?.x, box?.y, box?.width, box?.height].every(value => Number.isFinite(value)) ||
        box.width < 20 || box.height < 12 || box.x < 0 || box.y < 0 ||
        box.x + box.width > frame.width || box.y + box.height > frame.height) throw new Error('Invalid popup icon region')
      const icon = popupIconBox(box)
      if (icon.x < 0 || icon.y < 0 || icon.x + icon.width > frame.width || icon.y + icon.height > frame.height) {
        respond({ type: 'popup-icon', requestId, gifts: [] })
        return
      }
      const region: [number, number, number, number] = [icon.x / frame.width, icon.y / frame.height,
        icon.width / frame.width, icon.height / frame.height]
      const embedded = matchGiftEmbedding(await embed(frame, region), giftReferences, embeddingIndex)
      // Catalog-icon templates recognise small popup art far better than the embedding; the two must not disagree.
      const matched = plateShaped(box) && coarseTemplates.length ? acceptedIcon(rankIcons(sampler(frame), box, coarseTemplates, fineTemplates, tinyTemplates)) : null
      const gifts = matched ? (embedded[0] && embedded[0].id !== matched.id ? [] : [matched]) : embedded
      respond({ type: 'popup-icon', requestId, gifts })
      return
    }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(frame, 0, 0, SCENE_SIZE, SCENE_SIZE)
    const input = sceneFrameToTensor(context.getImageData(0, 0, SCENE_SIZE, SCENE_SIZE))
    const scores = await runModel('scene', input)
    if (scores.length !== labels.length) throw new Error('Model labels mismatch')
    const logits = Array.from(scores, Number)
    if (!logits.every(Number.isFinite)) throw new Error('Invalid model output')
    const max = Math.max(...logits)
    const probabilities = logits.map(score => Math.exp(score - max))
    const sum = probabilities.reduce((total, score) => total + score, 0)
    if (!Number.isFinite(sum) || sum <= 0) throw new Error('Invalid model output')
    const index = logits.indexOf(max)
    const label = labels[index]
    const confidence = probabilities[index] / sum
    const validGameFrame = frame.width > 0 && frame.height > 0 && frame.width / frame.height >= 1.7 && frame.width / frame.height <= 1.85
    const events = validGameFrame && eventReferences.length && embeddingIndex
      ? matchEventEmbedding(await embed(frame, eventRegion), eventReferences, embeddingIndex) : []
    const gifts: VisualMatch[] = []
    if (validGameFrame && giftReferences.length && embeddingIndex && confidence >= 0.5 && (label === 'reward_choice' || label === 'shop')) {
      const regions = label === 'shop' ? shopGiftRegions : giftRegions
      for (const region of regions) {
        const match = matchGiftEmbedding(await embed(frame, region), giftReferences, embeddingIndex)
        if (match.length) gifts.push(match[0])
      }
      if (label === 'shop') {
        if (new Set(gifts.map(gift => gift.id)).size > 1) gifts.length = 0
        else if (gifts.length > 1) gifts.splice(0, gifts.length, gifts.reduce((best, gift) => gift.score > best.score ? gift : best))
      }
    }
    respond({ type: 'prediction', label, confidence, gifts, events })
  } catch (error) {
    if (event.data.type === 'popup-icon') respond({ type: 'popup-icon', requestId: event.data.requestId, gifts: [] })
    else if (event.data.type === 'fusion-slots' || event.data.type === 'fusion-wheel') respond({ type: 'fusion-slots', requestId: event.data.requestId, slots: [] })
    else respond({ type: 'error', message: error instanceof Error ? error.message : 'Inference failed' })
  } finally {
    frame.close()
  }
}
