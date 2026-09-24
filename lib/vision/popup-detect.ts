export interface PopupLabelBox { x: number; y: number; width: number; height: number }

/** Find a large solid color name plate on an acquired-gift popup. */
export function detectGiftPopupLabel(image: ImageData): PopupLabelBox | null {
  const { data, width, height } = image
  if (width < 80 || height < 60 || data.length !== width * height * 4) return null
  const size = width * height
  const mask = new Uint8Array(size)
  for (let pixel = 0; pixel < size; pixel++) {
    const red = data[pixel * 4], green = data[pixel * 4 + 1], blue = data[pixel * 4 + 2]
    const high = Math.max(red, green, blue), low = Math.min(red, green, blue)
    const difference = high - low
    if (high < 70 || difference < high * 80 / 255) continue
    mask[pixel] = 1
  }
  const queue = new Int32Array(size)
  let best: PopupLabelBox | null = null
  let bestArea = 0
  for (let start = 0; start < size; start++) {
    if (mask[start] !== 1) continue
    let head = 0, tail = 1, area = 0
    queue[0] = start
    mask[start] = 2
    let left = width, right = 0, top = height, bottom = 0
    while (head < tail) {
      const pixel = queue[head++]
      const x = pixel % width, y = Math.floor(pixel / width)
      area++
      left = Math.min(left, x); right = Math.max(right, x)
      top = Math.min(top, y); bottom = Math.max(bottom, y)
      const neighbors = [x > 0 ? pixel - 1 : -1, x + 1 < width ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1, y + 1 < height ? pixel + width : -1]
      for (const neighbor of neighbors) if (neighbor >= 0 && mask[neighbor] === 1) {
        mask[neighbor] = 2
        queue[tail++] = neighbor
      }
    }
    const boxWidth = right - left + 1, boxHeight = bottom - top + 1
    if (area < size * 0.002 || area <= bestArea || boxHeight < height * 0.03 ||
      boxWidth / boxHeight < 1.2 || boxWidth / boxHeight > 4 ||
      area / (boxWidth * boxHeight) < 0.55) continue
    bestArea = area
    best = { x: left, y: top, width: boxWidth, height: boxHeight }
  }
  return best
}

export function popupIconBox(label: PopupLabelBox): PopupLabelBox {
  const size = label.height
  return {
    x: label.x + label.width * 0.23,
    y: label.y - label.height * 1.95,
    width: size,
    height: size,
  }
}

/** Plates measured 2.17 wide per height; saturated glow can inflate the height but not the width. */
export function popupPlateUnit(label: PopupLabelBox): number {
  return Math.min(label.height, label.width / 2.17)
}

/** Acquisition header line above the artwork, placed from the plate center. */
export function popupHeaderBox(label: PopupLabelBox): PopupLabelBox {
  const unit = popupPlateUnit(label)
  const center = label.y + label.height / 2
  return { x: label.x + label.width * 0.4, y: center - unit * 3.77, width: label.width * 3, height: unit * 0.9 }
}

/** Effect text panel to the right of the artwork, still inside the popup frame. */
export function popupEffectBox(label: PopupLabelBox): PopupLabelBox {
  const unit = popupPlateUnit(label)
  const center = label.y + label.height / 2
  return { x: label.x + label.width * 1.16, y: center - unit * 2.6, width: label.width * 2.6, height: unit * 3.05 }
}

export function popupIconSignature(image: ImageData, label: PopupLabelBox): string {
  const icon = popupIconBox(label)
  const values: number[] = []
  for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
    const x = Math.min(image.width - 1, Math.max(0, Math.floor(icon.x + (column + 0.5) * icon.width / 8)))
    const y = Math.min(image.height - 1, Math.max(0, Math.floor(icon.y + (row + 0.5) * icon.height / 8)))
    const at = (y * image.width + x) * 4
    values.push(image.data[at] * 0.3 + image.data[at + 1] * 0.59 + image.data[at + 2] * 0.11)
  }
  const mean = values.reduce((total, value) => total + value, 0) / values.length
  return values.map(value => value >= mean ? '1' : '0').join('')
}

export function popupSignatureDistance(left: string, right: string): number {
  if (left.length !== 64 || right.length !== 64) return 64
  let distance = 0
  for (let index = 0; index < 64; index++) if (left[index] !== right[index]) distance++
  return distance
}

export function popupLabelColor(image: ImageData, label: PopupLabelBox): [number, number, number] {
  const x = Math.min(image.width - 1, Math.max(0, Math.floor(label.x + label.width * 0.1)))
  const y = Math.min(image.height - 1, Math.max(0, Math.floor(label.y + label.height * 0.7)))
  const at = (y * image.width + x) * 4
  return [image.data[at], image.data[at + 1], image.data[at + 2]]
}

export interface PopupObservation {
  signature: string
  color: [number, number, number]
  box: PopupLabelBox
  at: number
}

/** Popups fade and scale in and out; gaps shorter than this keep one popup continuous. */
const POPUP_CONTINUITY_MS = 120

function chroma(color: [number, number, number]): number[] {
  const high = Math.max(1, ...color)
  return color.map(channel => channel / high)
}

/** Sharpness proxy: fade frames are both smaller and darker than the settled name plate. */
export function popupQuality(observation: Pick<PopupObservation, 'color' | 'box'>): number {
  return observation.box.width * observation.box.height * Math.max(...observation.color) / 255
}

/**
 * Consecutive detections keep one popup while fading/scaling if the plate hue stays the same.
 * After a visible gap only a settled, near-identical plate continues; distinct quick popups start anew.
 */
export function samePopupEpisode(previous: PopupObservation, current: PopupObservation): boolean {
  const hue = chroma(previous.color), next = chroma(current.color)
  if (Math.max(...hue.map((channel, index) => Math.abs(channel - next[index]))) > 0.2) return false
  const width = Math.max(previous.box.width, current.box.width)
  const height = Math.max(previous.box.height, current.box.height)
  const dx = Math.abs(previous.box.x + previous.box.width / 2 - current.box.x - current.box.width / 2)
  const dy = Math.abs(previous.box.y + previous.box.height / 2 - current.box.y - current.box.height / 2)
  const elapsed = current.at - previous.at
  if (elapsed >= 0 && elapsed <= POPUP_CONTINUITY_MS) return dx <= width && dy <= height
  const area = previous.box.width * previous.box.height / (current.box.width * current.box.height)
  return elapsed >= 0 && dx <= width / 4 && dy <= height / 2 && area >= 0.9 && area <= 1.1 &&
    popupSignatureDistance(previous.signature, current.signature) <= 8
}

/** Measured fade-in lasts about 100–120ms; the best frame seen by then is sent unless the popup ends sooner. */
export const POPUP_SETTLE_MS = 150

/**
 * Queue rank: acquisition plates measured 2.0–2.2 wide per height at any scale, so other shapes (cursors,
 * card labels) and retries wait behind first attempts on plate-shaped boxes instead of being rejected.
 */
export function popupPriority(box: PopupLabelBox, retry: boolean): number {
  const ratio = box.width / box.height
  return (ratio >= 1.8 && ratio <= 2.45 ? 2 : 0) + (retry ? 0 : 1)
}

/**
 * The pending frame of a popup is upgraded in place; one comparable frame at least 100ms later may wait as the only
 * retry, even while the first is still queued, so busy bursts still read two different frames of each popup.
 */
export function popupCaptureAction({ quality, at, queuedQuality, attempts, capturedQuality, capturedAt, maxAttempts = 2 }: {
  quality: number
  at: number
  queuedQuality: number | null
  attempts: number
  capturedQuality: number
  capturedAt: number
  /** Separate frames read per popup (each a new capture, never a copy of an earlier read). */
  maxAttempts?: number
}): 'skip' | 'replace' | 'enqueue' {
  if (queuedQuality !== null && quality > queuedQuality * 1.02) return 'replace'
  if (attempts === 0) return 'enqueue'
  if (attempts < maxAttempts && quality >= capturedQuality * 0.95 && at - capturedAt >= 100) return 'enqueue'
  return 'skip'
}
