// Saves what a Spine stage draws, or a plain illustration, as a file: a PNG of one frame, a looping GIF, a video of
// one loop. Browser only. The stage hands out single frames through its handle (features/catalog/components/SpineStage.tsx).
import type { SpineStageHandle } from '@/features/catalog/components/SpineStage'

const GIF_FPS = 25 // a GIF counts in hundredths of a second: 25 a second is exact
const GIF_FRAMES = 150
const VIDEO_FPS = 30
const VIDEO_SECONDS = 20

export interface Recording {
  /** The live stage. Null once its viewer has closed, which stops the recording. */
  stage: () => SpineStageHandle | null
  /** What stands behind a transparent figure. Null keeps a GIF transparent; a video cannot be and gets black. */
  colour: string | null
  /** The longest side of the saved picture, in pixels. */
  side: number
  onProgress: (done: number) => void
}

/** The identity's name as a file name. */
export function fileNameOf(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, ' ').trim() || 'illustration'
}

/** `width`×`height` scaled down so its longer side is at most `side` (never up), in even numbers: H.264 needs them. */
export function frameSize(width: number, height: number, side: number): [number, number] {
  const scale = Math.min(1, side / Math.max(width, height))
  const even = (value: number) => Math.max(2, Math.floor((value * scale + 0.5) / 2) * 2)
  return [even(width), even(height)]
}

/** The container a browser can record video into: MP4 where it can, WebM elsewhere, null when it records nothing. */
export function videoType(supported: (type: string) => boolean): { type: string; extension: 'mp4' | 'webm' } | null {
  for (const type of ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']) {
    if (supported(type)) return { type, extension: type.startsWith('video/mp4') ? 'mp4' : 'webm' }
  }
  return null
}

export function download(blob: Blob, file: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = file
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

const pause = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))
const blobOf = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('The picture could not be made'))), type))

/** Copies what the stage canvas holds onto `pen` (a new canvas of that size when unset), over `colour`. */
function copy(source: HTMLCanvasElement, width: number, height: number, colour: string | null, pen?: CanvasRenderingContext2D) {
  const target = pen ?? Object.assign(document.createElement('canvas'), { width, height }).getContext('2d', { willReadFrequently: true })!
  if (colour) {
    target.fillStyle = colour
    target.fillRect(0, 0, width, height)
  } else {
    target.clearRect(0, 0, width, height)
  }
  target.drawImage(source, 0, 0, width, height)
  return target
}

/** The frame on the stage as a PNG, at the size it is drawn. */
export function stagePng(stage: SpineStageHandle, colour: string | null): Promise<Blob> {
  try {
    const source = stage.draw()
    return blobOf(copy(source, source.width, source.height, colour).canvas, 'image/png')
  } finally {
    stage.release()
  }
}

/** An image file (an illustration in Storage) as a PNG. */
export async function imagePng(src: string): Promise<Blob> {
  const response = await fetch(src)
  if (!response.ok) throw new Error(`${src}: ${response.status}`)
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height })
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  bitmap.close()
  return blobOf(canvas, 'image/png')
}

/** One loop of the animation as a GIF, as it is framed on the stage. */
export async function stageGif({ stage, colour, side, onProgress }: Recording): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
  const gif = GIFEncoder()
  try {
    const total = Math.min(GIF_FRAMES, Math.max(1, Math.round((stage()?.duration() ?? 0) * GIF_FPS)))
    let pen: CanvasRenderingContext2D | undefined
    let width = 0
    let height = 0
    for (let index = 0; index < total; index++) {
      const live = stage()
      if (!live) throw new Error('The viewer was closed')
      const source = live.draw(index / GIF_FPS)
      if (!pen) [width, height] = frameSize(source.width, source.height, side)
      pen = copy(source, width, height, colour, pen)
      const { data } = pen.getImageData(0, 0, width, height)
      if (colour) {
        const palette = quantize(data, 256)
        gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: 1000 / GIF_FPS })
      } else {
        // a GIF pixel is either there or not: the figure's edge is cut hard and each frame is cleared before the next
        const palette = quantize(data, 256, { format: 'rgba4444', oneBitAlpha: true })
        const clear = palette.findIndex(entry => entry[3] === 0)
        gif.writeFrame(applyPalette(data, palette, 'rgba4444'), width, height, { palette, delay: 1000 / GIF_FPS, transparent: clear >= 0, transparentIndex: Math.max(clear, 0), dispose: 2 })
      }
      if (index % 4 === 3) {
        onProgress((index + 1) / total)
        await pause() // let the progress show
      }
    }
    gif.finish()
    return new Blob([gif.bytes().slice()], { type: 'image/gif' })
  } finally {
    stage()?.release()
  }
}

/** One loop of the animation as a video: MP4 where the browser can record it, WebM elsewhere. */
export async function stageVideo({ stage, colour, side, onProgress }: Recording): Promise<{ blob: Blob; extension: 'mp4' | 'webm' }> {
  const kind = typeof MediaRecorder === 'undefined' ? null : videoType(type => MediaRecorder.isTypeSupported(type))
  if (!kind) throw new Error('This browser cannot record video')
  const behind = colour ?? '#000000'
  try {
    const first = stage()
    if (!first) throw new Error('The viewer was closed')
    const total = Math.max(1, Math.round(Math.min(VIDEO_SECONDS, first.duration()) * VIDEO_FPS))
    const opening = first.draw(0)
    const [width, height] = frameSize(opening.width, opening.height, side)
    const pen = copy(opening, width, height, behind)
    const recorder = new MediaRecorder(pen.canvas.captureStream(VIDEO_FPS), { mimeType: kind.type, videoBitsPerSecond: 8_000_000 })
    const chunks: Blob[] = []
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve()
      recorder.onerror = () => reject(new Error('The recording failed'))
    })
    recorder.start()
    const started = performance.now()
    // The recorder stamps each frame with the clock, so the loop is drawn at its real speed.
    for (let index = 0; index < total; index++) {
      const live = stage()
      if (!live) {
        recorder.stop()
        throw new Error('The viewer was closed')
      }
      copy(live.draw(index / VIDEO_FPS), width, height, behind, pen)
      onProgress((index + 1) / total)
      await pause(Math.max(0, started + ((index + 1) * 1000) / VIDEO_FPS - performance.now()))
    }
    recorder.stop()
    await stopped
    return { blob: new Blob(chunks, { type: kind.type.split(';')[0] }), extension: kind.extension }
  } finally {
    stage()?.release()
  }
}
