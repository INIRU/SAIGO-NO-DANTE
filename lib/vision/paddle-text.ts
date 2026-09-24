/**
 * Pre- and post-processing for PP-OCRv5 mobile text detection and korean_PP-OCRv5_mobile_rec, following PaddleX's
 * DetResizeForTest, NormalizeImage, DBPostProcess (thresh 0.3, box_thresh 0.6, unclip 1.5), OCRReisizeNormImg and
 * CTCLabelDecode. Boxes are axis-aligned because game UI text is horizontal.
 */

export interface TextRect { x: number; y: number; width: number; height: number; score: number }

export const REC_HEIGHT = 48
const REC_MIN_WIDTH = 320
const REC_MAX_WIDTH = 3200
const DET_MEAN = [0.485, 0.456, 0.406]
const DET_STD = [0.229, 0.224, 0.225]

/** Detector input size: limited on the long ('max') or short ('min') side, rounded to multiples of 32. */
export function detSize(width: number, height: number, limit: number, type: 'max' | 'min') {
  let ratio = 1
  if (type === 'max') { if (Math.max(width, height) > limit) ratio = limit / Math.max(width, height) }
  else if (Math.min(width, height) < limit) ratio = limit / Math.min(width, height)
  return { width: Math.max(Math.round(width * ratio / 32) * 32, 32), height: Math.max(Math.round(height * ratio / 32) * 32, 32) }
}

/** RGBA pixels to the detector's CHW tensor. PaddleX decodes BGR and applies the mean/std list in that channel order. */
export function detTensor(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const plane = width * height
  const out = new Float32Array(3 * plane)
  for (let pixel = 0; pixel < plane; pixel++) {
    const at = pixel * 4
    out[pixel] = (rgba[at + 2] / 255 - DET_MEAN[0]) / DET_STD[0]
    out[plane + pixel] = (rgba[at + 1] / 255 - DET_MEAN[1]) / DET_STD[1]
    out[2 * plane + pixel] = (rgba[at] / 255 - DET_MEAN[2]) / DET_STD[2]
  }
  return out
}

/**
 * Text lines from the detector probability map, in source pixels: connected regions above 0.3 whose mean probability
 * reaches 0.6, grown by the DB unclip distance, sorted top-to-bottom then left-to-right within a row.
 */
export function textRects(prob: Float32Array, mapWidth: number, mapHeight: number, sourceWidth: number, sourceHeight: number,
  limit = Infinity): TextRect[] {
  const scaleX = sourceWidth / mapWidth, scaleY = sourceHeight / mapHeight
  const seen = new Uint8Array(mapWidth * mapHeight)
  const stack = new Int32Array(mapWidth * mapHeight)
  const rects: TextRect[] = []
  for (let start = 0; start < prob.length; start++) {
    if (seen[start] || prob[start] <= 0.3) continue
    let top = 0
    stack[top++] = start
    seen[start] = 1
    let x0 = mapWidth, y0 = mapHeight, x1 = -1, y1 = -1
    while (top) {
      const at = stack[--top]
      const y = (at / mapWidth) | 0, x = at - y * mapWidth
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= mapWidth || ny >= mapHeight) continue
        const next = ny * mapWidth + nx
        if (!seen[next] && prob[next] > 0.3) { seen[next] = 1; stack[top++] = next }
      }
    }
    const boxWidth = x1 - x0, boxHeight = y1 - y0
    if (Math.min(boxWidth, boxHeight) < 3) continue
    let sum = 0
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) sum += prob[y * mapWidth + x]
    const score = sum / ((boxWidth + 1) * (boxHeight + 1))
    if (score < 0.6) continue
    const grow = boxWidth * boxHeight * 1.5 / (2 * (boxWidth + boxHeight))
    if (Math.min(boxWidth, boxHeight) + 2 * grow < 5) continue
    const clampX = (value: number) => Math.max(0, Math.min(sourceWidth, Math.round(value * scaleX)))
    const clampY = (value: number) => Math.max(0, Math.min(sourceHeight, Math.round(value * scaleY)))
    const left = clampX(x0 - grow), right = clampX(x1 + grow), upper = clampY(y0 - grow), lower = clampY(y1 + grow)
    if (right - left < 2 || lower - upper < 2) continue
    rects.push({ x: left, y: upper, width: right - left, height: lower - upper, score })
  }
  rects.sort((first, second) => first.y - second.y || first.x - second.x)
  for (let index = 0; index < rects.length - 1; index++) {
    for (let at = index; at >= 0; at--) {
      if (Math.abs(rects[at + 1].y - rects[at].y) < 10 && rects[at + 1].x < rects[at].x) {
        const swap = rects[at]; rects[at] = rects[at + 1]; rects[at + 1] = swap
      } else break
    }
  }
  return rects.slice(0, limit)
}

/** Shared tensor width for a batch of lines (the widest aspect ratio, at least the model's 320). */
export function recBatchWidth(rects: { width: number; height: number }[]): number {
  const ratio = Math.max(REC_MIN_WIDTH / REC_HEIGHT, ...rects.map(rect => rect.width / Math.max(1, rect.height)))
  return Math.min(REC_MAX_WIDTH, Math.floor(REC_HEIGHT * ratio))
}

/** Resized width of one line inside a batch of width `batchWidth`. */
export function recLineWidth(rect: { width: number; height: number }, batchWidth: number): number {
  return Math.max(1, Math.min(batchWidth, Math.ceil(REC_HEIGHT * rect.width / Math.max(1, rect.height))))
}

/** Writes one resized line (RGBA, lineWidth x 48) into slot `index` of a zero-padded BGR batch tensor, scaled to [-1, 1]. */
export function fillRecLine(tensor: Float32Array, index: number, batchWidth: number, rgba: Uint8ClampedArray, lineWidth: number) {
  const plane = REC_HEIGHT * batchWidth
  const base = index * 3 * plane
  for (let y = 0; y < REC_HEIGHT; y++) for (let x = 0; x < lineWidth; x++) {
    const at = (y * lineWidth + x) * 4, to = y * batchWidth + x
    tensor[base + to] = rgba[at + 2] / 127.5 - 1
    tensor[base + plane + to] = rgba[at + 1] / 127.5 - 1
    tensor[base + 2 * plane + to] = rgba[at] / 127.5 - 1
  }
}

/** Greedy CTC decoding: argmax per step, repeats merged, blank (0) dropped; score is the mean kept probability. */
export function ctcDecode(logits: Float32Array, index: number, steps: number, classes: number, characters: string[]) {
  let text = ''
  let previous = -1
  let total = 0
  let kept = 0
  for (let step = 0; step < steps; step++) {
    const offset = (index * steps + step) * classes
    let best = 0
    let value = -Infinity
    for (let item = 0; item < classes; item++) if (logits[offset + item] > value) { value = logits[offset + item]; best = item }
    if (best !== 0 && best !== previous && best < characters.length) { text += characters[best]; total += value; kept++ }
    previous = best
  }
  return { text, score: kept ? total / kept : 0 }
}

/** Decoder alphabet: blank, the model dictionary, then the space character (use_space_char). */
export function recAlphabet(dictionary: unknown): string[] {
  if (!Array.isArray(dictionary) || !dictionary.length || !dictionary.every(item => typeof item === 'string')) {
    throw new Error('Invalid OCR dictionary')
  }
  return ['', ...dictionary, ' ']
}
