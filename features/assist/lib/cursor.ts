/**
 * The game's mouse cursor in a captured frame. Limbus sets a hardware cursor (a gold nib, 64×64 with the hot spot at
 * 14,6; a brighter orange one while the button is down), so the game's own frames never hold it, but a screen share
 * draws it in. Where the cursor was is evidence when a quick click is over before its window is captured (which ? room
 * option was taken).
 *
 * Gold pixels are grouped into blobs; a blob of the cursor's proportions is compared with both pictures at its size by
 * normalised correlation of the colours under the picture (so a flat gold UI piece of the same outline scores low).
 */
export interface CursorTemplates { size: number; hot: [number, number]; off: Uint8Array; on: Uint8Array }
export interface CursorRead { x: number; y: number; pressed: boolean; score: number }

/** public/models/assist-scene/cursor.json: both pictures as base64 RGBA, `size` square. */
export function decodeCursorTemplates(value: unknown): CursorTemplates | null {
  const raw = value as { size?: unknown; hot?: unknown; off?: unknown; on?: unknown }
  if (typeof raw?.size !== 'number' || !Array.isArray(raw.hot) || typeof raw.off !== 'string' || typeof raw.on !== 'string') return null
  const bytes = (text: string) => Uint8Array.from(atob(text), char => char.charCodeAt(0))
  const off = bytes(raw.off), on = bytes(raw.on)
  if (off.length !== raw.size * raw.size * 4 || on.length !== off.length) return null
  return { size: raw.size, hot: [Number(raw.hot[0]), Number(raw.hot[1])], off, on }
}

/**
 * The cursor's gold and its shaded side: saturated, hue 18 to about 55 degrees (the nib measures 22 to 48). Paler UI gold
 * (borders, text) and the red-orange buttons the cursor often rests on (hue 7 to 8) fall outside, so they do not join its blob.
 */
function gold(r: number, g: number, b: number) {
  return r >= 120 && r - b >= 0.6 * r && g - b >= 0.3 * (r - b) && g <= 0.95 * r
}

interface Shape { x0: number; y0: number; w: number; h: number; pixels: [number, number, number][] }

/** The opaque part of a picture: its bounding box and pixel colours, relative to the box. */
function shape(rgba: Uint8Array, size: number): Shape {
  let x0 = size, y0 = size, x1 = -1, y1 = -1
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (rgba[(y * size + x) * 4 + 3] > 200) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
  }
  const pixels: [number, number, number][] = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (rgba[(y * size + x) * 4 + 3] > 200) pixels.push([x, y, (y * size + x) * 4])
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, pixels }
}

const shapes = new WeakMap<CursorTemplates, { off: Shape; on: Shape }>()

/** Correlation of the frame's colours under the picture placed with its opaque box's top-left at (bx, by), scaled by s. */
function correlate(frame: ArrayLike<number>, width: number, height: number, picture: Uint8Array, form: Shape, bx: number, by: number, s: number) {
  const n = form.pixels.length
  const a = new Float32Array(n * 3), b = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const [x, y, at] = form.pixels[i]
    const fx = Math.round(bx + (x - form.x0) * s), fy = Math.round(by + (y - form.y0) * s)
    if (fx < 0 || fy < 0 || fx >= width || fy >= height) return -1
    const f = (fy * width + fx) * 4
    for (let c = 0; c < 3; c++) { a[i * 3 + c] = picture[at + c]; b[i * 3 + c] = frame[f + c] }
  }
  let ma = 0, mb = 0
  for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i] }
  ma /= a.length; mb /= b.length
  let ab = 0, aa = 0, bb = 0
  for (let i = 0; i < a.length; i++) { const da = a[i] - ma, db = b[i] - mb; ab += da * db; aa += da * da; bb += db * db }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0
}

const CURSOR_MIN_SCORE = 0.85
const CURSOR_MIN_OVERLAP = 0.6

/** Intersection over union of blob `id` (its box x0, y0, w, h) and the picture's opaque part stretched over that box. */
function outline(blob: Int32Array, id: number, width: number, x0: number, y0: number, w: number, h: number, picture: Uint8Array, form: Shape) {
  let both = 0, either = 0
  const size = Math.round(Math.sqrt(picture.length / 4))
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = form.x0 + Math.min(form.w - 1, Math.floor(x * form.w / w)), py = form.y0 + Math.min(form.h - 1, Math.floor(y * form.h / h))
    const inPicture = picture[(py * size + px) * 4 + 3] > 200
    const inBlob = blob[(y0 + y) * width + x0 + x] === id
    if (inPicture && inBlob) both++
    if (inPicture || inBlob) either++
  }
  return either ? both / either : 0
}

/**
 * The cursor in an RGBA frame (any size; the cursor may be 16 to 128 px tall in it), or null. x, y is the hot spot in
 * the frame's pixels.
 */
export function findCursor(frame: ArrayLike<number>, width: number, height: number, templates: CursorTemplates): CursorRead | null {
  let forms = shapes.get(templates)
  if (!forms) { forms = { off: shape(templates.off, templates.size), on: shape(templates.on, templates.size) }; shapes.set(templates, forms) }
  // 0: not gold, -1: gold not yet in a blob, n > 0: in blob n
  const blob = new Int32Array(width * height)
  for (let i = 0, p = 0; i < blob.length; i++, p += 4) if (gold(frame[p], frame[p + 1], frame[p + 2])) blob[i] = -1
  const stack: number[] = []
  let best: CursorRead | null = null
  let id = 0
  for (let start = 0; start < blob.length; start++) {
    if (blob[start] !== -1) continue
    // one blob (4-connected)
    let x0 = width, y0 = height, x1 = -1, y1 = -1, count = 0
    blob[start] = ++id; stack.push(start)
    while (stack.length) {
      const i = stack.pop()!, x = i % width, y = (i - x) / width
      count++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      if (x > 0 && blob[i - 1] === -1) { blob[i - 1] = id; stack.push(i - 1) }
      if (x < width - 1 && blob[i + 1] === -1) { blob[i + 1] = id; stack.push(i + 1) }
      if (y > 0 && blob[i - width] === -1) { blob[i - width] = id; stack.push(i - width) }
      if (y < height - 1 && blob[i + width] === -1) { blob[i + width] = id; stack.push(i + width) }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1
    // the nib is about 0.55 as wide as tall and fills about half its box
    if (h < 9 || h > 130 || w < 0.35 * h || w > 0.85 * h || count < 0.25 * w * h || count > 0.75 * w * h) continue
    for (const [pressed, picture, form] of [[false, templates.off, forms.off], [true, templates.on, forms.on]] as const) {
      const base = h / form.h
      // the blob's outline must be the nib's: overlap with the picture's opaque part (orange art, hair and flames differ)
      if (outline(blob, id, width, x0, y0, w, h, picture, form) < CURSOR_MIN_OVERLAP) continue
      for (const k of [0.94, 1, 1.06]) for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
        const s = base * k
        const score = correlate(frame, width, height, picture, form, x0 + dx, y0 + dy, s)
        if (score >= CURSOR_MIN_SCORE && (!best || score > best.score))
          best = { x: x0 + dx + (templates.hot[0] - form.x0) * s, y: y0 + dy + (templates.hot[1] - form.y0) * s, pressed, score }
      }
    }
  }
  return best
}
