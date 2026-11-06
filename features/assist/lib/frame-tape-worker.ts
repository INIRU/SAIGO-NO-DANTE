/// <reference lib="webworker" />
import { keptEntries, pickFrames, sharpness, type TapeEntry } from './frame-tape'

/**
 * Keeps the capture's last seconds (features/assist/lib/frame-tape.ts) off the page's thread: each frame is scored for sharpness
 * on a 160×90 grey copy and encoded as JPEG; a `take` answers with the sharpest frames of a span, decoded, in time order.
 * Built to public/models/assist-scene/frame-tape-worker.js.
 */
type Request = { type: 'frame'; at: number; frame: ImageBitmap } | { type: 'take'; requestId: number; from: number; to: number; max: number }
interface Kept extends TapeEntry { blob: Blob }

let tape: Kept[] = []
const small = new OffscreenCanvas(160, 90)
const smallContext = small.getContext('2d', { willReadFrequently: true })
let canvas: OffscreenCanvas | null = null
let encoding = false
// time spent keeping frames (score and JPEG), for the development log
let keptMs = 0, keptCount = 0, dropped = 0

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data
  if (request.type === 'frame') {
    const { frame, at } = request
    // one frame at a time: a frame arriving while the last is encoding is dropped (the next comes 100 ms later)
    if (encoding || !smallContext) { dropped++; frame.close(); return }
    encoding = true
    try {
      const started = performance.now()
      smallContext.drawImage(frame, 0, 0, 160, 90)
      const rgba = smallContext.getImageData(0, 0, 160, 90).data
      const grey = new Float32Array(160 * 90)
      for (let i = 0; i < grey.length; i++) grey[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
      if (!canvas || canvas.width !== frame.width || canvas.height !== frame.height) canvas = new OffscreenCanvas(frame.width, frame.height)
      canvas.getContext('2d')?.drawImage(frame, 0, 0)
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
      tape = [...keptEntries(tape, at), { at, sharpness: sharpness(grey, 160, 90), blob }]
      keptMs += performance.now() - started; keptCount++
    } catch { /* a frame not kept leaves a gap of 100 ms */ } finally {
      frame.close()
      encoding = false
    }
    return
  }
  if (request.type === 'take') {
    const picked = pickFrames(tape, request.from, request.to, request.max)
    const frames: { at: number; sharpness: number; bitmap: ImageBitmap }[] = []
    for (const entry of picked) {
      try { frames.push({ at: entry.at, sharpness: entry.sharpness, bitmap: await createImageBitmap(entry.blob) }) } catch { /* skipped */ }
    }
    const bytes = tape.reduce((sum, entry) => sum + entry.blob.size, 0)
    ;(self as unknown as Worker).postMessage({ type: 'frames', requestId: request.requestId, frames, kept: tape.length, bytes,
      keepMs: keptCount ? Math.round(10 * keptMs / keptCount) / 10 : 0, dropped }, frames.map(frame => frame.bitmap))
  }
}
