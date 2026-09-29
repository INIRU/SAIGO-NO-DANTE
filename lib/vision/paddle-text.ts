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

/**
 * Overlapping grid cells over a frame, as in slicing-aided inference (SAHI): each cell is detected at its own zoom so
 * small UI text keeps more detector pixels than one downscaled full-frame pass. `overlap` is a fraction of a cell.
 */
export function tileGrid(width: number, height: number, grid: number, overlap = 0.15) {
  const cellWidth = width / grid, cellHeight = height / grid
  const padX = Math.round(cellWidth * overlap), padY = Math.round(cellHeight * overlap)
  const tiles: { x: number; y: number; width: number; height: number }[] = []
  for (let row = 0; row < grid; row++) for (let column = 0; column < grid; column++) {
    const x = Math.max(0, Math.round(column * cellWidth) - padX), y = Math.max(0, Math.round(row * cellHeight) - padY)
    tiles.push({ x, y, width: Math.min(width, Math.round((column + 1) * cellWidth) + padX) - x,
      height: Math.min(height, Math.round((row + 1) * cellHeight) + padY) - y })
  }
  return tiles
}

/**
 * Lines found per tile, in frame pixels, merged across tiles: a box from another tile that overlaps a line horizontally
 * and shares most of its height is the same line (an overlap duplicate or the other half of a line cut by a tile edge),
 * so the two become their union. Boxes from the same tile are never merged; the detector already separated them.
 */
export function mergeTileRects(tiles: TextRect[][]): TextRect[] {
  const merged: (TextRect & { tiles: Set<number> })[] = []
  tiles.forEach((rects, tile) => {
    for (const rect of rects) {
      const line = merged.find(other => {
        if (other.tiles.has(tile) || rect.x >= other.x + other.width || other.x >= rect.x + rect.width) return false
        const shared = Math.min(other.y + other.height, rect.y + rect.height) - Math.max(other.y, rect.y)
        return shared >= Math.min(other.height, rect.height) * 0.6
      })
      if (!line) { merged.push({ ...rect, tiles: new Set([tile]) }); continue }
      const right = Math.max(line.x + line.width, rect.x + rect.width), bottom = Math.max(line.y + line.height, rect.y + rect.height)
      line.x = Math.min(line.x, rect.x); line.y = Math.min(line.y, rect.y)
      line.width = right - line.x; line.height = bottom - line.y
      line.score = Math.max(line.score, rect.score)
      line.tiles.add(tile)
    }
  })
  return merged.map(({ tiles: _tiles, ...rect }) => rect)
    .sort((first, second) => Math.abs(first.y - second.y) < Math.min(first.height, second.height) / 2 ? first.x - second.x : first.y - second.y)
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

export interface LexiconEntry { id: string; name: string; labels: number[] }

/** Names as alphabet indices for lexicon decoding; a name with a character the model cannot output is left out. */
export function lexiconEntries(names: { id: string; name: string }[], alphabet: string[]): LexiconEntry[] {
  const index = new Map<string, number>()
  alphabet.forEach((character, position) => { if (position > 0 && !index.has(character)) index.set(character, position) })
  return names.flatMap(({ id, name }) => {
    const text = name.normalize('NFKC').trim()
    const labels = [...text].map(character => index.get(character) ?? -1)
    return text && labels.every(label => label > 0) ? [{ id, name: text, labels }] : []
  })
}

const logAdd = (left: number, right: number) => {
  if (left === -Infinity) return right
  if (right === -Infinity) return left
  const high = Math.max(left, right)
  return high + Math.log1p(Math.exp(-Math.abs(left - right)))
}

/** CTC log-likelihood of one label sequence (forward algorithm over the blank-extended sequence). */
function ctcLogLikelihood(logp: Float64Array, steps: number, classes: number, labels: number[]): number {
  const size = labels.length * 2 + 1
  let previous = new Float64Array(size).fill(-Infinity)
  let current = new Float64Array(size)
  previous[0] = logp[0]
  if (size > 1) previous[1] = logp[labels[0]]
  for (let step = 1; step < steps; step++) {
    const row = step * classes
    for (let state = 0; state < size; state++) {
      const label = state % 2 ? labels[(state - 1) / 2] : 0
      let value = previous[state]
      if (state > 0) value = logAdd(value, previous[state - 1])
      if (state > 1 && state % 2 && label !== labels[(state - 3) / 2]) value = logAdd(value, previous[state - 2])
      current[state] = value + logp[row + label]
    }
    ;[previous, current] = [current, previous]
  }
  return size > 1 ? logAdd(previous[size - 1], previous[size - 2]) : previous[0]
}

/**
 * The lexicon name one recognized line most likely spells: CTC probability of each whole name (lexicon-based
 * transcription, Shi et al., CRNN, TPAMI 2017). `margin` is its lead over the runner-up and `gap` its shortfall from the
 * greedy path, both in natural-log units; a line that is no lexicon name has a large gap.
 */
export function ctcLexiconBest(probabilities: Float32Array, index: number, steps: number, classes: number, entries: LexiconEntry[]) {
  const logp = new Float64Array(steps * classes)
  let greedy = 0
  for (let step = 0; step < steps; step++) {
    const offset = (index * steps + step) * classes
    let high = -Infinity
    for (let item = 0; item < classes; item++) {
      const value = Math.log(Math.max(probabilities[offset + item], 1e-12))
      logp[step * classes + item] = value
      if (value > high) high = value
    }
    greedy += high
  }
  let best: { entry: LexiconEntry; score: number } | null = null
  let second = -Infinity
  for (const entry of entries) {
    const score = ctcLogLikelihood(logp, steps, classes, entry.labels)
    if (!best || score > best.score) { second = best?.score ?? -Infinity; best = { entry, score } }
    else if (score > second) second = score
  }
  return best ? { id: best.entry.id, name: best.entry.name, margin: best.score - second, gap: greedy - best.score } : null
}

/**
 * Recognized lines on one row joined left to right, rows top to bottom. The detector often boxes words of a wide-spaced line apart, e.g. the
 * English banner "Exploring" | "Floor 3" (2026-09-28 gameplay video), so a phrase is tested on the joined row.
 */
export function joinRowLines<T extends { text: string; rect: TextRect }>(lines: T[]): { text: string; rect: TextRect }[] {
  const rows: { text: string; rect: TextRect }[] = []
  for (const line of [...lines].sort((first, second) => first.rect.x - second.rect.x)) {
    const middle = line.rect.y + line.rect.height / 2
    const row = rows.find(item => Math.abs(item.rect.y + item.rect.height / 2 - middle) < Math.max(item.rect.height, line.rect.height) * 0.4 &&
      line.rect.x - (item.rect.x + item.rect.width) < Math.max(item.rect.height, line.rect.height) * 1.5)
    if (!row) { rows.push({ text: line.text, rect: { ...line.rect } }); continue }
    const bottom = Math.max(row.rect.y + row.rect.height, line.rect.y + line.rect.height)
    row.text = `${row.text} ${line.text}`
    row.rect = { x: row.rect.x, y: Math.min(row.rect.y, line.rect.y), width: Math.max(row.rect.x + row.rect.width, line.rect.x + line.rect.width) - row.rect.x,
      height: 0, score: Math.min(row.rect.score, line.rect.score) }
    row.rect.height = bottom - row.rect.y
  }
  return rows.sort((first, second) => first.rect.y - second.rect.y)
}

/**
 * Waits before reloading the GPU OCR models after each failure. A GPU busy with the game can stall a run past its timeout
 * without being unusable, so a failure no longer leaves Tesseract reading the rest of the capture; after the last wait it
 * does. Models that ran PADDLE_STABLE_MS before failing count as recovered and the waits start over.
 */
export const PADDLE_RETRY_MS = [10_000, 45_000, 180_000]
export const PADDLE_STABLE_MS = 5 * 60_000

/** The wait before the next reload (null: no more) and the retries spent with it, for models loaded at `loadedAt` (null: none ran). */
export function paddleRetryDelay(spent: number, loadedAt: number | null, now: number): { delay: number | null; spent: number } {
  const used = loadedAt !== null && now - loadedAt >= PADDLE_STABLE_MS ? 0 : spent
  return used < PADDLE_RETRY_MS.length ? { delay: PADDLE_RETRY_MS[used], spent: used + 1 } : { delay: null, spent: used }
}
