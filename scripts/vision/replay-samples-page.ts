// Page side of scripts/vision/replay_samples.ts: the app's 480 px popup detection and the shipped OCR and scene workers.
import { acquisitionPlate, darkPopupPlate, detectGiftPopupLabel, popupIconSignature, popupLabelColor, popupQuality } from '../../lib/vision/popup-detect'

type Box = { x: number; y: number; width: number; height: number }
let ocr: Worker, scene: Worker
let next = 0
const waiting = new Map<number, (value: unknown) => void>()

function call(worker: Worker, message: Record<string, unknown>, transfer: Transferable[]) {
  const requestId = ++next
  return new Promise(resolve => { waiting.set(requestId, resolve); worker.postMessage({ ...message, requestId }, transfer) })
}
const settle = (event: MessageEvent) => { const done = waiting.get(event.data?.requestId); if (done) { waiting.delete(event.data.requestId); done(event.data) } }

async function init(giftReferences: { id: string; imageUrl: string }[], giftNames: { id: string; name: string }[]) {
  ocr = new Worker('/models/assist-ocr/ocr-worker.js', { type: 'module' })
  scene = new Worker('/models/assist-scene/scene-worker.js', { type: 'module' })
  const ocrReady = new Promise<string>((resolve, reject) => {
    let ready = false
    ocr.addEventListener('message', event => {
      if (event.data.type === 'ready') ready = true
      if (event.data.type === 'backend' && !event.data.loading && ready) resolve(event.data.engine + ':' + event.data.adapter)
      if (event.data.type === 'error' && event.data.requestId === undefined) reject(new Error(event.data.message))
    })
  })
  const sceneReady = new Promise<string>((resolve, reject) => {
    let provider = ''
    scene.addEventListener('message', event => {
      if (event.data.type === 'ready') provider = event.data.provider + ':' + event.data.adapter
      if (event.data.type === 'icons') resolve(provider + ' icons=' + event.data.count)
      if (event.data.type === 'error') reject(new Error(event.data.message))
    })
  })
  ocr.addEventListener('message', settle)
  scene.addEventListener('message', settle)
  ocr.postMessage({ type: 'init', language: 'ko', giftNames })
  scene.postMessage({ type: 'init', giftReferences, eventReferences: [] })
  return { ocr: await ocrReady, scene: await sceneReady }
}

const canvas = new OffscreenCanvas(480, 270)
const context = canvas.getContext('2d', { willReadFrequently: true })!

/** One frame: the app's detection on a 480 px copy, then the popup OCR and icon reads it would request. */
async function frame(url: string) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob())
  const { width, height } = bitmap
  canvas.height = Math.max(60, Math.round(480 * bitmap.height / bitmap.width))
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const found = detectGiftPopupLabel(pixels) ?? darkPopupPlate(pixels)
  // As the app: REPLAY_GATE=0 replays the earlier behaviour that read every colored plate.
  const label = found && (!(globalThis as { gate?: boolean }).gate || acquisitionPlate(found, canvas.width, canvas.height)) ? found : null
  if (!label) { bitmap.close(); return { width, height, label: null } }
  const box: Box = { x: label.x * bitmap.width / canvas.width, y: label.y * bitmap.height / canvas.height,
    width: label.width * bitmap.width / canvas.width, height: label.height * bitmap.height / canvas.height }
  const observation = { signature: popupIconSignature(pixels, label), color: popupLabelColor(pixels, label), box: label }
  const quality = popupQuality(observation)
  // The popup around the plate, for labelling: artwork left of it, header above, effect text to the right.
  const left = Math.max(0, box.x - box.width * 0.6), top = Math.max(0, box.y - box.height * 5.5)
  const right = Math.min(bitmap.width, box.x + box.width * 4.2), bottom = Math.min(bitmap.height, box.y + box.height * 2.2)
  const cropCanvas = new OffscreenCanvas(Math.round(right - left), Math.round(bottom - top))
  cropCanvas.getContext('2d')!.drawImage(bitmap, left, top, right - left, bottom - top, 0, 0, cropCanvas.width, cropCanvas.height)
  const blob = await cropCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
  const crop = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob) })
  const [ocrFrame, iconFrame] = [await createImageBitmap(bitmap), await createImageBitmap(bitmap)]
  const [read, icon] = await Promise.all([
    call(ocr, { type: 'popup', frame: ocrFrame, box }, [ocrFrame]),
    call(scene, { type: 'popup-icon', frame: iconFrame, box }, [iconFrame]),
  ])
  bitmap.close()
  return { width, height, label: box, observation, quality, crop, read, icon }
}

Object.assign(globalThis, { replay: { init, frame, setGate: (on: boolean) => { (globalThis as { gate?: boolean }).gate = on } } })

/** Full-frame OCR as the app's balanced mode requests it: text and word boxes in frame pixels. */
async function recognize(url: string) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob())
  const size = { width: bitmap.width, height: bitmap.height }
  const result = await call(ocr, { type: 'recognize', frame: bitmap, detSide: 1280, grid: 1, tileScale: 1 }, [bitmap]) as { text?: string; words?: unknown[] }
  return { ...size, text: result.text ?? '', words: result.words ?? [] }
}

/** One fusion slot read (dialog slots or every wheel position) on the whole frame, as the scene worker answers the app. */
async function fusion(url: string, request: Record<string, unknown>) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob())
  const message = request.type === 'fusion-wheel'
    ? { ...request, frame: bitmap, origin: { x: 0, y: 0 }, scale: 1, frameSize: { width: bitmap.width, height: bitmap.height } }
    : { ...request, frame: bitmap }
  const result = await call(scene, message, [bitmap]) as { slots?: unknown[] }
  return result.slots ?? []
}

Object.assign((globalThis as unknown as { replay: object }).replay, { recognize, fusion })
